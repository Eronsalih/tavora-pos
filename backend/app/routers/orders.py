from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_password
from app.core.subscription_access import (
    require_pro_plan,
    require_standard_plan,
)
from app.database.mongodb import database
from app.routers.auth import get_current_user, require_active_subscription
from app.schemas.order import (
    OrderAddItems,
    OrderComplimentaryRelease,
    OrderCreate,
    OrderPayment,
    OrderStatusUpdate,
    OrderTableTransfer,
    OrderUpdate,
    StationStatusUpdate,
)


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
    dependencies=[Depends(require_active_subscription)],
)


ACTIVE_ORDER_STATUSES = {
    "draft",
    "sent_to_kitchen",
    "preparing",
    "ready",
}

PAYABLE_ORDER_STATUSES = ACTIVE_ORDER_STATUSES
CANCELLABLE_ORDER_STATUSES = {"draft", "sent_to_kitchen"}

KITCHEN_CATEGORIES = {
    "Food",
    "Desserts",
    "Breakfast",
    "Soups",
    "Salads",
    "Appetizers",
    "Main Dishes",
    "Grill",
    "Pasta",
    "Pizza",
    "Sandwiches",
    "Traditional Food",
    "Side Dishes",
}

BAR_CATEGORIES = {
    "Coffee",
    "Drinks",
    "Hot Drinks",
    "Cold Drinks",
    "Alcohol",
    "Cocktails",
}


def get_business_object_id(current_user: dict) -> ObjectId:
    business_id = current_user.get("business_id")

    if not business_id or not ObjectId.is_valid(business_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid business ID is required.",
        )

    return ObjectId(business_id)


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        if getattr(value, "tzinfo", None) is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    return value


def serialize_order(order: dict) -> dict:
    return {
        "id": str(order["_id"]),
        "business_id": str(order["business_id"]),
        "table_id": str(order["table_id"]),
        "table_number": order.get("table_number"),
        "table_zone": order.get("table_zone"),
        "opened_by_user_id": order.get("opened_by_user_id"),
        "opened_by_name": order.get("opened_by_name"),
        "opened_by_role": order.get("opened_by_role"),
        "items": order.get("items", []),
        "total_items": int(order.get("total_items", 0)),
        "total": round(float(order.get("total", 0)), 2),
        "status": order.get("status", "draft"),
        "kitchen_status": order.get("kitchen_status"),
        "bar_status": order.get("bar_status"),
        "payment_method": order.get("payment_method"),
        "paid_by_user_id": order.get("paid_by_user_id"),
        "paid_by_name": order.get("paid_by_name"),
        "paid_by_role": order.get("paid_by_role"),
        "stock_deducted": order.get("stock_deducted", False),
        "stock_restored": order.get("stock_restored", False),
        "complimentary_original_total": order.get("complimentary_original_total"),
        "complimentary_reason": order.get("complimentary_reason"),
        "complimentary_authorized_by_user_id": order.get(
            "complimentary_authorized_by_user_id"
        ),
        "complimentary_authorized_by_name": order.get(
            "complimentary_authorized_by_name"
        ),
        "created_at": serialize_datetime(order.get("created_at")),
        "updated_at": serialize_datetime(order.get("updated_at")),
        "sent_to_kitchen_at": serialize_datetime(order.get("sent_to_kitchen_at")),
        "preparing_at": serialize_datetime(order.get("preparing_at")),
        "ready_at": serialize_datetime(order.get("ready_at")),
        "paid_at": serialize_datetime(order.get("paid_at")),
        "cancelled_at": serialize_datetime(order.get("cancelled_at")),
        "stock_deducted_at": serialize_datetime(order.get("stock_deducted_at")),
        "stock_restored_at": serialize_datetime(order.get("stock_restored_at")),
    }


def order_has_kitchen_items(order: dict) -> bool:
    return any(
        item.get("category") in KITCHEN_CATEGORIES
        for item in order.get("items", [])
    )


def order_has_bar_items(order: dict) -> bool:
    return any(
        item.get("category") in BAR_CATEGORIES
        for item in order.get("items", [])
    )


def filter_items_by_categories(order: dict, categories: set[str]) -> dict:
    filtered_items = [
        item
        for item in order.get("items", [])
        if item.get("category") in categories
    ]

    result = serialize_order(order)
    result["items"] = filtered_items
    result["total_items"] = sum(
        int(item.get("quantity", 0)) for item in filtered_items
    )
    return result


