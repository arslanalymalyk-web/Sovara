"""Trace the RGS logo reference into polygon profiles (marching squares, stdlib + numpy + PIL).
Outputs trace.json: badge outline + letter profiles in a unit frame (disc diameter = 1, +y up)."""
import json, math
import numpy as np
from PIL import Image, ImageFilter

UP = 6
im = Image.open('reference.png').convert('RGBA')
W, H = im.size
a = np.asarray(im).astype(float)
alpha = a[..., 3] / 255.0
white = (a[..., :3].min(axis=2) / 255.0)          # 1 for white, ~0.2 for the orange
# whiteness only counts where the disc is opaque
letter = np.clip((white - 0.55) / 0.30, 0, 1) * (alpha > 0.5)

def up(field):
    img = Image.fromarray((field * 255).astype(np.uint8)).resize((W * UP, H * UP), Image.BICUBIC)
    img = img.filter(ImageFilter.GaussianBlur(UP * 0.55))
    return np.asarray(img).astype(float) / 255.0

def contours(field, level=0.5):
    h, w = field.shape
    segs = []
    f = field
    for y in range(h - 1):
        row = f[y]; nxt = f[y + 1]
        mixed = np.where(((row[:-1] > level) != (row[1:] > level)) | ((nxt[:-1] > level) != (nxt[1:] > level)) |
                         ((row[:-1] > level) != (nxt[:-1] > level)))[0]
        for x in mixed:
            v = (f[y, x], f[y, x + 1], f[y + 1, x + 1], f[y + 1, x])
            idx = sum((1 << i) for i, val in enumerate(v) if val > level)
            if idx in (0, 15): continue
            def lerp(p, q, vp, vq):
                t = (level - vp) / (vq - vp) if vq != vp else 0.5
                return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
            P = [(x, y), (x + 1, y), (x + 1, y + 1), (x, y + 1)]
            edges = {0: (0, 1), 1: (1, 2), 2: (2, 3), 3: (3, 0)}
            pts = {}
            for e, (i, j) in edges.items():
                if (v[i] > level) != (v[j] > level):
                    pts[e] = lerp(P[i], P[j], v[i], v[j])
            ks = list(pts)
            if len(ks) == 2:
                segs.append((pts[ks[0]], pts[ks[1]]))
            elif len(ks) == 4:  # saddle: split by centre value
                c = sum(v) / 4
                if (c > level) == (v[0] > level):
                    segs.append((pts[0], pts[3])); segs.append((pts[1], pts[2]))
                else:
                    segs.append((pts[0], pts[1])); segs.append((pts[2], pts[3]))
    # chain segments
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    adj = {}
    for s in segs:
        adj.setdefault(key(s[0]), []).append(s); adj.setdefault(key(s[1]), []).append(s)
    used = set(); loops = []
    for s in segs:
        if id(s) in used: continue
        loop = [s[0], s[1]]; used.add(id(s)); cur = key(s[1])
        while True:
            nxt = None
            for t in adj.get(cur, []):
                if id(t) not in used: nxt = t; break
            if nxt is None: break
            used.add(id(nxt))
            a0, a1 = key(nxt[0]), key(nxt[1])
            p = nxt[1] if a0 == cur else nxt[0]
            loop.append(p); cur = key(p)
        if len(loop) > 12: loops.append(loop)
    return loops

def area(p):
    return 0.5 * sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a0, b0 = pts[0], pts[-1]
    dx, dy = b0[0] - a0[0], b0[1] - a0[1]; n = math.hypot(dx, dy) or 1e-9
    dmax, imax = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + b0[0] * a0[1] - b0[1] * a0[0]) / n
        if d > dmax: dmax, imax = d, i
    if dmax > eps:
        return rdp(pts[:imax + 1], eps)[:-1] + rdp(pts[imax:], eps)
    return [a0, b0]

def simplify(loop, eps):
    pts = loop[:-1] if loop[0] == loop[-1] else loop
    # split closed loop at the point farthest from the start for a stable RDP
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    a1 = rdp(pts[:far + 1], eps); a2 = rdp(pts[far:] + [pts[0]], eps)
    return a1[:-1] + a2[:-1]

def contains(poly, p):
    c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1: c = not c
    return c

body_loops = contours(up(alpha))
body = max(body_loops, key=lambda l: abs(area(l)))
xs = [p[0] for p in body]; ys = [p[1] for p in body]
cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
diam = max(max(xs) - min(xs), max(ys) - min(ys))
def norm(loop): return [[round((p[0] - cx) / diam, 5), round(-(p[1] - cy) / diam, 5)] for p in loop]   # +y up

eps_px = 0.45 * UP
# the lettering is transparent in the PNG (stencil cut-outs); classify every alpha loop by nesting depth
allp = [l for l in body_loops if abs(area(l)) > (1.2 * UP) ** 2]
allp.sort(key=lambda l: -abs(area(l)))
depth = [sum(1 for j, m in enumerate(allp) if j != i and contains(m, allp[i][0])) for i in range(len(allp))]
EPS_BODY, EPS_LETTER = 0.25 * UP, 0.18 * UP   # finer than round 1 (0.45 / 0.45 px)
bodies = [simplify(allp[i], EPS_BODY) for i in range(len(allp)) if depth[i] == 0]
holes = [simplify(allp[i], EPS_LETTER) for i in range(len(allp)) if depth[i] == 1]
islands = [allp[i] for i in range(len(allp)) if depth[i] == 2]
body_poly = norm(bodies[0])
holes.sort(key=lambda h: min(p[0] for p in h))
named = []
for hole in holes:
    named.append({'points': norm(hole), 'islands': [norm(i) for i in islands if contains(hole, i[0])]})
for n, l in zip(['R', 'G', 'S'], named): l['id'] = n
out = {'diameterPx': round(diam / UP, 2), 'centrePx': [round(cx / UP, 2), round(cy / UP, 2)], 'body': body_poly, 'cutouts': named,
       'counts': {'bodyPoints': len(body_poly), 'cutouts': [(l['id'], len(l['points']), len(l['islands'])) for l in named], 'depths': sorted(depth)}}
json.dump(out, open('trace.json', 'w'))
print(json.dumps(out['counts']), 'diam px', out['diameterPx'], 'centre px', [float(x) for x in out['centrePx']])
print('cutout extents (x0,x1,y0,y1):', [(l['id'], round(min(p[0] for p in l['points']), 3), round(max(p[0] for p in l['points']), 3), round(min(p[1] for p in l['points']), 3), round(max(p[1] for p in l['points']), 3)) for l in named])
