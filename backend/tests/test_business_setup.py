"""A new business must get default tables and menu exactly once."""

import asyncio

from bson import ObjectId

from app.services import business_setup, table_seed
from tests.conftest import FakeDatabase


def make_database(monkeypatch):
    fake = FakeDatabase()
    monkeypatch.setattr(business_setup, "database", fake)
    monkeypatch.setattr(table_seed, "database", fake)
    return fake


def create_business(fake):
    business_id = ObjectId()
    asyncio.run(fake["businesses"].insert_one({"_id": business_id}))
    return business_id


def test_new_business_gets_135_tables(monkeypatch):
    fake = make_database(monkeypatch)
    business_id = create_business(fake)

    asyncio.run(business_setup.ensure_business_setup(business_id))

    tables = [t for t in fake["tables"].docs if t["business_id"] == business_id]
    by_zone = {}
    for table in tables:
        by_zone.setdefault(table["zone"], []).append(table["number"])

    assert len(tables) == 135
    assert sorted(by_zone["Salla"]) == list(range(1, 31))
    assert sorted(by_zone["Terrace"]) == list(range(31, 132))
    assert sorted(by_zone["VIP"]) == list(range(1, 5))


def test_default_menu_starts_with_zero_stock(monkeypatch):
    fake = make_database(monkeypatch)
    business_id = create_business(fake)

    asyncio.run(business_setup.ensure_business_setup(business_id))

    products = fake["products"].docs
    assert len(products) == 144
    assert all(p["stock"] == 0 for p in products)
    assert all(p["business_id"] == business_id for p in products)


def test_setup_runs_only_once(monkeypatch):
    fake = make_database(monkeypatch)
    business_id = create_business(fake)

    asyncio.run(business_setup.ensure_business_setup(business_id))

    # The owner deletes every product on purpose...
    fake["products"].docs.clear()

    # ...and logs in again: products must NOT come back.
    asyncio.run(business_setup.ensure_business_setup(business_id))

    assert fake["products"].docs == []


def test_each_business_gets_its_own_data(monkeypatch):
    fake = make_database(monkeypatch)
    first = create_business(fake)
    second = create_business(fake)

    asyncio.run(business_setup.ensure_business_setup(first))
    asyncio.run(business_setup.ensure_business_setup(second))

    for business_id in (first, second):
        own = [p for p in fake["products"].docs if p["business_id"] == business_id]
        assert len(own) == 144
