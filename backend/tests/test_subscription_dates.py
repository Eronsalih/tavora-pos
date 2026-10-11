"""Subscription extension: nobody loses days they already paid for."""

from datetime import datetime, timedelta, timezone

from app.core.subscription_dates import (
    compute_new_expiry,
    is_continuing_subscription,
)

NOW = datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc)


def test_active_subscription_is_extended_from_its_expiry():
    expiry = NOW + timedelta(days=23)

    assert compute_new_expiry(expiry, 90, NOW) == expiry + timedelta(days=90)


def test_expired_subscription_starts_today():
    expiry = NOW - timedelta(days=5)

    assert compute_new_expiry(expiry, 30, NOW) == NOW + timedelta(days=30)


def test_new_business_without_expiry_starts_today():
    assert compute_new_expiry(None, 365, NOW) == NOW + timedelta(days=365)


def test_paused_subscription_keeps_remaining_days():
    # Paused (inactive) but 29 paid days left: they are kept.
    expiry = NOW + timedelta(days=29)

    assert compute_new_expiry(expiry, 30, NOW) == expiry + timedelta(days=30)


def test_mongo_dates_without_timezone_are_treated_as_utc():
    naive_expiry = (NOW + timedelta(days=10)).replace(tzinfo=None)

    assert compute_new_expiry(naive_expiry, 30, NOW) == (
        NOW + timedelta(days=40)
    )


def test_only_running_active_subscription_keeps_start_date():
    future = NOW + timedelta(days=3)
    past = NOW - timedelta(days=3)

    assert is_continuing_subscription("active", future, NOW)
    assert not is_continuing_subscription("inactive", future, NOW)
    assert not is_continuing_subscription("active", past, NOW)
    assert not is_continuing_subscription("active", None, NOW)
