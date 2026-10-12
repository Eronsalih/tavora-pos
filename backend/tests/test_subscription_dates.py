"""Subscription extension: nobody loses days they already paid for."""

from datetime import datetime, timedelta, timezone

from app.core.subscription_dates import (
    compute_new_expiry,
    is_continuing_subscription,
    trial_subscription_fields,
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


def test_new_cafe_gets_14_days_of_pro():
    fields = trial_subscription_fields(NOW, 14)

    assert fields["subscription_plan"] == "pro"
    assert fields["subscription_status"] == "active"
    assert fields["payment_provider"] == "trial"
    assert fields["subscription_expires_at"] == NOW + timedelta(days=14)


def test_trial_can_be_turned_off():
    fields = trial_subscription_fields(NOW, 0)

    assert fields["subscription_status"] == "inactive"
    assert fields["subscription_expires_at"] is None


def test_paying_during_trial_keeps_the_remaining_trial_days():
    # 5 trial days left, then the café buys 1 month: nothing is lost.
    trial_end = NOW + timedelta(days=5)

    assert is_continuing_subscription("active", trial_end, NOW)
    assert compute_new_expiry(trial_end, 30, NOW) == NOW + timedelta(days=35)
