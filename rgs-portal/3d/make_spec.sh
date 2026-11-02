#!/bin/sh
# Re-creates object-sculpt-spec.json: authored content + reference-derived PBR evidence.
set -e
S=/home/user/Sovara/.claude/skills/img2threejs
cd "$(dirname "$0")"
python3 build_spec.py
