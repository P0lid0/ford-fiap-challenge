"""Schema canônico para ficha técnica — Desafio 1.

Princípios:
- Tudo opcional. Ausência → None (regra Ford "vazio / não disponível").
- Unidade no nome (cc, cv, nm, mm, kg, l, kmh, kml, brl).
- schema_version permite evolução sem quebrar consumidores.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "1.0.0"


class Motor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cilindrada_cc: int | None = None
    potencia_cv: int | None = None
    torque_nm: int | None = None
    combustivel: str | None = None
    aspiracao: str | None = None
    cilindros: int | None = None


class Dimensoes(BaseModel):
    model_config = ConfigDict(extra="ignore")
    comprimento_mm: int | None = None
    largura_mm: int | None = None
    altura_mm: int | None = None
    entre_eixos_mm: int | None = None
    vao_livre_mm: int | None = None
    peso_kg: int | None = None
    capacidade_porta_malas_l: int | None = None
    capacidade_cacamba_l: int | None = None
    capacidade_carga_kg: int | None = None
    capacidade_reboque_kg: int | None = None


class Transmissao(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tipo: str | None = None
    marchas: int | None = None
    tracao: str | None = None


class Desempenho(BaseModel):
    model_config = ConfigDict(extra="ignore")
    aceleracao_0_100_s: float | None = None
    velocidade_max_kmh: int | None = None
    consumo_cidade_kml: float | None = None
    consumo_estrada_kml: float | None = None
    autonomia_km: int | None = None


class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: UUID = Field(default_factory=uuid4)
    schema_version: str = SCHEMA_VERSION

    marca: str
    modelo: str
    versao: str
    ano: int
    categoria: str

    motor: Motor = Field(default_factory=Motor)
    dimensoes: Dimensoes = Field(default_factory=Dimensoes)
    transmissao: Transmissao = Field(default_factory=Transmissao)
    desempenho: Desempenho = Field(default_factory=Desempenho)

    equipamentos: list[str] = Field(default_factory=list)
    preco_brl: int | None = None
    pais_origem: str | None = None

    fontes: list[str] = Field(default_factory=list)
    atualizado_em: datetime = Field(default_factory=datetime.utcnow)

    def to_supabase_row(self) -> dict[str, Any]:
        d = self.model_dump(mode="json")
        d.pop("id", None)
        d.pop("atualizado_em", None)
        return d
