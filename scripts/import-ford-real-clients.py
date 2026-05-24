"""Importa os 175k VINs reais Ford como clients no banco.

Processo:
1. Cria/garante dealership virtual "Ford BR" (usa pra RLS — admin/gestor vê tudo)
2. Lê Base 1 (ford_real_base1_full.parquet)
3. Faz upsert em batches de 1000 via Supabase Management /database/query
4. Marca cada client com is_ford_real=true + data_source='vin_share_Desafio_02'

VIN_Hash é a chave única — se rodar de novo, faz UPDATE em vez de inserir duplicata.

⚠ Esses dados ficam ISOLADOS dos clientes sintéticos via campo is_ford_real.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import os, json, time
from pathlib import Path
import pandas as pd
import urllib.request
from urllib.error import HTTPError

ROOT = Path("C:/Users/pedro.martins/ford-fiap-challenge")
BASE1 = ROOT / "services/ml/data/ford_real_base1_full.parquet"

SUPABASE_REF = "wafphrldcghbqxdclypp"
PAT = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not PAT:
    sys.exit("Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.")

BATCH = 500   # tamanho do lote por INSERT
MAX_VINS = int(os.environ.get("MAX_VINS", 0)) or None  # limite (opcional pra testes)


def run_sql(query: str, retries: int = 3) -> dict:
    url = f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query"
    body = json.dumps({"query": query}).encode("utf-8")
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, method="POST")
            req.add_header("Authorization", f"Bearer {PAT}")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            last_err = f"HTTP {e.code}: {e.read().decode('utf-8')[:300]}"
            if e.code in (429, 503):
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(last_err)
        except Exception as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Falhou após {retries}: {last_err}")


def ensure_dealership_ford() -> str:
    """Cria/recupera dealership 'Ford BR' e retorna seu UUID."""
    # Primeiro tenta encontrar
    r = run_sql("select id from public.dealerships where nome = 'Ford BR (Real Data)' limit 1")
    if r and len(r) > 0:
        return r[0]["id"]
    # Senão cria
    r = run_sql("""
        insert into public.dealerships (nome, cidade, uf, regiao, codigo_concessionaria)
        values ('Ford BR (Real Data)', 'Brasil', 'BR', 'sudeste', 'FORD-BR-AGG')
        returning id
    """)
    return r[0]["id"]


def sql_literal(v):
    """Converte valor Python pra literal SQL."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, float):
        if pd.isna(v): return "NULL"
        return f"{v:.4f}"
    if isinstance(v, list):
        if not v: return "ARRAY[]::integer[]"
        inner = ", ".join(str(int(x)) for x in v if x is not None and not pd.isna(x))
        return f"ARRAY[{inner}]::integer[]"
    if isinstance(v, pd.Timestamp):
        if pd.isna(v): return "NULL"
        return f"'{v.strftime('%Y-%m-%d')}'"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def build_row_values(row, dealership_id: str):
    """Gera tupla SQL VALUES pra uma linha do parquet."""
    def safe_int(v):
        if v is None or pd.isna(v): return None
        return int(v)
    def safe_date(v):
        if v is None or pd.isna(v): return None
        return pd.Timestamp(v)
    def safe_float(v):
        if v is None or pd.isna(v): return None
        return float(v)
    def clamp_smallint(v):
        if v is None: return None
        v = int(v)
        return max(-32768, min(32767, v))

    # dealer_codes_revisao não temos no parquet (só dealer_revisao_mais_freq);
    # passamos array vazio
    cols = {
        "dealership_id": dealership_id,
        "vin_hash": str(row["VIN_Hash"]),
        "model_name": str(row["modelo"]) if row.get("modelo") and not pd.isna(row.get("modelo")) else None,
        "model_year": safe_int(row.get("ano_modelo")),
        "dealer_code_venda": safe_int(row.get("dealer_venda")),
        "dealer_codes_revisao": [safe_int(row.get("dealer_revisao_mais_freq"))] if row.get("dealer_revisao_mais_freq") and not pd.isna(row.get("dealer_revisao_mais_freq")) else [],
        "sales_date": safe_date(row.get("data_venda")),
        "delivery_date": safe_date(row.get("data_entrega")),
        "warranty_start_date": safe_date(row.get("data_garantia")),
        "primeiro_servico": safe_date(row.get("primeiro_servico")),
        "ultimo_servico": safe_date(row.get("ultimo_servico")),
        "km_max": safe_int(min(row.get("km_max", 0), 2_000_000)) if row.get("km_max") and not pd.isna(row.get("km_max")) else None,
        "num_revisoes": clamp_smallint(row.get("num_revisoes")),
        "num_servicos_total": safe_int(row.get("num_servicos_total")),
        "dias_ate_1a_revisao": clamp_smallint(row.get("dias_ate_1a_revisao")),
        "dias_desde_ultima_revisao": clamp_smallint(row.get("dias_desde_ultima_revisao")),
        "dealer_loyalty": safe_float(row.get("dealer_loyalty")),
        "taxa_aderencia_km": min(safe_float(row.get("taxa_aderencia_km")) or 0, 999.99) if row.get("taxa_aderencia_km") is not None else None,
        "revisoes_por_ano": min(safe_float(row.get("revisoes_por_ano")) or 0, 999.99) if row.get("revisoes_por_ano") is not None else None,
        "perfil_real": str(row.get("perfil_real")) if row.get("perfil_real") and not pd.isna(row.get("perfil_real")) else None,
        "is_ford_real": True,
        "data_source": "vin_share_Desafio_02",
        # data_compra é NOT NULL default current_date — usamos sales_date como proxy se válido
        "data_compra": safe_date(row.get("data_venda")) or pd.Timestamp.now(),
    }
    return cols


