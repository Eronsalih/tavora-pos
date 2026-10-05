from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    plan: Literal["starter", "standard", "pro"]
    provider: Literal["paddle", "manual"] = "paddle"
    billing_cycle: Literal["monthly", "yearly"] = "monthly"


class PaymentResponse(BaseModel):
    id: str
    business_id: str
    amount_minor: int
    amount: float
    currency: str
    plan: str
    billing_cycle: str
    duration_days: int
    provider: str
    provider_payment_id: str | None = None
    checkout_url: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    paid_at: datetime | None = None


class ManualSubscriptionUpdate(BaseModel):
    plan: Literal["starter", "standard", "pro"]
    duration_days: int = Field(default=30, ge=1, le=3660)
    note: str = Field(default="Owner manual activation", min_length=2, max_length=240)
