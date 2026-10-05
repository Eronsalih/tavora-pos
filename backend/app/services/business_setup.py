"""First-time setup for a business: default tables and default menu.

Runs automatically when a business signs up, and again on login for
older businesses that were created before this feature existed.

It runs only ONCE per business (flag `setup_completed`), so if the owner
later deletes tables or products on purpose, they are not re-created.
"""

import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.database.mongodb import database
from app.services.default_menu import DEFAULT_MENU
from app.services.table_seed import seed_tables

logger = logging.getLogger(__name__)


async def seed_default_menu(business_id: ObjectId) -> int:
    """Insert the default menu with stock 0. Returns how many were created."""
    now = datetime.now(timezone.utc)

    products = [
        {
            "business_id": business_id,
            "name": item["name"],
            "price": item["price"],
            "category": item["category"],
            "stock": 0,
            "is_active": item["is_active"],
            "created_at": now,
            "updated_at": now,
        }
        for item in DEFAULT_MENU
    ]

    if not products:
        return 0

    result = await database["products"].insert_many(products)
    return len(result.inserted_ids)


async def ensure_business_setup(business_id: ObjectId | str | None) -> None:
    """Create default tables and menu the first time, then never again."""
    if business_id is None:
        return

    if not isinstance(business_id, ObjectId):
        if not ObjectId.is_valid(str(business_id)):
            return
        business_id = ObjectId(str(business_id))

    business = await database["businesses"].find_one(
        {"_id": business_id},
        {"setup_completed": 1},
    )

    if not business or business.get("setup_completed"):
        return

    tables_count = await database["tables"].count_documents(
        {"business_id": business_id}
    )
    if tables_count == 0:
        await seed_tables(business_id)

    products_count = await database["products"].count_documents(
        {"business_id": business_id}
    )
    if products_count == 0:
        await seed_default_menu(business_id)

    await database["businesses"].update_one(
        {"_id": business_id},
        {
            "$set": {
                "setup_completed": True,
                "setup_completed_at": datetime.now(timezone.utc),
            }
        },
    )


async def safe_ensure_business_setup(business_id: ObjectId | str | None) -> None:
    """Same as ensure_business_setup, but never breaks signup or login."""
    try:
        await ensure_business_setup(business_id)
    except Exception:
        logger.exception("Default business setup failed for %s", business_id)
