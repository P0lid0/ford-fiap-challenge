"""Fallback de ingestão via Claude.

Quando o scraper de carrosnaweb falha (site offline ou 500), buscamos a ficha
em fontes alternativas e pedimos ao Claude para extrair no schema canônico.

Estratégia:
1. WebFetch da página oficial da fabricante (ford.com.br, toyota.com.br, etc.)
2. Envia HTML/texto pro Claude com schema explícito
3. Valida com Pydantic
"""
from __future__ import annotations

import json
import re

import anthropic
import httpx

from ..config import settings
from .canonical_schema import Vehicle, SCHEMA_VERSION

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0"

_SYSTEM = f"""Você extrai fichas técnicas automotivas no schema canônico v{SCHEMA_VERSION}.

Regras inegociáveis:
- Responda APENAS com JSON puro. Sem markdown, sem comentários.
- Campo não encontrado no texto → null. JAMAIS invente.
- Unidades: cc, cv, Nm, mm, kg, km/h, km/l, BRL.
- "combustivel" ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- "categoria" ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]
- "equipamentos" = lista de strings snake_case.

Schema esperado:
{{ "marca", "modelo", "versao", "ano", "categoria",
   "motor": {{ "cilindrada_cc", "potencia_cv", "torque_nm", "combustivel", "aspiracao", "cilindros" }},
   "dimensoes": {{ "comprimento_mm", "largura_mm", "altura_mm", "entre_eixos_mm",
                   "vao_livre_mm", "peso_kg", "capacidade_porta_malas_l",
                   "capacidade_cacamba_l", "capacidade_carga_kg", "capacidade_reboque_kg" }},
   "transmissao": {{ "tipo", "marchas", "tracao" }},
   "desempenho": {{ "aceleracao_0_100_s", "velocidade_max_kmh",
                    "consumo_cidade_kml", "consumo_estrada_kml", "autonomia_km" }},
   "equipamentos": [], "preco_brl", "pais_origem" }}
"""


def fetch_text(url: str, timeout_s: float = 12.0) -> str | None:
    """Baixa página web em texto. Falha silenciosa retorna None."""
    try:
        with httpx.Client(timeout=timeout_s, headers={"User-Agent": _UA}, follow_redirects=True) as c:
            resp = c.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception:
        return None


async def extract_with_claude(raw_text: str, hint: dict | None = None) -> Vehicle | None:
    """Pede ao Claude para normalizar texto bruto em Vehicle canônico."""
    if not settings.anthropic_api_key:
        return None

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_msg = raw_text[:30_000]
    if hint:
        user_msg = f"DICAS: {json.dumps(hint, ensure_ascii=False)}\n\nTEXTO:\n{user_msg}"

    msg = await client.messages.create(
        model=settings.claude_model_fast,
        max_tokens=2048,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = msg.content[0].text.strip() if msg.content else ""
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    if not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
        fontes = data.pop("fontes", [])
        return Vehicle(**data, fontes=[*fontes, "llm:claude"])
    except (json.JSONDecodeError, ValueError):
        return None


# Mapa marca → URL oficial para fallback de busca pela página da fabricante.
FABRICANTE_URLS: dict[str, str] = {
    "ford": "https://www.ford.com.br/{modelo}",
    "toyota": "https://www.toyota.com.br/{modelo}",
    "ram": "https://www.ram.com.br/{modelo}",
    "volkswagen": "https://www.vw.com.br/{modelo}",
    "chevrolet": "https://www.chevrolet.com.br/{modelo}",
    "fiat": "https://www.fiat.com.br/{modelo}",
}


async def ingest(marca: str, modelo: str, versao: str, ano: int) -> Vehicle | None:
    """Pipeline de ingestão com fallback.

    1. Tenta carrosnaweb (off-line hoje? Skip se não tiver código).
    2. Tenta site oficial da fabricante + Claude.
    3. Retorna None se tudo falhar (cliente vê 404 e pode inserir manual).
    """
    marca_l = marca.lower()
    url_template = FABRICANTE_URLS.get(marca_l)
    if not url_template:
        return None
    url = url_template.format(modelo=modelo.lower())
    text = fetch_text(url)
    if not text:
        return None
    return await extract_with_claude(text, hint={
        "marca": marca, "modelo": modelo, "versao": versao, "ano": ano,
    })
