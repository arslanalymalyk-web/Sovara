"""Align reference.png to the render framing: composite on white and crop so the disc fills the same fraction as in captures/front-white.png."""
from PIL import Image
import numpy as np, json
r = np.asarray(Image.open('captures/front-white.png').convert('RGB')).astype(int)
m = (r[..., 0] > r[..., 1] + 60); ys, xs = np.where(m)
bw = xs.max() - xs.min() + 1
t = json.load(open('trace.json')); cx, cy = t['centrePx']; D = t['diameterPx']
ref = Image.open('reference.png').convert('RGBA'); bg = Image.new('RGBA', ref.size, (255, 255, 255, 255)); bg.alpha_composite(ref); ref = bg.convert('RGB')
k = 8; side = D / (bw / 536)
big = ref.resize((134 * k, 134 * k), Image.LANCZOS)
pad = Image.new('RGB', (big.width * 2, big.height * 2), (255, 255, 255)); pad.paste(big, (big.width // 2, big.height // 2))
ox = big.width // 2; box = tuple(int(v * k + ox) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
pad.crop(box).resize((536, 536), Image.LANCZOS).save('reference-aligned.png')
print('render disc frac', round(bw / 536, 3), 'centre', (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2)
