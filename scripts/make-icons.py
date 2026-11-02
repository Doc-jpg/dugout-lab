# Dugout Lab icon: navy square, white diamond, orange station dots, a check in the middle. Drawn at 4x then downsampled.
from PIL import Image, ImageDraw
import sys, os
out = sys.argv[1]
NAVY = (19, 33, 58); WHITE = (255, 255, 255); ORANGE = (240, 150, 60); GREEN = (72, 190, 120)

def icon(size, pad_ratio, rounded):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.225, fill=NAVY)
    else: d.rectangle([0, 0, S - 1, S - 1], fill=NAVY)
    pad = pad_ratio
    cx, cy = S / 2, S * 0.52
    r = S * (0.36 - pad * 0.9)
    pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    w = max(4, int(S * 0.045))
    d.line(pts + [pts[0]], fill=WHITE, width=w, joint='curve')
    b = S * 0.055
    for (x, y) in pts:
        d.ellipse([x - b, y - b, x + b, y + b], fill=ORANGE)
    # check mark in the middle
    cw = max(4, int(S * 0.05))
    d.line([(cx - r * 0.32, cy + r * 0.02), (cx - r * 0.08, cy + r * 0.26), (cx + r * 0.36, cy - r * 0.26)], fill=GREEN, width=cw, joint='curve')
    return img.resize((size, size), Image.LANCZOS)

for name, size, pad, rounded in [('icon-192.png', 192, 0.03, True), ('icon-512.png', 512, 0.03, True), ('icon-512-maskable.png', 512, 0.12, False), ('apple-touch-icon.png', 180, 0.04, False), ('favicon.png', 64, 0.03, True)]:
    icon(size, pad, rounded).save(os.path.join(out, name))
print('ok')
