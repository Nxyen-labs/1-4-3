from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.drift.models import DriftSimulation
from app.drift.schemas import DriftSimulationResponse

router = APIRouter(prefix="/api/drift", tags=["drift"])


def drift_to_response(drift: DriftSimulation) -> dict:
    origin_cone = None
    predicted_path = None
    pts = drift.trajectory_points or []
    if pts and drift.direction == "backward":
        lats = [p["lat"] for p in pts]
        lons = [p["lon"] for p in pts]
        if lats and lons:
            min_lat, max_lat = min(lats) - 0.03, max(lats) + 0.03
            min_lon, max_lon = min(lons) - 0.03, max(lons) + 0.03
            origin_cone = {
                "type": "Polygon",
                "coordinates": [[
                    [round(min_lon, 5), round(min_lat, 5)],
                    [round(max_lon, 5), round(min_lat, 5)],
                    [round(max_lon + 0.02, 5), round(max_lat + 0.02, 5)],
                    [round(min_lon - 0.02, 5), round(max_lat + 0.02, 5)],
                    [round(min_lon, 5), round(min_lat, 5)],
                ]]
            }
    elif pts and drift.direction == "forward":
        coords = [[p["lon"], p["lat"]] for p in pts]
        if len(coords) >= 3:
            predicted_path = {
                "type": "LineString",
                "coordinates": coords
            }

    return {
        "id": drift.id,
        "spill_id": drift.spill_id,
        "direction": drift.direction,
        "sim_start_time": drift.sim_start_time,
        "sim_end_time": drift.sim_end_time,
        "duration_hours": drift.duration_hours,
        "origin_cone_geojson": origin_cone,
        "predicted_path_geojson": predicted_path,
        "trajectory_points": drift.trajectory_points,
        "parameters": drift.parameters,
        "created_at": drift.created_at,
    }


@router.get("/{spill_id}/backward", response_model=DriftSimulationResponse)
async def get_backward_drift(
    spill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get backward drift simulation result — origin probability cone."""
    result = await db.execute(
        select(DriftSimulation)
        .where(DriftSimulation.spill_id == spill_id, DriftSimulation.direction == "backward")
        .order_by(DriftSimulation.created_at.desc())
    )
    drift = result.scalar_one_or_none()
    if not drift:
        raise HTTPException(status_code=404, detail="No backward drift simulation found for this spill")
    return DriftSimulationResponse(**drift_to_response(drift))


@router.get("/{spill_id}/forward", response_model=DriftSimulationResponse)
async def get_forward_drift(
    spill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get forward drift simulation result — predicted future path."""
    result = await db.execute(
        select(DriftSimulation)
        .where(DriftSimulation.spill_id == spill_id, DriftSimulation.direction == "forward")
        .order_by(DriftSimulation.created_at.desc())
    )
    drift = result.scalar_one_or_none()
    if not drift:
        raise HTTPException(status_code=404, detail="No forward drift simulation found for this spill")
    return DriftSimulationResponse(**drift_to_response(drift))


@router.get("/{spill_id}/all", response_model=List[DriftSimulationResponse])
async def get_all_drift(
    spill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all drift simulations for a spill."""
    result = await db.execute(
        select(DriftSimulation)
        .where(DriftSimulation.spill_id == spill_id)
        .order_by(DriftSimulation.created_at.desc())
    )
    drifts = result.scalars().all()
    return [DriftSimulationResponse(**drift_to_response(d)) for d in drifts]
