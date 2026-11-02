# Review contract read (gates_reference.md, self_correction.md, render_capture.md)
Obligations recorded for this run:
- Tier 1 (diagnose_render) before any AI-vision review; deterministic viewer for captures (orbit disabled via ?orbit=0); same framing for reference and render.
- Judge each pass on its own goal; do not chase Divine Eye / SSIM against a flat logo with a different render lighting.
- 2D gates are blind to 3D realism: the three-quarter view must be inspected and its limits stated (here: constant-thickness slab, square edges, flat back).
- continue needs: render + comparison sheet + AI-vision score >= 0.7 + every critical feature >= its own threshold. Max 3 corrections per pass.
- Do not over-claim: report approximate/stylized; a single flat 134 px image cannot give thickness, bevel or back face.