async def prepare_order_items(
    items,
    business_id: ObjectId,
) -> tuple[list[dict], int, float]:
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must contain at least one product.",
        )

    prepared_items: list[dict] = []
    total_items = 0
    order_total = 0.0

    for item in items:
        product = await database["products"].find_one(
            {
                "_id": ObjectId(item.product_id),
                "business_id": business_id,
                "is_active": {"$ne": False},
            }
        )

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product not found: {item.product_id}",
            )

        quantity = int(item.quantity)
        price = float(product.get("price", 0))
        subtotal = round(price * quantity, 2)

        prepared_items.append(
            {
                "product_id": str(product["_id"]),
                "name": product.get("name", ""),
                "category": product.get("category", "Other"),
                "price": price,
                "quantity": quantity,
                "subtotal": subtotal,
            }
        )

        total_items += quantity
        order_total += subtotal

    return prepared_items, total_items, round(order_total, 2)


async def ensure_stock_available(
    items: list[dict],
    business_id: ObjectId,
) -> None:
    for item in items:
        product_id = item.get("product_id")

        if not product_id or not ObjectId.is_valid(product_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order contains an invalid product ID.",
            )

        product = await database["products"].find_one(
            {
                "_id": ObjectId(product_id),
                "business_id": business_id,
            }
        )

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product not found: {product_id}",
            )

        available = int(product.get("stock", 0))
        requested = int(item.get("quantity", 0))

        if requested <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order contains an invalid quantity.",
            )

        if available < requested:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Not enough stock for {product.get('name', 'product')}. "
                    f"Available: {available}, requested: {requested}."
                ),
            )


async def change_stock(
    items: list[dict],
    business_id: ObjectId,
    multiplier: int,
) -> None:
    for item in items:
        result = await database["products"].update_one(
            {
                "_id": ObjectId(item["product_id"]),
                "business_id": business_id,
            },
            {
                "$inc": {
                    "stock": multiplier * int(item["quantity"]),
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product not found: {item['product_id']}",
            )


async def deduct_stock_if_needed(
    order: dict,
    business_id: ObjectId,
) -> dict:
    if order.get("stock_deducted") and not order.get("stock_restored"):
        return order

    items = order.get("items", [])
    await ensure_stock_available(items, business_id)
    await change_stock(items, business_id, -1)

    now = datetime.now(timezone.utc)

    await database["orders"].update_one(
        {
            "_id": order["_id"],
            "business_id": business_id,
        },
        {
            "$set": {
                "stock_deducted": True,
                "stock_restored": False,
                "stock_deducted_at": now,
                "stock_restored_at": None,
                "updated_at": now,
            }
        },
    )

    return await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )


async def restore_stock_if_needed(
    order: dict,
    business_id: ObjectId,
) -> None:
    if not order.get("stock_deducted") or order.get("stock_restored"):
        return

    await change_stock(order.get("items", []), business_id, 1)

    now = datetime.now(timezone.utc)
    await database["orders"].update_one(
        {
            "_id": order["_id"],
            "business_id": business_id,
        },
        {
            "$set": {
                "stock_restored": True,
                "stock_restored_at": now,
                "updated_at": now,
            }
        },
    )


async def free_order_table(order: dict, business_id: ObjectId) -> None:
    await database["tables"].update_one(
        {
            "_id": order["table_id"],
            "business_id": business_id,
            "active_order_id": order["_id"],
        },
        {
            "$set": {"status": "free"},
            "$unset": {"active_order_id": ""},
        },
    )


async def update_overall_order_status(
    order_object_id: ObjectId,
    business_id: ObjectId,
) -> None:
    order = await database["orders"].find_one(
        {
            "_id": order_object_id,
            "business_id": business_id,
        }
    )

    if not order or order.get("status") in {"paid", "cancelled", "draft"}:
        return

    station_statuses = [
        value
        for value in (
            order.get("kitchen_status"),
            order.get("bar_status"),
        )
        if value is not None
    ]

    if not station_statuses:
        return

    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now}

    if all(value == "ready" for value in station_statuses):
        update_fields["status"] = "ready"
        update_fields["ready_at"] = now
    elif any(value == "preparing" for value in station_statuses):
        update_fields["status"] = "preparing"
        update_fields["preparing_at"] = order.get("preparing_at") or now
    else:
        update_fields["status"] = "sent_to_kitchen"

    await database["orders"].update_one(
        {
            "_id": order_object_id,
            "business_id": business_id,
        },
        {"$set": update_fields},
    )


