import asyncio

from app.database.mongodb import database


async def main():
    users = await database["users"].find(
        {
            "role": "superadmin",
        },
        {
            "email": 1,
            "name": 1,
            "is_active": 1,
        },
    ).to_list(length=20)

    if not users:
        print("Nuk u gjet asnje superadmin.")
        return

    for user in users:
        print(
            "Email:",
            user.get("email"),
            "| Name:",
            user.get("name"),
            "| Active:",
            user.get("is_active"),
        )


if __name__ == "__main__":
    asyncio.run(main())