from typing import Literal

from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    product_id: str = Field(pattern=r"^[0-9a-fA-F]{24}$")
    quantity: int = Field(ge=1, le=999)


class OrderCreate(BaseModel):
    table_id: str = Field(pattern=r"^[0-9a-fA-F]{24}$")
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderUpdate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderAddItems(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderPayment(BaseModel):
    payment_method: Literal["cash", "card"]


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "draft",
        "sent_to_kitchen",
        "preparing",
        "ready",
        "paid",
        "cancelled",
    ]


class StationStatusUpdate(BaseModel):
    status: Literal["pending", "preparing", "ready"]


class OrderTableTransfer(BaseModel):
    new_table_id: str = Field(pattern=r"^[0-9a-fA-F]{24}$")


class OrderComplimentaryRelease(BaseModel):
    admin_pin: str = Field(pattern=r"^\d{4}$")
    reason: str = Field(min_length=3, max_length=240)
