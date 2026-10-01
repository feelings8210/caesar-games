"""Court markings texture for Hoops IQ (shared by Blender previews and the game).

Covers x -25..25 ft and y 0..50 ft (baseline at the top edge of the image),
2048 px square, RGBA: painted areas and lines over transparent wood.

    python3 tools/blender/court_texture.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 2048
SS = 2                      # supersample for smooth edges
PX = SIZE * SS / 50.0       # pixels per foot
OUT = Path(__file__).resolve().parents[2] / 'assets' / 'hoops' / 'court_lines.png'

NAVY = (30, 60, 110)
LINE = (246, 244, 238, 255)
W = 2 / 12                  # two-inch lines


def p(x, y):
    return ((x + 25) * PX, y * PX)


def main():
    img = Image.new('RGBA', (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = max(1, round(W * PX))

    # Painted lane and centre circle, in the app's navy.
    d.rectangle([p(-8, 0), p(8, 19)], fill=NAVY + (248,))
    cx, cy = p(0, 47)
    r = 6 * PX
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=NAVY + (248,))

    # Three-point area: a faint darker stain.
    stain = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stain)
    hx, hy = p(0, 5.25)
    R = 23.75 * PX
    sd.pieslice([hx - R, hy - R, hx + R, hy + R], 0, 180, fill=(90, 58, 24, 26))
    sd.rectangle([p(-22, 0), p(22, 5.25)], fill=(90, 58, 24, 26))
    img = Image.alpha_composite(stain, img)
    d = ImageDraw.Draw(img)

    def line(a, b):
        d.line([p(*a), p(*b)], fill=LINE, width=lw)

    def arc(cx_, cy_, rad, start, end, dashed=False):
        box = [p(cx_ - rad, cy_ - rad), p(cx_ + rad, cy_ + rad)]
        box = [box[0][0], box[0][1], box[1][0], box[1][1]]
        if not dashed:
            d.arc(box, start, end, fill=LINE, width=lw)
            return
        step = 14
        for a in range(int(start), int(end), step):
            d.arc(box, a, min(a + step * 0.55, end), fill=LINE, width=lw)

    # Boundary
    line((-25, 0), (25, 0)); line((-25, 0), (-25, 47)); line((25, 0), (25, 47)); line((-25, 47), (25, 47))
    # Lane
    line((-8, 0), (-8, 19)); line((8, 0), (8, 19)); line((-8, 19), (8, 19))
    for y in (7, 8, 11, 14):
        line((-8.8, y), (-8, y)); line((8, y), (8.8, y))
    # Free-throw circle: solid toward half court, dashed inside the lane.
    arc(0, 19, 6, 0, 180)
    arc(0, 19, 6, 180, 360, dashed=True)
    # Restricted area
    arc(0, 5.25, 4, 0, 180)
    # Three-point line
    ya = 5.25 + math.sqrt(23.75 ** 2 - 22 ** 2)
    line((-22, 0), (-22, ya)); line((22, 0), (22, ya))
    t = math.degrees(math.asin((ya - 5.25) / 23.75))
    arc(0, 5.25, 23.75, t, 180 - t)
    # Centre circles
    arc(0, 47, 6, 180, 360)
    arc(0, 47, 2, 180, 360)
    # Thin gold ring inside the centre circle.
    gx, gy = p(0, 47)
    gr = 4.2 * PX
    d.arc([gx - gr, gy - gr, gx + gr, gy + gr], 180, 360, fill=(201, 167, 106, 255), width=max(1, lw // 2))

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, optimize=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
