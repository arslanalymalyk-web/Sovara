# Image analysis: rgs-logo.png (134x134 RGBA, transparent background)

## L1 Identification
Observed: a flat brand badge: an orange disc with a notched ("gear/bolt-head") perimeter and the white lettering "RGS".
Classification: work type = badge / emblem; broad class = signage; primaryDomain = object; confidence 0.9.
Inference: this is a 2D mark, not a physical object; any depth is invented. The model is a stylized extruded badge.

## L2 Form and silhouette
Observed: near-circular outline, ~8 shallow rectangular steps cut into the perimeter (clear at the top, left, right and bottom,
chamfered facets between them); radial near-symmetry; white wordmark centred, slightly above the vertical middle, spanning ~75% of the diameter.
Primitives: extruded profile (notched disc) + three extruded letter profiles.
Symmetry: approximately 4-fold radial for the outline; the wordmark is asymmetric.

## L3 Macro -> meso -> micro
macro: badge-body (notched disc)
meso: wordmark group {letter-R, letter-G, letter-S}
micro: perimeter notches (part of the body profile), rounded stroke ends of the letters, the gap cut in R's leg.

## L4 Relationships
<letter-R, attached-to, badge-body front face>, <letter-G, attached-to, badge-body front face>, <letter-S, attached-to, badge-body front face>;
contact = butt (letters sit on the face and overlap it by a small embed to avoid z-fighting).

## L5 Materials (PBR)
badge-body: opaque dielectric, albedo ~ (245, 91, 55) vivid orange mid-high value, flat print: roughness ~0.55 satin-matte, metalness 0.
letters: opaque dielectric, albedo ~ white (250,250,250), roughness ~0.4 slightly glossier than the body.
Not observable: any relief/normal detail. The reference is a flat print: no pitting, grain or wear.

## L6 Colour and finish
Body: vivid orange, mid value, high saturation, flat (no gradient). Letters: near-white. Edge anti-aliasing only.

## Hidden / unobservable
Back face, side wall, thickness, bevels: all invented. Single frontal orthographic-looking view, no perspective.
Resolution is 134 px: letter stroke widths (~5 px) and notch depths (~3 px) are approximate (+/- 1 px = +/- 20%).
