from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DriftPointSchema(BaseModel):
    time: str
    lat: float
    lon: float
    probability: Optional[float] = None


class DriftSimulationResponse(BaseModel):
    id: int
    spill_id: int
    direction: str
    sim_start_time: Optional[datetime] = None
    sim_end_time: Optional[datetime] = None
    duration_hours: Optional[int] = None
    origin_cone_geojson: Optional[dict] = None
    predicted_path_geojson: Optional[dict] = None
    trajectory_points: Optional[List[dict]] = None
    parameters: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
