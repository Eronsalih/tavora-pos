"""Brute-force protection for passwords and 4-digit PINs."""

import pytest
from fastapi import HTTPException

from app.core.rate_limit import LoginRateLimiter


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_blocks_after_too_many_failures():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures=3, window_seconds=60, clock=clock)

    for _ in range(3):
        limiter.check("pin:1.2.3.4:cafe")
        limiter.record_failure("pin:1.2.3.4:cafe")

    with pytest.raises(HTTPException) as error:
        limiter.check("pin:1.2.3.4:cafe")

    assert error.value.status_code == 429


def test_other_keys_are_not_blocked():
    limiter = LoginRateLimiter(max_failures=1, window_seconds=60)
    limiter.record_failure("login:a")

    assert limiter.is_blocked("login:a")
    assert not limiter.is_blocked("login:b")


def test_block_expires_after_the_window():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60, clock=clock)
    limiter.record_failure("k")
    limiter.record_failure("k")
    assert limiter.is_blocked("k")

    clock.now += 61

    assert not limiter.is_blocked("k")


def test_successful_login_resets_the_counter():
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60)
    limiter.record_failure("k")
    limiter.reset("k")
    limiter.record_failure("k")

    assert not limiter.is_blocked("k")
