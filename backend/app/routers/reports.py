from datetime import date, datetime, time, timezone
from typing import Annotated
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.subscription_access import require_standard_plan
from app.database.mongodb import database
from app.routers.auth import (
    get_current_user,
    require_active_subscription,
)


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
    dependencies=[
        Depends(require_active_subscription),
    ],
)

BUSINESS_TIMEZONE = ZoneInfo("Europe/Belgrade")


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


async def resolve_report_user(
    current_user: dict,
    waiter_id: str | None,
    business_id: ObjectId,
) -> dict:
    if current_user["role"] != "admin" or not waiter_id:
        return {
            "id": current_user["id"],
            "name": current_user["name"],
            "role": current_user["role"],
        }

    if not ObjectId.is_valid(waiter_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid waiter ID.",
        )

    users_collection = database["users"]

    selected_user = await users_collection.find_one(
        {
            "_id": ObjectId(waiter_id),
            "business_id": business_id,
            "role": "waiter",
            "is_active": {
                "$ne": False,
            },
        }
    )

    if not selected_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waiter was not found.",
        )

    return {
        "id": str(selected_user["_id"]),
        "name": selected_user["name"],
        "role": selected_user["role"],
    }


async def calculate_daily_report(
    selected_date: date,
    target_user: dict,
    business_id: ObjectId,
) -> dict:
    start_local = datetime.combine(
        selected_date,
        time.min,
        tzinfo=BUSINESS_TIMEZONE,
    )

    end_local = datetime.combine(
        selected_date,
        time.max,
        tzinfo=BUSINESS_TIMEZONE,
    )

    start_utc = start_local.astimezone(
        timezone.utc
    )

    end_utc = end_local.astimezone(
        timezone.utc
    )

    orders_collection = database["orders"]

    query = {
        "business_id": business_id,
        "status": "paid",
        "paid_by_user_id": target_user["id"],
        "paid_at": {
            "$gte": start_utc,
            "$lte": end_utc,
        },
    }

    orders = await orders_collection.find(
        query
    ).to_list(length=None)

    orders_count = len(orders)

    items_sold = sum(
        int(order.get("total_items", 0))
        for order in orders
    )

    cash_total = round(
        sum(
            float(order.get("total", 0))
            for order in orders
            if order.get("payment_method") == "cash"
        ),
        2,
    )

    card_total = round(
        sum(
            float(order.get("total", 0))
            for order in orders
            if order.get("payment_method") == "card"
        ),
        2,
    )

    complimentary_orders = [
        order
        for order in orders
        if order.get("payment_method") == "complimentary"
    ]

    complimentary_count = len(complimentary_orders)

    complimentary_total = round(
        sum(
            float(order.get("complimentary_original_total", 0))
            for order in complimentary_orders
        ),
        2,
    )

    total_sales = round(
        cash_total + card_total,
        2,
    )

    return {
        "waiter_id": target_user["id"],
        "waiter_name": target_user["name"],
        "waiter_role": target_user["role"],
        "date": selected_date.isoformat(),
        "orders_count": orders_count,
        "items_sold": items_sold,
        "cash_total": cash_total,
        "card_total": card_total,
        "complimentary_count": complimentary_count,
        "complimentary_total": complimentary_total,
        "total_sales": total_sales,
    }


@router.get("/daily")
async def get_daily_waiter_report(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    report_date: date | None = Query(
        default=None,
    ),
    waiter_id: str | None = Query(
        default=None,
    ),
):
    business_id = get_business_object_id(
        current_user
    )

    selected_date = report_date or datetime.now(
        BUSINESS_TIMEZONE
    ).date()

    target_user = await resolve_report_user(
        current_user,
        waiter_id,
        business_id,
    )

    return await calculate_daily_report(
        selected_date,
        target_user,
        business_id,
    )


@router.get("/waiters")
async def get_report_waiters(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    _: Annotated[
        dict,
        Depends(require_standard_plan),
    ],
):
    business_id = get_business_object_id(
        current_user
    )

    if current_user["role"] != "admin":
        return [
            {
                "id": current_user["id"],
                "name": current_user["name"],
                "role": current_user["role"],
            }
        ]

    users_collection = database["users"]

    waiters = await users_collection.find(
        {
            "business_id": business_id,
            "role": "waiter",
            "is_active": {
                "$ne": False,
            },
        }
    ).sort(
        "name",
        1,
    ).to_list(
        length=None
    )

    return [
        {
            "id": str(waiter["_id"]),
            "name": waiter["name"],
            "role": waiter["role"],
        }
        for waiter in waiters
    ]


