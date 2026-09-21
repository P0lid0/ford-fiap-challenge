"""Importa as 3 versões da Ford Ranger 26MY do data sheet oficial Ford
direto pra tabela public.vehicles do PostgreSQL.

Gera um arquivo .sql (INSERT ... ON CONFLICT (hash_dedupe) DO UPDATE) a partir
de services/ml/data/ford-d1-ranger-26my.json e executa via psql contra a
DATABASE_URL (ambiente ou .env.local na raiz). Sem dependências além do psql.

Marcadas como verificado_manualmente=true, confianca_geral='alta',
fontes incluem 'manufacturer:ford-official' (datasheet enviado pela Ford
no Ford × FIAP Challenge 2026).

Uso:
    python scripts/import-ford-d1-ranger.py             # gera e aplica
    python scripts/import-ford-d1-ranger.py --dry-run   # só gera o .sql
"""
import sys, os, json
sys.stdout.reconfigure(encoding="utf-8")
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "services" / "ml" / "data" / "ford-d1-ranger-26my.json"

# ============================================================
# Mapeamento Ford section → nossa categoria de equipamento
# ============================================================
SECTION_TO_CATEGORY = {
    "Wheels":            "exterior",
    "Connectivity":      "tecnologia",
    "Ice Line Up":       "tecnologia",
    "Air conditioning":  "conforto",
    "Safety":            "seguranca",
    "High tech":         "assistencia",
    "Global Closing":    "seguranca",   # alarmes/travas
    "Trim":              "interior",
    "SunRoof":           "exterior",
    "Seats":             "interior",
    "Lights":            "exterior",
    "4X4":               "offroad",
    "Others":            "outros",       # tratado especialmente — cargo/exterior
}

# Item específico → override de categoria (Others é heterogêneo)
ITEM_OVERRIDE = {
    "Cabine Dupla": "outros:cabine_dupla",
    "Degrau acesso caçamba": "cargo:degrau_acesso_cacamba",
    "Assistente da Tampa da Caçamba": "cargo:assistente_tampa_cacamba",
    "Travamento elétrico da caçamba": "cargo:travamento_eletrico_cacamba",
    "Capota Marítima Elétrica": "cargo:capota_maritima_eletrica",
    "Pro Power 2.000W": "cargo:pro_power_2000w",
    "Engate de Reboque 3.500 kg": "cargo:engate_reboque_3500kg",
    "Preparação para reboque (Chicote)": "cargo:preparacao_reboque_chicote",
    "Bagageiro de teto (barras longitudinais)": "exterior:bagageiro_teto_longitudinais",
    "Bagageiro de teto (barras transversais)": "exterior:bagageiro_teto_transversais",
    "Tomada 110V (cada)": "tecnologia:tomada_110v",
    "Tomada 12V (cada)": "tecnologia:tomada_12v",
    "Apoio de braço dianteiro (integrado no banco)": "conforto:apoio_braco_dianteiro_integrado",
    "Apoio de braço traseiro": "conforto:apoio_braco_traseiro",
    "Console dianteiro central com apoio de braço": "conforto:console_dianteiro_apoio_braco",
    "Volantes aquecidos": "conforto:volante_aquecido",
    "Estribo lateral elétrico (por lado)": "exterior:estribo_lateral_eletrico",
    "Para-choque na Cor do Veículo": "exterior:para_choque_na_cor",
    "Para-choque Traseiro Cromado": "exterior:para_choque_traseiro_cromado",
    "Grade do radiador com acabamento Premium (Black Piano, Cromo, Cor veiculo)": "exterior:grade_radiador_premium",
    "Maçanetas externas cromadas": "exterior:macanetas_externas_cromadas",
    "Espelho Retrovisor Externo Cromado": "exterior:retrovisor_externo_cromado",
    "Aerofólio (Spoiler)": "exterior:aerofolio_spoiler",
    "Tapete Carpete": "interior:tapete_carpete",
    "Tapete de Borracha": "interior:tapete_borracha",
    "Iluminação Ambiente One Color (Ambient Light)": "interior:iluminacao_ambiente_one_color",
    "Iluminação Ambiente Multi-Color (Ambient Light)": "interior:iluminacao_ambiente_multicolor",
    "Disco de freio traseiro": "seguranca:freio_disco_traseiro",
    "Protetor de cárter": "offroad:protetor_carter",
    "Protetor inferior do tanque de combustível": "offroad:protetor_tanque",
    "Ganchos para Reboque (cada)": "cargo:ganchos_reboque",
    "Para Barro (Par)": "exterior:para_barro",
    "Tacógrafo Digital": "tecnologia:tacografo_digital",
    "Bússola e inclinômetros longitudinal e transversal": "offroad:bussola_inclinometros",
    "Faixa Adesiva (ex: capo, lateral, etc)": "exterior:faixa_adesiva",
    "Freios Brembo (Por Eixo)": "seguranca:freios_brembo",
    "Sistema de escapamento com Válvula ativa": "outros:escapamento_valvula_ativa",
    "Escada de acesso à caçamba": "cargo:escada_acesso_cacamba",
    "Superfície para trabalho na tampa na caçamba": "cargo:superficie_trabalho_cacamba",
    "Monitor de vida util do óleo": "tecnologia:monitor_vida_util_oleo",
    "Compartimento para caçamba": "cargo:compartimento_cacamba",
    "Tampa Traseira Multifuncional (c/ abertura lateral)": "cargo:tampa_traseira_multifuncional",
    "Tapete de porta-malas": "interior:tapete_porta_malas",
    "Sistema de gerencimento de carga dos porta malas/caçamba (Divisão de Espaços)": "cargo:gerenciamento_carga",
    "Alargadores de Paralamas": "exterior:alargadores_paralamas",
    "Ajuste dos Pedais elétrico": "conforto:ajuste_pedais_eletrico",
    "Anos de garantia": None,  # vai pra metadado de garantia
    "Anos de garantia da bateria (HEV or BEV)": None,
    "Retrovisores com luz de aproximação": "exterior:retrovisor_luz_aproximacao",
    "Teto pintado em duas cores": "exterior:teto_duas_cores",
    "Molduras Laterais na Cor do Veículo (Friso)": "exterior:molduras_laterais_cor_veiculo",
    "Molduras Laterais na Cor Preta (Friso)": "exterior:molduras_laterais_preta",
    "Moldura cromada/Black Piano das janelas": "exterior:moldura_janelas_premium",
}

