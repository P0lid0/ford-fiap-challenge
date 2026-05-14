"""Configuração via env. Lê .env.local da raiz do monorepo."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Procura .env.local subindo até 3 níveis
_HERE = Path(__file__).resolve()
_ENV_CANDIDATES = [
    _HERE.parents[3] / ".env.local",
    _HERE.parents[2] / ".env.local",
    _HERE.parents[1] / ".env.local",
    _HERE.parents[0] / ".env.local",
]
_env_file = next((p for p in _ENV_CANDIDATES if p.exists()), None)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_file) if _env_file else None, extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    anthropic_api_key: str = ""
    claude_model_fast: str = "claude-haiku-4-5-20251001"
    claude_model_smart: str = "claude-sonnet-4-6"

    ml_port: int = 8001
    ml_service_token: str = "local-dev-shared-secret-please-change"
    models_dir: Path = Path("./models")
    synthetic_data_dir: Path = Path("./data")


# Resolve diretórios sempre relativos ao services/ml/ (raiz desta app).
_ML_ROOT = _HERE.parents[1]  # services/ml/
settings = Settings()
if not settings.models_dir.is_absolute():
    settings.models_dir = (_ML_ROOT / settings.models_dir).resolve()
if not settings.synthetic_data_dir.is_absolute():
    settings.synthetic_data_dir = (_ML_ROOT / settings.synthetic_data_dir).resolve()
settings.models_dir.mkdir(parents=True, exist_ok=True)
settings.synthetic_data_dir.mkdir(parents=True, exist_ok=True)
