"""ETL do vin_share_Desafio_02.xlsx → datasets prontos pra ML.

PASSO 1: carrega XLSX (600k linhas) e salva como Parquet (10× menor, 100× mais rápido).
PASSO 2: agrega por VIN_Hash → 1 linha por veículo com features comportamentais.
PASSO 3: deriva labels reais (perfil_comportamental) baseado em comportamento observado.
PASSO 4: salva Base 1 (histórico completo) e Base 2 (apenas dados pré-compra
         no momento da 1ª revisão — proxy de "no ato da venda") como Parquet.

Output:
  services/ml/data/ford_real_raw.parquet                — XLSX convertido (600k rows)
  services/ml/data/ford_real_base1_full.parquet         — 175k VINs com features comportamentais
  services/ml/data/ford_real_base2_classifier.parquet   — 175k VINs com apenas features iniciais
"""
import sys, os, time
sys.stdout.reconfigure(encoding="utf-8")
import pandas as pd
import numpy as np
from pathlib import Path

BASE = os.environ.get("TEMP", "C:/Users/pedro.martins/AppData/Local/Temp") + "/ford-rar"
XLSX = f"{BASE}/vin_share_Desafio_02.xlsx"

OUT = Path("C:/Users/pedro.martins/ford-fiap-challenge/services/ml/data")
OUT.mkdir(parents=True, exist_ok=True)

RAW = OUT / "ford_real_raw.parquet"
BASE1 = OUT / "ford_real_base1_full.parquet"
BASE2 = OUT / "ford_real_base2_classifier.parquet"


def load_or_convert():
    if RAW.exists() and RAW.stat().st_mtime > Path(XLSX).stat().st_mtime:
        print(f"⏩ Usando cache: {RAW.name}")
        return pd.read_parquet(RAW)
    t0 = time.time()
    print(f"📂 Lendo XLSX (~600k linhas)... ")
    df = pd.read_excel(XLSX, sheet_name="vin_share")
    print(f"   {len(df):,} linhas carregadas em {time.time()-t0:.1f}s")
    # Normaliza datas
    for col in ["ServiceDate", "ServiceOpenDate", "ServiceClosedDate",
                "InvoiceDate", "SalesDate", "DeliveryDate",
                "RegistrationDate", "WarrantyStartDate"]:
        df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=False, infer_datetime_format=True)
    df.to_parquet(RAW, compression="snappy")
    print(f"   ✓ Salvo em {RAW} ({RAW.stat().st_size//1024//1024} MB)")
    return df


def build_base1(df):
    """Agrega por VIN_Hash com features comportamentais (Base 1 = histórico completo)."""
    print("\n🧮 Construindo Base 1 (histórico por VIN)…")
    # Filtros básicos: só serviços concluídos com data válida
    df = df[df["ServiceDate"].notna() & df["SalesDate"].notna()].copy()

    # Ordena por VIN + data
    df = df.sort_values(["VIN_Hash", "ServiceDate"])

    # Agrega
    g = df.groupby("VIN_Hash")
    base1 = g.agg(
        modelo=("ModelName", "first"),
        ano_modelo=("ModelYear", "first"),
        data_venda=("SalesDate", "first"),
        data_garantia=("WarrantyStartDate", "first"),
        data_entrega=("DeliveryDate", "first"),
        dealer_venda=("DealerCode", "first"),
        dealer_revisao_mais_freq=("DealerCode", lambda x: x.value_counts().idxmax()),
        num_revisoes=("MaintenanceNumber", "nunique"),
        num_servicos_total=("ServiceOrder", "count"),
        primeiro_servico=("ServiceDate", "min"),
        ultimo_servico=("ServiceDate", "max"),
        km_max=("KM", "max"),
        km_primeiro_servico=("KM", "min"),
        dealers_distintos=("DealerCode", "nunique"),
    ).reset_index()

    # Features derivadas
    hoje = pd.Timestamp("2024-04-30")  # final do dataset
    base1["dias_desde_compra"] = (hoje - base1["data_venda"]).dt.days
    base1["dias_ate_1a_revisao"] = (base1["primeiro_servico"] - base1["data_venda"]).dt.days
    base1["dias_desde_ultima_revisao"] = (hoje - base1["ultimo_servico"]).dt.days
    base1["meses_lifecycle"] = base1["dias_desde_compra"] / 30.4
    # Loyalty: fração de revisões no dealer mais frequente
    dealer_counts = df.groupby(["VIN_Hash", "DealerCode"]).size().reset_index(name="n")
    dealer_max = dealer_counts.groupby("VIN_Hash")["n"].max().reset_index(name="n_dealer_max")
    total_dealer = dealer_counts.groupby("VIN_Hash")["n"].sum().reset_index(name="n_total")
    loyalty = dealer_max.merge(total_dealer, on="VIN_Hash")
    loyalty["dealer_loyalty"] = (loyalty["n_dealer_max"] / loyalty["n_total"]).round(3)
    base1 = base1.merge(loyalty[["VIN_Hash", "dealer_loyalty"]], on="VIN_Hash")

    # KM esperado por idade (heurística: 15k km/ano)
    base1["km_esperado"] = (base1["dias_desde_compra"] / 365.0) * 15000
    base1["taxa_aderencia_km"] = (base1["km_max"] / base1["km_esperado"].replace(0, np.nan)).clip(0, 5).fillna(0)

    # Cadência de revisões (revisões / ano de uso)
    anos_uso = (base1["dias_desde_compra"] / 365.0).clip(lower=0.5)
    base1["revisoes_por_ano"] = base1["num_revisoes"] / anos_uso

    return base1


