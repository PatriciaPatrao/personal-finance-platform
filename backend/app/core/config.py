"""Application settings loaded from the environment."""

from pydantic import field_validator
from pydantic import model_validator
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict

from app.core.cors_origins import resolve_cors_origins


class Settings(BaseSettings):
    """Runtime configuration for the API."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    app_env: str = "development"
    cors_origins: str | None = None
    auth0_domain: str = ""
    auth0_audience: str = ""
    auth0_jwks_json: str | None = None

    @field_validator("app_env")
    @classmethod
    def normalize_app_env(cls, value: str) -> str:
        """Normalize APP_ENV for comparisons."""
        return value.strip().lower()

    @model_validator(mode="after")
    def validate_cors_configuration(self) -> "Settings":
        """Fail fast when production lacks an explicit CORS policy."""
        self.resolved_cors_origins()
        return self

    def resolved_cors_origins(self) -> list[str]:
        """Return permitted CORS origins for this process."""
        return resolve_cors_origins(
            app_env=self.app_env,
            cors_origins_raw=self.cors_origins,
        )


settings = Settings()
