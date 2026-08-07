#!/usr/bin/env python3
"""Render 1080x1920 vertical slides for the NHS privatisation TikTok reel."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
OUT = os.path.join(os.path.dirname(__file__), "slides")
os.makedirs(OUT, exist_ok=True)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Palette
BG_TOP = (8, 20, 36)      # deep navy
BG_BOT = (3, 8, 16)       # near black
NHS_BLUE = (0, 114, 206)  # NHS blue
RED = (218, 41, 28)       # alarm red
YELLOW = (255, 209, 59)   # highlight
WHITE = (245, 248, 252)
GREY = (150, 165, 182)


def font(sz, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, sz)


def gradient_bg():
    img = Image.new("RGB", (W, H), BG_BOT)
    top = Image.new("RGB", (W, H), BG_TOP)
    mask = Image.new("L", (W, H))
    md = mask.load()
    for y in range(H):
        md_val = int(255 * (1 - y / H) ** 1.3)
        for x in range(W):
            md[x, y] = md_val
    img.paste(top, (0, 0), mask)
    return img


def wrap(draw, text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=fnt) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_block(draw, lines, fnt, y, color, line_gap=18, center=True, x_left=90):
    for ln in lines:
        w = draw.textlength(ln, font=fnt)
        x = (W - w) // 2 if center else x_left
        # subtle shadow for legibility
        draw.text((x + 3, y + 3), ln, font=fnt, fill=(0, 0, 0))
        draw.text((x, y), ln, font=fnt, fill=color)
        asc, desc = fnt.getmetrics()
        y += asc + desc + line_gap
    return y


def kicker(draw, text, color=RED, y=250):
    f = font(46)
    tw = draw.textlength(text, font=f)
    pad = 34
    bx0 = (W - tw) // 2 - pad
    bx1 = (W + tw) // 2 + pad
    draw.rounded_rectangle([bx0, y, bx1, y + 92], radius=16, fill=color)
    draw.text(((W - tw) // 2, y + 20), text, font=f, fill=WHITE)
    return y + 92


def footer(draw, text="KEEP OUR NHS PUBLIC", color=GREY):
    f = font(38)
    tw = draw.textlength(text, font=f)
    draw.text(((W - tw) // 2, H - 130), text, font=f, fill=color)


def base():
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    # top + bottom accent bars
    d.rectangle([0, 0, W, 14], fill=RED)
    d.rectangle([0, H - 14, W, H], fill=NHS_BLUE)
    return img, d


def stat(draw, number, label, y, ncolor=YELLOW):
    fn = font(150)
    tw = draw.textlength(number, font=fn)
    draw.text(((W - tw) // 2 + 3, y + 3), number, font=fn, fill=(0, 0, 0))
    draw.text(((W - tw) // 2, y), number, font=fn, fill=ncolor)
    asc, desc = fn.getmetrics()
    y2 = y + asc + desc + 6
    fl = font(52, bold=True)
    lines = wrap(draw, label, fl, W - 180)
    y2 = draw_block(draw, lines, fl, y2, WHITE, line_gap=10)
    return y2


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, "PNG")
    print("wrote", p)


# ---- Slide 1: HOOK ----
img, d = base()
kicker(d, "NHS PRIVATISATION", RED, y=300)
f1 = font(96)
y = 560
y = draw_block(d, ["The NHS isn't", "being CUT."], f1, y, WHITE, line_gap=8)
y += 40
f2 = font(120)
draw_block(d, ["It's being"], f2, y, WHITE, line_gap=8)
y2 = y + font(120).getmetrics()[0] + font(120).getmetrics()[1] + 8
fsold = font(210)
tw = d.textlength("SOLD.", font=fsold)
d.text(((W - tw) // 2 + 4, y2 + 4), "SOLD.", font=fsold, fill=(0, 0, 0))
d.text(((W - tw) // 2, y2), "SOLD.", font=fsold, fill=RED)
footer(d)
save(img, "slide1.png")

# ---- Slide 2: The Plan / Milburn ----
img, d = base()
kicker(d, "THE 2025 10-YEAR HEALTH PLAN", NHS_BLUE, y=250)
fh = font(78)
y = 440
y = draw_block(d, wrap(d, "Openly welcomes private 'partnership'.", fh, W - 150), fh, y, WHITE, line_gap=14)
y += 70
# quote card
qy0 = y
fq = font(58, bold=True)
qlines = wrap(d, "Milburn calls the NHS an 'ecosystem' of private providers.", fq, W - 240)
card_h = 60 + (fq.getmetrics()[0] + fq.getmetrics()[1] + 14) * len(qlines) + 60
d.rounded_rectangle([80, qy0, W - 80, qy0 + card_h], radius=28, fill=(16, 34, 56))
d.rectangle([80, qy0, 96, qy0 + card_h], fill=YELLOW)
yy = qy0 + 60
for ln in qlines:
    d.text((130, yy), ln, font=fq, fill=WHITE)
    yy += fq.getmetrics()[0] + fq.getmetrics()[1] + 14
d.text((130, yy + 6), "— Alan Milburn, Health Adviser", font=font(40, bold=False), fill=GREY)
footer(d)
save(img, "slide2.png")

# ---- Slide 3: Follow the money ----
img, d = base()
kicker(d, "FOLLOW THE MONEY", RED, y=230)
y = 470
y = stat(d, "32%", "of profits extracted by private cataract firms", y)
y += 90
y = stat(d, "£68m", "interest on debt paid straight to private equity", y, ncolor=YELLOW)
footer(d)
save(img, "slide3.png")

# ---- Slide 4: Cherry-picking / inequality ----
img, d = base()
kicker(d, "CHERRY-PICKING", RED, y=250)
fh = font(72)
y = 440
y = draw_block(d, wrap(d, "Private takes the easy, low-risk cases.", fh, W - 150), fh, y, WHITE, line_gap=12)
y += 30
y = draw_block(d, wrap(d, "Complex cases dumped on a depleted NHS.", fh, W - 150), fh, y, YELLOW, line_gap=12)
y += 70
fb = font(56, bold=True)
lines = wrap(d, "The surgery-access gap between richest and poorest keeps widening.", fb, W - 180)
draw_block(d, lines, fb, y, WHITE, line_gap=12)
footer(d)
save(img, "slide4.png")

# ---- Slide 5: Safety / rescued ----
img, d = base()
kicker(d, "WHEN PRIVATE CARE FAILS", RED, y=230)
y = 470
y = stat(d, "6,600", "private patients rescued by the NHS every year", y)
y += 90
y = stat(d, "£80m", "the annual bill picked up by the public", y, ncolor=YELLOW)
footer(d)
save(img, "slide5.png")

# ---- Slide 6: CTA ----
img, d = base()
y = 430
fbig = font(70)
y = draw_block(d, ["PUBLIC MONEY.", "PRIVATE PROFIT."], fbig, y, GREY, line_gap=10)
y += 80
# big CTA
fc = font(110)
y = draw_block(d, ["KEEP OUR", "NHS", "PUBLIC"], fc, y, WHITE, line_gap=6)
# underline NHS in blue block already white; add red bar
d.rectangle([(W - 500) // 2, y + 20, (W + 500) // 2, y + 40], fill=RED)
fcta = font(50, bold=True)
t = "Follow. Share. Defend it."
tw = d.textlength(t, font=fcta)
d.text(((W - tw) // 2, H - 260), t, font=fcta, fill=YELLOW)
save(img, "slide6.png")

print("done")
