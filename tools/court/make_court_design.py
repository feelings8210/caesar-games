"""CD Games home court: full-court floor design as one RGBA texture (paint over the maple).

    python3 make_court_design.py <out.png> <Anton.ttf> <cd_mark.png> [--ppf 64]

Runs on the 3090 (pycairo for anti-aliased vectors, Pillow for lettering). The texture
covers x -35..35 ft (columns, left to right) and z -12..106 ft (rows, near baseline at the
top), i.e. the court plus the painted apron out to the stands. Alpha says how much paint
covers the wood: 0 = bare maple, ~0.15 = stain, ~0.94 = paint (a hint of grain shows).

Design (docs/COURT_DESIGN.md): what NBA home floors share -- pale natural maple, a darker
stain outside the arc, team-colour lane, painted apron with the team name on the baseline,
big centre-court mark -- plus our own signature: a horns set "etched" into each half in a
faint darker stain, the read-and-react idea of the game written into the wood.
"""
import math
import sys

import cairo
from PIL import Image, ImageDraw, ImageFont

X0, X1, Z0, Z1 = -35.0, 35.0, -12.0, 106.0
HOOP_Z = 5.25
CZ = HOOP_Z + math.sqrt(23.75 ** 2 - 22 ** 2)      # where the corner three meets the arc
LW = 2 / 12

WHITE = (247, 244, 236)
NAVY_APRON = (31, 52, 89)
NAVY_KEY = (24, 44, 82)
NAVY_CHEVRON = (27, 49, 90)
GOLD = (214, 170, 92)
STAIN = (92, 52, 20)
ETCH = (64, 36, 14)


def rgba(c, a):
    return (c[0] / 255, c[1] / 255, c[2] / 255, a)


class Court:
    def __init__(self, ppf):
        self.ppf = ppf
        self.W, self.H = int((X1 - X0) * ppf), int((Z1 - Z0) * ppf)
        self.s = cairo.ImageSurface(cairo.FORMAT_ARGB32, self.W, self.H)
        self.g = cairo.Context(self.s)
        # Court feet -> pixels; drawing in feet keeps every dimension readable.
        self.g.scale(ppf, ppf)
        self.g.translate(-X0, -Z0)
        self.far = False

    # Far half = the near half turned around centre court.
    def half(self, far):
        g = self.g
        g.restore() if self.far else None
        self.far = far
        if far:
            g.save()
            g.translate(0, 94)
            g.scale(-1, -1)

    def fill(self, c, a):
        self.g.set_source_rgba(*rgba(c, a)); self.g.fill()

    def stroke(self, c, a, w):
        self.g.set_source_rgba(*rgba(c, a)); self.g.set_line_width(w); self.g.stroke()

    def arc_path(self, cx, cz, r, a0, a1, neg=False):
        (self.g.arc_negative if neg else self.g.arc)(cx, cz, r, a0, a1)

    def three_path(self, join=False):
        g = self.g
        a0 = math.atan2(CZ - HOOP_Z, 22)
        (g.line_to if join else g.move_to)(-22, 0); g.line_to(-22, CZ)
        g.arc_negative(0, HOOP_Z, 23.75, math.pi - a0, a0)
        g.line_to(22, 0)

    def line(self, x0, z0, x1, z1, c=WHITE, a=1.0, w=LW):
        self.g.move_to(x0, z0); self.g.line_to(x1, z1); self.stroke(c, a, w)


def arrow_head(c, x, z, ang, size=1.1, col=ETCH, a=0.21):
    g = c.g
    g.move_to(x, z)
    g.line_to(x - size * math.cos(ang - 0.45), z - size * math.sin(ang - 0.45))
    g.line_to(x - size * math.cos(ang + 0.45), z - size * math.sin(ang + 0.45))
    g.close_path(); c.fill(col, a)


