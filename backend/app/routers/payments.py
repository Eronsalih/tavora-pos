import hashlib
import hmac
import json
import os
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.subscription_plans import public_subscription_plans
from app.routers.auth import get_current_user
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import (
    complete_payment,
    complete_payment_from_paddle,
    create_payment,
    get_payment_by_id,
)


router = APIRouter(
    prefix="/api/payments",
    tags=["Payments"],
)


def get_business_id(current_user: dict) -> str:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    return business_id


@router.get("/plans")
async def get_plans():
    return public_subscription_plans()


@router.post(
    "",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_subscription_payment(
    payment_data: PaymentCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PaymentResponse:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a business administrator can buy a subscription.",
        )

    try:
        payment = await create_payment(
            business_id=get_business_id(current_user),
            plan_id=payment_data.plan,
            provider=payment_data.provider,
            billing_cycle=payment_data.billing_cycle,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    # PaymentResponse intentionally ignores the optional configuration_error key.
    return PaymentResponse(**payment)


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
)
async def get_payment(
    payment_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PaymentResponse:
    payment = await get_payment_by_id(
        payment_id=payment_id,
        business_id=get_business_id(current_user),
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment was not found.",
        )

    return PaymentResponse(**payment)


@router.post(
    "/{payment_id}/simulate-success",
    response_model=PaymentResponse,
)
async def simulate_payment_success(
    payment_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PaymentResponse:
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payment simulation is disabled in production.",
        )

    payment = await get_payment_by_id(
        payment_id=payment_id,
        business_id=get_business_id(current_user),
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment was not found.",
        )

    completed = await complete_payment(payment_id)

    if not completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment was not found.",
        )

    return PaymentResponse(**completed)


def verify_paddle_signature(
    raw_body: bytes,
    signature_header: str,
    secret: str,
) -> bool:
    parts: dict[str, list[str]] = {}

    for part in signature_header.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        parts.setdefault(key.strip(), []).append(value.strip())

    timestamps = parts.get("ts", [])
    signatures = parts.get("h1", [])

    if not timestamps or not signatures:
        return False

    try:
        timestamp = int(timestamps[0])
    except ValueError:
        return False

    tolerance = settings.paddle_webhook_tolerance_seconds

    if abs(int(time.time()) - timestamp) > tolerance:
        return False

    signed_payload = str(timestamp).encode() + b":" + raw_body
    expected = hmac.new(
        secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return any(
        hmac.compare_digest(expected, signature)
        for signature in signatures
    )


@router.post("/webhooks/paddle")
async def paddle_webhook(request: Request):
    secret = settings.paddle_webhook_secret

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Paddle webhook secret is not configured.",
        )

    raw_body = await request.body()
    signature = request.headers.get("Paddle-Signature", "")

    if not verify_paddle_signature(raw_body, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Paddle webhook signature.",
        )

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook JSON.",
        ) from error

    event_type = event.get("event_type")
    data = event.get("data") or {}

    if event_type == "transaction.completed":
        await complete_payment_from_paddle(data)

    return {"received": True}
