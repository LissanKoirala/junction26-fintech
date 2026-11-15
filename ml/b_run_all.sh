#!/usr/bin/env bash
# ML-B pipeline, idempotent. Run on the VM from ~/proj:  bash ml/b_run_all.sh [txgpt]
# Outputs: $DATA_DIR/ml/{forecast,risk,txgpt}/{id}.json, $DATA_DIR/global/modelcard-{forecast,risk,txgpt}.json
set -euo pipefail
cd "$(dirname "$0")"
PY=~/mlenv/bin/python
export DATA_DIR=${DATA_DIR:-$HOME/data}
if [ "${1:-all}" != "txgpt" ]; then
  (cd ../app && npx tsx ../ml/b_ts_export.ts)      # app engine: fixed events + next payday + simulator parity sample
  $PY b_data.py --arrays --force                    # dense arrays + (customer, cut-off) feature/target table
  $PY b_forecast.py                                 # quantile model, calibrated fan, overdraft backtest, card
  $PY b_risk.py                                     # early-warning classifier, SHAP reasons, card
fi
$PY b_txgpt.py seqs
TXGPT_MINUTES=${TXGPT_MINUTES:-18} $PY b_txgpt.py train
$PY b_txgpt.py eval
N=${TXGPT_SHARDS:-8}
for k in $(seq 0 $((N-1))); do TXGPT_GEN_THREADS=4 $PY b_txgpt.py gen $k $N > ~/logs/b_txgpt_gen_$k.log 2>&1 & done
wait
$PY b_txgpt.py card
