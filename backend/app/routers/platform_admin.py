from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database.mongodb import database
from app.routers.auth import get_current_user
from app.schemas.payment import ManualSubscriptionUpdate
from app.services.business_service import (
    activate_business_for_days,
    set_business_enabled,
    set_business_subscription_status,
)


router = APIRouter(
    prefix="/api/platform-admin",
    tags=["Platform Admin"],
)


async def require_superadmin(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    if current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tavora owner access is required.",
        )

    return current_user


def serialize_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def serialize_business(business: dict) -> dict:
    return {
        "id": str(business["_id"]),
        "name": business.get("name", ""),
        "owner_name": business.get("owner_name", ""),
        "email": business.get("email", ""),
        "phone": business.get("phone"),
        "country": business.get("country"),
        "is_active": business.get("is_active", True),
        "subscription_plan": business.get("subscription_plan", "none"),
        "subscription_status": business.get("subscription_status", "inactive"),
        "subscription_started_at": serialize_datetime(
            business.get("subscription_started_at")
        ),
        "subscription_expires_at": serialize_datetime(
            business.get("subscription_expires_at")
        ),
        "payment_provider": business.get("payment_provider"),
        "created_at": serialize_datetime(business.get("created_at")),
        "updated_at": serialize_datetime(business.get("updated_at")),
    }


def serialize_payment(payment: dict, business_name: str | None = None) -> dict:
    amount_minor = int(payment.get("amount_minor", 0))
    return {
        "id": str(payment["_id"]),
        "business_id": str(payment.get("business_id")),
        "business_name": business_name,
        "amount_minor": amount_minor,
        "amount": round(amount_minor / 100, 2),
        "currency": payment.get("currency", "EUR"),
        "plan": payment.get("plan"),
        "provider": payment.get("provider"),
        "provider_payment_id": payment.get("provider_payment_id"),
        "status": payment.get("status"),
        "created_at": serialize_datetime(payment.get("created_at")),
        "updated_at": serialize_datetime(payment.get("updated_at")),
        "paid_at": serialize_datetime(payment.get("paid_at")),
    }


def validate_business_id(business_id: str) -> ObjectId:
    if not ObjectId.is_valid(business_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid business ID.",
        )
    return ObjectId(business_id)


