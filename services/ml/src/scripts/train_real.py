"""Treina o classificador v2 com dados REAIS da Ford (vin_share)."""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[4]
ML_DIR = ROOT / "services" / "ml"
sys.path.insert(0, str(ML_DIR))

from src.classifier_real import train, save, MODEL_VERSION  # noqa: E402

BASE2 = ML_DIR / "data" / "ford_real_base2_classifier.parquet"
OUT_MODEL = ML_DIR / "models" / "classifier_real_v1.joblib"
OUT_METRICS = ML_DIR / "models" / "metrics_real.json"

if not BASE2.exists():
    raise SystemExit(f"❌ Base 2 real não encontrada em {BASE2}. Rode scripts/etl-d2-real.py primeiro.")

print(f"📂 Carregando Base 2 real: {BASE2.name}")
df = pd.read_parquet(BASE2)
print(f"   {len(df):,} amostras · {len(df.columns)} cols")
print(f"   Distribuição perfil_real:\n{df['perfil_real'].value_counts(normalize=True)}\n")

print(f"🧠 Treinando {MODEL_VERSION} (XGBoost) com dados Ford reais…")
pipe, metrics = train(df)

print("\n📊 Métricas:")
print(f"   Accuracy:    {metrics['accuracy']:.4f}")
print(f"   F1 macro:    {metrics['f1_macro']:.4f}")
print(f"   F1 weighted: {metrics['f1_weighted']:.4f}")
print(f"   Train/Test:  {metrics['n_samples_train']:,} / {metrics['n_samples_test']:,}")
print("\nMatriz de confusão:")
print("              " + "  ".join(f"{l:>10}" for l in metrics["labels"]))
for i, label in enumerate(metrics["labels"]):
    row = metrics["confusion_matrix"][i]
    print(f"  Real {label:9}" + "  ".join(f"{v:>10}" for v in row))

print("\nRelatório por classe:")
for label in metrics["labels"]:
    r = metrics["report"][label]
    print(f"  {label:10}: precision {r['precision']:.3f} · recall {r['recall']:.3f} · f1 {r['f1-score']:.3f} · suporte {r['support']:.0f}")

OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
save(pipe, metrics, str(OUT_MODEL))
print(f"\n✓ Modelo salvo em {OUT_MODEL}")

# Salva métricas em JSON pra UI / docs
OUT_METRICS.write_text(json.dumps({
    "model_version": metrics["model_version"],
    "n_samples_train": metrics["n_samples_train"],
    "n_samples_test": metrics["n_samples_test"],
    "accuracy": metrics["accuracy"],
    "f1_macro": metrics["f1_macro"],
    "f1_weighted": metrics["f1_weighted"],
    "confusion_matrix": metrics["confusion_matrix"],
    "labels": metrics["labels"],
    "per_class": {l: metrics["report"][l] for l in metrics["labels"]},
    "dataset_source": "Ford × FIAP — vin_share_Desafio_02.xlsx (175,554 VINs Brasil)",
}, indent=2, default=str), encoding="utf-8")
print(f"✓ Métricas salvas em {OUT_METRICS}")