COLUMNS_ORDER = [
    "dealership_id", "vin_hash", "model_name", "model_year", "dealer_code_venda",
    "dealer_codes_revisao", "sales_date", "delivery_date", "warranty_start_date",
    "primeiro_servico", "ultimo_servico", "km_max", "num_revisoes", "num_servicos_total",
    "dias_ate_1a_revisao", "dias_desde_ultima_revisao", "dealer_loyalty",
    "taxa_aderencia_km", "revisoes_por_ano", "perfil_real", "is_ford_real",
    "data_source", "data_compra",
]


def upsert_batch(rows: list, dealership_id: str):
    """Insere/atualiza um batch via INSERT ... ON CONFLICT (vin_hash)."""
    values_list = []
    for row in rows:
        cols = build_row_values(row, dealership_id)
        vals = "(" + ", ".join(sql_literal(cols[c]) for c in COLUMNS_ORDER) + ")"
        values_list.append(vals)

    col_names = ", ".join(COLUMNS_ORDER)
    values_str = ",\n".join(values_list)
    # ON CONFLICT — vin_hash unique
    update_cols = [c for c in COLUMNS_ORDER if c not in ("dealership_id", "vin_hash")]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
INSERT INTO public.clients ({col_names})
VALUES
{values_str}
ON CONFLICT (vin_hash) DO UPDATE SET {set_clause}
"""
    return run_sql(sql)


def main():
    print(f"📂 Lendo Base 1 ({BASE1.name})…")
    df = pd.read_parquet(BASE1)
    if MAX_VINS:
        df = df.head(MAX_VINS)
    print(f"   {len(df):,} VINs a importar")

    print("🏢 Garantindo dealership 'Ford BR (Real Data)'…")
    dealership_id = ensure_dealership_ford()
    print(f"   dealership_id = {dealership_id}")

    print(f"\n📤 Importando em batches de {BATCH}…")
    t0 = time.time()
    total_inserted = 0
    n_batches = (len(df) + BATCH - 1) // BATCH

    for i in range(0, len(df), BATCH):
        batch = df.iloc[i:i+BATCH].to_dict(orient="records")
        try:
            upsert_batch(batch, dealership_id)
            total_inserted += len(batch)
            elapsed = time.time() - t0
            rate = total_inserted / elapsed if elapsed > 0 else 0
            eta = (len(df) - total_inserted) / rate if rate > 0 else 0
            batch_n = (i // BATCH) + 1
            print(f"   ✓ batch {batch_n}/{n_batches}  {total_inserted:,}/{len(df):,}  "
                  f"({rate:.0f} VINs/s · ETA {eta:.0f}s)")
        except Exception as e:
            print(f"   ✗ batch {i//BATCH+1}: {e}")
            # continua nos próximos
            continue

    elapsed = time.time() - t0
    print(f"\n✓ {total_inserted:,} VINs importados em {elapsed:.1f}s ({total_inserted/elapsed:.0f}/s)")


if __name__ == "__main__":
    main()