async def get_tenant_order(
    order_id: str,
    business_id: ObjectId,
) -> dict:
    if not ObjectId.is_valid(order_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID.",
        )

    order = await database["orders"].find_one(
        {
            "_id": ObjectId(order_id),
            "business_id": business_id,
        }
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


async def verify_tenant_admin_pin(
    business_id: ObjectId,
    pin: str,
) -> dict:
    cursor = database["users"].find(
        {
            "business_id": business_id,
            "role": "admin",
            "is_active": {"$ne": False},
            "hashed_pin": {"$exists": True, "$ne": None},
        }
    )

    async for admin in cursor:
        if verify_password(pin, admin["hashed_pin"]):
            return admin

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator PIN is incorrect.",
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)

    table = await database["tables"].find_one(
        {
            "_id": ObjectId(order_data.table_id),
            "business_id": business_id,
            "is_active": {"$ne": False},
        }
    )

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found.",
        )

    active_order_id = table.get("active_order_id")

    if active_order_id:
        active_order = await database["orders"].find_one(
            {
                "_id": active_order_id,
                "business_id": business_id,
                "status": {"$in": list(ACTIVE_ORDER_STATUSES)},
            }
        )

        if active_order:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This table already has an active order.",
            )

    prepared_items, total_items, order_total = await prepare_order_items(
        order_data.items,
        business_id,
    )

    now = datetime.now(timezone.utc)

    order = {
        "_id": ObjectId(),
        "business_id": business_id,
        "table_id": table["_id"],
        "table_number": table.get("number"),
        "table_zone": table.get("zone"),
        "opened_by_user_id": current_user["id"],
        "opened_by_name": current_user["name"],
        "opened_by_role": current_user["role"],
        "items": prepared_items,
        "total_items": total_items,
        "total": order_total,
        "status": "draft",
        "kitchen_status": None,
        "bar_status": None,
        "payment_method": None,
        "paid_by_user_id": None,
        "paid_by_name": None,
        "paid_by_role": None,
        "stock_deducted": False,
        "stock_restored": False,
        "created_at": now,
        "updated_at": now,
        "sent_to_kitchen_at": None,
        "preparing_at": None,
        "ready_at": None,
        "paid_at": None,
        "cancelled_at": None,
        "stock_deducted_at": None,
        "stock_restored_at": None,
    }

    await database["orders"].insert_one(order)

    result = await database["tables"].update_one(
        {
            "_id": table["_id"],
            "business_id": business_id,
            "$or": [
                {"active_order_id": {"$exists": False}},
                {"active_order_id": None},
            ],
        },
        {
            "$set": {
                "status": "occupied",
                "active_order_id": order["_id"],
            }
        },
    )

    if result.modified_count == 0:
        await database["orders"].delete_one(
            {"_id": order["_id"], "business_id": business_id}
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Table is no longer available.",
        )

    return serialize_order(order)


