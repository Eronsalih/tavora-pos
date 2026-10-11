import asyncio

from app.database.mongodb import database


async def main():
    orders_collection = database["orders"]

    cursor = orders_collection.find(
        {
            "status": "paid",
            "paid_by_user_id": {
                "$exists": False,
            },
            "opened_by_user_id": {
                "$ne": None,
            },
        }
    )

    updated_count = 0

    async for order in cursor:
        opened_by_user_id = order.get("opened_by_user_id")
        opened_by_name = order.get("opened_by_name")
        opened_by_role = order.get("opened_by_role")

        await orders_collection.update_one(
            {
                "_id": order["_id"],
            },
            {
                "$set": {
                    "paid_by_user_id": opened_by_user_id,
                    "paid_by_name": opened_by_name,
                    "paid_by_role": opened_by_role,
                }
            },
        )

        updated_count += 1

    print(
        f"Backfill completed. Updated orders: {updated_count}"
    )


if __name__ == "__main__":
    asyncio.run(main())