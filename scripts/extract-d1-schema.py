"""Extrai a planilha Ford D1 completa e categoriza linhas em seções.

A planilha tem 277 linhas. Cada bloco tem um cabeçalho (linha sem X/0 nos 3
trims, com NaN nas colunas trim) seguido de itens daquele grupo.

Saída: JSON estruturado com seções → itens → valores por trim.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import os
import json
import pandas as pd

BASE = os.environ.get("TEMP", "C:/Users/pedro.martins/AppData/Local/Temp") + "/ford-rar"
D1 = f"{BASE}/FIAP-Ford - Data sheet_Desafio_01_v02.xlsx"

df = pd.read_excel(D1, sheet_name="BASE")
# Renomeia colunas pra ficar mais limpo
df.columns = ["item", "xlt", "limited", "limited_plus"]
# Remove primeira linha que é só RANGER 26MY 3x
df = df.iloc[2:].reset_index(drop=True)

def is_section_header(row):
    """Linha onde os 3 trims estão NaN/Coluna* = cabeçalho de seção."""
    vals = [row["xlt"], row["limited"], row["limited_plus"]]
    return all(pd.isna(v) for v in vals)

sections: dict[str, list[dict]] = {}
current = "(sem secao)"
for _, row in df.iterrows():
    if pd.isna(row["item"]):
        continue
    item = str(row["item"]).strip()
    if not item:
        continue
    if is_section_header(row):
        current = item
        sections.setdefault(current, [])
        continue
    sections.setdefault(current, []).append({
        "item": item,
        "xlt": None if pd.isna(row["xlt"]) else str(row["xlt"]).strip(),
        "limited": None if pd.isna(row["limited"]) else str(row["limited"]).strip(),
        "limited_plus": None if pd.isna(row["limited_plus"]) else str(row["limited_plus"]).strip(),
    })

print(f"Total seções: {len(sections)}")
print(f"Total itens: {sum(len(v) for v in sections.values())}")
print()
for sec, items in sections.items():
    print(f"=== {sec} ({len(items)} itens) ===")
    for it in items[:5]:
        print(f"  • {it['item']:55s}  XLT={it['xlt']!r:12s}  Lim={it['limited']!r:12s}  Lim+={it['limited_plus']!r:12s}")
    if len(items) > 5:
        print(f"  ... +{len(items)-5} itens")

out_path = "C:/Users/pedro.martins/ford-fiap-challenge/services/ml/data/ford-d1-ranger-26my.json"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump({"versoes": ["XLT 3.0L V6 AT 26MY", "Limited 3.0L V6 26MY", "Limited + 3.0L V6 26MY"], "sections": sections}, f, ensure_ascii=False, indent=2)
print(f"\nSalvo em {out_path}")
