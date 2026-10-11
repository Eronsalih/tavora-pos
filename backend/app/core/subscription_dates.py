"""Pure date math for subscriptions (no database), so it is easy to test."""

from datetime import datetime, timedelta, timezone


def as_utc(value: datetime | None) -> datetime | None:
    """MongoDB returns dates without a timezone; they are always UTC."""
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def compute_new_expiry(
    current_expiry: datetime | None,
    duration_days: int,
    now: datetime,
) -> datetime:
    """New expiry date when a café gets `duration_days` more days.

    If the café still has paid days left, the new days are added on top,
    even when the subscription was paused, so nobody loses days they
    already paid for. Otherwise the new period starts today.
    """
    current_expiry = as_utc(current_expiry)

    starts_from = (
        current_expiry
        if current_expiry is not None and current_expiry > now
        else now
    )

    return starts_from + timedelta(days=duration_days)


def is_continuing_subscription(
    current_status: str | None,
    current_expiry: datetime | None,
    now: datetime,
) -> bool:
    """True when this is an extension of a running subscription (keep the
    original start date) instead of a brand-new period."""
    current_expiry = as_utc(current_expiry)

    return (
        current_status == "active"
        and current_expiry is not None
        and current_expiry > now
    )
