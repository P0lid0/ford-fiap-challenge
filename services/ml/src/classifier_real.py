"""Classificador Ford v2 — treinado nos dados REAIS do vin_share_Desafio_02.xlsx.

Features na compra (sem leakage):
  - modelo (categórico)
  - ano_modelo
  - dealer_venda (categórico, ~435 unique)
  - mes_venda, trimestre_venda, dia_semana_venda, ano_venda
  - dealer_pct_{fiel,abandono,esquecido,economico}: % histórico do dealer
  - dealer_total_vendas
  - modelo_pct_{fiel,abandono,esquecido,economico}: % histórico do modelo

Target: perfil_real (4 classes, derivado por regras de comportamento na Base 1).
"""
from __future__ import annotations
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

NUMERIC = [
    "ano_modelo", "ano_venda", "mes_venda", "trimestre_venda", "dia_semana_venda",
    "dealer_total_vendas",
    "dealer_pct_fiel", "dealer_pct_abandono", "dealer_pct_esquecido", "dealer_pct_economico",
    "modelo_pct_fiel", "modelo_pct_abandono", "modelo_pct_esquecido", "modelo_pct_economico",
]
CATEGORICAL = ["modelo", "dealer_venda"]

PERFIS = ["abandono", "economico", "esquecido", "fiel"]
MODEL_VERSION = "xgb-real-v1"


def build_pipeline() -> Pipeline:
    pre = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=50), CATEGORICAL),
    ])
    clf = XGBClassifier(
        n_estimators=400, max_depth=7, learning_rate=0.06,
        objective="multi:softprob", num_class=4, eval_metric="mlogloss",
        random_state=42, n_jobs=-1, tree_method="hist",
    )
    return Pipeline([("pre", pre), ("clf", clf)])


def train(df_base2: pd.DataFrame, target_col: str = "perfil_real"):
    df = df_base2.dropna(subset=[target_col]).copy()
    # garante que as colunas necessárias existem
    for c in NUMERIC:
        if c not in df.columns:
            df[c] = 0
    for c in CATEGORICAL:
        if c not in df.columns:
            df[c] = "unknown"
        else:
            df[c] = df[c].astype(str)

    y = df[target_col].map({p: i for i, p in enumerate(PERFIS)})
    X = df[NUMERIC + CATEGORICAL]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    pipe = build_pipeline()
    pipe.fit(X_tr, y_tr)
    y_pred = pipe.predict(X_te)
    metrics = {
        "accuracy": float(accuracy_score(y_te, y_pred)),
        "f1_macro": float(f1_score(y_te, y_pred, average="macro")),
        "f1_weighted": float(f1_score(y_te, y_pred, average="weighted")),
        "confusion_matrix": confusion_matrix(y_te, y_pred).tolist(),
        "labels": PERFIS,
        "report": classification_report(y_te, y_pred, target_names=PERFIS, output_dict=True),
        "model_version": MODEL_VERSION,
        "n_samples_train": int(len(X_tr)),
        "n_samples_test": int(len(X_te)),
    }
    return pipe, metrics


def predict(pipe: Pipeline, row: dict) -> dict:
    """Recebe um dict com features e retorna predição."""
    df = pd.DataFrame([row])
    for c in NUMERIC:
        if c not in df.columns: df[c] = 0
    for c in CATEGORICAL:
        if c not in df.columns: df[c] = "unknown"
        else: df[c] = df[c].astype(str)
    proba = pipe.predict_proba(df[NUMERIC + CATEGORICAL])[0]
    idx = int(np.argmax(proba))
    probabilidades = {PERFIS[i]: float(proba[i]) for i in range(len(PERFIS))}
    risco_evasao = probabilidades["abandono"] + 0.6 * probabilidades["esquecido"]
    return {
        "perfil_predito": PERFIS[idx],
        "probabilidades": probabilidades,
        "risco_evasao": float(risco_evasao),
        "confianca": float(np.max(proba)),
    }


def save(pipe, metrics, path):
    joblib.dump({"pipeline": pipe, "metrics": metrics, "labels": PERFIS, "version": MODEL_VERSION}, path)


def load(path):
    obj = joblib.load(path)
    return obj["pipeline"], obj["metrics"], obj.get("version", MODEL_VERSION)
