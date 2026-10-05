"""Assign legacy POS documents to one Tavora business.

Dry-run is the default. Run with --apply only after checking the counts.
This script is for data created before tenant isolation added business_id.
"""

import argparse
import asyncio

from bson import ObjectId

from app.database.mongodb import database


COLLECTIONS = (
    "products",
    "tables",
    "orders",
    "daily_reports",
)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--business-id",
        required=True,
        help="24-character MongoDB ObjectId of the business that owns the legacy data.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually update documents. Without this flag, the script is dry-run only.",
    )
    parser.add_argument(
        "--collections",
        nargs="*",
        choices=COLLECTIONS,
        default=list(COLLECTIONS),
    )
    args = parser.parse_args()

    if not ObjectId.is_valid(args.business_id):
        raise SystemExit("Invalid --business-id. Expected a 24-character MongoDB ObjectId.")

    business_id = ObjectId(args.business_id)
    business = await database["businesses"].find_one({"_id": business_id})

    if not business:
        raise SystemExit("Business was not found. Nothing was changed.")

    print(f"Business: {business.get('name', '')} ({business_id})")
    print("Mode:", "APPLY" if args.apply else "DRY RUN")
    print()

    total = 0

    for collection_name in args.collections:
        collection = database[collection_name]
        query = {
            "$or": [
                {"business_id": {"$exists": False}},
                {"business_id": None},
            ]
        }
        count = await collection.count_documents(query)
        total += count
        print(f"{collection_name}: {count} legacy documents")

        if args.apply and count:
            result = await collection.update_many(
                query,
                {"$set": {"business_id": business_id}},
            )
            print(f"  updated: {result.modified_count}")

    print()
    if args.apply:
        print(f"Migration completed. Legacy documents inspected: {total}")
    else:
        print(f"Dry run completed. {total} documents would be updated.")
        print("Run the same command with --apply after verifying the business ID.")


if __name__ == "__main__":
    asyncio.run(main())
