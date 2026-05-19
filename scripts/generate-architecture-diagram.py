"""Gera o desenho de arquitetura do sistema (componentes + fluxos)
para a disciplina de Arquitetura Orientada a Serviços e Web Services.

Saída: PNG (alta resolução) + PDF embutindo o PNG.
"""
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.lines import Line2D

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "deliverables"
OUT.mkdir(parents=True, exist_ok=True)

# Cores Ford
BLUE = "#003478"
BLUE_LIGHT = "#0066B2"
GREY = "#4A4A4A"
GREEN = "#2E7D32"
ORANGE = "#E65100"
PURPLE = "#6A1B9A"
RED = "#C62828"
BG_CLIENT = "#E3F2FD"
BG_APP = "#FFF3E0"
BG_API = "#E8F5E9"
BG_ML = "#F3E5F5"
BG_DATA = "#FFFDE7"
BG_EXT = "#FAFAFA"

fig = plt.figure(figsize=(18, 12), dpi=120, facecolor="white")
ax = fig.add_subplot(111)
ax.set_xlim(0, 100)
ax.set_ylim(0, 70)
ax.set_aspect("equal")
ax.axis("off")

# Título
ax.text(50, 68, "FordIQ — Arquitetura do Sistema",
        ha="center", va="center", fontsize=18, weight="bold", color=BLUE)
ax.text(50, 65.5, "Inteligência Competitiva + Retenção VIN Share · Ford × FIAP 2026",
        ha="center", va="center", fontsize=10, color=GREY, style="italic")

# Equipe
ax.text(50, 63.5, "Equipe: Guilherme (554962) · Pedro (555556) · Fabrício (558216) · Vitor (554893) · Matheus (555447)",
        ha="center", va="center", fontsize=8, color=GREY)


def layer(x, y, w, h, fill, label, label_color=GREY):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.2,rounding_size=0.4",
                          linewidth=1.5, edgecolor=label_color, facecolor=fill, alpha=0.5)
    ax.add_patch(rect)
    ax.text(x + 0.3, y + h - 0.7, label, fontsize=9, weight="bold",
            color=label_color, alpha=0.85)


def box(x, y, w, h, label, fill, border, text_color="white", fsize=9, bold=True, subtitle=None):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.15,rounding_size=0.3",
                          linewidth=1.5, edgecolor=border, facecolor=fill)
    ax.add_patch(rect)
    cy = y + h / 2 + (0.5 if subtitle else 0)
    ax.text(x + w / 2, cy, label, ha="center", va="center",
            fontsize=fsize, weight=("bold" if bold else "normal"), color=text_color)
    if subtitle:
        ax.text(x + w / 2, y + h / 2 - 0.7, subtitle, ha="center", va="center",
                fontsize=fsize - 2, color=text_color, alpha=0.85, style="italic")


def arrow(x1, y1, x2, y2, color=GREY, label=None, label_pos=0.5, lw=1.4, style="-", curve=0):
    if curve:
        connstyle = f"arc3,rad={curve}"
    else:
        connstyle = "arc3,rad=0"
    arr = FancyArrowPatch((x1, y1), (x2, y2),
                          arrowstyle="-|>", mutation_scale=12,
                          linewidth=lw, color=color, linestyle=style,
                          connectionstyle=connstyle)
    ax.add_patch(arr)
    if label:
        lx = x1 + (x2 - x1) * label_pos
        ly = y1 + (y2 - y1) * label_pos
        ax.text(lx, ly + 0.5, label, fontsize=7, color=color,
                ha="center", va="bottom", style="italic",
                bbox=dict(facecolor="white", edgecolor="none", pad=1.5, alpha=0.85))


# ===== LAYER 1: CLIENTES =====
layer(2, 53, 96, 8, BG_CLIENT, "CAMADA DE APRESENTAÇÃO", BLUE)

box(6, 55, 18, 4.5, "Web App", BLUE, BLUE, fsize=11,
    subtitle="Next.js 15 · TypeScript")
