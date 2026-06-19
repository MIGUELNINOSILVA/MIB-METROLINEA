from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np


@dataclass
class Detection:
    bbox: list[float]   # [x1, y1, x2, y2] normalizadas (0-1)
    confidence: float
    class_id: int = 0
    class_name: str = "person"


@dataclass
class FrameDetections:
    detections: list[Detection] = field(default_factory=list)
    image_width: int = 0
    image_height: int = 0

    @property
    def count(self) -> int:
        return len(self.detections)


class PersonDetector:
    """Wrapper sobre YOLOv8 que devuelve únicamente detecciones de personas."""

    def __init__(self, model_name: str = "yolov8n.pt", confidence: float = 0.40):
        from ultralytics import YOLO

        self.model = YOLO(model_name)
        self.confidence = confidence
        # COCO class 0 = person
        self._person_cls = 0

    def detect(
        self,
        source: str | Path | np.ndarray,
        roi: Optional[list[float]] = None,
    ) -> FrameDetections:
        """
        Ejecuta detección sobre una imagen o frame.

        Args:
            source: ruta a imagen, numpy array (BGR), o URL.
            roi: región de interés [x1_norm, y1_norm, x2_norm, y2_norm].
                 Si se provee, solo se cuentan detecciones cuyo centro caiga dentro.
        """
        results = self.model(
            source,
            conf=self.confidence,
            classes=[self._person_cls],
            verbose=False,
        )[0]

        h, w = results.orig_shape
        detections: list[Detection] = []

        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])

            # Normalizar a [0, 1]
            bbox_norm = [x1 / w, y1 / h, x2 / w, y2 / h]

            if roi is not None and not self._inside_roi(bbox_norm, roi):
                continue

            detections.append(Detection(bbox=bbox_norm, confidence=conf))

        return FrameDetections(detections=detections, image_width=w, image_height=h)

    @staticmethod
    def _inside_roi(bbox_norm: list[float], roi: list[float]) -> bool:
        cx = (bbox_norm[0] + bbox_norm[2]) / 2
        cy = (bbox_norm[1] + bbox_norm[3]) / 2
        return roi[0] <= cx <= roi[2] and roi[1] <= cy <= roi[3]