@router.get("")
async def get_orders(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    orders = await database["orders"].find(
        {"business_id": business_id}
    ).sort("created_at", -1).to_list(length=None)

    return [serialize_order(order) for order in orders]


@router.get(
    "/kitchen",
    dependencies=[Depends(require_standard_plan)],
)
async def get_kitchen_orders(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)

    orders = await database["orders"].find(
        {
            "business_id": business_id,
            "status": {"$nin": ["paid", "cancelled", "draft"]},
            "kitchen_status": {"$in": ["pending", "preparing", "ready"]},
        }
    ).sort("created_at", 1).to_list(length=None)

    return [
        filter_items_by_categories(order, KITCHEN_CATEGORIES)
        for order in orders
        if order_has_kitchen_items(order)
    ]


@router.get(
    "/bar",
    dependencies=[Depends(require_standard_plan)],
)
async def get_bar_orders(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)

    orders = await database["orders"].find(
        {
            "business_id": business_id,
            "status": {"$nin": ["paid", "cancelled", "draft"]},
            "bar_status": {"$in": ["pending", "preparing", "ready"]},
        }
    ).sort("created_at", 1).to_list(length=None)

    return [
        filter_items_by_categories(order, BAR_CATEGORIES)
        for order in orders
        if order_has_bar_items(order)
    ]


@router.delete("/reset-demo")
async def reset_demo_orders(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )

    business_id = get_business_object_id(current_user)

    delete_result = await database["orders"].delete_many(
        {"business_id": business_id}
    )

    table_result = await database["tables"].update_many(
        {"business_id": business_id},
        {
            "$set": {"status": "free"},
            "$unset": {"active_order_id": ""},
        },
    )

    return {
        "message": "Demo orders were reset for this business only.",
        "deleted_orders": delete_result.deleted_count,
        "updated_tables": table_result.modified_count,
    }


@router.patch(
    "/{order_id}/kitchen-status",
    dependencies=[Depends(require_standard_plan)],
)
async def update_kitchen_status(
    order_id: str,
    status_data: StationStatusUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") in {"paid", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Closed orders cannot be updated.",
        )

    if not order_has_kitchen_items(order):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order does not contain kitchen items.",
        )

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "kitchen_status": status_data.status,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    await update_overall_order_status(order["_id"], business_id)

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch(
    "/{order_id}/bar-status",
    dependencies=[Depends(require_standard_plan)],
)
async def update_bar_status(
    order_id: str,
    status_data: StationStatusUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") in {"paid", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Closed orders cannot be updated.",
        )

    if not order_has_bar_items(order):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order does not contain bar items.",
        )

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "bar_status": status_data.status,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    await update_overall_order_status(order["_id"], business_id)

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch("/{order_id}/transfer-table")
async def transfer_order_table(
    order_id: str,
    transfer_data: OrderTableTransfer,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") not in ACTIVE_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active orders can be transferred.",
        )

    new_table_id = ObjectId(transfer_data.new_table_id)

    if order["table_id"] == new_table_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The order is already assigned to this table.",
        )

    target = await database["tables"].find_one(
        {
            "_id": new_table_id,
            "business_id": business_id,
            "is_active": {"$ne": False},
        }
    )

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target table not found.",
        )

    if target.get("status") != "free" or target.get("active_order_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target table is not free.",
        )

    claim = await database["tables"].update_one(
        {
            "_id": new_table_id,
            "business_id": business_id,
            "status": "free",
            "$or": [
                {"active_order_id": {"$exists": False}},
                {"active_order_id": None},
            ],
        },
        {
            "$set": {
                "status": "occupied",
                "active_order_id": order["_id"],
            }
        },
    )

    if claim.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target table is no longer available.",
        )

    old_table_id = order["table_id"]
    now = datetime.now(timezone.utc)

    try:
        await database["orders"].update_one(
            {"_id": order["_id"], "business_id": business_id},
            {
                "$set": {
                    "table_id": target["_id"],
                    "table_number": target.get("number"),
                    "table_zone": target.get("zone"),
                    "updated_at": now,
                }
            },
        )

        await database["tables"].update_one(
            {
                "_id": old_table_id,
                "business_id": business_id,
                "active_order_id": order["_id"],
            },
            {
                "$set": {"status": "free"},
                "$unset": {"active_order_id": ""},
            },
        )
    except Exception:
        await database["tables"].update_one(
            {
                "_id": target["_id"],
                "business_id": business_id,
                "active_order_id": order["_id"],
            },
            {
                "$set": {"status": "free"},
                "$unset": {"active_order_id": ""},
            },
        )
        raise

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    return serialize_order(await get_tenant_order(order_id, business_id))


