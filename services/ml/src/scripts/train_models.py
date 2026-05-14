"""Treina clustering + classifier a partir de dados sintéticos."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src import clustering, classifier, synthetic
from src.config import settings


def main(n: int = 10_000):
    print(f"[1/4] gerando {n} clientes sintéticos...")
    df = synthetic.generate(n=n, seed=42)
    print(f"     shape={df.shape}")

    print("[2/4] segmentação na Base 1 (K-Means)...")
    pipe_cluster, df_labeled, cluster_metrics = clustering.fit_and_label(df)
    print(f"     silhouette={cluster_metrics['silhouette_score']:.3f}")

    base1, base2 = synthetic.split_base1_base2(df_labeled)
    base1.to_parquet(settings.synthetic_data_dir / "base1_full.parquet", index=False)
    base2.to_parquet(settings.synthetic_data_dir / "base2_classifier.parquet", index=False)

    print("[3/4] classificador na Base 2 (XGBoost)...")
    pipe_clf, clf_metrics = classifier.train(base2, target_col="perfil_real")
    print(f"     accuracy={clf_metrics['accuracy']:.3f}  f1_macro={clf_metrics['f1_macro']:.3f}")

    print("[4/4] persistindo artefatos...")
    clustering.save(pipe_cluster, cluster_metrics["cluster_to_persona"],
                    str(settings.models_dir / "clustering_base1.joblib"))
    classifier.save(pipe_clf, clf_metrics,
                    str(settings.models_dir / "classifier_base2.joblib"))

    metrics_path = settings.models_dir / "metrics.json"
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump({
            "cluster_metrics": {k: v for k, v in cluster_metrics.items() if k != "centroid_summary"},
            "classifier_metrics": {k: v for k, v in clf_metrics.items() if k != "report"},
        }, f, indent=2, default=str)
    print(f"[OK] metrics: {metrics_path}")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000
    main(n=n)
