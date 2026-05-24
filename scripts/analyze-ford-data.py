"""Análise profunda dos 2 datasets reais da Ford.
Foco: entender o que dá pra plugar no nosso sistema (D1 catálogo + D2 ML real).
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import os
import pandas as pd

BASE = os.environ.get("TEMP", "C:/Users/pedro.martins/AppData/Local/Temp") + "/ford-rar"
D1 = f"{BASE}/FIAP-Ford - Data sheet_Desafio_01_v02.xlsx"
D2 = f"{BASE}/vin_share_Desafio_02.xlsx"

print("=" * 80)
print("DESAFIO 1 — Data sheet (catálogo Ranger 26MY)")
print("=" * 80)
df1 = pd.read_excel(D1, sheet_name="BASE")
print(f"Total linhas: {len(df1)}")
print(f"Colunas: {list(df1.columns)}")
print()
# Mostra todas as linhas pra entender estrutura
print("PRIMEIRAS 40 LINHAS (estrutura do catálogo):")
print(df1.head(40).to_string())
print()
print(f"\n... LINHAS 100-130 (meio do arquivo):")
print(df1.iloc[100:130].to_string())

print("\n" + "=" * 80)
print("DESAFIO 2 — VIN Share (histórico real de service)")
print("=" * 80)
df2 = pd.read_excel(D2, sheet_name="vin_share")
print(f"Total linhas: {len(df2):,}")
print()
print("Modelos únicos:")
print(df2["ModelName"].value_counts().head(20))
print()
print("Distribuição por Country:")
print(df2["Country"].value_counts())
print()
print("Distribuição por ModelYear:")
print(df2["ModelYear"].value_counts().sort_index())
print()
print("Distribuição por ServiceType:")
print(df2["ServiceType"].value_counts())
print()
print("Distribuição por StatusUSA:")
print(df2["StatusUSA"].value_counts().head(15))
print()
print("VINs únicos:")
n_vins = df2["VIN_Hash"].nunique()
print(f"  {n_vins:,} VINs distintos em {len(df2):,} ordens de serviço")
print(f"  Média de serviços por VIN: {len(df2)/n_vins:.2f}")
print()
print("Distribuição de MaintenanceNumber (numero da revisão):")
print(df2["MaintenanceNumber"].value_counts().sort_index().head(20))
print()
print("DealerCode únicos:")
print(f"  {df2['DealerCode'].nunique():,} concessionárias distintas")
print("  Top 10 com mais serviços:")
print(df2["DealerCode"].value_counts().head(10))
print()
print("KM (distribuição):")
print(df2["KM"].describe())
print()
print("Faixa temporal (SalesDate):")
print(f"  Primeira venda: {df2['SalesDate'].min()}")
print(f"  Última venda: {df2['SalesDate'].max()}")
print(f"  Primeiro serviço: {df2['ServiceDate'].min()}")
print(f"  Último serviço: {df2['ServiceDate'].max()}")
print()
# Agora vamos calcular VIN Share real
print("\n--- VIN SHARE REAL (cálculo) ---")
# Por modelo, quantos VINs únicos têm pelo menos 1 service na rede?
veiculos_ativos = df2.groupby("ModelName")["VIN_Hash"].nunique()
print("VINs únicos por modelo (todos retornaram à rede oficial pelo menos 1x):")
print(veiculos_ativos.sort_values(ascending=False).head(15))
print()

# Casos de "churn potencial": só 1 revisão e parou
revisoes_por_vin = df2.groupby("VIN_Hash")["MaintenanceNumber"].nunique()
print("Distribuição de número de revisões por VIN:")
print(revisoes_por_vin.value_counts().sort_index().head(15))
print()
print(f"VINs com apenas 1 revisão (potencial abandono): {(revisoes_por_vin == 1).sum():,}")
print(f"VINs com 4+ revisões (potencial fiel): {(revisoes_por_vin >= 4).sum():,}")

print("\n" + "=" * 80)
print("AMOSTRA DETALHADA DE 1 VIN (jornada de um cliente):")
print("=" * 80)
# Pega um VIN com várias revisões e mostra a trajetória
vin_top = revisoes_por_vin.sort_values(ascending=False).index[0]
print(f"VIN com mais revisões: {vin_top[:16]}…")
df_vin = df2[df2["VIN_Hash"] == vin_top].sort_values("ServiceDate")
print(df_vin[["ServiceDate", "MaintenanceNumber", "KM", "ServiceType", "DealerCode", "MainSource"]].to_string())