@router.post("/{order_id}/add-items")
async def add_items_to_order(
    order_id: str,
    order_data: OrderAddItems,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") in {"draft", "paid", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Items can only be added after the order has been sent.",
        )

    prepared, added_count, added_total = await prepare_order_items(
        order_data.items,
        business_id,
    )

    await ensure_stock_available(prepared, business_id)
    await change_stock(prepared, business_id, -1)

    now = datetime.now(timezone.utc)

    for item in prepared:
        item["added_by_user_id"] = current_user["id"]
        item["added_by_name"] = current_user["name"]
        item["added_by_role"] = current_user["role"]
        item["added_at"] = now

    update_fields = {
        "items": [*order.get("items", []), *prepared],
        "total_items": int(order.get("total_items", 0)) + added_count,
        "total": round(float(order.get("total", 0)) + added_total, 2),
        "status": "sent_to_kitchen",
        "ready_at": None,
        "stock_deducted": True,
        "stock_restored": False,
        "updated_at": now,
    }

    if any(item.get("category") in KITCHEN_CATEGORIES for item in prepared):
        update_fields["kitchen_status"] = "pending"

    if any(item.get("category") in BAR_CATEGORIES for item in prepared):
        update_fields["bar_status"] = "pending"

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {"$set": update_fields},
    )

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.put("/{order_id}")
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft orders can be updated.",
        )

    prepared, total_items, total = await prepare_order_items(
        order_data.items,
        business_id,
    )

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "items": prepared,
                "total_items": total_items,
                "total": total,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if status_data.status != "sent_to_kitchen":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the dedicated endpoints for payment, cancel, kitchen and bar status.",
        )

    if order.get("status") != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft orders can be sent.",
        )

    order = await deduct_stock_if_needed(order, business_id)
    now = datetime.now(timezone.utc)

    update_fields = {
        "status": "sent_to_kitchen",
        "sent_to_kitchen_at": now,
        "updated_at": now,
        "kitchen_status": "pending" if order_has_kitchen_items(order) else None,
        "bar_status": "pending" if order_has_bar_items(order) else None,
    }

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {"$set": update_fields},
    )

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch("/{order_id}/pay")
async def pay_order(
    order_id: str,
    payment_data: OrderPayment,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") not in PAYABLE_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order cannot be paid in its current status.",
        )

    if float(order.get("total", 0)) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order total must be greater than zero.",
        )

    order = await deduct_stock_if_needed(order, business_id)
    now = datetime.now(timezone.utc)

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "status": "paid",
                "payment_method": payment_data.payment_method,
                "paid_by_user_id": current_user["id"],
                "paid_by_name": current_user["name"],
                "paid_by_role": current_user["role"],
                "paid_at": now,
                "updated_at": now,
            }
        },
    )

    await free_order_table(order, business_id)

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch(
    "/{order_id}/complimentary",
    dependencies=[Depends(require_pro_plan)],
)
async def release_order_complimentary(
    order_id: str,
    release_data: OrderComplimentaryRelease,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") not in PAYABLE_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order cannot be released in its current status.",
        )

    admin = await verify_tenant_admin_pin(
        business_id,
        release_data.admin_pin,
    )

    order = await deduct_stock_if_needed(order, business_id)

    original_total = round(float(order.get("total", 0)), 2)
    now = datetime.now(timezone.utc)

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "status": "paid",
                "payment_method": "complimentary",
                "complimentary_original_total": original_total,
                "complimentary_reason": release_data.reason.strip(),
                "complimentary_authorized_by_user_id": str(admin["_id"]),
                "complimentary_authorized_by_name": admin.get("name"),
                "paid_by_user_id": current_user["id"],
                "paid_by_name": current_user["name"],
                "paid_by_role": current_user["role"],
                "paid_at": now,
                "updated_at": now,
            }
        },
    )

    await database["audit_logs"].insert_one(
        {
            "business_id": business_id,
            "type": "complimentary_order",
            "order_id": order["_id"],
            "table_id": order["table_id"],
            "table_number": order.get("table_number"),
            "original_total": original_total,
            "reason": release_data.reason.strip(),
            "requested_by_user_id": current_user["id"],
            "requested_by_name": current_user["name"],
            "authorized_by_user_id": str(admin["_id"]),
            "authorized_by_name": admin.get("name"),
            "created_at": now,
        }
    )

    await free_order_table(order, business_id)

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)


@router.patch("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    business_id = get_business_object_id(current_user)
    order = await get_tenant_order(order_id, business_id)

    if order.get("status") not in CANCELLABLE_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or sent orders can be cancelled.",
        )

    await restore_stock_if_needed(order, business_id)
    now = datetime.now(timezone.utc)

    await database["orders"].update_one(
        {"_id": order["_id"], "business_id": business_id},
        {
            "$set": {
                "status": "cancelled",
                "payment_method": None,
                "cancelled_at": now,
                "updated_at": now,
                "kitchen_status": None,
                "bar_status": None,
            }
        },
    )

    await free_order_table(order, business_id)

    updated = await database["orders"].find_one(
        {"_id": order["_id"], "business_id": business_id}
    )
    return serialize_order(updated)
