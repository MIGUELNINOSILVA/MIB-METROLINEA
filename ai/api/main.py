"""
FastAPI — Servicio de conteo de pasajeros.
El backend AdonisJS consume este servicio vía HTTP.

POST /analyze/image  — imagen estática (multipart)
POST /analyze/url    — imagen desde URL pública
GET  /health         — liveness check
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import io
import time
import uuid
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import YOLO_MODEL, DETECTION_CONFIDENCE, FO_DATASET_NAME
from passenger_counting.detector import PersonDetector
from passenger_counting.counter import PassengerCounter
from passenger_counting.dataset import get_or_create_dataset, add_frame
from shared.video import save_frame

app = FastAPI(
    title="Metrolinea AI — Passenger Counting",
    version="1.0.0",
)

# Inicializar modelos una sola vez al arrancar
_detector = PersonDetector(model_name=YOLO_MODEL, confidence=DETECTION_CONFIDENCE)
_counter = PassengerCounter()
_dataset = None   # lazy-loaded solo si FiftyOne está disponible


def _get_dataset():
    global _dataset
    if _dataset is None:
        try:
            _dataset = get_or_create_dataset(FO_DATASET_NAME)
        except Exception:
            _dataset = False  # deshabilitar silenciosamente si FO no está listo
    return _dataset if _dataset else None


def _decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen")
    return frame


def _run_pipeline(
    frame: np.ndarray,
    bus_id: Optional[str],
    roi: Optional[list[float]],
    save: bool,
    image_path: Optional[Path] = None,
) -> dict:
    t0 = time.perf_counter()
    detections = _detector.detect(frame, roi=roi)
    result = _counter.count(detections, bus_id=bus_id)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    if save and image_path:
        ds = _get_dataset()
        if ds is not None:
            add_frame(ds, image_path, detections, result)

    payload = result.to_dict()
    payload["inference_ms"] = elapsed_ms
    return payload


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    bus_id: Optional[str] = Form(None),
    roi: Optional[str] = Form(None),   # "x1,y1,x2,y2" normalizadas
    save_to_dataset: bool = Form(True),
):
    """
    Analiza una imagen y devuelve el conteo de pasajeros.
    Acepta cualquier formato de imagen (jpg, png, etc.).
    """
    data = await file.read()
    frame = _decode_image(data)

    roi_list = [float(v) for v in roi.split(",")] if roi else None

    image_path = None
    if save_to_dataset:
        frames_dir = Path(__file__).parent.parent / "data" / "frames"
        image_path = save_frame(
            frame, frames_dir,
            f"{bus_id or 'bus'}_{uuid.uuid4().hex[:8]}.jpg"
        )

    result = _run_pipeline(frame, bus_id, roi_list, save_to_dataset, image_path)
    return JSONResponse(content=result)


class UrlRequest(BaseModel):
    url: str
    bus_id: Optional[str] = None
    roi: Optional[list[float]] = None   # [x1, y1, x2, y2] normalizadas
    save_to_dataset: bool = True


@app.post("/analyze/url")
def analyze_url(req: UrlRequest):
    """Descarga una imagen desde una URL y la analiza."""
    import urllib.request
    try:
        with urllib.request.urlopen(req.url, timeout=10) as resp:
            data = resp.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo descargar la imagen: {e}")

    frame = _decode_image(data)

    image_path = None
    if req.save_to_dataset:
        frames_dir = Path(__file__).parent.parent / "data" / "frames"
        image_path = save_frame(
            frame, frames_dir,
            f"{req.bus_id or 'bus'}_{uuid.uuid4().hex[:8]}.jpg"
        )

    result = _run_pipeline(frame, req.bus_id, req.roi, req.save_to_dataset, image_path)
    return JSONResponse(content=result)
