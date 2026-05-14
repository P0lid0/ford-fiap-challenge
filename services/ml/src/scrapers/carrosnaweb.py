"""Scraper de carrosnaweb.com.br.

Estado do site em 14/05/2026: fichas individuais retornam 500.
Implementação preparada para quando o site voltar — parser por regex sobre
o HTML clássico em ISO-8859-1 (charset declarado no <meta>).

URL pattern: https://www.carrosnaweb.com.br/fichadetalhe.asp?codigo={N}

Pares marca/modelo → codigo são descobertos em catalogo.asp?fabricante=...
mas a página de catálogo carrega resultados via JS, então usamos
catalogos cacheados ou a busca do Google como fallback (sitemap-like).
"""
from __future__ import annotations

import re
from typing import Iterable

import httpx
from bs4 import BeautifulSoup

from .canonical_schema import Vehicle, Motor, Dimensoes, Transmissao, Desempenho

BASE = "https://www.carrosnaweb.com.br"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


class CarrosNaWebScraper:
    def __init__(self, timeout_s: float = 15.0) -> None:
        self.client = httpx.Client(
            timeout=timeout_s,
            headers={
                "User-Agent": UA,
                "Accept-Language": "pt-BR,pt;q=0.9",
                "Referer": BASE + "/",
            },
            follow_redirects=True,
        )

    def fetch_ficha_html(self, codigo: int) -> str | None:
        """Retorna HTML cru da ficha técnica, ou None se 500/erro."""
        resp = self.client.get(f"{BASE}/fichadetalhe.asp", params={"codigo": codigo})
        if resp.status_code != 200:
            return None
        # Site declara ISO-8859-1; httpx usa o charset reportado
        return resp.text

    def parse_ficha(self, html: str, codigo: int) -> Vehicle | None:
        """Extrai Vehicle a partir do HTML clássico."""
        soup = BeautifulSoup(html, "lxml")
        title = soup.find("title")
        if not title:
            return None
        # Título tipo: "Carros na Web | Ford Ranger Raptor 3.0 V6 2024 | Ficha Técnica..."
        m = re.match(
            r"(?i)Carros na Web\s*\|\s*([\w-]+)\s+([\w\d\.\- ]+?)\s+(\d{4})\s*\|",
            title.get_text(strip=True),
        )
        if not m:
            return None
        marca = m.group(1).strip()
        modelo_versao = m.group(2).strip()
        ano = int(m.group(3))
        # split marca/modelo/versao — heurística simples
        partes = modelo_versao.split(" ", 1)
        modelo = partes[0] if partes else modelo_versao
        versao = partes[1] if len(partes) > 1 else "Padrão"

        labels = _extract_label_value_pairs(soup)
        equipamentos = _extract_equipamentos(soup)

        return Vehicle(
            marca=marca, modelo=modelo, versao=versao, ano=ano,
            categoria=_infer_categoria(modelo, modelo_versao),
            motor=Motor(
                cilindrada_cc=_parse_int(labels.get("cilindrada")),
                potencia_cv=_parse_int(labels.get("potência") or labels.get("potencia")),
                torque_nm=_parse_int(labels.get("torque")),
                combustivel=_norm_combustivel(labels.get("combustível") or labels.get("combustivel")),
                aspiracao=_norm_aspiracao(labels.get("alimentação") or labels.get("aspiração")),
                cilindros=_parse_int(labels.get("cilindros")),
            ),
            dimensoes=Dimensoes(
                comprimento_mm=_parse_int(labels.get("comprimento")),
                largura_mm=_parse_int(labels.get("largura")),
                altura_mm=_parse_int(labels.get("altura")),
                entre_eixos_mm=_parse_int(labels.get("entre-eixos") or labels.get("distância entre-eixos")),
                peso_kg=_parse_int(labels.get("peso")),
            ),
            transmissao=Transmissao(
                tipo=_norm_transmissao(labels.get("transmissão") or labels.get("câmbio")),
                marchas=_parse_int(labels.get("marchas")),
                tracao=_norm_tracao(labels.get("tração")),
            ),
            desempenho=Desempenho(
                aceleracao_0_100_s=_parse_float(labels.get("0 a 100 km/h") or labels.get("aceleração")),
                velocidade_max_kmh=_parse_int(labels.get("velocidade máxima")),
                consumo_cidade_kml=_parse_float(labels.get("consumo cidade")),
                consumo_estrada_kml=_parse_float(labels.get("consumo estrada") or labels.get("consumo rodovia")),
            ),
            equipamentos=equipamentos,
            preco_brl=_parse_int(labels.get("preço") or labels.get("valor")),
            fontes=[f"carrosnaweb.com.br/fichadetalhe.asp?codigo={codigo}"],
        )

    def scrape(self, codigo: int) -> Vehicle | None:
        html = self.fetch_ficha_html(codigo)
        if not html:
            return None
        return self.parse_ficha(html, codigo)

    def close(self) -> None:
        self.client.close()


