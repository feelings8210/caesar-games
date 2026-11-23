"""Video -> per-frame 3D body keypoints for one tracked player (SAM 3D Body, Meta SAM License).

Runs on the 3090 in the sam3dbody runtime venv:
  .venv/bin/python video_to_keypoints.py <video> <out_dir> --t0 1.0 --t1 4.6 --pick 1020,705
      [--ckpt <model.ckpt>] [--mhr <mhr_model.pt>] [--step 1]

The target player is the person box containing --pick (pixels, video resolution) at t0, then
followed frame to frame by best box overlap (torchvision Faster R-CNN person boxes).
Writes keypoints.npz (kp3d camera-space incl. cam_t, kp2d, boxes, fps) and track_overlay.mp4.
Experiment only: nothing here is wired into the game.
"""
import argparse, os, sys, json, time
import numpy as np, cv2, torch

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('out')
ap.add_argument('--t0', type=float, default=0.0); ap.add_argument('--t1', type=float, default=1e9)
ap.add_argument('--pick', required=True)
ap.add_argument('--step', type=int, default=1)
ap.add_argument('--ckpt', default='/srv/media-vault/archive/models/models/sam-3d-body/dinov3/model.ckpt')
ap.add_argument('--cfg', default='/srv/ai-data/models/sam-3d-body/dinov3/model_config.yaml')
ap.add_argument('--mhr', default='/srv/ai-data/models/sam-3d-body/dinov3/assets/mhr_model.pt')
ap.add_argument('--repo', default='/srv/ai-data/media-work/runtimes/sam3dbody/sam-3d-body')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
sys.path.insert(0, a.repo)
T0 = time.time()

# The loader looks for model_config.yaml next to the checkpoint; the checkpoint lives in the
# vault (model_guard moved it), so stage a tiny dir with a symlink + config instead of copying 2 GB.
stage = os.path.join(a.out, '_ckpt'); os.makedirs(stage, exist_ok=True)
lk = os.path.join(stage, 'model.ckpt')
if not os.path.exists(lk): os.symlink(a.ckpt, lk)
import shutil; shutil.copy(a.cfg, os.path.join(stage, 'model_config.yaml'))

from sam_3d_body import load_sam_3d_body, SAM3DBodyEstimator
dev = torch.device('cuda')
model, cfg = load_sam_3d_body(lk, device=dev, mhr_path=a.mhr)
est = SAM3DBodyEstimator(sam_3d_body_model=model, model_cfg=cfg, human_detector=None,
                         human_segmentor=None, fov_estimator=None)

import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2, FasterRCNN_ResNet50_FPN_V2_Weights
det = fasterrcnn_resnet50_fpn_v2(weights=FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT).to(dev).eval()

def persons(img):
    t = torch.from_numpy(img[:, :, ::-1].copy()).permute(2, 0, 1).float().div(255).to(dev)
    with torch.no_grad():
        o = det([t])[0]
    k = (o['labels'] == 1) & (o['scores'] > 0.55)
    return o['boxes'][k].cpu().numpy()

def iou(b, B):
    x0 = np.maximum(b[0], B[:, 0]); y0 = np.maximum(b[1], B[:, 1])
    x1 = np.minimum(b[2], B[:, 2]); y1 = np.minimum(b[3], B[:, 3])
    inter = np.clip(x1 - x0, 0, None) * np.clip(y1 - y0, 0, None)
    ar = lambda z: (z[..., 2] - z[..., 0]) * (z[..., 3] - z[..., 1])
    return inter / (ar(b) + ar(B) - inter + 1e-6)

cap = cv2.VideoCapture(a.video)
fps = cap.get(cv2.CAP_PROP_FPS); W = int(cap.get(3)); H = int(cap.get(4))
cap.set(cv2.CAP_PROP_POS_MSEC, a.t0 * 1000)
px, py = (float(v) for v in a.pick.split(','))
vw = cv2.VideoWriter(os.path.join(a.out, 'track_overlay.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), fps / a.step, (W // 2, H // 2))
rec = {k: [] for k in ('kp3d', 'kp2d', 'cam_t', 'box', 'focal', 'joints', 'grots', 'lost', 't')}
prev = None; fi = 0
SK = [(5, 7), (7, 62), (6, 8), (8, 41), (5, 6), (5, 9), (6, 10), (9, 10), (9, 11), (11, 13), (10, 12), (12, 14),
      (13, 17), (13, 15), (14, 20), (14, 18), (0, 69)]
while True:
    ok, img = cap.read()
    if not ok: break
    t = a.t0 + fi / fps
    if t > a.t1: break
    if fi % a.step:
        fi += 1; continue
    B = persons(img); lost = False
    if prev is None:
        inside = [b for b in B if b[0] <= px <= b[2] and b[1] <= py <= b[3]]
        if not inside: raise SystemExit(f'no person box contains pick {a.pick} at t0 ({len(B)} boxes)')
        box = min(inside, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    else:
        if len(B):
            j = iou(prev, B); k = int(j.argmax())
            box = B[k] if j[k] > 0.25 else prev
            lost = j[k] <= 0.25
        else:
            box, lost = prev, True
    prev = box
    outs = est.process_one_image(img[:, :, ::-1].copy(), bboxes=np.array([box]))
    o = outs[0]
    rec['kp3d'].append(o['pred_keypoints_3d']); rec['kp2d'].append(o['pred_keypoints_2d'])
    rec['cam_t'].append(o['pred_cam_t']); rec['box'].append(box); rec['focal'].append(float(np.ravel(o['focal_length'])[0]))
    rec['joints'].append(o['pred_joint_coords']); rec['grots'].append(o['pred_global_rots'])
    rec['lost'].append(lost); rec['t'].append(t)
    vis = img.copy()
    cv2.rectangle(vis, (int(box[0]), int(box[1])), (int(box[2]), int(box[3])), (0, 0, 255) if lost else (0, 255, 0), 3)
    k2 = o['pred_keypoints_2d']
    for i, j in SK:
        cv2.line(vis, tuple(int(v) for v in k2[i][:2]), tuple(int(v) for v in k2[j][:2]), (255, 200, 0), 3)
    vw.write(cv2.resize(vis, (W // 2, H // 2)))
    fi += 1
vw.release()
arr = {k: np.array(v) for k, v in rec.items()}
np.savez_compressed(os.path.join(a.out, 'keypoints.npz'), fps=fps / a.step, **arr)
meta = {'video': a.video, 't0': a.t0, 't1': a.t1, 'pick': a.pick, 'frames': len(rec['t']), 'fps': fps / a.step,
        'lost_frames': int(np.sum(arr['lost'])), 'res': [W, H], 'kp3d_shape': list(arr['kp3d'].shape),
        'joints_shape': list(arr['joints'].shape), 'seconds': round(time.time() - T0, 1),
        'model': 'SAM 3D Body dinov3 (SAM License, commercial use permitted)', 'ckpt_sha256': 'b5a2f9d305dd02626b967aa2e86021fba07065df66ce7a7e00ffb9664f150abf'}
json.dump(meta, open(os.path.join(a.out, 'meta.json'), 'w'), indent=1)
print('[v2k] done', json.dumps(meta), flush=True)
