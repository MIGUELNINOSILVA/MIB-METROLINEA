from pathlib import Path

ROOT = Path(__file__).parent

# YOLOv8 — "n" (nano) para velocidad, cambiar a "s" o "m" si se necesita más precisión
YOLO_MODEL = "yolov8n.pt"

# Confianza mínima para contar una detección como persona
DETECTION_CONFIDENCE = 0.40

# Clase COCO para persona
PERSON_CLASS_ID = 0

# Capacidad máxima del bus (ajustar por flota real)
BUS_MAX_CAPACITY = 60

# Umbrales de ocupación (fracción de BUS_MAX_CAPACITY)
OCCUPANCY_THRESHOLDS = {
    "EMPTY":  (0.00, 0.20),
    "LOW":    (0.20, 0.50),
    "MEDIUM": (0.50, 0.80),
    "HIGH":   (0.80, 1.00),
    "FULL":   (1.00, float("inf")),
}

# FiftyOne
FO_DATASET_NAME = "metrolinea-passenger-counting"
FO_DATASET_DIR = ROOT / "data" / "fiftyone"
