"""The default menu must be valid data."""

from app.services.default_menu import DEFAULT_MENU


def test_menu_has_144_products():
    assert len(DEFAULT_MENU) == 144


def test_every_product_is_valid():
    for product in DEFAULT_MENU:
        assert len(product["name"].strip()) >= 2
        assert product["price"] > 0
        assert product["category"]
