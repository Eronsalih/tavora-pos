from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.security import hash_password, verify_password
from app.database.mongodb import database
from app.schemas.user import UserCreate


users_collection = database["users"]


def serialize_user(
    user: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "business_id": (
            str(user["business_id"])
            if user.get("business_id")
            else None
        ),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }


def normalize_business_id(
    business_id: ObjectId | str | None,
) -> ObjectId | None:
    if business_id is None:
        return None

    if isinstance(business_id, ObjectId):
        return business_id

    if not ObjectId.is_valid(str(business_id)):
        return None

    return ObjectId(str(business_id))


async def create_users_indexes() -> None:
    await users_collection.create_index(
        "email",
        unique=True,
        name="unique_user_email",
    )


async def get_user_document_by_email(
    email: str,
) -> dict[str, Any] | None:
    normalized_email = email.strip().lower()

    return await users_collection.find_one(
        {
            "email": normalized_email,
        }
    )


async def get_user_document_by_id(
    user_id: str,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(user_id):
        return None

    return await users_collection.find_one(
        {
            "_id": ObjectId(user_id),
        }
    )


async def get_user_by_email(
    email: str,
) -> dict[str, Any] | None:
    user = await get_user_document_by_email(email)

    if not user:
        return None

    return serialize_user(user)


async def get_user_by_id(
    user_id: str,
) -> dict[str, Any] | None:
    user = await get_user_document_by_id(user_id)

    if not user:
        return None

    return serialize_user(user)


async def create_user(
    user_data: UserCreate,
    business_id: ObjectId | str | None = None,
) -> dict[str, Any]:
    normalized_email = str(
        user_data.email
    ).strip().lower()

    existing_user = await get_user_document_by_email(
        normalized_email,
    )

    if existing_user:
        raise ValueError(
            "A user with this email already exists.",
        )

    normalized_business_id = normalize_business_id(
        business_id
    )

    if business_id is not None and normalized_business_id is None:
        raise ValueError(
            "Invalid business ID.",
        )

    now = datetime.now(timezone.utc)

    user_document: dict[str, Any] = {
        "name": user_data.name.strip(),
        "email": normalized_email,
        "hashed_password": hash_password(
            user_data.password,
        ),
        "role": user_data.role.value,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    if normalized_business_id is not None:
        user_document["business_id"] = normalized_business_id

    if user_data.business_name:
        user_document["business_name"] = (
            user_data.business_name.strip()
        )

    if user_data.pin:
        user_document["hashed_pin"] = hash_password(
            user_data.pin,
        )

    try:
        result = await users_collection.insert_one(
            user_document,
        )
    except DuplicateKeyError as error:
        raise ValueError(
            "A user with this email already exists.",
        ) from error

    created_user = await users_collection.find_one(
        {
            "_id": result.inserted_id,
        }
    )

    if not created_user:
        raise RuntimeError(
            "User was created but could not be loaded.",
        )

    return serialize_user(created_user)


async def create_platform_superadmin(
    name: str,
    email: str,
    password: str,
) -> dict[str, Any]:
    normalized_email = email.strip().lower()

    existing_user = await get_user_document_by_email(
        normalized_email
    )

    if existing_user:
        raise ValueError(
            "A user with this email already exists."
        )

    now = datetime.now(timezone.utc)

    user_document = {
        "name": name.strip(),
        "email": normalized_email,
        "hashed_password": hash_password(password),
        "role": "superadmin",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await users_collection.insert_one(
            user_document
        )
    except DuplicateKeyError as error:
        raise ValueError(
            "A user with this email already exists."
        ) from error

    created_user = await users_collection.find_one(
        {
            "_id": result.inserted_id,
        }
    )

    if not created_user:
        raise RuntimeError(
            "Superadmin was created but could not be loaded."
        )

    return serialize_user(created_user)


async def authenticate_user(
    email: str,
    password: str,
) -> dict[str, Any] | None:
    user = await get_user_document_by_email(email)

    if not user:
        return None

    if not user.get("is_active", True):
        return None

    hashed_password = user.get("hashed_password")

    if not hashed_password:
        return None

    if not verify_password(
        password,
        hashed_password,
    ):
        return None

    return serialize_user(user)


async def authenticate_user_by_pin(
    pin: str,
    business_id: str,
) -> dict[str, Any] | None:
    business_object_id = normalize_business_id(
        business_id
    )

    if business_object_id is None:
        return None

    cursor = users_collection.find(
        {
            "business_id": business_object_id,
            "is_active": True,
            "role": {
                "$in": [
                    "admin",
                    "cashier",
                    "waiter",
                ],
            },
            "hashed_pin": {
                "$exists": True,
            },
        }
    )

    async for user in cursor:
        hashed_pin = user.get("hashed_pin")

        if not hashed_pin:
            continue

        if verify_password(
            pin,
            hashed_pin,
        ):
            return serialize_user(user)

    return None


async def set_user_pin(
    user_id: str,
    pin: str,
    business_id: str,
) -> dict[str, Any] | None:
    if not ObjectId.is_valid(user_id):
        return None

    business_object_id = normalize_business_id(
        business_id
    )

    if business_object_id is None:
        return None

    now = datetime.now(timezone.utc)

    result = await users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "business_id": business_object_id,
        },
        {
            "$set": {
                "hashed_pin": hash_password(pin),
                "updated_at": now,
            },
        },
    )

    if result.matched_count == 0:
        return None

    updated_user = await users_collection.find_one(
        {
            "_id": ObjectId(user_id),
            "business_id": business_object_id,
        }
    )

    if not updated_user:
        return None

    return serialize_user(updated_user)


async def create_admin(
    name: str,
    email: str,
    password: str,
    pin: str | None = None,
    business_name: str | None = None,
    business_id: ObjectId | str | None = None,
) -> dict[str, Any]:
    admin_data = UserCreate(
        name=name,
        email=email,
        password=password,
        pin=pin,
        business_name=business_name,
        role="admin",
    )

    return await create_user(
        admin_data,
        business_id=business_id,
    )


async def get_users(
    business_id: str | None,
) -> list[dict]:
    business_object_id = normalize_business_id(
        business_id
    )

    if business_object_id is None:
        return []

    users = []

    cursor = users_collection.find(
        {
            "business_id": business_object_id,
        }
    ).sort(
        "created_at",
        -1,
    )

    async for user in cursor:
        users.append(
            serialize_user(user)
        )

    return users


async def update_user(
    user_id: str,
    user_data,
    business_id: str,
) -> dict | None:
    if not ObjectId.is_valid(user_id):
        return None

    business_object_id = normalize_business_id(
        business_id
    )

    if business_object_id is None:
        return None

    object_id = ObjectId(user_id)

    existing_user = await users_collection.find_one(
        {
            "_id": object_id,
            "business_id": business_object_id,
        }
    )

    if not existing_user:
        return None

    normalized_email = str(
        user_data.email
    ).strip().lower()

    duplicate_user = await users_collection.find_one(
        {
            "email": normalized_email,
            "_id": {
                "$ne": object_id,
            },
        }
    )

    if duplicate_user:
        raise ValueError(
            "A user with this email already exists."
        )

    await users_collection.update_one(
        {
            "_id": object_id,
            "business_id": business_object_id,
        },
        {
            "$set": {
                "name": user_data.name.strip(),
                "email": normalized_email,
                "role": user_data.role.value,
                "updated_at": datetime.now(
                    timezone.utc
                ),
            }
        },
    )

    updated_user = await users_collection.find_one(
        {
            "_id": object_id,
            "business_id": business_object_id,
        }
    )

    if not updated_user:
        return None

    return serialize_user(updated_user)


async def set_user_status(
    user_id: str,
    is_active: bool,
    business_id: str,
) -> dict | None:
    if not ObjectId.is_valid(user_id):
        return None

    business_object_id = normalize_business_id(
        business_id
    )

    if business_object_id is None:
        return None

    object_id = ObjectId(user_id)

    result = await users_collection.update_one(
        {
            "_id": object_id,
            "business_id": business_object_id,
        },
        {
            "$set": {
                "is_active": is_active,
                "updated_at": datetime.now(
                    timezone.utc
                ),
            }
        },
    )

    if result.matched_count == 0:
        return None

    updated_user = await users_collection.find_one(
        {
            "_id": object_id,
            "business_id": business_object_id,
        }
    )

    if not updated_user:
        return None

    return serialize_user(updated_user)
