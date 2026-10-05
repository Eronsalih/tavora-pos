import asyncio
from getpass import getpass

from app.services.auth_service import (
    create_platform_superadmin,
    create_users_indexes,
)


async def main() -> None:
    print("=== Tavora Superadmin Setup ===")

    name = input("Name: ").strip()
    email = input("Email: ").strip().lower()
    password = getpass("Password: ")
    confirm_password = getpass(
        "Confirm password: "
    )

    if len(name) < 2:
        raise SystemExit(
            "Name must contain at least 2 characters."
        )

    if len(password) < 8:
        raise SystemExit(
            "Password must contain at least 8 characters."
        )

    if password != confirm_password:
        raise SystemExit(
            "Passwords do not match."
        )

    await create_users_indexes()

    try:
        user = await create_platform_superadmin(
            name=name,
            email=email,
            password=password,
        )
    except ValueError as error:
        raise SystemExit(
            str(error)
        ) from error

    print()
    print("Superadmin created successfully.")
    print(f"ID: {user['id']}")
    print(f"Email: {user['email']}")
    print(f"Role: {user['role']}")


if __name__ == "__main__":
    asyncio.run(main())
