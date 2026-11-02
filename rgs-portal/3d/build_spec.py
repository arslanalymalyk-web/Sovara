"""Author object-sculpt-spec.json for the RGS badge from the skeleton + trace.json (re-runnable)."""
import json, copy
d = json.load(open('skeleton-spec.json'))
t = json.load(open('trace.json'))
asm = json.load(open('assessment.json'))
d['preSpecAssessment'] = asm['preSpecAssessment']
d['localSpecSearch'] = asm.get('localSpecSearch', d.get('localSpecSearch'))
DEPTH = 0.10
d['suitability'] = 'conditional'
d['scores'] = {'object_isolation': 3, 'silhouette_readability': 3, 'depth_inference': 0, 'primitive_decomposition': 3,
               'material_procedurality': 3, 'occlusion_risk': 0, 'interaction_fit': 1}
d['assumptions'] = [
    'Flat 2D brand mark: thickness (0.10 of diameter) and a flat plain back face are invented; edges are left square (no chamfer is modelled), not observed.',
    'The lettering is transparent in the source PNG (stencil): modelled as letters cut fully through the disc.',
    '134 px source: notch depth and stroke width are +/-1 px (about +/-20%).',
]
d['coordinateFrame'] = {'front': 'camera-facing (+Z) face of the badge in the reference', 'up': '+Y = image up', 'scaleReference': 'disc diameter = 1.0 unit; thickness 0.10'}
d['silhouette'] = {
    'boundingShape': 'notched disc (near-circular, ~8 shallow rectangular steps cut into the perimeter)',
    'aspectRatios': ['1.0 : 1.0 (width : height)'],
    'symmetry': 'approximately 4-fold radial for the outline; the wordmark cut-outs are asymmetric',
    'dominantCurves': ['circular arcs between the notches', 'chamfered facets on the diagonals'],
    'negativeSpaces': ['letter R cut-out', 'letter G cut-out', 'letter S cut-out'],
    'landmarks': ['top notch', 'bottom notch', 'left notch', 'right notch', 'wordmark centred slightly above the disc middle'],
}
d['viewEvidence'] = [
    {'id': 'full-object', 'view': 'primary', 'imageRegion': {'x': 0, 'y': 0, 'width': 1, 'height': 1, 'units': 'normalized'},
     'observations': ['orange disc with notched perimeter and transparent RGS lettering; flat print, no shading gradient'], 'confidence': 0.9},
    {'id': 'perimeter', 'view': 'primary', 'imageRegion': {'x': 0.0, 'y': 0.0, 'width': 0.85, 'height': 0.85, 'units': 'normalized'},
     'observations': ['rectangular steps at the top, bottom, left and right; chamfered facets between them'], 'confidence': 0.85},
    {'id': 'wordmark', 'view': 'primary', 'imageRegion': {'x': 0.12, 'y': 0.37, 'width': 0.70, 'height': 0.28, 'units': 'normalized'},
     'observations': ['R, G, S as rounded geometric strokes; the leg of the R has a cut gap'], 'confidence': 0.8},
]
d['performanceBudget'].update({'targetTriangles': 6000, 'maxDrawCalls': 8, 'fpsTarget': 60})
d['lodPlan'] = [{'tier': 'near', 'distance': 0, 'strategy': 'full traced profile'}, {'tier': 'far', 'distance': 30, 'strategy': 'same mesh; profile is already below 400 vertices'}]

# ---- material
m = d['materials'][0]
m['id'] = 'badge-orange'; m['name'] = 'Badge orange (painted plastic, satin)'
col = '#F55B37'
m['baseColor'] = col; m['color'] = col
m['albedo'] = {'dominant': col, 'secondary': ['#F2603C', '#EF5A35'], 'samplingNotes': 'Sampled from the reference disc: rgb(245,91,55). Flat print; no gradient observed, so a single albedo zone.'}
m['colorVariation'] = {'palette': [col], 'pattern': 'flat', 'amplitude': 0.0, 'heightCorrelation': 0.0}
m['roughness'] = {'base': 0.5, 'variation': 0.06, 'map': 'constant', 'localResponse': 'uniform satin; cut-out walls inherit the same value'}
m['metalness'] = {'base': 0.0, 'variation': 0.0}
m['bump'] = {'pattern': 'none', 'amplitude': 0.0, 'scale': 1.0}
m['normal'] = {'pattern': 'none', 'strength': 0.0, 'space': 'tangent'}
m['notes'] = 'Flat enamel/print finish read from a 134 px PNG: no relief, wear or dirt is observable, so none is invented. Satin roughness 0.5 (assumed; the print has no specular cue).'
for b, amp in zip(m.get('surfaceFrequencyBands', []), (0.004, 0.002, 0.001)): b['amplitude'] = amp; b['role'] = 'near-zero: flat print, no observed relief (kept positive only to satisfy the band contract)'
m['ambientOcclusion'] = {'cavityStrength': 0.15, 'contactShadowBias': 0.2, 'notes': 'Light darkening inside the cut-outs only.'}
for f in ('normal', 'bump', 'displacement', 'surfaceFrequencyBands', 'textureProjection', 'textureResolution', 'referencePbr'):
    m.pop(f, None)
