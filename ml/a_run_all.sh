#!/usr/bin/env bash
# ML-A pipeline end to end (VM only). Idempotent. usage: bash ml/a_run_all.sh   (from ~/proj, env loaded by bin/vm)
# Long run: bin/vm "tmux new-session -d -s mla 'bash ml/a_run_all.sh 2>&1 | tee ~/logs/mla.log'"
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-$HOME/mlenv/bin/python}
export PYTHONUNBUFFERED=1 PYTHONWARNINGS=ignore
step() { echo "=== $1 ($(date +%T))"; shift; "$PY" "$@"; }
step "1 features"    a_features.py
step "2 money map"   a_map.py          # needs RUNWARE_API_KEY on first run (names cached in DATA_DIR/cache)
step "1b profiles"   a_profile.py      # after the map so profiles carry map/tribe fields
step "3 twins"       a_twins.py
step "4 anomalies"   a_anomalies.py
step "5 habits"      a_habits.py
step "6 benchmarks"  a_benchmarks.py   # cached PxWeb responses; --refresh to refetch
step "7 home"        a_home.py
step "check"         a_check.py
echo "=== done ($(date +%T))"
