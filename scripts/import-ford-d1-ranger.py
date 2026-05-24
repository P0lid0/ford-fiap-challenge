"""Importa as 3 versões da Ford Ranger 26MY do data sheet oficial Ford
direto pra tabela vehicles do Supabase.

Marcadas como verificado_manualmente=true, confianca_geral='alta',
fontes incluem 'manufacturer:ford-official' (datasheet enviado pela Ford
no Ford × FIAP Challenge 2026).
"""
import sys, os, json, hashlib
sys.stdout.reconfigure(encoding="utf-8")
import re
import urllib.request
from urllib.error import HTTPError

SUPABASE_REF = "wafphrldcghbqxdclypp"
PAT = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not PAT:
    sys.exit("Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.")

DATA_PATH = "C:/Users/pedro.martins/ford-fiap-challenge/services/ml/data/ford-d1-ranger-26my.json"

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

def get_supabase_jwt():
    """Login no Supabase com email/senha do admin pra pegar JWT."""
    # Lê .env.local pra credenciais
    env_path = "C:/Users/pedro.martins/ford-fiap-challenge/.env.local"
    env = {}
    if os.path.exists(env_path):
        for line in open(env_path, encoding="utf-8"):
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
            if m: env[m.group(1)] = m.group(2).strip('"\'')
    supabase_url = env.get("SUPABASE_URL")
    anon = env.get("SUPABASE_ANON_KEY")
    if not supabase_url or not anon:
        raise RuntimeError("SUPABASE_URL ou SUPABASE_ANON_KEY faltando em .env.local")
    # admin demo
    body = json.dumps({"email": "admin@faroai.com.br", "password": "Ford2026!"}).encode()
    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        data=body, method="POST")
    req.add_header("apikey", anon)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
        return data["access_token"]

def post_import(items: list) -> dict:
    """Manda lote pro endpoint /competitive/vehicles/import via API local."""
    jwt = get_supabase_jwt()
    api_url = "http://localhost:3333/competitive/vehicles/import"
    body = json.dumps({"format": "json", "content": json.dumps(items, ensure_ascii=False)}).encode()
    req = urllib.request.Request(api_url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {jwt}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode('utf-8')[:500]}")

def main():
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

    print(f"\n→ Enviando {len(payloads)} veículos pra /competitive/vehicles/import …")
    try:
        result = post_import(payloads)
        print(f"  ✓ {result.get('inserted', 0)} inseridos")
        for v in result.get("vehicles", []):
            print(f"    • {v.get('marca')} {v.get('modelo')} {v.get('versao')} → id={v.get('id')[:8]}…  {len(v.get('equipamentos', []))} equipamentos · confiança {v.get('confianca_geral')}")
    except Exception as e:
        print(f"  ✗ Erro: {e}")

if __name__ == "__main__":
    main()
