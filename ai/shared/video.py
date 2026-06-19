"""Utilidades para extraer frames de video de cámaras de bus."""
from __future__ import annotations

from pathlib import Path
from typing import Generator

import cv2
import numpy as np


def extract_frames(
    source: str | int,
    every_n: int = 1,
    max_frames: int | None = None,
) -> Generator[tuple[int, np.ndarray], None, None]:
    """
    Genera frames de un archivo de video o cámara en vivo.

    Args:
        source: ruta al video o índice de cámara (0 = webcam).
        every_n: tomar 1 de cada N frames (reduce carga de inferencia).
        max_frames: límite máximo de frames a generar.

    Yields:
        (frame_index, frame_bgr)
    """
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir la fuente de video: {source}")

    frame_idx = 0
    yielded = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % every_n == 0:
                yield frame_idx, frame
                yielded += 1
                if max_frames is not None and yielded >= max_frames:
                    break
            frame_idx += 1
    finally:
        cap.release()


def save_frame(frame: np.ndarray, output_dir: str | Path, name: str) -> Path:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / name
    cv2.imwrite(str(path), frame)
    return path
