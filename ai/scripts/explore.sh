#!/usr/bin/env bash
# Abre FiftyOne en el navegador
# Uso: bash ai/scripts/explore.sh [nombre-dataset]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../.venv/bin/activate"

DATASET="${1:-crowdhuman-bus-sample}"

echo "Abriendo dataset '$DATASET' en http://localhost:5151"
python3 - << EOF
import fiftyone as fo
ds = fo.load_dataset("$DATASET")
print(f"Muestras: {len(ds)}")
fo.launch_app(ds).wait()
EOF
