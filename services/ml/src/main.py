"""ML Service — FastAPI.

Expõe /predict para o API gateway Node, /ingest para o scraper de Desafio 1,
e /train para retreino. Token compartilhado obrigatório no header.
"""
from __future__ import annotations

import logging
from pathlib import Path

import hashlib
import hmac
import re
import time

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .classifier import ACOES_POR_PERFIL, load as load_classifier, predict as run_predict
from .config import settings
from .scrapers.canonical_schema import Vehicle
from .scrapers.carrosnaweb import CarrosNaWebScraper
from .scrapers.llm_extractor import ingest as llm_ingest

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","lvl":"%(levelname)s","name":"%(name)s","msg":"%(message)s"}',
)
log = logging.getLogger("ml")

is_production = settings.node_env == "production"
app = FastAPI(
    title="Ford FIAP ML Service",
    version="0.1.0",
    description="Classificação de perfil + ingestão de fichas técnicas.",
    docs_url=None if is_production else "/docs",
    redoc_url=None,
    openapi_url=None if is_production else "/openapi.json",
)

MODEL_PATH = settings.models_dir / "classifier_base2.joblib"
_classifier = None
_used_nonces: dict[str, float] = {}


def _get_classifier():
    global _classifier
    if _classifier is None:
        if not MODEL_PATH.exists():
            raise HTTPException(503, "modelo indisponível; treine o modelo antes de iniciar o serviço")
        _classifier = load_classifier(str(MODEL_PATH))
    return _classifier


def auth_token(authorization: str | None = Header(default=None)):
    """Token compartilhado entre API gateway e ML service."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(token, settings.ml_service_token):
        raise HTTPException(401, "invalid bearer token")
    return True


async def verify_payload_signature(
    request: Request,
    x_payload_signature: str | None = Header(default=None),
    x_payload_timestamp: str | None = Header(default=None),
    x_payload_nonce: str | None = Header(default=None),
) -> None:
    """Validate a fresh, one-time HMAC over timestamp, nonce, and raw body."""
    if not x_payload_signature or not x_payload_timestamp or not x_payload_nonce:
        raise HTTPException(401, "missing payload signature headers")
    if not re.fullmatch(r"[a-f0-9]{32}", x_payload_nonce):
        raise HTTPException(400, "invalid payload nonce")
    try:
        timestamp = int(x_payload_timestamp)
    except ValueError as exc:
        raise HTTPException(400, "invalid payload timestamp") from exc
    now = int(time.time())
    if abs(now - timestamp) > 60:
        raise HTTPException(401, "expired payload signature")

    expired_nonces = [nonce for nonce, seen_at in _used_nonces.items() if now - seen_at > 60]
    for nonce in expired_nonces:
        del _used_nonces[nonce]
    if x_payload_nonce in _used_nonces:
        raise HTTPException(409, "replayed payload")

    body = await request.body()
    expected = hmac.new(
        settings.ml_service_token.encode(),
        b"ml-payload-signature:v1\0"
        + f"{x_payload_timestamp}.{x_payload_nonce}.".encode()
        + body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, x_payload_signature):
        raise HTTPException(401, "invalid payload signature")
    if x_payload_nonce in _used_nonces:
        raise HTTPException(409, "replayed payload")
    _used_nonces[x_payload_nonce] = now


# ============== Schemas ==============

class PredictRequest(BaseModel):
    idade: int = Field(ge=18, le=95)
    genero: str
    regiao: str
    renda_mensal_brl: int = Field(ge=0)
    estado_civil: str
    score_credito: int = Field(ge=0, le=1000)
    modelo_comprado: str
    versao_comprada: str
    preco_pago_brl: int = Field(ge=0)
    financiamento: str
    parcelas: int = Field(ge=0, le=84)
    canal_aquisicao: str
    primeiro_carro: bool
    test_drive_realizado: bool
    dealership_id: str


class PredictResponse(BaseModel):
    model_version: str
    perfil_predito: str
    probabilidades: dict[str, float]
    risco_evasao: float
    confianca: float
    recomendacoes_acao: list[str]


class IngestRequest(BaseModel):
    marca: str
    modelo: str
    versao: str | None = None
    ano: int = 2025
    # opcional: codigo do carrosnaweb se já conhecido
    codigo: int | None = None


# ============== Routes ==============

@app.get("/health")
def health():
    has_model = MODEL_PATH.exists()
    return {
        "status": "ok",
        "model_loaded": has_model,
    }


@app.post(
    "/predict",
    response_model=PredictResponse,
    dependencies=[Depends(auth_token), Depends(verify_payload_signature)],
)
def predict_endpoint(req: PredictRequest) -> PredictResponse:
    pipe, metrics, version = _get_classifier()
    out = run_predict(pipe, req.model_dump())
    return PredictResponse(
        model_version=version,
        perfil_predito=out["perfil_predito"],
        probabilidades=out["probabilidades"],
        risco_evasao=out["risco_evasao"],
        confianca=out["confianca"],
        recomendacoes_acao=ACOES_POR_PERFIL[out["perfil_predito"]],
    )


@app.post("/ingest", dependencies=[Depends(auth_token)])
async def ingest_endpoint(req: IngestRequest) -> dict:
    """Pipeline de ingestão Desafio 1.

    1. Se `codigo` informado, tenta carrosnaweb direto.
    2. Senão, tenta fabricante + LLM (Claude).
    3. Retorna Vehicle no schema canônico ou erro 404.
    """
    # Tentativa 1: scraper carrosnaweb
    if req.codigo:
        scraper = CarrosNaWebScraper()
        try:
            vehicle = scraper.scrape(req.codigo)
            if vehicle:
                log.info(f"ingested via carrosnaweb codigo={req.codigo}")
                return {"source": "carrosnaweb", "vehicle": vehicle.model_dump(mode="json")}
        finally:
            scraper.close()
        log.warning(f"carrosnaweb retornou erro para codigo={req.codigo}, tentando LLM")

    # Tentativa 2: LLM com fetch da fabricante
    vehicle = await llm_ingest(req.marca, req.modelo, req.versao or "Padrão", req.ano)
    if vehicle:
        log.info(f"ingested via LLM {req.marca}/{req.modelo}")
        return {"source": "llm", "vehicle": vehicle.model_dump(mode="json")}

    raise HTTPException(404, "veículo não encontrado em nenhuma fonte")


@app.get("/model/metrics", dependencies=[Depends(auth_token)])
def model_metrics():
    _pipe, metrics, version = _get_classifier()
    return {"version": version, **metrics}
