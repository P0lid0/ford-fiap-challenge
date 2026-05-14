"""Segmentação não-supervisionada na Base 1."""
from __future__ import annotations

import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BEHAVIORAL_FEATURES = [
    "num_revisoes_realizadas", "num_revisoes_esperadas",
    "gasto_total_servicos_brl", "dias_desde_ultima_visita",
    "seguiu_recomendacoes_pct", "reclamacoes_abertas",
]
DERIVED_FEATURES = ["taxa_aderencia_revisoes"]
ALL_FEATURES = BEHAVIORAL_FEATURES + DERIVED_FEATURES


def _derive(df: pd.DataFrame) -> pd.DataFrame:
    X = df[BEHAVIORAL_FEATURES].copy()
    X["taxa_aderencia_revisoes"] = (
        X["num_revisoes_realizadas"] / X["num_revisoes_esperadas"].clip(lower=1)
    )
    return X[ALL_FEATURES]


def build_pipeline(k: int = 4, seed: int = 42) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("kmeans", KMeans(n_clusters=k, n_init=20, random_state=seed)),
    ])


def _map_clusters_to_personas(summary: pd.DataFrame) -> dict[int, str]:
    summary = summary.copy()
    summary["score_fidelidade"] = (
        summary["taxa_aderencia"] * 1.5 + summary["seguiu_rec"]
        - summary["dias_ultimo"] / 1000
    )
    ordered = summary.sort_values("score_fidelidade", ascending=False)
    fiel = int(ordered.index[0])
    abandono = int(ordered.index[-1])
    restantes = [int(c) for c in summary.index if int(c) not in (fiel, abandono)]
    esquecido = max(restantes, key=lambda c: summary.loc[c, "dias_ultimo"])
    economico = [c for c in restantes if c != esquecido][0]
    return {fiel: "fiel", abandono: "abandono", esquecido: "esquecido", economico: "economico"}


def fit_and_label(df: pd.DataFrame, seed: int = 42) -> tuple[Pipeline, pd.DataFrame, dict]:
    X = _derive(df)
    pipe = build_pipeline(k=4, seed=seed)
    labels = pipe.fit_predict(X)
    sil = float(silhouette_score(pipe.named_steps["scaler"].transform(X), labels))

    df_out = df.copy()
    df_out["cluster"] = labels
    centroid_summary = df_out.groupby("cluster").agg(
        taxa_aderencia=("num_revisoes_realizadas", "mean"),
        dias_ultimo=("dias_desde_ultima_visita", "mean"),
        gasto_medio=("gasto_total_servicos_brl", "mean"),
        seguiu_rec=("seguiu_recomendacoes_pct", "mean"),
    )
    mapping = _map_clusters_to_personas(centroid_summary)
    df_out["perfil_descoberto"] = df_out["cluster"].map(mapping)

    metrics = {
        "silhouette_score": sil,
        "cluster_sizes": df_out["cluster"].value_counts().to_dict(),
        "cluster_to_persona": {str(k): v for k, v in mapping.items()},
        "centroid_summary": centroid_summary.to_dict("index"),
    }
    return pipe, df_out, metrics


def save(pipe: Pipeline, mapping: dict[int, str], path: str) -> None:
    joblib.dump({"pipeline": pipe, "mapping": mapping, "features": ALL_FEATURES}, path)


def load(path: str) -> tuple[Pipeline, dict[int, str]]:
    obj = joblib.load(path)
    return obj["pipeline"], obj["mapping"]
