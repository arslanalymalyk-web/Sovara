# RGS badge, rebuilt as a code-only Three.js model

The RGS logo (`../assets/rgs-logo.png`, a flat 134 px mark) rebuilt as a procedural Three.js model with the
[img2threejs](https://github.com/img2threejs/img2threejs) pipeline (skill installed at `.claude/skills/img2threejs`).
No mesh files or art packs: the geometry is generated in `src/createObjectModel.ts` from the traced 2D outline in
`object-sculpt-spec.json`.

## View it

```bash
cd rgs-portal/3d
python3 -m http.server 8560      # any static server
# open http://localhost:8560/index.html   (drag to rotate)
```

Query parameters: `view=front|three-quarter|side|rear`, `bg=white|studio`, `orbit=0` (fixed camera), `spin=1`,
`fov=<deg>`, `unlit=1` (flat colour, for silhouette review), `lights=grazing`.

Rebuild after editing `viewer/main.ts` or `src/createObjectModel.ts`: `npm install && npm run build`
(Three.js and esbuild are dev tooling; `dist/viewer.js` is committed so the page runs without a build).

## What the model is (and is not)

- An extruded, notched disc (73-vertex traced outline, 8 perimeter steps) with **R, G, S cut fully through it**
  (43 / 43 / 46 vertices). The lettering is transparent in the source PNG, so it is modelled as a stencil.
- One matte orange material (`#F55B37`, roughness 0.85, metalness 0), declared `textureless` with evidence.
- Runtime hierarchy: one named pivot, one mesh (828 triangles), a front-face socket, a box collider, a destruction group.

**Invented, not observed** (a flat 134 px image cannot show them): thickness (0.10 of the diameter), the plain back
face, square edges (no chamfer), the matte finish. Stroke widths and notch depths are accurate to about 1 px of the
source, roughly 20%. It reads as a faithful cut-out slab from the front and is plain from other angles.

## Evidence (all from real browser renders in `captures/`)

| Gate | Result |
| --- | --- |
| Silhouette IoU vs the reference (front, same framing) | 0.961 |
| Aspect / scale delta | 0.000 / 0.010 |
| Mean disc colour vs the reference (dE76) | 6.65 |
| Multi-angle (no degenerate view) | pass; edge-on area is 0.16 of the face against a 0.15 limit, marginal because the plate is thin |
| Part coverage | 1 specified / 1 built |
| Review passes | blockout (1 correction), structural, material, lighting: all `continue`, AI-vision 0.87 to 0.88 |

Two things the first attempts got wrong and the record keeps: applying the extracted PBR maps as tiled textures printed
four ghost copies of the logo across the face (rejected; the material is `textureless` instead), and a 0.5 roughness
left a white sheen that shifted the colour (raised to 0.85).

## Files

`object-sculpt-spec.json` (spec + review history) · `src/createObjectModel.ts` (generated factory) · `viewer/main.ts` ·
`trace_logo.py` (reference to polygons) · `build_spec.py` / `make_spec.sh` (initial authoring; do not re-run, it would
discard the review history) · `run_pass.sh`, `mark_cycle.sh`, `capture.cjs`, `align_ref.py`, `dump_parts.cjs`
(evidence cycle) · `.img2threejs/state.json` (checklist state) · `captures/`, `tier1-*.json`, `multi-angle-*.json`.