box(28, 55, 18, 4.5, "Mobile App", BLUE_LIGHT, BLUE_LIGHT, fsize=11,
    subtitle="Expo / React Native")
box(54, 55, 18, 4.5, "Swagger UI", "#5C6BC0", "#5C6BC0", fsize=11,
    subtitle="/docs · OpenAPI 3.0")
box(76, 55, 18, 4.5, "Webhook (futuro)", GREY, GREY, fsize=11,
    subtitle="CRM da concessionária")

# ===== LAYER 2: API GATEWAY =====
layer(2, 38, 96, 13, BG_API, "CAMADA DE SERVIÇO — API GATEWAY (Fastify + TS, REST/JSON, JWT, RBAC)", GREEN)

# Plugins horizontais
box(4, 46, 14, 3.5, "Auth (JWT + RBAC)", GREEN, GREEN, fsize=8)
box(20, 46, 14, 3.5, "Rate Limit + CORS", GREEN, GREEN, fsize=8)
box(36, 46, 14, 3.5, "Helmet (CSP/HSTS)", GREEN, GREEN, fsize=8)
box(52, 46, 14, 3.5, "Audit Log", GREEN, GREEN, fsize=8)
box(68, 46, 14, 3.5, "Zod Validation", GREEN, GREEN, fsize=8)
box(84, 46, 12, 3.5, "Pino Logger", GREEN, GREEN, fsize=8)

# Módulos de domínio
box(4, 40, 18, 4.5, "Vehicles Module", "#43A047", "#43A047", fsize=9,
    subtitle="/competitive/* · CRUD + busca")
box(26, 40, 18, 4.5, "Retention Module", "#43A047", "#43A047", fsize=9,
    subtitle="/clients/* · /leads/* · /predict")
box(48, 40, 18, 4.5, "Insights Module", "#43A047", "#43A047", fsize=9,
    subtitle="/insights/* · /metrics/*")
box(70, 40, 18, 4.5, "AI Config Module", "#43A047", "#43A047", fsize=9,
    subtitle="/admin/ai-keys (admin-only)")

# ===== LAYER 3: SERVIÇOS DE SUPORTE / ML =====
layer(2, 24, 60, 12, BG_ML, "AGGREGATOR DE DADOS + ML SERVICE", PURPLE)

box(4, 30, 27, 4.5, "Vehicles Aggregator", PURPLE, PURPLE, fsize=10,
    subtitle="Orquestra 5 fontes · provenance/campo")
box(33, 30, 27, 4.5, "Manufacturer E-book Extractor", PURPLE, PURPLE, fsize=10,
    subtitle="PDF → vision (Claude / OpenAI)")
box(4, 25, 27, 4, "AI Vision Hybrid", "#7B1FA2", "#7B1FA2", fsize=9,
    subtitle="pdf-parse + LLM (cheap) → vision (fallback)")
box(33, 25, 27, 4, "ML Service (FastAPI)", "#7B1FA2", "#7B1FA2", fsize=9,
    subtitle="/predict + /train · XGBoost + KMeans")

# ===== LAYER 4: DADOS =====
layer(64, 24, 34, 12, BG_DATA, "CAMADA DE DADOS", ORANGE)

box(66, 30, 30, 4.5, "Supabase Postgres", ORANGE, ORANGE, fsize=10,
    subtitle="RLS por dealership · JSONB specs")
box(66, 25, 14, 4, "audit_log", "#F57C00", "#F57C00", fsize=9,
    subtitle="trilha de auditoria")
box(82, 25, 14, 4, "ai_keys (RLS)", "#F57C00", "#F57C00", fsize=9,
    subtitle="cripto + admin-only")

# ===== LAYER 5: FONTES EXTERNAS =====
layer(2, 4, 96, 18, BG_EXT, "FONTES EXTERNAS (Web Services consumidos)", RED)

