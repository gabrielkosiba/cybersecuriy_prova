from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "development-only-change-me"
    access_token_minutes: int = 30
    database_url: str = "sqlite:///./automhub.db"

    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:5175,"
        "http://127.0.0.1:5175,"
        "http://26.254.74.28:5173"
    )

    model_dir: str = "../models"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
