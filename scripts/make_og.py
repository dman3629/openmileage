from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "og.png"
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


def font(name, size):
    path = FONT_DIR / name
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


image = Image.new("RGB", (1200, 630), "#0f6e56")
draw = ImageDraw.Draw(image)
draw.text((80, 176), "OpenMileage", fill="white", font=font("DejaVuSans-Bold.ttf", 96))
draw.text(
    (80, 330),
    "Free mileage log. No app. No cap. No account.",
    fill="white",
    font=font("DejaVuSans.ttf", 43),
)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, optimize=True)