def slugify(s: str) -> str:
    s = s.lower().strip()
    # remove acentos
    repl = str.maketrans("áàâãäéèêëíìîïóòôõöúùûüç", "aaaaaeeeeiiiiooooouuuuc")
    s = s.translate(repl)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")

def parse_value(s):
    if s is None: return None
    s = str(s).strip()
    if s in ("", "X", "0"): return s
    return s

def is_truthy(v) -> bool:
    """X ou número > 0 = item presente."""
    if v is None: return False
    s = str(v).strip()
    if s.upper() == "X": return True
    try:
        n = float(s)
        return n > 0
    except (ValueError, TypeError):
        return False

def build_vehicle(sections: dict, trim_key: str, versao_label: str, peso_kg: int) -> dict:
    """Monta payload de UM veículo (trim) seguindo schema do nosso db."""

    # === Specs numéricos (seção "(sem secao)") ===
    base = {it["item"]: it[trim_key] for it in sections.get("(sem secao)", [])}
    motor = {
        "cilindrada_cc": int(float(base.get("Cilindrada", 0)) * 1000) if base.get("Cilindrada") else None,
        "potencia_cv": int(base.get("Potência")) if base.get("Potência") else None,
        "torque_nm": int(base.get("Torque")) if base.get("Torque") else None,
        "combustivel": "diesel" if is_truthy(base.get("Motor Diesel")) else ("flex" if is_truthy(base.get("Motor Flex vs Gasolina")) else None),
        "aspiracao": "biturbo" if is_truthy(base.get("Tecnologia BiTurbo")) else ("turbo" if is_truthy(base.get("Tecnologia turbo")) else None),
        "cilindros": 6,  # V6 3.0L
    }
    transmissao = {
        "tipo": "automatica" if is_truthy(base.get("Transmissão Automática")) else None,
        "marchas": int(base.get("Quantidade de marchas")) if base.get("Quantidade de marchas") else None,
        "tracao": "4x4",  # Ranger sempre 4x4 nessas versões
    }
    desempenho = {
        "consumo_estrada_kml": float(base.get("Economia de Combustível")) if base.get("Economia de Combustível") else None,
    }
    dimensoes = {
        "peso_kg": peso_kg,
        "capacidade_reboque_kg": 3500,  # standard nessas versões
    }

    # === Equipamentos categorizados ===
    equipamentos: list[str] = []

    for sec_name, items in sections.items():
        if sec_name == "(sem secao)":
            continue
        for it in items:
            val = it[trim_key]
            if not is_truthy(val):
                # mesmo "0" não entra; mas se for número > 0, salva
                if val is None or str(val).strip() in ("", "0"):
                    continue

            item_text = it["item"]

            # Override explícito
            if item_text in ITEM_OVERRIDE:
                slug = ITEM_OVERRIDE[item_text]
                if slug is None:
                    continue
                equipamentos.append(slug)
                continue

            # Categoria padrão da seção
            cat = SECTION_TO_CATEGORY.get(sec_name, "outros")
            if cat == "outros":
                continue  # se não temos override, melhor não duvidoso

            slug = f"{cat}:{slugify(item_text)}"
            # Para valores numéricos, agrega valor: ex 'exterior:polegadas_18'
            if str(val).strip().upper() != "X":
                try:
                    n = int(float(val))
                    slug = f"{cat}:{slugify(item_text)}_{n}"
                except (ValueError, TypeError):
                    slug = f"{cat}:{slugify(item_text)}_{slugify(str(val))}"
            equipamentos.append(slug)

    equipamentos = sorted(set(equipamentos))

    # Garantia (metadado em notas)
    garantia = next((it[trim_key] for it in sections.get("Others", [])
                     if it["item"] == "Anos de garantia"), None)
    notas = f"Datasheet oficial Ford × FIAP — Ranger 26MY · {versao_label}"
    if garantia:
        notas += f"\nGarantia: {garantia} anos"

    return {
        "marca": "Ford",
        "modelo": "Ranger",
        "versao": versao_label,
        "ano": 2026,
        "categoria": "picape_media",
        "motor": {k: v for k, v in motor.items() if v is not None},
        "dimensoes": {k: v for k, v in dimensoes.items() if v is not None},
        "transmissao": {k: v for k, v in transmissao.items() if v is not None},
        "desempenho": {k: v for k, v in desempenho.items() if v is not None},
        "equipamentos": equipamentos,
        "preco_brl": None,  # FIPE busca depois se quisermos
        "pais_origem": "Brasil",
        "fontes": ["manufacturer:ford-official", "datasheet:FIAP-Ford-D1-v02"],
        "data_sources": {
            "motor.cilindrada_cc": "manufacturer:ford-official",
            "motor.potencia_cv": "manufacturer:ford-official",
            "motor.torque_nm": "manufacturer:ford-official",
            "motor.combustivel": "manufacturer:ford-official",
            "motor.aspiracao": "manufacturer:ford-official",
            "transmissao.tipo": "manufacturer:ford-official",
            "transmissao.marchas": "manufacturer:ford-official",
            "transmissao.tracao": "manufacturer:ford-official",
            "dimensoes.peso_kg": "manufacturer:ford-official",
            "dimensoes.capacidade_reboque_kg": "manufacturer:ford-official",
            "desempenho.consumo_estrada_kml": "manufacturer:ford-official",
            "equipamentos": "manufacturer:ford-official",
            "categoria": "manufacturer:ford-official",
            "pais_origem": "manufacturer:ford-official",
        },
        "verificado_manualmente": True,
        "confianca_geral": "alta",
        "notas": notas,
    }

