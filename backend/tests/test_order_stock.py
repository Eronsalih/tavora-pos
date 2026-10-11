"""Stock helpers used when an order is sent, paid or extended."""

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.routers.orders import merge_item_quantities

COFFEE = str(ObjectId())
WATER = str(ObjectId())


def test_same_product_twice_is_counted_together():
    items = [
        {"product_id": COFFEE, "quantity": 2},
        {"product_id": WATER, "quantity": 1},
        {"product_id": COFFEE, "quantity": 3},
    ]

    assert merge_item_quantities(items) == {COFFEE: 5, WATER: 1}


@pytest.mark.parametrize(
    "item",
    [
        {"product_id": "not-an-id", "quantity": 1},
        {"product_id": COFFEE, "quantity": 0},
        {"product_id": COFFEE, "quantity": -2},
    ],
)
def test_invalid_items_are_rejected(item):
    with pytest.raises(HTTPException) as error:
        merge_item_quantities([item])

    assert error.value.status_code == 400
