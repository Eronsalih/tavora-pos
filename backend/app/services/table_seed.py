from bson import ObjectId

from app.database.mongodb import database


async def seed_tables(
    business_id: ObjectId,
) -> dict[str, int]:
    tables_to_create = []

    # Salla: tavolinat 1 - 30
    for number in range(1, 31):
        tables_to_create.append(
            {
                "business_id": business_id,
                "number": number,
                "zone": "Salla",
                "seats": 4,
                "status": "free",
                "is_active": True,
            }
        )

    # Terrace: tavolinat 31 - 131
    for number in range(31, 132):
        tables_to_create.append(
            {
                "business_id": business_id,
                "number": number,
                "zone": "Terrace",
                "seats": 4,
                "status": "free",
                "is_active": True,
            }
        )

    # VIP: tavolinat 1 - 4
    for number in range(1, 5):
        tables_to_create.append(
            {
                "business_id": business_id,
                "number": number,
                "zone": "VIP",
                "seats": 12,
                "status": "free",
                "is_active": True,
            }
        )

    created_count = 0
    skipped_count = 0

    for table in tables_to_create:
        existing_table = await database.tables.find_one(
            {
                "business_id": business_id,
                "number": table["number"],
                "zone": table["zone"],
            }
        )

        if existing_table:
            skipped_count += 1
            continue

        await database.tables.insert_one(table)
        created_count += 1

    return {
        "created": created_count,
        "skipped": skipped_count,
        "total": len(tables_to_create),
    }