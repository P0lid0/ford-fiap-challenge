"""Classificador supervisionado na Base 2 — sem data leakage."""
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

NUMERIC = ["idade", "renda_mensal_brl", "score_credito", "preco_pago_brl", "parcelas"]
CATEGORICAL = ["genero", "regiao", "estado_civil", "modelo_comprado",
               "versao_comprada", "financiamento", "canal_aquisicao"]
BOOLEAN = ["primeiro_carro", "test_drive_realizado"]

PERFIS = ["abandono", "economico", "esquecido", "fiel"]
MODEL_VERSION = "xgb-v1"


def build_pipeline() -> Pipeline:
    pre = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ("bool", "passthrough", BOOLEAN),
    ])
    clf = XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.08,
        objective="multi:softprob", num_class=4, eval_metric="mlogloss",
        random_state=42, n_jobs=-1,
    )
    return Pipeline([("pre", pre), ("clf", clf)])


def train(df_base2: pd.DataFrame, target_col: str = "perfil_real"):
    df = df_base2.dropna(subset=[target_col]).copy()
    y = df[target_col].map({p: i for i, p in enumerate(PERFIS)})
    X = df[NUMERIC + CATEGORICAL + BOOLEAN]
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
    }
    return pipe, metrics


def predict(pipe: Pipeline, row: dict) -> dict:
    df = pd.DataFrame([row])
    proba = pipe.predict_proba(df[NUMERIC + CATEGORICAL + BOOLEAN])[0]
    idx = int(np.argmax(proba))
    probabilidades = {PERFIS[i]: float(proba[i]) for i in range(len(PERFIS))}
    risco_evasao = probabilidades["abandono"] + 0.6 * probabilidades["esquecido"]
    return {
        "perfil_predito": PERFIS[idx],
        "probabilidades": probabilidades,
        "risco_evasao": float(risco_evasao),
        "confianca": float(np.max(proba)),
    }


def save(pipe: Pipeline, metrics: dict, path: str) -> None:
    joblib.dump({"pipeline": pipe, "metrics": metrics, "labels": PERFIS, "version": MODEL_VERSION}, path)


def load(path: str) -> tuple[Pipeline, dict, str]:
    obj = joblib.load(path)
    return obj["pipeline"], obj["metrics"], obj.get("version", MODEL_VERSION)


ACOES_POR_PERFIL: dict[str, list[str]] = {
    "fiel": ["Convite para programa de fidelidade premium",
             "Oferta de upgrade no próximo modelo com condições preferenciais",
             "Convite para eventos da marca"],
    "abandono": ["Contato proativo do consultor sênior em até 7 dias",
                 "Pacote de revisão com desconto agressivo (até -30%)",
                 "Cashback em primeira manutenção fora da garantia",
                 "Pesquisa qualitativa para entender motivo de saída"],
    "esquecido": ["Campanha de SMS+WhatsApp lembrando próxima revisão",
                  "Bônus por trazer o carro à concessionária nos próximos 30 dias",
                  "Oferta de busca/entrega domiciliar do veículo"],
    "economico": ["Pacote de revisão fixo com preço fechado",
                  "Programa de assinatura de manutenção (mensalidade baixa)",
                  "Cross-sell de peças genuínas com desconto progressivo"],
}
