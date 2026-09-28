"""
Gera os assets do app mobile (ícone, ícone adaptativo Android, splash e favicon)
a partir do símbolo Faro AI — o mesmo farol usado em apps/web/src/components/FaroLogo.tsx.

Uso (na raiz do repositório):
    python scripts/generate-mobile-assets.py

Saída: apps/mobile/assets/{icon,adaptive-icon,splash-icon,favicon}.png
Dependência: Pillow (pip install pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets"

# Tokens de cor — mesmos de packages/ui/src/index.ts
FORD_BLUE_DARK = (0, 26, 61, 255)     # #001A3D  fundo
MARK_BODY = (255, 255, 255, 255)      # corpo do farol
MARK_LIGHT = (77, 159, 255, 255)      # #4D9FFF  feixes de luz
TRANSPARENT = (0, 0, 0, 0)

SUPERSAMPLING = 4  # desenha maior e reduz, para bordas suaves


def quadratic_curve(p0, p1, p2, steps=64):
    """Pontos de uma curva de Bézier quadrática (a 'estrada' na base do logo)."""
    points = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        points.append((x, y))
    return points


def stroke_path(draw: ImageDraw.ImageDraw, points, width: float, fill) -> None:
    """Traço com pontas arredondadas: carimba círculos ao longo do caminho."""
    radius = width / 2
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / (radius / 3)))
        for i in range(steps + 1):
            t = i / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=fill)


def draw_mark(draw: ImageDraw.ImageDraw, origin_x: float, origin_y: float, scale: float) -> None:
    """Desenha o farol no viewBox 64x64 original, transladado e escalado."""

    def pt(x, y):
        return (origin_x + x * scale, origin_y + y * scale)

    # Feixes de luz saindo do topo do farol (em leque)
    rays = [((32, 8), (32, 2)), ((27, 10), (22, 5)), ((37, 10), (42, 5))]
    for start, end in rays:
        stroke_path(draw, [pt(*start), pt(*end)], 2.2 * scale, MARK_LIGHT)
    # Corpo do farol
    draw.polygon([pt(32, 13), pt(40, 50), pt(24, 50)], fill=MARK_BODY)
    # Feixes laterais
    draw.polygon([pt(24, 50), pt(18, 54), pt(32, 36)], fill=MARK_LIGHT)
    draw.polygon([pt(40, 50), pt(46, 54), pt(32, 36)], fill=MARK_LIGHT)
    # Estrada
    road = [pt(x, y) for x, y in quadratic_curve((14, 57), (32, 51), (50, 57))]
    stroke_path(draw, road, 2.8 * scale, MARK_BODY)


def render(size: int, background, mark_ratio: float) -> Image.Image:
    """mark_ratio = fração do lado ocupada pelo símbolo (controla a margem de segurança)."""
    big = size * SUPERSAMPLING
    image = Image.new("RGBA", (big, big), background)
    draw = ImageDraw.Draw(image)
    mark_px = big * mark_ratio
    scale = mark_px / 64
    offset = (big - mark_px) / 2
    draw_mark(draw, offset, offset, scale)
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    assets = {
        "icon.png": render(1024, FORD_BLUE_DARK, 0.70),
        # Android recorta o ícone adaptativo: o símbolo precisa caber nos 66% centrais
        "adaptive-icon.png": render(1024, TRANSPARENT, 0.52),
        "splash-icon.png": render(1024, TRANSPARENT, 0.60),
        "favicon.png": render(48, FORD_BLUE_DARK, 0.80),
    }
    for name, image in assets.items():
        image.save(OUTPUT_DIR / name, optimize=True)
        print(f"ok  {OUTPUT_DIR / name}")


if __name__ == "__main__":
    main()
