from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


class BusinessSignup(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    pin: str = Field(pattern=r"^\d{4}$")
    phone: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=80)


class BusinessResponse(BaseModel):
    id: str
    name: str
    owner_name: str
    email: EmailStr
    phone: str | None = None
    country: str | None = None
    is_active: bool = True
    subscription_plan: str = "none"
    subscription_status: str = "inactive"
    subscription_started_at: datetime | None = None
    subscription_expires_at: datetime | None = None
    payment_provider: str | None = None
    created_at: datetime
    updated_at: datetime


class BusinessSignupResponse(BaseModel):
    business: BusinessResponse
    user: UserResponse
