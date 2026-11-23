"""Stack source footage | our player over the same camera | our player from the side.

  python compose_video_compare.py <source.mp4> <keypoints_dir> <retarget_dir> <out.mp4> --t0 1.0 [--pct 50]

Silent output. Experiment only.
"""
import argparse, os, json, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('kp'); ap.add_argument('ret'); ap.add_argument('out')
ap.add_argument('--t0', type=float, required=True); ap.add_argument('--pct', type=int, default=50)
ap.add_argument('--trim', default='')
a = ap.parse_args()
d = np.load(os.path.join(a.kp, 'keypoints.npz'))
boxes = d['box'] * a.pct / 100.0
info = json.load(open(os.path.join(a.ret, 'retarget.json')))
if a.trim:
    s_, e_ = (int(v) for v in a.trim.split(':')); boxes = boxes[s_:e_]
else:
    s_ = 0
N = info['frames']; fps = info['fps']

def gs(x, sig):
    r = int(3 * sig); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sig) ** 2); k /= k.sum()
    p = np.concatenate([x[:1].repeat(r, 0), x, x[-1:].repeat(r, 0)])
    return np.stack([np.convolve(p[:, i], k, 'valid') for i in range(x.shape[1])], 1)
ctr = gs(np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2], 6)
bh = (boxes[:, 3] - boxes[:, 1]).max()
ch = int(bh * 1.35) // 2 * 2; cw = int(ch * 0.8) // 2 * 2
cap = cv2.VideoCapture(a.src)
cap.set(cv2.CAP_PROP_POS_MSEC, (a.t0 + s_ / fps) * 1000)
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 22)
PH = 540
tmp = a.out + '.raw.mp4'
vw = None
for f in range(N):
    ok, img = cap.read()
    if not ok: break
    img = cv2.resize(img, None, fx=a.pct / 100, fy=a.pct / 100, interpolation=cv2.INTER_AREA)
    Hh, Ww = img.shape[:2]
    cx = int(np.clip(ctr[f, 0] - cw / 2, 0, Ww - cw)); cy = int(np.clip(ctr[f, 1] - ch / 2, 0, Hh - ch))
    src = img[cy:cy + ch, cx:cx + cw]
    ren = cv2.imread(os.path.join(a.ret, 'frames', f'cam_{f + 1:04d}.png'), cv2.IMREAD_UNCHANGED)
    ren = cv2.resize(ren, (Ww, Hh))[cy:cy + ch, cx:cx + cw]
    bg = (cv2.cvtColor(cv2.cvtColor(src, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR) * 0.45).astype(np.float32)
    al = ren[:, :, 3:4].astype(np.float32) / 255
    over = (ren[:, :, :3] * al + bg * (1 - al)).astype(np.uint8)
    side = cv2.imread(os.path.join(a.ret, 'frames', f'side_{f + 1:04d}.png'))
    panels = [cv2.resize(p, (int(p.shape[1] * PH / p.shape[0]), PH)) for p in (src, over, side)]
    row = np.concatenate(panels, 1)
    im = Image.fromarray(cv2.cvtColor(row, cv2.COLOR_BGR2RGB)); dr = ImageDraw.Draw(im)
    x = 0
    for p, lab in zip(panels, ('原视频', '我们的球员（同一机位）', '我们的球员（侧面）')):
        dr.rectangle((x, 0, x + p.shape[1], 34), fill=(0, 0, 0)); dr.text((x + 10, 4), lab, font=font, fill=(255, 255, 255))
        x += p.shape[1]
    row = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)
    if row.shape[1] % 2: row = row[:, :-1]
    if vw is None:
        vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'), fps, (row.shape[1], row.shape[0]))
    vw.write(row)
vw.release()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-an', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', a.out], check=True)
os.remove(tmp)
print('[compose] done', a.out, flush=True)
