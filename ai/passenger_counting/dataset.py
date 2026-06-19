"""
FiftyOne dataset manager para el módulo de conteo de pasajeros.
Almacena frames + detecciones para revisión, evaluación y entrenamiento futuro.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import fiftyone as fo

from config import FO_DATASET_NAME, FO_DATASET_DIR
from .detector import FrameDetections
from .counter import OccupancyResult


def get_or_create_dataset(name: str = FO_DATASET_NAME) -> fo.Dataset:
    """Carga el dataset si existe, si no lo crea persistente."""
    if fo.dataset_exists(name):
        return fo.load_dataset(name)

    dataset = fo.Dataset(name, persistent=True)
    dataset.add_dynamic_sample_fields()
    return dataset


def add_frame(
    dataset: fo.Dataset,
    image_path: str | Path,
    detections: FrameDetections,
    result: OccupancyResult,
    split: str = "inference",
    tags: Optional[list[str]] = None,
) -> fo.Sample:
    """
    Agrega un frame con sus detecciones al dataset de FiftyOne.

    Args:
        dataset: dataset FiftyOne destino.
        image_path: ruta absoluta al frame/imagen.
        detections: salida del PersonDetector.
        result: salida del PassengerCounter.
        split: etiqueta de conjunto ('inference', 'train', 'val').
        tags: tags adicionales para el sample.
    """
    fo_detections = [
        fo.Detection(
            label="person",
            bounding_box=[
                d.bbox[0],
                d.bbox[1],
                d.bbox[2] - d.bbox[0],   # width
                d.bbox[3] - d.bbox[1],   # height
            ],
            confidence=d.confidence,
        )
        for d in detections.detections
    ]

    sample = fo.Sample(filepath=str(image_path))
    sample["predictions"] = fo.Detections(detections=fo_detections)
    sample["passenger_count"] = result.count
    sample["occupancy_rate"] = result.occupancy_rate
    sample["occupancy_level"] = result.level
    sample["bus_id"] = result.bus_id
    sample.tags = [split] + (tags or [])

    dataset.add_sample(sample)
    return sample


def launch_app(dataset_name: str = FO_DATASET_NAME) -> fo.Session:
    """Abre el app de FiftyOne para visualización."""
    dataset = fo.load_dataset(dataset_name)
    return fo.launch_app(dataset)
