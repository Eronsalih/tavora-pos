import asyncio
from getpass import getpass

from app.schemas.user import UserCreate, UserRole
from app.services.auth_service import create_user


async def main():
    name = input("Name: ")
    email = input("Email: ")
    password = getpass("Password: ")
    pin = getpass("4-digit PIN: ")

    user = UserCreate(
        name=name,
        email=email,
        password=password,
        pin=pin,
        role=UserRole.ADMIN,
    )

    created = await create_user(user)

    print("\nAdmin created successfully:")
    print(created)


asyncio.run(main())