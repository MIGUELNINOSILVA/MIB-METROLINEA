from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .detector import FrameDetections
from config import BUS_MAX_CAPACITY, OCCUPANCY_THRESHOLDS


@dataclass
class OccupancyResult:
    count: int
    capacity: int
    occupancy_rate: float   # 0.0 – 1.0+
    level: str              # EMPTY | LOW | MEDIUM | HIGH | FULL
    bus_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "bus_id": self.bus_id,
            "passenger_count": self.count,
            "capacity": self.capacity,
            "occupancy_rate": round(self.occupancy_rate, 3),
            "occupancy_level": self.level,
        }


class PassengerCounter:
    def __init__(self, capacity: int = BUS_MAX_CAPACITY):
        self.capacity = capacity

    def count(
        self,
        detections: FrameDetections,
        bus_id: Optional[str] = None,
    ) -> OccupancyResult:
        n = detections.count
        rate = n / self.capacity if self.capacity > 0 else 0.0
        level = self._classify(rate)
        return OccupancyResult(
            count=n,
            capacity=self.capacity,
            occupancy_rate=rate,
            level=level,
            bus_id=bus_id,
        )

    @staticmethod
    def _classify(rate: float) -> str:
        for level, (lo, hi) in OCCUPANCY_THRESHOLDS.items():
            if lo <= rate < hi:
                return level
        return "FULL"
