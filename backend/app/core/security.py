import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash


password_hash = PasswordHash.recommended()

_DEV_FALLBACK_SECRET = "development-only-change-this-before-production"

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEV_FALLBACK_SECRET)

# Never run production with the public fallback secret: anyone could
# forge tokens (e.g. log in as an admin) because the value is in the repo.
if (
    os.getenv("APP_ENV", "development").lower() == "production"
    and (JWT_SECRET_KEY == _DEV_FALLBACK_SECRET or len(JWT_SECRET_KEY) < 32)
):
    raise RuntimeError(
        "JWT_SECRET_KEY must be set to a random value of at least 32 "
        "characters in production (e.g. `openssl rand -hex 32`)."
    )
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    extra_data: dict[str, Any] | None = None,
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }

    if extra_data:
        payload.update(extra_data)

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
    except InvalidTokenError:
        return None
