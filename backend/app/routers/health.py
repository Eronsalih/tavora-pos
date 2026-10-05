from fastapi import APIRouter

from app.database.mongodb import check_database_connection

router = APIRouter(
    prefix="/api",
    tags=["Health"],
)


@router.get("/health")
async def health_check():
    database_connected = await check_database_connection()

    return {
        "status": "healthy" if database_connected else "degraded",
        "service": "tavora-pos-backend",
        "database": "connected" if database_connected else "disconnected",
    }