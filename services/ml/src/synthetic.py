"""Gerador de dados sintéticos para o Desafio 2.

4 perfis (fiel/abandono/esquecido/econômico) gerados por processos distintos —
permite validar se o clustering recupera, e oferece ground truth para o classificador.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

REGIOES = ["sul", "sudeste", "centro_oeste", "nordeste", "norte"]
MODELOS = [
    ("Ka", "SE"), ("Ka", "Titanium"),
    ("Fiesta", "SE"), ("Fiesta", "Titanium"),
    ("EcoSport", "SE"), ("EcoSport", "Titanium"),
    ("Ranger", "XL"), ("Ranger", "XLS"), ("Ranger", "XLT"),
    ("Ranger", "Limited"), ("Ranger", "Raptor"),
    ("Territory", "SEL"), ("Territory", "Titanium"),
    ("Bronco", "Wildtrack"), ("Bronco", "Badlands"),
]
PERFIS = ["fiel", "abandono", "esquecido", "economico"]


def _gen_one(rng: np.random.Generator, perfil: str) -> dict:
    modelo, versao = MODELOS[rng.integers(0, len(MODELOS))]

    if perfil == "fiel":
        idade = int(np.clip(rng.normal(48, 11), 22, 85))
        renda = int(np.clip(rng.normal(14000, 5000), 2500, 60000))
        score = int(np.clip(rng.normal(780, 80), 300, 1000))
    elif perfil == "abandono":
        idade = int(np.clip(rng.normal(35, 9), 20, 70))
        renda = int(np.clip(rng.normal(7500, 3000), 1800, 40000))
        score = int(np.clip(rng.normal(620, 110), 200, 950))
    elif perfil == "esquecido":
        idade = int(np.clip(rng.normal(42, 13), 22, 80))
        renda = int(np.clip(rng.normal(9000, 4000), 2000, 45000))
        score = int(np.clip(rng.normal(680, 100), 250, 980))
    else:  # economico
        idade = int(np.clip(rng.normal(40, 10), 25, 70))
        renda = int(np.clip(rng.normal(6500, 2500), 1500, 30000))
        score = int(np.clip(rng.normal(660, 95), 280, 960))

    preco_pago = int(np.clip(rng.normal(85000 + (score - 600) * 100, 25000), 35000, 600000))
    financ_p = {"a_vista": 0.15, "financiado": 0.65, "leasing": 0.05, "consorcio": 0.15}
    if perfil == "abandono":
        financ_p = {"a_vista": 0.08, "financiado": 0.75, "leasing": 0.04, "consorcio": 0.13}
    financiamento = rng.choice(list(financ_p.keys()), p=list(financ_p.values()))
    parcelas = 0 if financiamento == "a_vista" else int(rng.choice([24, 36, 48, 60, 72]))
    canal_p = {"concessionaria": 0.55, "online": 0.25, "indicacao": 0.15, "frota": 0.05}
    canal = rng.choice(list(canal_p.keys()), p=list(canal_p.values()))

    if perfil == "fiel":
        num_esperadas = rng.integers(3, 9)
        num_realizadas = max(0, num_esperadas - rng.integers(0, 2))
        gasto = int(num_realizadas * rng.normal(1800, 400))
        dias_ultimo = int(np.clip(rng.normal(90, 50), 5, 365))
        seguiu = float(np.clip(rng.normal(0.92, 0.08), 0, 1))
        reclamacoes = rng.integers(0, 2)
        nps = int(np.clip(rng.normal(9, 1.2), 0, 10))
    elif perfil == "abandono":
        num_esperadas = rng.integers(2, 8)
        num_realizadas = rng.integers(0, 2)
        gasto = int(num_realizadas * rng.normal(900, 300))
        dias_ultimo = int(np.clip(rng.normal(720, 200), 180, 1500))
        seguiu = float(np.clip(rng.normal(0.15, 0.12), 0, 1))
        reclamacoes = rng.integers(0, 4)
        nps = int(np.clip(rng.normal(4, 2.5), 0, 10)) if rng.random() > 0.4 else None
    elif perfil == "esquecido":
        num_esperadas = rng.integers(3, 9)
        num_realizadas = max(0, num_esperadas - rng.integers(2, 5))
        gasto = int(num_realizadas * rng.normal(1500, 400))
        dias_ultimo = int(np.clip(rng.normal(400, 150), 90, 1100))
        seguiu = float(np.clip(rng.normal(0.55, 0.18), 0, 1))
        reclamacoes = rng.integers(0, 3)
        nps = int(np.clip(rng.normal(6, 2), 0, 10)) if rng.random() > 0.3 else None
    else:  # economico
        num_esperadas = rng.integers(3, 8)
        num_realizadas = max(1, num_esperadas - rng.integers(1, 4))
        gasto = int(num_realizadas * rng.normal(950, 250))
        dias_ultimo = int(np.clip(rng.normal(220, 110), 30, 800))
        seguiu = float(np.clip(rng.normal(0.45, 0.15), 0, 1))
        reclamacoes = rng.integers(0, 3)
        nps = int(np.clip(rng.normal(7, 1.8), 0, 10))

    data_compra = date.today() - timedelta(days=int(rng.integers(180, 2200)))

    return {
        "idade": idade, "genero": rng.choice(["M", "F", "outro"], p=[0.58, 0.40, 0.02]),
        "regiao": rng.choice(REGIOES, p=[0.15, 0.45, 0.10, 0.20, 0.10]),
        "renda_mensal_brl": renda,
        "estado_civil": rng.choice(["solteiro", "casado", "divorciado", "viuvo"], p=[0.30, 0.52, 0.12, 0.06]),
        "score_credito": score,
        "modelo_comprado": modelo, "versao_comprada": versao,
        "preco_pago_brl": preco_pago, "financiamento": financiamento,
        "parcelas": parcelas, "canal_aquisicao": canal,
        "primeiro_carro": bool(rng.random() < 0.32),
        "test_drive_realizado": bool(rng.random() < 0.72),
        "dealership_id": f"D{rng.integers(1, 121):03d}",
        "data_compra": data_compra,
        "num_revisoes_realizadas": int(num_realizadas),
        "num_revisoes_esperadas": int(num_esperadas),
        "gasto_total_servicos_brl": max(0, int(gasto)),
        "dias_desde_ultima_visita": int(dias_ultimo),
        "seguiu_recomendacoes_pct": round(seguiu, 3),
        "reclamacoes_abertas": int(reclamacoes),
        "garantia_ativa": (date.today() - data_compra).days < 1095,
        "nps_ultima_visita": nps,
        "perfil_real": perfil,
    }


def _draw_perfil(rng: np.random.Generator) -> str:
    return rng.choice(PERFIS, p=[0.32, 0.28, 0.22, 0.18])


def generate(n: int = 10_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    return pd.DataFrame([_gen_one(rng, _draw_perfil(rng)) for _ in range(n)])


BASE2_COLUMNS = [
    "idade", "genero", "regiao", "renda_mensal_brl", "estado_civil",
    "score_credito", "modelo_comprado", "versao_comprada", "preco_pago_brl",
    "financiamento", "parcelas", "canal_aquisicao", "primeiro_carro",
    "test_drive_realizado", "dealership_id",
]


def split_base1_base2(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Base 1 = tudo (com pós-compra); Base 2 = só pré-compra + perfil rotulado."""
    return df.copy(), df[BASE2_COLUMNS + ["perfil_real"]].copy()
