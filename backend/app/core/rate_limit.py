"""Simple in-memory brute-force protection.

A 4-digit PIN has only 10,000 combinations, so without a limit anyone
could try them all in a few minutes. After too many wrong attempts for
the same key (e.g. IP + business) we block that key for a while.

Note: the counter lives in memory, so it resets when the server restarts
and is not shared between several backend instances. That is fine for a
single container; with many instances move it to Redis.
"""

import time
from threading import Lock

from fastapi import HTTPException, Request, status


class LoginRateLimiter:
    def __init__(
        self,
        max_failures: int = 10,
        window_seconds: int = 15 * 60,
        clock=time.monotonic,
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, list[float]] = {}
        self._lock = Lock()

    def _recent(self, key: str) -> list[float]:
        cutoff = self._clock() - self.window_seconds
        attempts = [t for t in self._failures.get(key, []) if t > cutoff]

        if attempts:
            self._failures[key] = attempts
        else:
            self._failures.pop(key, None)

        return attempts

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._recent(key)) >= self.max_failures

    def retry_after(self, key: str) -> int:
        with self._lock:
            attempts = self._recent(key)
            if len(attempts) < self.max_failures:
                return 0
            oldest = attempts[-self.max_failures]
            return max(1, int(oldest + self.window_seconds - self._clock()))

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._recent(key)
            self._failures.setdefault(key, []).append(self._clock())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def check(self, key: str) -> None:
        """Raise 429 if this key has too many recent failures."""
        if self.is_blocked(key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please try again later.",
                headers={"Retry-After": str(self.retry_after(key))},
            )


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# One shared limiter for passwords, employee PINs and admin PINs.
login_limiter = LoginRateLimiter()
