import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

from app.routers import (
    auth,
    health,
    orders,
    payments,
    platform_admin,
    products,
    reports,
    tables,
)


app = FastAPI(
    title="Tavora POS API",
    version="1.1.0",
)


default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

extra_origins = [
    value.strip()
    for value in os.getenv("CORS_ORIGINS", "").split(",")
    if value.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[*default_origins, *extra_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(products.router)
app.include_router(tables.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(platform_admin.router)


async def paddle_config_debug():
    return {
        "environment": settings.paddle_environment,
        "api_key": "PRESENT" if settings.paddle_api_key else "MISSING",
        "webhook_secret": (
            "PRESENT" if settings.paddle_webhook_secret else "MISSING"
        ),
        "starter_monthly": (
            "PRESENT"
            if settings.paddle_price_id_starter_monthly
            else "MISSING"
        ),
        "starter_yearly": (
            "PRESENT"
            if settings.paddle_price_id_starter_yearly
            else "MISSING"
        ),
    }


# Debug info is only exposed outside production.
if settings.app_env.lower() != "production":
    app.add_api_route(
        "/api/debug/paddle-config",
        paddle_config_debug,
        methods=["GET"],
        include_in_schema=False,
    )
