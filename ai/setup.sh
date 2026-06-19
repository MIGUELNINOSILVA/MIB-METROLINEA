#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="$(dirname "$0")/.venv"

echo "→ Creando entorno virtual en $VENV_DIR"
python3 -m venv "$VENV_DIR"

echo "→ Activando entorno e instalando dependencias"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip -q
pip install -r "$(dirname "$0")/requirements.txt"

echo ""
echo "✓ Entorno listo."
echo ""
echo "Para activar el entorno en tu sesión:"
echo "  source ai/.venv/bin/activate"
echo ""
echo "Para arrancar la API:"
echo "  source ai/.venv/bin/activate && uvicorn ai.api.main:app --reload --port 8001"
echo ""
echo "Para correr inferencia sobre un video:"
echo "  source ai/.venv/bin/activate && python ai/scripts/run_inference.py --source video.mp4 --bus-id BUS-01"