box(5, 16, 17, 4.5, "FIPE.online v2", RED, RED, fsize=9,
    subtitle="REST · preço oficial BR")
box(24, 16, 17, 4.5, "NHTSA vPIC", RED, RED, fsize=9,
    subtitle="REST · catálogo USA")
box(43, 16, 17, 4.5, "411 Vehicle Data", RED, RED, fsize=9,
    subtitle="RapidAPI · specs detalhadas")
box(62, 16, 17, 4.5, "Manufacturer HTML", RED, RED, fsize=9,
    subtitle="Scraping · Toyota/VW/RAM/...")
box(81, 16, 16, 4.5, "Manufacturer PDF", RED, RED, fsize=9,
    subtitle="E-books oficiais")

# LLMs
box(5, 9, 22, 4.5, "OpenAI", "#37474F", "#37474F", fsize=9,
    subtitle="GPT-4o-mini · vision + JSON")
box(29, 9, 22, 4.5, "Anthropic Claude", "#37474F", "#37474F", fsize=9,
    subtitle="Sonnet 4.6 · PDF nativo")
box(53, 9, 22, 4.5, "Google Gemini", "#37474F", "#37474F", fsize=9,
    subtitle="Flash · texto")
box(77, 9, 20, 4.5, "Supabase Auth", "#37474F", "#37474F", fsize=9,
    subtitle="JWT · OAuth2")

# Cybersec tag
box(5, 5, 92, 2.5, "[Cybersec] HTTPS/TLS 1.2+ · HMAC-SHA256 (API <-> ML) · Pseudonimização de PII · Body integrity check",
    RED, RED, fsize=8, bold=False)

# ===== ARROWS =====
# Camada 1 → Camada 2
arrow(15, 55, 15, 51, BLUE, "HTTPS\nJWT")
arrow(37, 55, 37, 51, BLUE_LIGHT, "HTTPS\nJWT")
arrow(63, 55, 63, 51, "#5C6BC0", "OpenAPI\nspec")

# Modulos → Aggregator/ML/Data
arrow(13, 40, 13, 35, GREEN, "service\ncall")
arrow(35, 40, 47, 30, GREEN, "predict()", curve=-0.1)
arrow(57, 40, 70, 35, GREEN, "RLS query", curve=0.1)

# Aggregator → Fontes externas
arrow(10, 30, 12, 21, PURPLE, "REST")
arrow(20, 30, 30, 21, PURPLE, "REST", curve=-0.2)
arrow(20, 30, 50, 21, PURPLE, curve=-0.3)
arrow(25, 30, 68, 21, PURPLE, curve=-0.4)
arrow(28, 30, 86, 21, PURPLE, "HTTP+HMAC", curve=-0.5)

# Vision → LLM
arrow(17, 25, 16, 14, "#7B1FA2", "vision API", curve=-0.1)
arrow(20, 25, 40, 14, "#7B1FA2", curve=-0.2)
arrow(20, 25, 64, 14, "#7B1FA2", curve=-0.3)

# ML → LLM
arrow(45, 25, 40, 14, "#7B1FA2", curve=0.1)

# Aggregator → Postgres
arrow(45, 30, 75, 32, PURPLE, "JSONB\nupsert", curve=0.15)

# Auth → Supabase Auth
arrow(11, 46, 86, 14, GREEN, "JWT validate", curve=0.4)

# Legenda
ax.text(2, 1.5, "REST/JSON sobre HTTPS  ·  setas indicam dependência (caller → callee)",
        fontsize=7, color=GREY, style="italic")

plt.tight_layout()

png_path = OUT / "FordIQ_Architecture_Diagram.png"
pdf_path = OUT / "FordIQ_Architecture_Diagram.pdf"
plt.savefig(png_path, dpi=180, bbox_inches="tight", facecolor="white")
plt.savefig(pdf_path, bbox_inches="tight", facecolor="white")
plt.close()

print(f"OK: {png_path.name}")
print(f"OK: {pdf_path.name}")
