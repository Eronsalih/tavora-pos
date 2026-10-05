from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str
    mongodb_db_name: str

    # App
    app_env: str = "development"

    # Paddle
    paddle_environment: str = "sandbox"
    paddle_api_key: str | None = None
    paddle_webhook_secret: str | None = None
    paddle_checkout_base_url: str | None = None
    paddle_webhook_tolerance_seconds: int = 300

    paddle_price_id_starter_monthly: str | None = None
    paddle_price_id_starter_yearly: str | None = None

    paddle_price_id_standard_monthly: str | None = None
    paddle_price_id_standard_yearly: str | None = None

    paddle_price_id_pro_monthly: str | None = None
    paddle_price_id_pro_yearly: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
