"""JWT safety: tokens work, and production refuses a weak secret."""

import os
import subprocess
import sys
from pathlib import Path

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_password_hash_and_verify():
    hashed = hash_password("sekret123")

    assert hashed != "sekret123"
    assert verify_password("sekret123", hashed)
    assert not verify_password("gabim", hashed)


def test_token_round_trip():
    token = create_access_token(subject="user-1", extra_data={"role": "admin"})
    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "user-1"
    assert payload["role"] == "admin"


def test_tampered_token_is_rejected():
    waiter_token = create_access_token(subject="user-1", extra_data={"role": "waiter"})
    admin_token = create_access_token(subject="user-1", extra_data={"role": "admin"})

    # Put the "admin" payload inside the waiter's signature: a classic attack.
    header, _, signature = waiter_token.split(".")
    admin_payload = admin_token.split(".")[1]
    forged = f"{header}.{admin_payload}.{signature}"

    assert decode_access_token(forged) is None


def _import_security_with(env_overrides):
    env = {k: v for k, v in os.environ.items() if k != "JWT_SECRET_KEY"}
    env.update(
        {
            "MONGODB_URL": "mongodb://localhost:27017",
            "MONGODB_DB_NAME": "tavora_test",
            **env_overrides,
        }
    )

    return subprocess.run(
        [sys.executable, "-c", "import app.core.security"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def test_production_refuses_missing_secret():
    result = _import_security_with({"APP_ENV": "production"})

    assert result.returncode != 0
    assert "JWT_SECRET_KEY" in result.stderr


def test_production_refuses_short_secret():
    result = _import_security_with({"APP_ENV": "production", "JWT_SECRET_KEY": "abc"})

    assert result.returncode != 0


def test_production_accepts_strong_secret():
    result = _import_security_with(
        {"APP_ENV": "production", "JWT_SECRET_KEY": "x" * 64}
    )

    assert result.returncode == 0, result.stderr
