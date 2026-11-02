#!/bin/sh
# Marks the evidence steps of one pass cycle in the order the state gate demands. Usage: ./mark_cycle.sh <tag>
S=/home/user/Sovara/.claude/skills/img2threejs
cd "$(dirname "$0")"; T="$1"
for st in "build-current-pass src/createObjectModel.ts" "render-capture captures/front-white.png" "review-contract-read review-contract-notes.md" "tier1-diagnostics tier1-$T.json" "multi-angle-review multi-angle-$T.json" "pass-gate-check pass-gate-$T.txt"; do
  set -- $st; python3 $S/forge/state.py mark $1 --state .img2threejs/state.json --evidence $2 2>&1 | grep -i "error" ; done
python3 $S/forge/next.py --state .img2threejs/state.json object-sculpt-spec.json 2>&1 | sed -n 1,1p | cut -c1-200