m['textureless'] = {'declared': True, 'evidence': [
    'pbr-report.json (extract_pbr_evidence.py on the isolated reference, confidence 0.86): palette F16033 / EE612F / EF6340, value range ~0.08, no usable height or normal signal',
    'reference.png / reference-4x.png: the disc is a single flat orange with no gradient, grain, wear or relief at 134 px; the only structure is the silhouette and the letter boundaries',
    'Attempting to apply the extracted maps as tiled textures printed four ghost copies of the logo across the face (captured and rejected), which is why they are not used']}
m['localOverrides'] = [{'id': 'cutout-wall-shade', 'region': 'letter cut-out walls', 'roughness': 0.6, 'notes': 'walls of the cut-outs read slightly darker/less glossy from AO'}]

# ---- component
c = d['componentTree'][0]
c['id'] = 'root'; c['name'] = 'Badge body (notched disc with RGS cut-outs)'
c['primitive'] = 'extrude'; c['topologyClass'] = 'assembled-solid'
c['topologyRationale'] = 'One flat rigid plate with hard faces (a badge):  the silhouette, the 8 perimeter steps and the three letter cut-outs all come from a single traced 2D profile (extrude with holes), not from separate boxes.'
c['fidelityTier'] = 'form'
c['confidence'] = 0.85
c['material'] = 'badge-orange'; c['materialLayers'] = ['badge-orange']
holes = [l['points'] for l in t['cutouts']]
c['geometryDescriptor'].update({
    'topologyIntent': 'extruded notched disc with three through-holes',
    'profile2D': {'points': t['body'], 'holes': holes, 'depth': DEPTH},
    'edgeTreatment': {'type': 'none', 'bevelRadius': 0.0, 'segments': 1},
})
c['dimensions'] = {'width': 1.0, 'height': 1.0, 'depth': DEPTH, 'units': 'relative', 'confidence': 0.8}
c['transform'] = {'position': [0, 0, -DEPTH / 2], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]}
c['actionProfile']['collider'].update({'type': 'box', 'scale': [1.0, 1.0, DEPTH], 'offset': [0, 0, DEPTH / 2], 'notes': 'Thin box proxy (disc is near-square in plan).'})
c['actionProfile']['pivot'].update({'mode': 'center', 'localPosition': [0, 0, DEPTH / 2], 'axis': [0, 1, 0], 'confidence': 0.8})
c['actionProfile']['destruction']['debrisMaterial'] = 'badge-orange'
c['actionProfile']['sockets'] = [{'id': 'face-front', 'localPosition': [0, 0, DEPTH], 'purpose': 'front face anchor (wordmark centre)'}]
c['surfaceDetail'] = {'macroRoughness': 0.5, 'microRoughness': 0.0, 'bumpAmplitude': 0.0, 'normalPattern': 'none', 'displacementPattern': 'none', 'occlusionPattern': 'cutout-edge', 'edgeWearPattern': 'none', 'notes': 'Flat print; no relief observed.'}
c['localFeatures'] = [
    {'id': 'perimeter-notches', 'type': 'contour', 'description': '8 shallow rectangular steps cut into the perimeter (top, bottom, left, right pairs) with chamfered facets between them. Carried by the traced outline (64 vertices).', 'confidence': 0.85},
    {'id': 'letter-cutouts', 'type': 'hole', 'description': 'R, G and S cut fully through the disc (holes in the extrude profile; 27, 27 and 29 vertices); the R keeps its leg gap.', 'confidence': 0.85},
]
c['details'] = ['perimeter-notches', 'letter-cutouts']
c['evidenceRefs'] = ['full-object', 'perimeter', 'wordmark']
c['actionProfile']['animationRole'] = 'root'

c['colorMaterialRecipe'] = {'dominantAlbedo': 'rgba(245, 91, 55, 1.0)', 'secondaryAlbedo': 'rgba(239, 90, 53, 1.0)', 'materialClass': 'plastic', 'materialClassConfidence': 0.6,
    'notes': 'Sampled from the flat orange print; class is an assumption (painted plastic/enamel badge), not observable.'}
