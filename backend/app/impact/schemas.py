from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ImpactPublicResponse(BaseModel):
    """Public-facing impact data — NO vessel/attribution info."""
    id: int
    spill_id: int
    spill_name: Optional[str] = None
    spill_detected_at: Optional[datetime] = None
    affected_area_sq_km: Optional[float] = None
    coast_proximity_km: Optional[float] = None
    overlaps_mpa: bool = False
    overlaps_coral: bool = False
    overlaps_eez: bool = False
    nearest_mpa_name: Optional[str] = None
    nearest_mpa_distance_km: Optional[float] = None
    priority: Optional[str] = None
    estimated_cleanup_cost_usd: Optional[float] = None
    ecological_sensitivity_score: Optional[float] = None
    affected_regions: Optional[List[str]] = None
    vulnerability_details: Optional[dict] = None
    severity: Optional[str] = None
    region: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicStatsResponse(BaseModel):
    """Aggregate public disaster & environmental awareness statistics."""
    period: str = "all"
    total_spills: int
    total_affected_area_sq_km: float
    coastal_population_affected: int
    coral_reef_area_risk_sq_km: float
    coastline_affected_km: float
    marine_species_risk_index: float
    severity_breakdown: dict  # {critical: N, high: N, medium: N, low: N}
    region_breakdown: dict  # {region_name: count}
    recent_spills: List[ImpactPublicResponse]
    timeframe_breakdown: Optional[dict] = None

