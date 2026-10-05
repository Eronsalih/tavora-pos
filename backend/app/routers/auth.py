from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from app.core.security import (
    create_access_token,
    decode_access_token,
)
from app.schemas.business import BusinessSignup
from app.services.business_setup import safe_ensure_business_setup
from app.schemas.user import (
    OwnerSignup,
    SubscriptionResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserPinLogin,
    UserPinUpdate,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.auth_service import (
    authenticate_user,
    authenticate_user_by_pin,
    create_user,
    get_user_by_id,
    get_users,
    set_user_pin,
    set_user_status,
    update_user,
)
from app.services.business_service import (
    create_business_account,
    get_business_by_id,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


bearer_scheme = HTTPBearer(
    auto_error=False,
)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Authentication credentials are invalid "
            "or missing."
        ),
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )

    if credentials is None:
        raise credentials_exception

    token = credentials.credentials

    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")

    if not user_id or not isinstance(user_id, str):
        raise credentials_exception

    user = await get_user_by_id(user_id)

    if user is None:
        raise credentials_exception

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive.",
        )

    return user


async def require_admin(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )

    return current_user


async def require_active_subscription(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
) -> dict:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    business = await get_business_by_id(
        business_id
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    if business.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This business account is inactive.",
        )

    if business.get("subscription_status") != "active":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="An active Tavora subscription is required.",
        )

    expires_at = business.get(
        "subscription_expires_at"
    )

    if expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="The Tavora subscription has expired.",
        )

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="The Tavora subscription has expired.",
        )

    return current_user


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    credentials: UserLogin,
) -> TokenResponse:
    user = await authenticate_user(
        email=str(credentials.email),
        password=credentials.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # First login of an older business: create default tables and menu.
    await safe_ensure_business_setup(user.get("business_id"))

    access_token = create_access_token(
        subject=user["id"],
        extra_data={
            "email": user["email"],
            "role": user["role"],
        },
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.post(
    "/pin-login",
    response_model=TokenResponse,
)
async def pin_login(
    credentials: UserPinLogin,
) -> TokenResponse:
    user = await authenticate_user_by_pin(
        pin=credentials.pin,
        business_id=credentials.business_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee PIN is incorrect.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    # First login of an older business: create default tables and menu.
    await safe_ensure_business_setup(user.get("business_id"))

    access_token = create_access_token(
        subject=user["id"],
        extra_data={
            "email": user["email"],
            "role": user["role"],
        },
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
) -> UserResponse:
    return UserResponse(**current_user)


@router.get(
    "/subscription",
    response_model=SubscriptionResponse,
)
async def get_subscription(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
) -> SubscriptionResponse:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    business = await get_business_by_id(
        business_id
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business was not found.",
        )

    return SubscriptionResponse(
        business_id=business["id"],
        plan=business["subscription_plan"],
        status=business["subscription_status"],
        started_at=business[
            "subscription_started_at"
        ],
        expires_at=business[
            "subscription_expires_at"
        ],
        payment_provider=business[
            "payment_provider"
        ],
    )


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    data: OwnerSignup,
) -> UserResponse:
    try:
        signup_data = BusinessSignup(
            business_name=data.business_name,
            owner_name=data.name,
            email=data.email,
            password=data.password,
            pin=data.pin,
        )

        _, user = await create_business_account(
            signup_data
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    return UserResponse(**user)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    user_data: UserCreate,
    current_user: Annotated[
        dict,
        Depends(require_admin),
    ],
) -> UserResponse:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    try:
        created_user = await create_user(
            user_data,
            business_id=business_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    return UserResponse(**created_user)


@router.get(
    "/users",
    response_model=list[UserResponse],
)
async def list_users(
    current_user: Annotated[
        dict,
        Depends(require_admin),
    ],
) -> list[UserResponse]:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    users = await get_users(
        business_id
    )

    return [
        UserResponse(**user)
        for user in users
    ]


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def edit_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: Annotated[
        dict,
        Depends(require_admin),
    ],
) -> UserResponse:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    try:
        updated_user = await update_user(
            user_id=user_id,
            user_data=user_data,
            business_id=business_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User was not found.",
        )

    return UserResponse(**updated_user)


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
)
async def update_user_status(
    user_id: str,
    status_data: UserStatusUpdate,
    current_user: Annotated[
        dict,
        Depends(require_admin),
    ],
) -> UserResponse:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    updated_user = await set_user_status(
        user_id=user_id,
        is_active=status_data.is_active,
        business_id=business_id,
    )

    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User was not found.",
        )

    return UserResponse(**updated_user)


@router.patch(
    "/users/{user_id}/pin",
    response_model=UserResponse,
)
async def update_user_pin(
    user_id: str,
    pin_data: UserPinUpdate,
    current_user: Annotated[
        dict,
        Depends(require_admin),
    ],
) -> UserResponse:
    business_id = current_user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is missing.",
        )

    updated_user = await set_user_pin(
        user_id=user_id,
        pin=pin_data.pin,
        business_id=business_id,
    )

    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User was not found.",
        )

    return UserResponse(**updated_user)
