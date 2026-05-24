"""Pré-computa KPIs agregados da base real Ford pra servir via API
sem precisar carregar 175k linhas em runtime.

Output: services/ml/data/ford-real-summary.json
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import json
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path("C:/Users/pedro.martins/ford-fiap-challenge")
BASE1 = ROOT / "services/ml/data/ford_real_base1_full.parquet"
RAW = ROOT / "services/ml/data/ford_real_raw.parquet"
OUT = ROOT / "services/ml/data/ford-real-summary.json"
METRICS = ROOT / "services/ml/models/metrics_real.json"

print(f"📂 Carregando Base 1 ({BASE1.name})…")
b1 = pd.read_parquet(BASE1)
print(f"   {len(b1):,} VINs")

print(f"📂 Carregando raw service log ({RAW.name})…")
raw = pd.read_parquet(RAW)
print(f"   {len(raw):,} service orders")

metrics_real = json.loads(METRICS.read_text(encoding="utf-8")) if METRICS.exists() else {}

# === Agregados gerais ===
total_vins = len(b1)
total_dealers = b1["dealer_venda"].nunique()
total_servicos = len(raw)

# % por perfil
perfis = b1["perfil_real"].value_counts(normalize=True).round(3).to_dict()
perfis_count = b1["perfil_real"].value_counts().to_dict()

# VIN Share real (proxy): clientes ativos = última revisão < 365 dias
ativos = (b1["dias_desde_ultima_revisao"] <= 365).sum()
vin_share = round(ativos / total_vins, 3)

# Por modelo
by_model = b1.groupby("modelo").agg(
    total=("VIN_Hash", "count"),
    fiel=("perfil_real", lambda x: (x == "fiel").sum()),
    abandono=("perfil_real", lambda x: (x == "abandono").sum()),
    esquecido=("perfil_real", lambda x: (x == "esquecido").sum()),
    economico=("perfil_real", lambda x: (x == "economico").sum()),
    revisoes_media=("num_revisoes", "mean"),
    loyalty_media=("dealer_loyalty", "mean"),
).round(2).reset_index().sort_values("total", ascending=False)
by_model["vin_share_modelo"] = (by_model["fiel"] / by_model["total"]).round(3)
by_model_dict = by_model.head(20).to_dict(orient="records")

# Top dealers (mais clientes fieis)
by_dealer = b1.groupby("dealer_venda").agg(
    total_clientes=("VIN_Hash", "count"),
    fieis=("perfil_real", lambda x: (x == "fiel").sum()),
    abandono=("perfil_real", lambda x: (x == "abandono").sum()),
).reset_index()
by_dealer["pct_fieis"] = (by_dealer["fieis"] / by_dealer["total_clientes"]).round(3)
by_dealer = by_dealer[by_dealer["total_clientes"] >= 100].sort_values("pct_fieis", ascending=False)
top_dealers = by_dealer.head(15).to_dict(orient="records")
bottom_dealers = by_dealer.sort_values("pct_fieis").head(15).to_dict(orient="records")

# Distribuição temporal de revisões (cohort por ano de venda)
b1["ano_venda"] = pd.to_datetime(b1["data_venda"]).dt.year
cohorts = b1.groupby("ano_venda").agg(
    total=("VIN_Hash", "count"),
    fieis_pct=("perfil_real", lambda x: (x == "fiel").sum() / len(x)),
    abandono_pct=("perfil_real", lambda x: (x == "abandono").sum() / len(x)),
).round(3).reset_index().to_dict(orient="records")

# Distribuição KM
km_q = b1["km_max"].clip(0, 500000).quantile([0.25, 0.5, 0.75, 0.9, 0.99]).round().to_dict()

# Dias até 1a revisão por perfil
dias_1a = b1.groupby("perfil_real")["dias_ate_1a_revisao"].median().to_dict()

# Loyalty por perfil
loyalty_perfil = b1.groupby("perfil_real")["dealer_loyalty"].mean().round(3).to_dict()

summary = {
    "fonte": "Ford × FIAP Challenge 2026 — vin_share_Desafio_02.xlsx",
    "atualizado_em": "2026-05-20",
    "totais": {
        "vins_unicos": int(total_vins),
        "service_orders": int(total_servicos),
        "dealers": int(total_dealers),
        "modelos_distintos": int(b1["modelo"].nunique()),
        "media_servicos_por_vin": round(total_servicos / total_vins, 2),
    },
    "vin_share_estimado": vin_share,
    "perfis_distribuicao": perfis,
    "perfis_count": {k: int(v) for k, v in perfis_count.items()},
    "vin_share_por_modelo": by_model_dict,
    "top_dealers_fidelidade": top_dealers,
    "bottom_dealers_fidelidade": bottom_dealers,
    "cohorts_por_ano_venda": cohorts,
    "km_quantis": {f"p{int(k*100)}": int(v) for k, v in km_q.items()},
    "dias_ate_1a_revisao_mediana_por_perfil": {k: int(v) for k, v in dias_1a.items()},
    "dealer_loyalty_media_por_perfil": loyalty_perfil,
    "modelo_ml": metrics_real,
}

OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
print(f"\n✓ Salvo em {OUT}")
print(f"   {len(json.dumps(summary, default=str))//1024} KB")
print(f"\nVIN Share real: {vin_share*100:.1f}%")
print(f"Distribuição: {perfis}")