def etched_horns(c):
    """Horns: 1 up top, 4 and 5 at the elbows, shooters in the corners. 4 screens for 1,
    1 attacks the screen, 4 rolls, 1 hits the roller -- drawn like chalk, faint stain."""
    g = c.g
    A, W = 0.21, 0.28
    for (x, z) in ((0, 31.5), (-8.5, 20.5), (8.5, 20.5), (-21.5, 4), (21.5, 4)):
        g.new_sub_path(); g.arc(x, z, 1.35, 0, math.tau); c.stroke(ETCH, A, W)
    # Screen: 4 up to the ball side of 1, T-bar at the end.
    g.move_to(-7.6, 21.8); g.curve_to(-6.5, 25.5, -4.5, 28.5, -2.6, 30.2); c.stroke(ETCH, A, W)
    g.move_to(-3.7, 31.4); g.line_to(-1.5, 29.0); c.stroke(ETCH, A, W)
    # 1 drives off the screen: a dribble squiggle toward the left wing.
    g.move_to(-1.0, 30.0)
    n = 9
    for k in range(1, n + 1):
        t = k / n
        x = -1.0 - 12.0 * t
        z = 30.0 - 9.0 * t + (0.55 if k % 2 else -0.55)
        g.line_to(x, z)
    c.stroke(ETCH, A, W)
    arrow_head(c, -13.4, 20.6, math.atan2(-9.0, -12.0))
    # 4 rolls to the rim.
    g.move_to(-2.4, 28.6); g.curve_to(-1.0, 22.0, -1.6, 15.0, -2.6, 10.6); c.stroke(ETCH, A, W)
    arrow_head(c, -2.7, 10.0, math.atan2(-4.0, -0.6))
    # Pocket pass from 1 to the roller, dashed.
    g.set_dash([0.9, 0.7])
    g.move_to(-12.6, 19.6); g.curve_to(-9.0, 15.8, -6.0, 13.0, -3.8, 11.4); c.stroke(ETCH, A, W)
    g.set_dash([])
    arrow_head(c, -3.3, 11.0, math.atan2(-1.6, 2.2))


def key_paint(c):
    g = c.g
    g.save()
    g.rectangle(-8, 0, 16, 19); g.clip()
    # Opaque: with a translucent base the doubled-up chevrons came out much darker than the
    # base (the pale maple showing through the base, not through the chevrons) -- a16.
    g.rectangle(-8, 0, 16, 19); c.fill(NAVY_KEY, 1.0)
    # Tonal chevrons pointing at the rim: the lane says "attack".
    for k in range(-1, 9):
        z = 1.2 + k * 2.6
        g.move_to(-8.5, z + 4.2); g.line_to(0, z); g.line_to(8.5, z + 4.2)
        c.stroke(NAVY_CHEVRON, 1.0, 0.75)
    g.restore()
    # Gold pinstripe just inside the lane.
    g.rectangle(-7.45, 0.55, 14.9, 17.9); c.stroke(GOLD, 0.95, LW)


def lines_half(c):
    g = c.g
    e = LW / 2
    c.line(-8, 0, -8, 19); c.line(8, 0, 8, 19); c.line(-8, 19 - e, 8, 19 - e)      # lane, FT line
    c.three_path(); c.stroke(WHITE, 1, LW)
    g.new_sub_path(); g.arc(0, 19, 6, 0, math.pi); c.stroke(WHITE, 1, LW)            # FT circle, outside
    g.set_dash([1.3, 1.0])
    g.new_sub_path(); g.arc(0, 19, 6, math.pi, math.tau); c.stroke(WHITE, 1, LW)     # dashed, inside the lane
    g.set_dash([])
    g.move_to(-4, 4); g.line_to(-4, HOOP_Z); g.arc_negative(0, HOOP_Z, 4, math.pi, 0); g.line_to(4, 4)
    c.stroke(WHITE, 1, LW)                                                           # restricted area
    for z in (7, 8, 11, 14):                                                         # lane spaces
        c.line(-8.8, z, -8, z); c.line(8, z, 8.8, z)
    c.line(-25, 28, -28, 28); c.line(25, 28, 28, 28)                                 # coaching box marks
    c.line(-2, 0, -2, 0.5); c.line(2, 0, 2, 0.5)                                     # baseline backboard marks
    c.line(-25, 3, -25.5, 3); c.line(25, 3, 25.5, 3)