@router.get("/dashboard")
async def get_platform_dashboard(
    _: Annotated[dict, Depends(require_superadmin)],
):
    now = datetime.now(timezone.utc)

    total_businesses = await database["businesses"].count_documents({})
    enabled_businesses = await database["businesses"].count_documents(
        {"is_active": {"$ne": False}}
    )
    active_subscriptions = await database["businesses"].count_documents(
        {
            "subscription_status": "active",
            "subscription_expires_at": {"$gt": now},
        }
    )
    paid_payments_count = await database["payments"].count_documents(
        {"status": "paid"}
    )

    revenue_by_currency = []

    pipeline = [
        {"$match": {"status": "paid"}},
        {
            "$group": {
                "_id": "$currency",
                "total_minor": {"$sum": "$amount_minor"},
                "payments": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    async for item in database["payments"].aggregate(pipeline):
        total_minor = int(item.get("total_minor", 0))
        revenue_by_currency.append(
            {
                "currency": item.get("_id") or "EUR",
                "total_minor": total_minor,
                "total": round(total_minor / 100, 2),
                "payments": int(item.get("payments", 0)),
            }
        )

    complimentary_count = await database["orders"].count_documents(
        {"payment_method": "complimentary"}
    )

    return {
        "total_businesses": total_businesses,
        "enabled_businesses": enabled_businesses,
        "active_subscriptions": active_subscriptions,
        "expired_or_unpaid": max(total_businesses - active_subscriptions, 0),
        "paid_payments_count": paid_payments_count,
        "complimentary_orders_count": complimentary_count,
        "revenue_by_currency": revenue_by_currency,
    }


@router.get("/businesses")
async def get_platform_businesses(
    _: Annotated[dict, Depends(require_superadmin)],
    search: str | None = Query(default=None),
    subscription_status: str | None = Query(default=None),
):
    query: dict = {}

    if subscription_status:
        query["subscription_status"] = subscription_status

    if search and search.strip():
        value = search.strip()
        query["$or"] = [
            {"name": {"$regex": value, "$options": "i"}},
            {"owner_name": {"$regex": value, "$options": "i"}},
            {"email": {"$regex": value, "$options": "i"}},
        ]

    result = []

    cursor = database["businesses"].find(query).sort("created_at", -1)

    async for business in cursor:
        item = serialize_business(business)
        item["users_count"] = await database["users"].count_documents(
            {"business_id": business["_id"]}
        )

        latest_payment = await database["payments"].find_one(
            {"business_id": business["_id"]},
            sort=[("created_at", -1)],
        )

        item["latest_payment"] = (
            serialize_payment(latest_payment, business.get("name"))
            if latest_payment
            else None
        )

        result.append(item)

    return result


@router.get("/businesses/{business_id}")
async def get_platform_business(
    business_id: str,
    _: Annotated[dict, Depends(require_superadmin)],
):
    object_id = validate_business_id(business_id)

    business = await database["businesses"].find_one({"_id": object_id})

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    result = serialize_business(business)
    result["users"] = [
        {
            "id": str(user["_id"]),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "is_active": user.get("is_active", True),
        }
        async for user in database["users"].find(
            {"business_id": object_id}
        ).sort("created_at", 1)
    ]

    return result


@router.get("/payments")
async def get_platform_payments(
    _: Annotated[dict, Depends(require_superadmin)],
    limit: int = Query(default=100, ge=1, le=500),
):
    payments = await database["payments"].find({}).sort(
        "created_at", -1
    ).limit(limit).to_list(length=limit)

    business_ids = {
        payment.get("business_id")
        for payment in payments
        if payment.get("business_id")
    }

    businesses = await database["businesses"].find(
        {"_id": {"$in": list(business_ids)}}
    ).to_list(length=None)

    names = {
        business["_id"]: business.get("name")
        for business in businesses
    }

    return [
        serialize_payment(
            payment,
            names.get(payment.get("business_id")),
        )
        for payment in payments
    ]


@router.patch("/businesses/{business_id}/enabled")
async def update_business_enabled(
    business_id: str,
    enabled: bool,
    current_user: Annotated[dict, Depends(require_superadmin)],
):
    validate_business_id(business_id)

    business = await set_business_enabled(business_id, enabled)

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    await database["audit_logs"].insert_one(
        {
            "type": "platform_business_enabled_changed",
            "business_id": ObjectId(business_id),
            "enabled": enabled,
            "performed_by_user_id": current_user["id"],
            "performed_by_name": current_user["name"],
            "created_at": datetime.now(timezone.utc),
        }
    )

    return business


@router.post("/businesses/{business_id}/activate")
async def activate_business_manually(
    business_id: str,
    data: ManualSubscriptionUpdate,
    current_user: Annotated[dict, Depends(require_superadmin)],
):
    validate_business_id(business_id)

    business = await activate_business_for_days(
        business_id=business_id,
        plan=data.plan,
        payment_provider="owner_manual",
        duration_days=data.duration_days,
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    await database["audit_logs"].insert_one(
        {
            "type": "platform_subscription_manual_activation",
            "business_id": ObjectId(business_id),
            "plan": data.plan,
            "duration_days": data.duration_days,
            "note": data.note,
            "performed_by_user_id": current_user["id"],
            "performed_by_name": current_user["name"],
            "created_at": datetime.now(timezone.utc),
        }
    )

    return business


@router.patch("/businesses/{business_id}/subscription-status")
async def update_subscription_status(
    business_id: str,
    subscription_status: str,
    current_user: Annotated[dict, Depends(require_superadmin)],
):
    if subscription_status not in {"active", "inactive", "past_due", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subscription status.",
        )

    validate_business_id(business_id)

    business = await set_business_subscription_status(
        business_id,
        subscription_status,
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    await database["audit_logs"].insert_one(
        {
            "type": "platform_subscription_status_changed",
            "business_id": ObjectId(business_id),
            "subscription_status": subscription_status,
            "performed_by_user_id": current_user["id"],
            "performed_by_name": current_user["name"],
            "created_at": datetime.now(timezone.utc),
        }
    )

    return business


@router.get("/audit")
async def get_platform_audit(
    _: Annotated[dict, Depends(require_superadmin)],
    business_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    query: dict = {}

    if business_id:
        query["business_id"] = validate_business_id(business_id)

    logs = await database["audit_logs"].find(query).sort(
        "created_at", -1
    ).limit(limit).to_list(length=limit)

    result = []

    for log in logs:
        item = {
            key: serialize_datetime(value)
            if isinstance(value, datetime)
            else str(value)
            if isinstance(value, ObjectId)
            else value
            for key, value in log.items()
            if key != "_id"
        }
        item["id"] = str(log["_id"])
        result.append(item)

    return result
