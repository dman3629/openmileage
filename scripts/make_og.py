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
draw.text((72, 62), "OpenMileage", fill="white", font=font("DejaVuSans-Bold.ttf", 82))
draw.line((74, 166, 1126, 166), fill="#76d7b9", width=5)
draw.text(
    (72, 198),
    "Free mileage log. No app. No cap. No account.",
    fill="white",
    font=font("DejaVuSans.ttf", 34),
)
# A simple entry-card mockup, drawn rather than screenshot-dependent.
draw.rounded_rectangle((72, 300, 1128, 565), radius=22, fill="#f5f7f5")
draw.text((108, 328), "Add mileage", fill="#17201d", font=font("DejaVuSans-Bold.ttf", 31))
draw.text((108, 389), "Start odometer", fill="#5b6763", font=font("DejaVuSans.ttf", 19))
draw.text((488, 389), "End odometer", fill="#5b6763", font=font("DejaVuSans.ttf", 19))
draw.rounded_rectangle((108, 422, 452, 501), radius=10, outline="#b8c5c0", width=3, fill="white")
draw.rounded_rectangle((488, 422, 832, 501), radius=10, outline="#b8c5c0", width=3, fill="white")
draw.rounded_rectangle((868, 422, 1092, 501), radius=10, fill="#0f6e56")
draw.text((944, 442), "Add", fill="white", font=font("DejaVuSans-Bold.ttf", 27))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, optimize=True)
