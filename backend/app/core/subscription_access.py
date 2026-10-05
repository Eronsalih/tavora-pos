from typing import Annotated, Callable

from bson import ObjectId
from fastapi import Depends, HTTPException, status

from app.database.mongodb import database
from app.routers.auth import get_current_user


PLAN_LEVELS = {
    "none": 0,
    "starter": 1,
    "standard": 2,
    "pro": 3,
}


def require_minimum_plan(
    minimum_plan: str,
) -> Callable:
    minimum_level = PLAN_LEVELS.get(
        minimum_plan,
        0,
    )

    async def dependency(
        current_user: Annotated[
            dict,
            Depends(get_current_user),
        ],
    ) -> dict:
        if current_user.get("role") == "superadmin":
            return current_user

        business_id = current_user.get(
            "business_id"
        )

        if (
            not business_id
            or not ObjectId.is_valid(business_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid business ID.",
            )

        business = await database[
            "businesses"
        ].find_one(
            {
                "_id": ObjectId(business_id),
            }
        )

        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business was not found.",
            )

        current_plan = business.get(
            "subscription_plan",
            "none",
        )

        current_level = PLAN_LEVELS.get(
            current_plan,
            0,
        )

        if current_level < minimum_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This feature requires the "
                    f"{minimum_plan.capitalize()} "
                    f"plan or higher."
                ),
            )

        return current_user

    return dependency


require_standard_plan = require_minimum_plan(
    "standard"
)

require_pro_plan = require_minimum_plan(
    "pro"
)