def load_database_url() -> str:
    """DATABASE_URL do ambiente, senão de .env.local na raiz do monorepo."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env_path = REPO_ROOT / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
            if m and m.group(1) == "DATABASE_URL":
                return m.group(2).strip().strip("\"'")
    sys.exit("DATABASE_URL ausente (defina no ambiente ou em .env.local na raiz).")

def find_psql() -> str:
    """psql do PATH, ou PSQL=<caminho> no ambiente."""
    cand = os.environ.get("PSQL") or shutil.which("psql")
    if not cand:
        sys.exit("psql não encontrado no PATH (defina PSQL=<caminho do psql.exe>).")
    return cand

# ============================================================
# Geração do SQL (sem driver: literais escapados + psql)
# ============================================================
def sql_str(v) -> str:
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def sql_jsonb(obj) -> str:
    return sql_str(json.dumps(obj, ensure_ascii=False)) + "::jsonb"

def sql_text_array(items) -> str:
    if not items:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_str(i) for i in items) + "]::text[]"

def sql_int(v) -> str:
    return "NULL" if v is None else str(int(v))

VEHICLE_COLS = [
    "marca", "modelo", "versao", "ano", "categoria",
    "motor", "dimensoes", "transmissao", "desempenho", "equipamentos",
    "preco_brl", "pais_origem", "fontes", "data_sources",
    "verificado_manualmente", "confianca_geral", "notas",
]

def vehicle_values(v: dict) -> str:
    return "(" + ", ".join([
        sql_str(v["marca"]), sql_str(v["modelo"]), sql_str(v["versao"]),
        sql_int(v["ano"]), sql_str(v["categoria"]),
        sql_jsonb(v["motor"]), sql_jsonb(v["dimensoes"]), sql_jsonb(v["transmissao"]),
        sql_jsonb(v["desempenho"]), sql_text_array(v["equipamentos"]),
        sql_int(v["preco_brl"]), sql_str(v["pais_origem"]),
        sql_text_array(v["fontes"]), sql_jsonb(v["data_sources"]),
        "true" if v["verificado_manualmente"] else "false",
        sql_str(v["confianca_geral"]), sql_str(v["notas"]),
    ]) + ")"

def build_sql(vehicles: list) -> str:
    """Upsert por hash_dedupe (marca|modelo|versao|ano), igual ao endpoint
    /competitive/vehicles/import que este script usava antes."""
    update_cols = [c for c in VEHICLE_COLS if c not in ("marca", "modelo", "versao", "ano")]
    sets = ",\n  ".join(f"{c} = excluded.{c}" for c in update_cols)
    return (
        "-- gerado por scripts/import-ford-d1-ranger.py\n"
        "begin;\n"
        f"insert into public.vehicles ({', '.join(VEHICLE_COLS)})\nvalues\n"
        + ",\n".join(vehicle_values(v) for v in vehicles)
        + "\non conflict (hash_dedupe) do update set\n  "
        + sets
        + ",\n  verificado_em = now()\n"
        "returning id, marca, modelo, versao, array_length(equipamentos, 1) as equipamentos, confianca_geral;\n"
        "commit;\n"
    )

def run_psql(sql_path: Path) -> None:
    env = dict(os.environ, PGCLIENTENCODING="UTF8")
    cmd = [find_psql(), load_database_url(), "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8")
    if r.stdout:
        print(r.stdout.rstrip())
    if r.returncode != 0:
        raise RuntimeError(f"psql saiu com {r.returncode}:\n{r.stderr.strip()[:800]}")

def main():
    dry_run = "--dry-run" in sys.argv
    data = json.load(open(DATA_PATH, encoding="utf-8"))
    sections = data["sections"]

    trims = [
        ("xlt",         "XLT 3.0L V6 AT 26MY", 2283),
        ("limited",     "Limited 3.0L V6 26MY", 2357),
        ("limited_plus","Limited + 3.0L V6 26MY", 2357),
    ]

    payloads = []
    for trim_key, label, peso in trims:
        v = build_vehicle(sections, trim_key, label, peso)
        print(f"\n=== {label} ===")
        print(f"  Motor: {v['motor']}")
        print(f"  Transmissão: {v['transmissao']}")
        print(f"  Dimensões: {v['dimensoes']}")
        print(f"  Desempenho: {v['desempenho']}")
        print(f"  Equipamentos: {len(v['equipamentos'])} itens")
        # agrupa por categoria pra exibir
        by_cat = {}
        for e in v['equipamentos']:
            cat, _, item = e.partition(":")
            by_cat.setdefault(cat, []).append(item)
        for cat, items in sorted(by_cat.items()):
            print(f"    [{cat}]: {len(items)}")
        payloads.append(v)

    sql_path = Path(tempfile.gettempdir()) / "ford-d1-ranger-26my.sql"
    sql_path.write_text(build_sql(payloads), encoding="utf-8")
    print(f"\n→ SQL gerado em {sql_path}")
    if dry_run:
        print("  (--dry-run: nada aplicado)")
        return

    print(f"→ Aplicando {len(payloads)} veículos via psql …")
    try:
        run_psql(sql_path)
        print("  ✓ upsert concluído")
    except Exception as e:
        print(f"  ✗ Erro: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
