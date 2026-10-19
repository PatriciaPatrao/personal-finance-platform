"""Parse and validate CORS allowed origins from configuration."""

from __future__ import annotations


def parse_cors_origins(raw: str | None) -> list[str]:
    """Split a comma-separated origin list and drop empty entries."""
    if raw is None or not raw.strip():
        return []
    origins: list[str] = []
    for part in raw.split(","):
        origin = part.strip()
        if not origin:
            continue
        if origin == "*":
            msg = "Wildcard CORS origins are not permitted"
            raise ValueError(msg)
        origins.append(origin.rstrip("/"))
    return origins


def resolve_cors_origins(
    *,
    app_env: str,
    cors_origins_raw: str | None,
) -> list[str]:
    """Return allowed browser origins for the current environment."""
    normalized_env = app_env.strip().lower()
    parsed = parse_cors_origins(cors_origins_raw)
    if parsed:
        return parsed
    if normalized_env == "production":
        msg = (
            "CORS_ORIGINS is required when APP_ENV=production. "
            "Set a comma-separated list of frontend origins."
        )
        raise ValueError(msg)
    return ["http://localhost:4200"]