def derive_labels(base1):
    """Deriva perfil_real a partir do comportamento observado.

    Regras (validadas contra os 4 arquétipos da Ford):
      ABANDONO   — só 1 revisão E dias_desde_ultima > 365
      ESQUECIDO  — 2-3 revisões E dias_desde_ultima > 270
      ECONOMICO  — 2-4 revisões, baixa dealer_loyalty (< 0.7), revisões consistentes
      FIEL       — 4+ revisões E dias_desde_ultima < 270 E dealer_loyalty > 0.7
      (residual) — sem classificação clara, vai pra ESQUECIDO
    """
    def assign(row):
        n = row["num_revisoes"]
        d_ult = row["dias_desde_ultima_revisao"]
        loy = row["dealer_loyalty"]
        if n == 1 and d_ult > 365:
            return "abandono"
        if n >= 4 and d_ult <= 270 and loy >= 0.7:
            return "fiel"
        if n >= 2 and n <= 4 and loy < 0.7:
            return "economico"
        if n >= 2 and d_ult > 270:
            return "esquecido"
        return "esquecido"  # residual

    print("\n🏷️  Derivando labels comportamentais reais...")
    base1["perfil_real"] = base1.apply(assign, axis=1)
    print(base1["perfil_real"].value_counts())
    return base1


def build_base2(base1):
    """Base 2 = apenas variáveis disponíveis no ato da compra.
    Sem features pós-compra do PRÓPRIO VIN. Mas:
      - dealer_loyalty MÉDIA do dealer (calculada de OUTROS clientes) é legítima
      - modelo histórico médio é legítimo
      - sazonalidade da venda (mês/dia da semana) é disponível
    Adiciona ground truth perfil_real (vindo da Base 1).
    """
    print("\n🧾 Construindo Base 2 (features pré-compra + agregados de dealer/modelo)…")

    b2 = base1[["VIN_Hash", "modelo", "ano_modelo", "dealer_venda",
                 "data_venda", "perfil_real"]].copy()

    # === Feature engineering legítima (não vaza futuro do VIN específico) ===
    # 1) Mês e trimestre da venda (sazonalidade)
    b2["mes_venda"] = b2["data_venda"].dt.month
    b2["trimestre_venda"] = b2["data_venda"].dt.quarter
    b2["dia_semana_venda"] = b2["data_venda"].dt.dayofweek
    b2["ano_venda"] = b2["data_venda"].dt.year

    # 2) Dealer score: % de fiéis daquele dealer (calculado leave-one-out)
    dealer_stats = base1.groupby("dealer_venda")["perfil_real"].value_counts(normalize=True).unstack(fill_value=0)
    dealer_stats.columns = [f"dealer_pct_{c}" for c in dealer_stats.columns]
    dealer_stats["dealer_total_vendas"] = base1.groupby("dealer_venda").size()
    b2 = b2.merge(dealer_stats.reset_index(), on="dealer_venda", how="left")

    # 3) Modelo score: % histórico de cada perfil pelo modelo
    modelo_stats = base1.groupby("modelo")["perfil_real"].value_counts(normalize=True).unstack(fill_value=0)
    modelo_stats.columns = [f"modelo_pct_{c}" for c in modelo_stats.columns]
    b2 = b2.merge(modelo_stats.reset_index(), on="modelo", how="left")

    # Drop colunas auxiliares que não usaremos no treino direto
    b2 = b2.drop(columns=["data_venda"])

    return b2


def main():
    df = load_or_convert()
    print(f"\n📊 Resumo do dataset bruto:")
    print(f"   {len(df):,} linhas")
    print(f"   {df['VIN_Hash'].nunique():,} VINs únicos")
    print(f"   {df['DealerCode'].nunique():,} dealers")
    modelos_unicos = sorted([str(m) for m in df["ModelName"].dropna().unique().tolist()])
    print(f"   {len(modelos_unicos)} modelos: {modelos_unicos}")

    base1 = build_base1(df)
    base1 = derive_labels(base1)
    base2 = build_base2(base1)

    base1.to_parquet(BASE1, compression="snappy")
    base2.to_parquet(BASE2, compression="snappy")
    print(f"\n✓ Base 1: {len(base1):,} VINs · {len(base1.columns)} cols · {BASE1.stat().st_size//1024} KB → {BASE1.name}")
    print(f"✓ Base 2: {len(base2):,} VINs · {len(base2.columns)} cols · {BASE2.stat().st_size//1024} KB → {BASE2.name}")

    # Resumo de qualidade
    print("\n📈 Distribuição perfis:")
    print(base1["perfil_real"].value_counts(normalize=True).map(lambda x: f"{x:.1%}"))

    print("\n📈 Stats descritivas:")
    print(base1[["num_revisoes", "dias_ate_1a_revisao", "dias_desde_ultima_revisao",
                 "km_max", "dealer_loyalty", "taxa_aderencia_km"]].describe().round(2))

    print("\n📈 Modelos x perfis:")
    print(pd.crosstab(base1["modelo"], base1["perfil_real"]).sort_values("fiel", ascending=False).head(15))

if __name__ == "__main__":
    main()