@router.post(
    "/daily/close",
    status_code=status.HTTP_201_CREATED,
)
async def close_daily_report(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    report_date: date | None = Query(
        default=None,
    ),
    waiter_id: str | None = Query(
        default=None,
    ),
):
    business_id = get_business_object_id(
        current_user
    )

    selected_date = report_date or datetime.now(
        BUSINESS_TIMEZONE
    ).date()

    today = datetime.now(
        BUSINESS_TIMEZONE
    ).date()

    if selected_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A future daily report cannot be closed.",
        )

    target_user = await resolve_report_user(
        current_user,
        waiter_id,
        business_id,
    )

    report = await calculate_daily_report(
        selected_date,
        target_user,
        business_id,
    )

    daily_reports_collection = database[
        "daily_reports"
    ]

    existing_report = await daily_reports_collection.find_one(
        {
            "business_id": business_id,
            "waiter_id": target_user["id"],
            "report_date": selected_date.isoformat(),
        }
    )

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Daily report is already closed "
                "for this waiter and date."
            ),
        )

    current_time = datetime.now(
        timezone.utc
    )

    closed_report = {
        "business_id": business_id,
        "waiter_id": target_user["id"],
        "waiter_name": target_user["name"],
        "waiter_role": target_user["role"],
        "report_date": selected_date.isoformat(),
        "orders_count": report["orders_count"],
        "items_sold": report["items_sold"],
        "cash_total": report["cash_total"],
        "card_total": report["card_total"],
        "complimentary_count": report["complimentary_count"],
        "complimentary_total": report["complimentary_total"],
        "total_sales": report["total_sales"],
        "closed_at": current_time,
        "closed_by_user_id": current_user["id"],
        "closed_by_name": current_user["name"],
        "closed_by_role": current_user["role"],
    }

    result = await daily_reports_collection.insert_one(
        closed_report
    )

    return {
        "id": str(result.inserted_id),
        "waiter_id": closed_report["waiter_id"],
        "waiter_name": closed_report["waiter_name"],
        "waiter_role": closed_report["waiter_role"],
        "report_date": closed_report["report_date"],
        "orders_count": closed_report["orders_count"],
        "items_sold": closed_report["items_sold"],
        "cash_total": closed_report["cash_total"],
        "card_total": closed_report["card_total"],
        "complimentary_count": closed_report["complimentary_count"],
        "complimentary_total": closed_report["complimentary_total"],
        "total_sales": closed_report["total_sales"],
        "closed_at": current_time.isoformat(),
        "closed_by_user_id": closed_report[
            "closed_by_user_id"
        ],
        "closed_by_name": closed_report[
            "closed_by_name"
        ],
        "closed_by_role": closed_report[
            "closed_by_role"
        ],
    }


@router.post(
    "/x",
    status_code=status.HTTP_201_CREATED,
)
async def create_x_report(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
    report_date: date | None = Query(
        default=None,
    ),
    waiter_id: str | None = Query(
        default=None,
    ),
):
    """X report: a snapshot of the day so far.

    Unlike the Z report it does NOT close the day and can be printed
    as many times as needed. Every X report is logged with a running
    number per waiter and day, so the owner can see how many were printed.
    """
    business_id = get_business_object_id(
        current_user
    )

    selected_date = report_date or datetime.now(
        BUSINESS_TIMEZONE
    ).date()

    target_user = await resolve_report_user(
        current_user,
        waiter_id,
        business_id,
    )

    report = await calculate_daily_report(
        selected_date,
        target_user,
        business_id,
    )

    x_reports_collection = database["x_reports"]

    log_filter = {
        "business_id": business_id,
        "waiter_id": target_user["id"],
        "report_date": selected_date.isoformat(),
    }

    x_number = (
        await x_reports_collection.count_documents(log_filter)
    ) + 1

    z_report = await database["daily_reports"].find_one(log_filter)

    generated_at = datetime.now(timezone.utc)

    await x_reports_collection.insert_one(
        {
            **log_filter,
            "x_number": x_number,
            "orders_count": report["orders_count"],
            "total_sales": report["total_sales"],
            "generated_at": generated_at,
            "generated_by_user_id": current_user["id"],
            "generated_by_name": current_user["name"],
        }
    )

    return {
        **report,
        "report_type": "X",
        "x_number": x_number,
        "is_day_closed": z_report is not None,
        "generated_at": generated_at.isoformat(),
        "generated_by_name": current_user["name"],
    }