d['lightingFromPhoto'] = [
    {'id': 'key', 'type': 'key light', 'direction': 'front-upper-left, ~35 deg above the view axis', 'intensity': 2.2, 'color': '#FFFFFF', 'notes': 'The reference has no lighting cue (flat print); a neutral key is chosen so the chamfer reads.'},
    {'id': 'fill', 'type': 'fill light', 'direction': 'front-right, low', 'intensity': 0.7, 'color': '#EAF0FF', 'notes': 'Lifts the cut-out walls without flattening the face.'},
    {'id': 'rim', 'type': 'rim light', 'direction': 'behind-right', 'intensity': 1.1, 'color': '#FFFFFF', 'notes': 'Separates the disc edge from the background in three-quarter views.'},
    {'id': 'environment', 'type': 'environment reflection', 'direction': 'studio hemisphere', 'intensity': 0.5, 'color': '#FFFFFF', 'notes': 'Soft RoomEnvironment-style fill; exposure 1.0, ACES filmic tone mapping, neutral light-grey background, contact shadow on a ground disc.'},
]
d['preSpecAssessment']['unknownsToResolveBeforeImplementation'] = []
d['assumptions'].append('Resolved before implementation: thickness 0.10, flat back and fully cut-through letters; all recorded above and in localFeatures.')

# ---- passes & feature review targets all reference the single component
KEEP = ['blockout', 'structural-pass', 'material-pass', 'lighting-pass']
d['buildPasses'] = [p for p in d['buildPasses'] if p['id'] in KEEP]
for p in d['buildPasses']: p['componentRefs'] = ['root']
d['selfCorrectLoop']['reviewAfterPasses'] = KEEP
d['selfCorrectLoop']['screenshotPolicy']['requiredForPasses'] = KEEP
d['assumptions'].append('Pass plan: blockout, structural-pass, material-pass, lighting-pass. form-refinement is folded into blockout (the traced profile already carries the notches and cut-outs); surface-pass and interaction-pass are omitted because the print has no relief and the single body has no joints; optimization is omitted (about 2 thousand triangles).')
d['featureReviewTargets'] = [
    {'id': 'overall-silhouette', 'name': 'Notched disc silhouette and proportions', 'tier': 'critical', 'passIds': ['blockout', 'structural-pass', 'form-refinement'], 'minimumScore': 0.8, 'mustPass': True,
     'componentRefs': ['root'], 'evidenceRefs': ['full-object', 'perimeter'], 'criteria': ['outline matches the reference notches and facets', 'diameter 1.0, height = width']},
    {'id': 'wordmark-cutouts', 'name': 'R, G, S cut-outs (identity-defining)', 'tier': 'critical', 'passIds': ['form-refinement', 'material-pass'], 'minimumScore': 0.8, 'mustPass': True,
     'componentRefs': ['root'], 'evidenceRefs': ['wordmark'], 'criteria': ['letter shapes, spacing and the R leg gap match the reference', 'cut fully through the body']},
    {'id': 'orange-finish', 'name': 'Flat orange print finish', 'tier': 'important', 'passIds': ['material-pass', 'lighting-pass'], 'minimumScore': 0.65, 'mustPass': False,
     'componentRefs': ['root'], 'evidenceRefs': ['full-object'], 'criteria': ['albedo near #F55B37 under neutral light', 'satin, not glossy or metallic']},
]
d['qualityTargets']['reviewViewpoints'] = ['front', 'three-quarter', 'side']
# ---- detail inventory (each maps to a localFeature / localOverride)
d['preSpecAssessment']['detailInventory'] = {'scanMethod': 'grid-3x3', 'targetMinDetails': 3, 'note': 'Zones scanned with build_detail_inventory.py (di/); every detail maps to a spec entry.', 'details': [
    {'id': 'd-notches', 'kind': 'contour', 'description': 'rectangular steps in the perimeter at top/bottom/left/right', 'region': {'x': 0, 'y': 0, 'width': 1, 'height': 1, 'units': 'normalized'}, 'scale': 'meso', 'affects': 'silhouette', 'mapsTo': {'type': 'localFeature', 'ref': 'perimeter-notches'}, 'evidenceRef': 'di/zone-r0c1.png', 'confidence': 0.85},
    {'id': 'd-letters', 'kind': 'hole', 'description': 'RGS letter cut-outs with a gap in the leg of the R', 'region': {'x': 0.12, 'y': 0.37, 'width': 0.7, 'height': 0.28, 'units': 'normalized'}, 'scale': 'meso', 'affects': 'silhouette and interior', 'mapsTo': {'type': 'localFeature', 'ref': 'letter-cutouts'}, 'evidenceRef': 'di/zone-r1c1.png', 'confidence': 0.85},
    {'id': 'd-cutout-wall', 'kind': 'stain', 'description': 'slightly darker, rougher cut-out walls (AO)', 'region': {'x': 0.12, 'y': 0.37, 'width': 0.7, 'height': 0.28, 'units': 'normalized'}, 'scale': 'micro', 'affects': 'material response', 'mapsTo': {'type': 'localOverride', 'ref': 'cutout-wall-shade'}, 'evidenceRef': 'di/zone-r1c1.png', 'confidence': 0.4},
]}
json.dump(d, open('object-sculpt-spec.json', 'w'), indent=1)
print('wrote object-sculpt-spec.json; body points', len(t['body']), 'holes', [len(h) for h in holes])
