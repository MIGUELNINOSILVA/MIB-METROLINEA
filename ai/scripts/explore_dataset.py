"""
Abre el dataset de FiftyOne en el navegador para revisar
detecciones, conteos y calidad del modelo.

Uso:
    python scripts/explore_dataset.py
    python scripts/explore_dataset.py --filter HIGH     # solo muestras con alta ocupación
    python scripts/explore_dataset.py --bus BUS-01
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import argparse
import fiftyone as fo
from config import FO_DATASET_NAME


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default=FO_DATASET_NAME)
    p.add_argument("--filter", choices=["EMPTY", "LOW", "MEDIUM", "HIGH", "FULL"],
                   default=None, help="Filtrar por nivel de ocupación")
    p.add_argument("--bus", default=None, help="Filtrar por bus_id")
    return p.parse_args()


def main():
    args = parse_args()

    if not fo.dataset_exists(args.dataset):
        print(f"Dataset '{args.dataset}' no existe aún. Corre primero run_inference.py")
        return

    dataset = fo.load_dataset(args.dataset)
    view = dataset

    if args.filter:
        view = view.match(fo.ViewField("occupancy_level") == args.filter)
    if args.bus:
        view = view.match(fo.ViewField("bus_id") == args.bus)

    print(f"Muestras en vista: {len(view)}")
    print(f"Distribución de niveles:")
    for level, count in view.count_values("occupancy_level").items():
        print(f"  {level}: {count}")

    session = fo.launch_app(view=view, wait=True)


if __name__ == "__main__":
    main()
