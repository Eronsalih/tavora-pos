import asyncio

from app.database.mongodb import database


WAITER_ID = "6a691976ab71c4820044aca0"
WAITER_NAME = "Edmond Murati"
WAITER_ROLE = "waiter"


async def main():
    orders_collection = database["orders"]

    result = await orders_collection.update_many(
        {
            "status": "paid",
            "$or": [
                {"paid_by_user_id": {"$exists": False}},
                {"paid_by_user_id": None},
            ],
        },
        {
            "$set": {
                "paid_by_user_id": WAITER_ID,
                "paid_by_name": WAITER_NAME,
                "paid_by_role": WAITER_ROLE,
            }
        },
    )

    print(
        f"Historical paid orders updated: {result.modified_count}"
    )


if __name__ == "__main__":
    asyncio.run(main())