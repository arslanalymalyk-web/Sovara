#!/bin/sh
# One evidence cycle for a build pass: generate -> bundle -> capture -> align -> tier1 -> multi-angle -> pass check -> comparison sheet.
# Usage: ./run_pass.sh <pass-id> [tag]
set -e
S=/home/user/Sovara/.claude/skills/img2threejs
cd "$(dirname "$0")"
P="$1"; TAG="${2:-$1}"
python3 $S/forge/stage3_build/generate_threejs_factory.py object-sculpt-spec.json --out src/createObjectModel.ts --pass-id "$P" --force >/dev/null
npm run build 2>&1 | grep -i "error" || true
NODE_PATH=$(npm root -g) node capture.cjs 2>&1 | tail -1
python3 align_ref.py >/dev/null
python3 $S/forge/stage4_review/diagnose_render.py --reference reference-aligned.png --render captures/front-white.png --spec object-sculpt-spec.json --pass-id "$P" --in-place --json > "tier1-$TAG.json" 2>&1 || true
python3 $S/forge/stage4_review/diagnose_render_multi_angle.py --reference captures/front-white.png --orbit captures/three-quarter-white.png --orbit captures/side-white.png --orbit captures/rear-white.png --json > "multi-angle-$TAG.json" 2>&1 || true
python3 $S/forge/stage3_build/orchestrate_passes.py check object-sculpt-spec.json --pass-id "$P" > "pass-gate-$TAG.txt" 2>&1 || true
python3 $S/forge/stage4_review/make_comparison_sheet.py --reference reference-aligned.png --render captures/front-white.png --out "captures/cmp-$TAG.png" --json >/dev/null 2>&1
sed -n '2,$p' "tier1-$TAG.json" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['checks'];print('tier1 passed',d['passed'],'IoU',c['silhouetteIoU'],'scale',c['scaleDelta'],'dE',c['colorDelta']['maxDeltaE'],'failures',d.get('failures'))"
python3 -c "import json;d=json.load(open('multi-angle-$TAG.json'));print('multi-angle degenerate',d['degenerate'],[round(a['ratio'],2) for a in d['angles']])"
head -2 "pass-gate-$TAG.txt" | tail -1
