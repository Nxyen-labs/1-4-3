from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Public schemas (no vessel/attribution data) ---

class SpillPublic(BaseModel):
    """Public-facing spill data — impact only, NO vessel information."""
    id: int
    name: str
    detected_at: datetime
    area_sq_km: Optional[float] = None
    severity: Optional[str] = None
    region: Optional[str] = None
    validation_status: str
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None

    class Config:
        from_attributes = True


# --- Authenticated schemas ---

class SpillResponse(BaseModel):
    """Full spill data for authenticated users."""
    id: int
    name: str
    detected_at: datetime
    image_timestamp: Optional[datetime] = None
    area_sq_km: Optional[float] = None
    perimeter_km: Optional[float] = None
    elongation_ratio: Optional[float] = None
    fragmentation_index: Optional[float] = None
    age_estimate: Optional[str] = None
    severity: Optional[str] = None
    validation_status: str
    validated_by: Optional[int] = None
    validated_at: Optional[datetime] = None
    region: Optional[str] = None
    sar_image_path: Optional[str] = None
    mask_image_path: Optional[str] = None
    model_confidence: Optional[dict] = None
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None
    slick_geojson: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SpillValidation(BaseModel):
    """Validation status update by Coast Guard."""
    validation_status: str  # confirmed | false_positive | needs_review


class SpillListResponse(BaseModel):
    spills: List[SpillResponse]
    total: int


class SpillCreate(BaseModel):
    """Manual spill creation (for demo/testing)."""
    name: Optional[str] = None
    region: Optional[str] = None
    image_timestamp: Optional[datetime] = None
    centroid_lat: float
    centroid_lon: float
    area_sq_km: Optional[float] = None
    severity: Optional[str] = None
