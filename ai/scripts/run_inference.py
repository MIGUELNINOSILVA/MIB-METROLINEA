"""
Corre el pipeline de conteo de pasajeros sobre un video o imagen.

Uso:
    python scripts/run_inference.py --source video.mp4 --bus-id BUS-01
    python scripts/run_inference.py --source imagen.jpg --bus-id BUS-02 --no-save
    python scripts/run_inference.py --source 0             # webcam en vivo
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import argparse
import json
import cv2

from config import YOLO_MODEL, DETECTION_CONFIDENCE, FO_DATASET_NAME
from passenger_counting.detector import PersonDetector
from passenger_counting.counter import PassengerCounter
from passenger_counting.dataset import get_or_create_dataset, add_frame
from shared.video import extract_frames, save_frame


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Conteo de pasajeros en buses")
    p.add_argument("--source", required=True, help="Video, imagen o índice de cámara")
    p.add_argument("--bus-id", default=None, help="Identificador del bus")
    p.add_argument("--model", default=YOLO_MODEL)
    p.add_argument("--conf", type=float, default=DETECTION_CONFIDENCE)
    p.add_argument("--every-n", type=int, default=10,
                   help="Analizar 1 de cada N frames (video)")
    p.add_argument("--capacity", type=int, default=60, help="Capacidad máxima del bus")
    p.add_argument("--roi", type=float, nargs=4, metavar=("X1", "Y1", "X2", "Y2"),
                   default=None, help="ROI normalizada [0-1] para filtrar detecciones")
    p.add_argument("--no-save", action="store_true",
                   help="No guardar frames en FiftyOne")
    p.add_argument("--frames-dir", default="data/frames",
                   help="Directorio donde guardar frames (relativo a ai/)")
    return p.parse_args()


def is_image(path: str) -> bool:
    return Path(path).suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def main():
    args = parse_args()
    detector = PersonDetector(model_name=args.model, confidence=args.conf)
    counter = PassengerCounter(capacity=args.capacity)
    dataset = None if args.no_save else get_or_create_dataset(FO_DATASET_NAME)

    frames_dir = Path(__file__).parent.parent / args.frames_dir
    results_log = []

    if is_image(args.source):
        import numpy as np
        from PIL import Image
        frame = cv2.imread(args.source)
        frames_iter = [(0, frame)]
    else:
        source = int(args.source) if args.source.isdigit() else args.source
        frames_iter = extract_frames(source, every_n=args.every_n)

    for frame_idx, frame in frames_iter:
        detections = detector.detect(frame, roi=args.roi)
        result = counter.count(detections, bus_id=args.bus_id)

        print(json.dumps(result.to_dict()))
        results_log.append(result.to_dict())

        if dataset is not None:
            frame_path = save_frame(
                frame, frames_dir,
                f"{args.bus_id or 'bus'}_{frame_idx:06d}.jpg"
            )
            add_frame(dataset, frame_path, detections, result)

    if results_log:
        avg_count = sum(r["passenger_count"] for r in results_log) / len(results_log)
        print(f"\n[Resumen] Frames analizados: {len(results_log)}, "
              f"Promedio pasajeros: {avg_count:.1f}")


if __name__ == "__main__":
    main()
