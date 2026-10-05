from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import database
from app.routers.auth import (
    get_current_user,
    require_active_subscription,
)
from app.schemas.table import TableCreate, TableUpdate
from app.services.table_seed import seed_tables


router = APIRouter(
    prefix="/api/tables",
    tags=["Tables"],
    dependencies=[
        Depends(require_active_subscription),
    ],
)


def get_business_object_id(
    current_user: dict,
) -> ObjectId:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    if not ObjectId.is_valid(business_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid business ID.",
        )

    return ObjectId(business_id)


def serialize_table(table: dict) -> dict:
    active_order_id = table.get("active_order_id")

    return {
        "id": str(table["_id"]),
        "number": table["number"],
        "zone": table["zone"],
        "seats": table.get("seats", 4),
        "status": table.get("status", "free"),
        "is_active": table.get("is_active", True),
        "active_order_id": (
            str(active_order_id)
            if active_order_id
            else None
        ),
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
async def create_table(
    table: TableCreate,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    existing_table = await database.tables.find_one(
        {
            "business_id": business_id,
            "number": table.number,
            "zone": table.zone,
        }
    )

    if existing_table:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Table {table.number} already exists "
                f"in zone {table.zone}"
            ),
        )

    table_data = table.model_dump()
    table_data["business_id"] = business_id

    try:
        result = await database.tables.insert_one(
            table_data
        )
    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Table already exists",
        ) from error

    created_table = await database.tables.find_one(
        {
            "_id": result.inserted_id,
            "business_id": business_id,
        }
    )

    return serialize_table(created_table)


@router.get("")
async def get_tables(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    zone: str | None = Query(default=None),
    table_status: str | None = Query(
        default=None,
        alias="status",
    ),
):
    business_id = get_business_object_id(
        current_user
    )

    filters = {
        "business_id": business_id,
    }

    if zone:
        filters["zone"] = zone

    if table_status:
        filters["status"] = table_status

    tables = []

    cursor = database.tables.find(filters).sort(
        [
            ("zone", 1),
            ("number", 1),
        ]
    )

    async for table in cursor:
        tables.append(
            serialize_table(table)
        )

    return tables


@router.post("/seed")
async def seed_all_tables(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    result = await seed_tables(
        business_id
    )

    return {
        "message": "Tables seeded successfully",
        **result,
    }


@router.get("/{table_id}")
async def get_table(
    table_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    if not ObjectId.is_valid(table_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table ID",
        )

    table = await database.tables.find_one(
        {
            "_id": ObjectId(table_id),
            "business_id": business_id,
        }
    )

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found",
        )

    return serialize_table(table)


@router.put("/{table_id}")
async def update_table(
    table_id: str,
    table: TableUpdate,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    if not ObjectId.is_valid(table_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table ID",
        )

    table_object_id = ObjectId(table_id)

    existing_table = await database.tables.find_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        }
    )

    if not existing_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found",
        )

    update_data = table.model_dump(
        exclude_none=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    new_number = update_data.get(
        "number",
        existing_table["number"],
    )

    new_zone = update_data.get(
        "zone",
        existing_table["zone"],
    )

    duplicate_table = await database.tables.find_one(
        {
            "_id": {
                "$ne": table_object_id,
            },
            "business_id": business_id,
            "number": new_number,
            "zone": new_zone,
        }
    )

    if duplicate_table:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Table {new_number} already exists "
                f"in zone {new_zone}"
            ),
        )

    await database.tables.update_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        },
        {
            "$set": update_data,
        },
    )

    updated_table = await database.tables.find_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        }
    )

    return serialize_table(updated_table)


@router.patch("/{table_id}/status")
async def update_table_status(
    table_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    table_status: str = Query(alias="status"),
):
    business_id = get_business_object_id(
        current_user
    )

    allowed_statuses = {
        "free",
        "occupied",
        "reserved",
    }

    if table_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Status must be free, occupied, or reserved"
            ),
        )

    if not ObjectId.is_valid(table_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table ID",
        )

    table_object_id = ObjectId(table_id)

    table = await database.tables.find_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        }
    )

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found",
        )

    update_operation = {
        "$set": {
            "status": table_status,
        }
    }

    if table_status == "free":
        update_operation["$unset"] = {
            "active_order_id": "",
        }

    await database.tables.update_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        },
        update_operation,
    )

    updated_table = await database.tables.find_one(
        {
            "_id": table_object_id,
            "business_id": business_id,
        }
    )

    return serialize_table(updated_table)


@router.delete("/{table_id}")
async def delete_table(
    table_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    if not ObjectId.is_valid(table_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table ID",
        )

    result = await database.tables.delete_one(
        {
            "_id": ObjectId(table_id),
            "business_id": business_id,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found",
        )

    return {
        "message": "Table deleted successfully",
    }
