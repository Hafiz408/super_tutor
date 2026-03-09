from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List, Any


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # AI provider config — set all three in .env
    agent_provider: str = "openai"     # openai | anthropic | groq | openrouter
    agent_model: str = "gpt-4o"        # model ID valid for chosen provider
    agent_api_key: str = ""            # single key for whichever provider is active
    agent_fallback_provider: str = "" # fallback provider (if different from primary, e.g. "openrouter")
    agent_fallback_model: str = ""     # optional fallback model ID
    agent_fallback_api_key: str = ""  # fallback API key (if different provider; defaults to agent_api_key)
    agent_max_retries: int = 3         # max attempts before giving up

    # Trace storage — SQLite db for AgentOS run traces
    trace_db_path: str = "tmp/super_tutor_traces.db"    # override with TRACE_DB_PATH env var
    session_db_path: str = "tmp/super_tutor_sessions.db"  # override with SESSION_DB_PATH env var
    status_db_path: str = "tmp/session_status.db"          # override with STATUS_DB_PATH env var

    # CORS
    allowed_origins: List[str] | str = ["http://localhost:3000"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",")]
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()
