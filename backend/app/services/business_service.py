from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId

from app.database.mongodb import database
from app.schemas.business import BusinessSignup
from app.services.business_setup import safe_ensure_business_setup
from app.schemas.user import UserCreate
from app.services.auth_service import create_user, get_user_document_by_email


businesses_collection = database["businesses"]


def serialize_business(business: dict[str, Any]) -> dict[str, Any]:
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
        "subscription_started_at": business.get("subscription_started_at"),
        "subscription_expires_at": business.get("subscription_expires_at"),
        "payment_provider": business.get("payment_provider"),
        "created_at": business.get("created_at"),
        "updated_at": business.get("updated_at"),
    }


async def create_business_account(
    signup_data: BusinessSignup,
) -> tuple[dict[str, Any], dict[str, Any]]:
    normalized_email = str(signup_data.email).strip().lower()

    if await get_user_document_by_email(normalized_email):
        raise ValueError("A user with this email already exists.")

    if await businesses_collection.find_one({"email": normalized_email}):
        raise ValueError("A business with this email already exists.")

    now = datetime.now(timezone.utc)
    business_id = ObjectId()

    business_document = {
        "_id": business_id,
        "name": signup_data.business_name.strip(),
        "owner_name": signup_data.owner_name.strip(),
        "email": normalized_email,
        "phone": signup_data.phone.strip() if signup_data.phone else None,
        "country": signup_data.country.strip() if signup_data.country else None,
        "is_active": True,
        "subscription_plan": "none",
        "subscription_status": "inactive",
        "subscription_started_at": None,
        "subscription_expires_at": None,
        "payment_provider": None,
        "created_at": now,
        "updated_at": now,
    }

    await businesses_collection.insert_one(business_document)

    admin_data = UserCreate(
        name=signup_data.owner_name,
        email=normalized_email,
        password=signup_data.password,
        pin=signup_data.pin,
        business_name=signup_data.business_name,
        role="admin",
    )

    try:
        user = await create_user(admin_data, business_id=business_id)
    except Exception:
        await businesses_collection.delete_one({"_id": business_id})
        raise

    # Default tables + menu (stock 0) so the business can start right away.
    await safe_ensure_business_setup(business_id)

    return serialize_business(business_document), user


async def get_business_by_id(business_id: str) -> dict[str, Any] | None:
    if not ObjectId.is_valid(business_id):
        return None

    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})

    return serialize_business(business) if business else None


async def activate_business_subscription(
    business_id: str,
    plan: str,
    payment_provider: str,
    expires_at: datetime,
    billing_cycle: str = "manual",
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(business_id):
        return None

    now = datetime.now(timezone.utc)

    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {
            "$set": {
                "subscription_plan": plan,
                "subscription_status": "active",
                "subscription_started_at": now,
                "subscription_expires_at": expires_at,
                "subscription_billing_cycle": billing_cycle,
                "payment_provider": payment_provider,
                "updated_at": now,
            }
        },
    )

    if result.matched_count == 0:
        return None

    return await get_business_by_id(business_id)


async def activate_business_for_days(
    business_id: str,
    plan: str,
    payment_provider: str,
    duration_days: int,
    billing_cycle: str = "manual",
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    current = await get_business_by_id(business_id)

    if not current:
        return None

    current_expiry = current.get("subscription_expires_at")

    if current_expiry and current_expiry.tzinfo is None:
        current_expiry = current_expiry.replace(tzinfo=timezone.utc)

    starts_from = (
        current_expiry
        if current.get("subscription_status") == "active"
        and current_expiry
        and current_expiry > now
        else now
    )

    return await activate_business_subscription(
        business_id=business_id,
        plan=plan,
        payment_provider=payment_provider,
        expires_at=starts_from + timedelta(days=duration_days),
    billing_cycle=billing_cycle,
    )


async def set_business_enabled(
    business_id: str,
    enabled: bool,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(business_id):
        return None

    now = datetime.now(timezone.utc)

    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": {"is_active": enabled, "updated_at": now}},
    )

    if result.matched_count == 0:
        return None

    return await get_business_by_id(business_id)


async def set_business_subscription_status(
    business_id: str,
    status_value: str,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(business_id):
        return None

    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {
            "$set": {
                "subscription_status": status_value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        return None

    return await get_business_by_id(business_id)
