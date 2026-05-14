"""ML Service — FastAPI.

Expõe /predict para o API gateway Node, /ingest para o scraper de Desafio 1,
e /train para retreino. Token compartilhado obrigatório no header.
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(
    title="Ford FIAP ML Service",
    version="0.1.0",
    description="Classificação de perfil + ingestão de fichas técnicas.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODEL_PATH = settings.models_dir / "classifier_base2.joblib"
_classifier = None


def _get_classifier():
    global _classifier
    if _classifier is None:
        if not MODEL_PATH.exists():
            raise HTTPException(503, f"modelo não encontrado em {MODEL_PATH}; rode train_models.py")
        _classifier = load_classifier(str(MODEL_PATH))
    return _classifier


def auth_token(authorization: str | None = Header(default=None)):
    """Token compartilhado entre API gateway e ML service."""
    if not settings.ml_service_token or settings.ml_service_token in ("", "change-me"):
        # Modo dev sem token configurado → permite.
        return True
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if token != settings.ml_service_token:
        raise HTTPException(403, "invalid token")
    return True


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
        "model_path": str(MODEL_PATH),
    }


@app.post("/predict", response_model=PredictResponse, dependencies=[Depends(auth_token)])
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