def draw(ppf):
    c = Court(ppf)
    g = c.g
    # 1 Stain outside the arc, inside the boundary.
    for far in (False, True):
        c.half(far)
        g.move_to(-25, 0); c.three_path(join=True); g.line_to(25, 0); g.line_to(25, 47); g.line_to(-25, 47); g.close_path()
        c.fill(STAIN, 0.15)
    # 2 Etched horns set in both halves.
    for far in (False, True):
        c.half(far)
        etched_horns(c)
    c.half(False)
    # 3 Apron: everything outside the boundary, with a gold pinstripe 8 in outside it.
    g.rectangle(X0, Z0, X1 - X0, Z1 - Z0); g.rectangle(-25, 0, 50, 94)
    g.set_fill_rule(cairo.FILL_RULE_EVEN_ODD); c.fill(NAVY_APRON, 0.95); g.set_fill_rule(cairo.FILL_RULE_WINDING)
    g.rectangle(-25.75, -0.75, 51.5, 95.5); c.stroke(GOLD, 0.95, 4 / 12)
    # 4 Lanes.
    for far in (False, True):
        c.half(far)
        key_paint(c)
    c.half(False)
    # 5 Centre circle: navy disc, gold ring (the mark goes on with the lettering).
    g.new_sub_path(); g.arc(0, 47, 6, 0, math.tau); c.fill(NAVY_KEY, 0.94)
    g.new_sub_path(); g.arc(0, 47, 5.35, 0, math.tau); c.stroke(GOLD, 0.95, 0.25)
    # 6 Lines.
    e = LW / 2
    g.rectangle(-25 + e, e, 50 - LW, 94 - LW); c.stroke(WHITE, 1, LW)               # boundary
    c.line(-25, 47, -6, 47); c.line(6, 47, 25, 47)                                   # half court (the mark fills the circle)
    g.new_sub_path(); g.arc(0, 47, 6, 0, math.tau); c.stroke(WHITE, 1, LW)
    for far in (False, True):
        c.half(far)
        lines_half(c)
    c.half(False)
    return c


def letter(img, text, font_path, height_ft, ppf, colour, centre, rot):
    """Anton lettering, `height_ft` cap height, rotated `rot` degrees counter-clockwise."""
    size = int(height_ft * ppf * 1.18)
    font = ImageFont.truetype(font_path, size)
    l, t, r, b = font.getbbox(text)
    tile = Image.new('RGBA', (r - l + 8, b - t + 8), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((4 - l, 4 - t), text, font=font, fill=(*colour, 245))
    tile = tile.rotate(rot, expand=True, resample=Image.BICUBIC)
    cx, cz = centre
    px, py = int((cx - X0) * ppf - tile.width / 2), int((cz - Z0) * ppf - tile.height / 2)
    img.alpha_composite(tile, (px, py))


def main():
    out, font, mark = sys.argv[1:4]
    ppf = int(sys.argv[sys.argv.index('--ppf') + 1]) if '--ppf' in sys.argv else 64
    c = draw(ppf)
    tmp = out + '.vec.png'
    c.s.write_to_png(tmp)
    img = Image.open(tmp).convert('RGBA')
    # Broadcast camera sits at -x looking +x: its "up" is image right, so its lettering
    # turns 90 deg clockwise (-90). Baseline names read from the court: near upright, far 180.
    letter(img, 'CD GAMES', font, 4.6, ppf, WHITE, (-30.2, 47), -90)
    letter(img, 'HOOPS IQ', font, 4.6, ppf, GOLD, (30.2, 47), -90)
    letter(img, 'HOOPS IQ', font, 3.4, ppf, WHITE, (0, -6.2), 0)
    letter(img, 'HOOPS IQ', font, 3.4, ppf, WHITE, (0, 100.2), 180)
    # Centre-court mark in gold.
    m = Image.open(mark).convert('RGBA')
    w = int(8.2 * ppf)
    m = m.resize((w, int(w * m.height / m.width)), Image.LANCZOS)
    gold = Image.new('RGBA', m.size, (*GOLD, 0))
    gold.putalpha(m.getchannel('A').point(lambda v: int(v * 0.96)))
    gold = gold.rotate(-90, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(gold, (int((0 - X0) * ppf - gold.width / 2), int((47 - Z0) * ppf - gold.height / 2)))
    img.save(out, optimize=True)
    print(out, img.size)


if __name__ == '__main__':
    main()