# ===================== HELPERS =====================

def _extract_label_value_pairs(soup: BeautifulSoup) -> dict[str, str]:
    """Heurística: o site usa <table> com 2 colunas (label / valor)."""
    pairs: dict[str, str] = {}
    for tr in soup.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) >= 2 and cells[0]:
            label = cells[0].strip().rstrip(":").lower()
            value = cells[1].strip()
            if label and value:
                pairs[label] = value
    return pairs


def _extract_equipamentos(soup: BeautifulSoup) -> list[str]:
    out: list[str] = []
    for header in soup.find_all(string=re.compile(r"equipamentos? de série", re.I)):
        ul = header.find_parent().find_next("ul") if header.find_parent() else None
        if ul:
            out.extend(_normalize_equip(li.get_text(" ", strip=True)) for li in ul.find_all("li"))
    return [e for e in out if e]


def _normalize_equip(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _parse_int(s: str | None) -> int | None:
    if not s:
        return None
    m = re.search(r"(\d[\d\.]*)", s.replace(",", "."))
    if not m:
        return None
    return int(m.group(1).replace(".", ""))


def _parse_float(s: str | None) -> float | None:
    if not s:
        return None
    m = re.search(r"(\d+(?:[\.,]\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def _norm_combustivel(s: str | None) -> str | None:
    if not s:
        return None
    s = s.lower()
    if "diesel" in s: return "diesel_s10" if "s10" in s else "diesel"
    if "flex" in s: return "flex"
    if "etanol" in s or "álcool" in s: return "etanol"
    if "gasolina" in s: return "gasolina"
    if "elétric" in s or "eletric" in s: return "eletrico"
    if "híbrido" in s or "hibrid" in s: return "hibrido"
    return None


def _norm_aspiracao(s: str | None) -> str | None:
    if not s: return None
    s = s.lower()
    if "twin" in s or "biturbo" in s: return "twin_turbo"
    if "turbo" in s: return "turbo"
    if "compress" in s or "supercharg" in s: return "supercharged"
    if "natural" in s or "aspirado" in s: return "natural"
    return None


def _norm_transmissao(s: str | None) -> str | None:
    if not s: return None
    s = s.lower()
    if "cvt" in s: return "cvt"
    if "dct" in s or "dupla embreagem" in s: return "dct"
    if "automatiz" in s: return "automatizada"
    if "automát" in s or "auto" in s: return "automatica"
    if "manual" in s: return "manual"
    return None


def _norm_tracao(s: str | None) -> str | None:
    if not s: return None
    s = s.lower()
    if "4x4" in s or "4wd" in s or "awd" in s: return "4x4"
    if "diant" in s or "fwd" in s: return "fwd"
    if "tras" in s or "rwd" in s: return "rwd"
    if "4x2" in s: return "4x2"
    return None


def _infer_categoria(modelo: str, full: str) -> str:
    f = (modelo + " " + full).lower()
    if any(k in f for k in ["ranger", "f-150", "ram", "amarok", "hilux", "frontier", "s10"]):
        return "picape_media"
    if any(k in f for k in ["ka", "fiesta", "gol", "onix", "polo", "hb20", "argo"]):
        return "hatch"
    if any(k in f for k in ["ecosport", "territory", "bronco", "tracker", "renegade", "compass"]):
        return "suv"
    if any(k in f for k in ["civic", "corolla", "sentra", "virtus", "voyage", "ka sedan"]):
        return "sedan"
    return "sedan"
