import os
from datetime import datetime, timezone
from typing import Any

import httpx
from bson import ObjectId

from app.core.config import settings
from app.core.subscription_plans import SUBSCRIPTION_PLANS
from app.database.mongodb import database
from app.services.business_service import activate_business_for_days


payments_collection = database["payments"]


def serialize_payment(payment: dict[str, Any]) -> dict[str, Any]:
    amount_minor = int(payment.get("amount_minor", 0))

    return {
        "id": str(payment["_id"]),
        "business_id": str(payment["business_id"]),
        "amount_minor": amount_minor,
        "amount": round(amount_minor / 100, 2),
        "currency": payment.get("currency", "EUR"),
        "plan": payment.get("plan", ""),
        "billing_cycle": payment.get(
            "billing_cycle",
            "monthly",
        ),
        "duration_days": int(
            payment.get("duration_days", 30)
        ),
        "provider": payment.get("provider", ""),
        "provider_payment_id": payment.get("provider_payment_id"),
        "checkout_url": payment.get("checkout_url"),
        "status": payment.get("status", "pending"),
        "created_at": payment.get("created_at"),
        "updated_at": payment.get("updated_at"),
        "paid_at": payment.get("paid_at"),
    }


async def create_payment(
    business_id: str,
    plan_id: str,
    provider: str,
    billing_cycle: str = "monthly",
) -> dict[str, Any]:
    if not ObjectId.is_valid(business_id):
        raise ValueError("Invalid business ID.")

    plan = SUBSCRIPTION_PLANS.get(plan_id)

    if not plan:
        raise ValueError("Unknown subscription plan.")

    if billing_cycle not in {"monthly", "yearly"}:
        raise ValueError("Unknown billing cycle.")

    is_yearly = billing_cycle == "yearly"

    amount_minor = int(
        plan["yearly_price_minor"]
        if is_yearly
        else plan["price_minor"]
    )

    duration_days = int(
        plan["yearly_duration_days"]
        if is_yearly
        else plan["duration_days"]
    )

    now = datetime.now(timezone.utc)

    payment = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "amount_minor": amount_minor,
        "currency": plan["currency"],
        "plan": plan_id,
        "billing_cycle": billing_cycle,
        "duration_days": duration_days,
        "provider": provider,
        "provider_payment_id": None,
        "checkout_url": None,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "paid_at": None,
    }

    await payments_collection.insert_one(payment)

    if provider == "paddle":
        try:
            paddle_data = await create_paddle_transaction(payment)
        except Exception as error:
            await payments_collection.update_one(
                {"_id": payment["_id"]},
                {
                    "$set": {
                        "status": "configuration_required",
                        "provider_error": str(error),
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

            stored = await payments_collection.find_one({"_id": payment["_id"]})
            result = serialize_payment(stored)
            result["configuration_error"] = str(error)
            return result

        await payments_collection.update_one(
            {"_id": payment["_id"]},
            {
                "$set": {
                    "provider_payment_id": paddle_data.get("id"),
                    "checkout_url": (paddle_data.get("checkout") or {}).get("url"),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    stored = await payments_collection.find_one({"_id": payment["_id"]})
    return serialize_payment(stored)


async def create_paddle_transaction(payment: dict[str, Any]) -> dict[str, Any]:
    api_key = settings.paddle_api_key
    environment = (settings.paddle_environment or "sandbox").lower()

    if not api_key:
        raise RuntimeError("PADDLE_API_KEY is not configured.")

    plan_key = str(payment["plan"]).upper()
    billing_cycle = payment.get(
        "billing_cycle",
        "monthly",
    )

    price_env_name = (
        f"PADDLE_PRICE_ID_{plan_key}_"
        f"{'YEARLY' if billing_cycle == 'yearly' else 'MONTHLY'}"
    )

    price_map = {
        ("STARTER", "monthly"):
            settings.paddle_price_id_starter_monthly,
        ("STARTER", "yearly"):
            settings.paddle_price_id_starter_yearly,
        ("STANDARD", "monthly"):
            settings.paddle_price_id_standard_monthly,
        ("STANDARD", "yearly"):
            settings.paddle_price_id_standard_yearly,
        ("PRO", "monthly"):
            settings.paddle_price_id_pro_monthly,
        ("PRO", "yearly"):
            settings.paddle_price_id_pro_yearly,
    }

    price_id = price_map.get((plan_key, billing_cycle))

    if not price_id:
        raise RuntimeError(
            f"{price_env_name} is not configured."
        )

    base_url = (
        "https://sandbox-api.paddle.com"
        if environment == "sandbox"
        else "https://api.paddle.com"
    )

    payload: dict[str, Any] = {
        "items": [
            {
                "price_id": price_id,
                "quantity": 1,
            }
        ],
        "collection_mode": "automatic",
        "custom_data": {
            "tavora_business_id": str(payment["business_id"]),
            "tavora_plan": payment["plan"],
            "tavora_billing_cycle": payment.get(
                "billing_cycle",
                "monthly",
            ),
            "tavora_payment_id": str(payment["_id"]),
        },
    }

    checkout_base_url = settings.paddle_checkout_base_url

    if checkout_base_url:
        payload["checkout"] = {"url": checkout_base_url}

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{base_url}/transactions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Paddle-Version": "1",
            },
            json=payload,
        )

    if response.status_code >= 400:
        try:
            detail = response.json()
        except Exception:
            detail = response.text

        raise RuntimeError(
            f"Paddle transaction creation failed ({response.status_code}): {detail}"
        )

    body = response.json()
    return body.get("data", body)


async def get_payment_by_id(
    payment_id: str,
    business_id: str | None = None,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(payment_id):
        return None

    query: dict[str, Any] = {"_id": ObjectId(payment_id)}

    if business_id:
        if not ObjectId.is_valid(business_id):
            return None
        query["business_id"] = ObjectId(business_id)

    payment = await payments_collection.find_one(query)

    return serialize_payment(payment) if payment else None


async def complete_payment(
    payment_id: str,
    provider_payment_id: str | None = None,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(payment_id):
        return None

    payment = await payments_collection.find_one({"_id": ObjectId(payment_id)})

    if not payment:
        return None

    if payment.get("status") == "paid":
        return serialize_payment(payment)

    plan = SUBSCRIPTION_PLANS.get(payment.get("plan"))

    if not plan:
        raise ValueError("Payment references an unknown subscription plan.")

    now = datetime.now(timezone.utc)

    await payments_collection.update_one(
        {"_id": payment["_id"]},
        {
            "$set": {
                "status": "paid",
                "provider_payment_id": (
                    provider_payment_id
                    or payment.get("provider_payment_id")
                ),
                "paid_at": now,
                "updated_at": now,
            }
        },
    )

    await activate_business_for_days(
        business_id=str(payment["business_id"]),
        plan=payment["plan"],
        payment_provider=payment["provider"],
        duration_days=int(
            payment.get(
                "duration_days",
                plan["duration_days"],
            )
        ),
        billing_cycle=payment.get(
            "billing_cycle",
            "monthly",
        ),
    )

    payment = await payments_collection.find_one({"_id": payment["_id"]})
    return serialize_payment(payment)


async def complete_payment_from_paddle(
    transaction_data: dict[str, Any],
) -> dict[str, Any] | None:
    custom_data = transaction_data.get("custom_data") or {}
    payment_id = custom_data.get("tavora_payment_id")

    if not payment_id:
        provider_id = transaction_data.get("id")

        if not provider_id:
            return None

        payment = await payments_collection.find_one(
            {"provider_payment_id": provider_id}
        )

        if not payment:
            return None

        payment_id = str(payment["_id"])

    return await complete_payment(
        payment_id=payment_id,
        provider_payment_id=transaction_data.get("id"),
    )
