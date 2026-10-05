from pydantic import BaseModel, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    price: float = Field(
        ...,
        gt=0,
    )

    category: str = Field(
        ...,
        min_length=2,
        max_length=50,
    )

    stock: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True

    @field_validator("name", "category")
    @classmethod
    def clean_text(cls, value: str) -> str:
        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError(
                "Kjo fushë nuk mund të jetë e zbrazët."
            )

        return cleaned_value


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: str
    created_at: str | None = None
    updated_at: str | None = None