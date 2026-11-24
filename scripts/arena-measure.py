"""Measure the in-game arena frame against docs/ARENA_REFERENCE.md.

  python3 -I scripts/arena-measure.py <1180x820-03-level-title.png>

Regions are fractions of the 1180x820 level-title frame from scripts/ui-screens.mjs
(court on the left, panel on the right). Prints floor/crowd/apron colour and the
ratios that the reference board sets targets for.
"""
import colorsys, json, sys
from PIL import Image

REGIONS = {'floor': [.47, .585, .64, .68], 'paint': [.17, .53, .30, .58],
           'apron': [.55, .877, .70, .903], 'crowd': [.38, .12, .55, .28]}
TARGETS = {'floor_Y': (0.70, 0.74), 'floor/crowd': (5, 13), 'floor/apron': (7, 9), 'floor_hue': (36, 43)}


def lin(c):
    c /= 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def stats(im, r):
    W, H = im.size
    px = list(im.crop(tuple(round(v) for v in (r[0] * W, r[1] * H, r[2] * W, r[3] * H))).getdata())
    n = len(px)
    m = [sum(p[i] for p in px) / n for i in range(3)]
    Y = sum(.2126 * lin(p[0]) + .7152 * lin(p[1]) + .0722 * lin(p[2]) for p in px) / n
    h, s, _ = colorsys.rgb_to_hsv(*[v / 255 for v in m])
    return {'rgb': [round(v) for v in m], 'Y': round(Y, 3), 'sat': round(s, 2), 'hue': round(h * 360)}


im = Image.open(sys.argv[1]).convert('RGB')
st = {k: stats(im, r) for k, r in REGIONS.items()}
ratio = {'floor_Y': st['floor']['Y'], 'floor_hue': st['floor']['hue'],
         'floor/crowd': round(st['floor']['Y'] / st['crowd']['Y'], 1),
         'floor/apron': round(st['floor']['Y'] / st['apron']['Y'], 1)}
print(json.dumps(st))
for k, v in ratio.items():
    lo, hi = TARGETS[k]
    print(f'{k:12s} {v:>7}   target {lo}-{hi}   {"OK" if lo <= v <= hi else "MISS"}')
