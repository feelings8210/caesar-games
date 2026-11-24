"""LED ribbon / courtside board texture for the Blender venue: six 10:1 ad panels, all our own text.

python3 tools/blender/make_led_ribbon.py <out.png>   (font: assets/hoops/fonts/Anton_Regular.ttf, OFL)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

PW, PH = 1600, 160
FONT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'hoops', 'fonts', 'Anton_Regular.ttf')
PANELS = [  # background, text colour, text, accent stripe colour
    ((10, 30, 92), (255, 255, 255), 'HOOPS IQ', (245, 176, 52)),
    ((245, 170, 40), (12, 26, 70), 'CD GAMES', None),
    ((246, 247, 250), (16, 46, 132), 'READ THE DEFENSE', (16, 46, 132)),
    ((22, 70, 190), (255, 255, 255), 'PLAY SMART', (255, 255, 255)),
    ((8, 10, 16), (245, 176, 52), 'MAKE THE RIGHT READ', None),
    ((160, 22, 34), (255, 255, 255), 'HOOPS IQ', (255, 255, 255)),
]


def main(out):
    img = Image.new('RGB', (PW * len(PANELS), PH))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(PH * 0.62))
    for k, (bg, fg, text, accent) in enumerate(PANELS):
        x0 = k * PW
        d.rectangle((x0, 0, x0 + PW - 1, PH - 1), fill=bg)
        if accent:
            d.rectangle((x0, PH - 14, x0 + PW - 1, PH - 1), fill=accent)
            d.rectangle((x0, 0, x0 + PW - 1, 7), fill=accent)
        l, t, r, b = d.textbbox((0, 0), text, font=font)
        d.text((x0 + (PW - (r - l)) / 2 - l, (PH - (b - t)) / 2 - t), text, font=font, fill=fg)
        d.rectangle((x0, 0, x0 + 3, PH - 1), fill=(0, 0, 0))   # panel seam
    img.save(out)


if __name__ == '__main__':
    main(sys.argv[1])
