from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database.mongodb import database
from app.routers.auth import (
    get_current_user,
    require_active_subscription,
)
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
)


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
    dependencies=[
        Depends(require_active_subscription),
    ],
)


ACTIVE_ORDER_STATUSES = {
    "draft",
    "sent_to_kitchen",
    "preparing",
    "ready",
}


def get_current_time() -> datetime:
    return datetime.now(timezone.utc)


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


def serialize_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)


def serialize_product(product: dict) -> dict:
    return {
        "id": str(product["_id"]),
        "name": product.get("name", ""),
        "price": float(product.get("price", 0)),
        "category": product.get("category", ""),
        "stock": int(product.get("stock", 0)),
        "is_active": product.get("is_active", True),
        "created_at": serialize_datetime(
            product.get("created_at")
        ),
        "updated_at": serialize_datetime(
            product.get("updated_at")
        ),
    }


def validate_product_id(
    product_id: str,
) -> ObjectId:
    if not ObjectId.is_valid(product_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID e produktit nuk është valide.",
        )

    return ObjectId(product_id)


async def check_duplicate_name(
    name: str,
    business_id: ObjectId,
    excluded_product_id: ObjectId | None = None,
):
    query = {
        "business_id": business_id,
        "name": {
            "$regex": f"^{name}$",
            "$options": "i",
        },
    }

    if excluded_product_id is not None:
        query["_id"] = {
            "$ne": excluded_product_id,
        }

    existing_product = await database[
        "products"
    ].find_one(query)

    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f'Produkti me emrin "{name}" ekziston.'
            ),
        )


@router.get("")
async def get_products(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    products = []

    cursor = database["products"].find(
        {
            "business_id": business_id,
        }
    ).sort(
        "created_at",
        -1,
    )

    async for product in cursor:
        products.append(
            serialize_product(product)
        )

    return products


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    object_id = validate_product_id(
        product_id
    )

    product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produkti nuk u gjet.",
        )

    return serialize_product(product)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    product_data: ProductCreate,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    await check_duplicate_name(
        product_data.name,
        business_id,
    )

    current_time = get_current_time()

    new_product = {
        "business_id": business_id,
        "name": product_data.name,
        "price": round(
            float(product_data.price),
            2,
        ),
        "category": product_data.category,
        "stock": int(product_data.stock),
        "is_active": product_data.is_active,
        "created_at": current_time,
        "updated_at": current_time,
    }

    result = await database[
        "products"
    ].insert_one(new_product)

    created_product = await database[
        "products"
    ].find_one(
        {
            "_id": result.inserted_id,
            "business_id": business_id,
        }
    )

    return serialize_product(
        created_product
    )


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    object_id = validate_product_id(
        product_id
    )

    existing_product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    if not existing_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produkti nuk u gjet.",
        )

    await check_duplicate_name(
        product_data.name,
        business_id,
        excluded_product_id=object_id,
    )

    updated_data = {
        "name": product_data.name,
        "price": round(
            float(product_data.price),
            2,
        ),
        "category": product_data.category,
        "stock": int(product_data.stock),
        "is_active": product_data.is_active,
        "updated_at": get_current_time(),
    }

    await database[
        "products"
    ].update_one(
        {
            "_id": object_id,
            "business_id": business_id,
        },
        {
            "$set": updated_data,
        },
    )

    updated_product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    return serialize_product(
        updated_product
    )


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    object_id = validate_product_id(
        product_id
    )

    existing_product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    if not existing_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produkti nuk u gjet.",
        )

    active_order = await database[
        "orders"
    ].find_one(
        {
            "business_id": business_id,
            "status": {
                "$in": list(
                    ACTIVE_ORDER_STATUSES
                ),
            },
            "items.product_id": product_id,
        }
    )

    if active_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Produkti nuk mund të fshihet sepse "
                "gjendet në një porosi aktive. "
                "Mund ta vendosësh si inactive."
            ),
        )

    await database[
        "products"
    ].delete_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    return {
        "message": (
            f'Produkti "{existing_product["name"]}" '
            "u fshi me sukses."
        ),
        "deleted_product_id": product_id,
    }


@router.patch("/{product_id}/status")
async def change_product_status(
    product_id: str,
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    object_id = validate_product_id(
        product_id
    )

    existing_product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    if not existing_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produkti nuk u gjet.",
        )

    new_status = not existing_product.get(
        "is_active",
        True,
    )

    await database[
        "products"
    ].update_one(
        {
            "_id": object_id,
            "business_id": business_id,
        },
        {
            "$set": {
                "is_active": new_status,
                "updated_at": get_current_time(),
            }
        },
    )

    updated_product = await database[
        "products"
    ].find_one(
        {
            "_id": object_id,
            "business_id": business_id,
        }
    )

    return serialize_product(
        updated_product
    )


@router.post(
    "/seed",
    status_code=status.HTTP_201_CREATED,
)
async def seed_products(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    existing_products_count = await database[
        "products"
    ].count_documents(
        {
            "business_id": business_id,
        }
    )

    if existing_products_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Produktet janë krijuar më herët.",
        )

    current_time = get_current_time()

    demo_products = [
        {
            "business_id": business_id,
            "name": "Espresso",
            "price": 0.70,
            "category": "Coffee",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Macchiato e madhe",
            "price": 1.00,
            "category": "Coffee",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Cappuccino",
            "price": 1.50,
            "category": "Coffee",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Ice Latte",
            "price": 2.50,
            "category": "Coffee",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Coca Cola",
            "price": 1.50,
            "category": "Drinks",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Orange Juice",
            "price": 2.00,
            "category": "Drinks",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Burger",
            "price": 4.50,
            "category": "Food",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
        {
            "business_id": business_id,
            "name": "Chocolate Cake",
            "price": 2.80,
            "category": "Desserts",
            "stock": 0,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
        },
    ]

    result = await database[
        "products"
    ].insert_many(demo_products)

    return {
        "message": "Produktet demo u krijuan me sukses.",
        "inserted_products": len(
            result.inserted_ids
        ),
    }
