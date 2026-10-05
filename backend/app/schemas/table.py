from typing import Literal

from pydantic import BaseModel, Field


TableStatus = Literal["free", "occupied", "reserved"]
TableZone = Literal["Salla", "Terrace", "VIP"]


class TableCreate(BaseModel):
    number: int = Field(gt=0)
    zone: TableZone
    seats: int = Field(default=4, gt=0)
    status: TableStatus = "free"
    is_active: bool = True


class TableUpdate(BaseModel):
    number: int | None = Field(default=None, gt=0)
    zone: TableZone | None = None
    seats: int | None = Field(default=None, gt=0)
    status: TableStatus | None = None
    is_active: bool | None = None