"""
Drift simulation module — simplified Euler-advection approach.
Produces backward (origin cone) and forward (predicted path) drift trajectories
as probability cones with uncertainty, using synthetic currents + wind for demo.

If OpenDrift is available, can use it as a backend; otherwise falls back to
simplified particle-based Euler advection with random perturbation.
"""
import numpy as np
from datetime import datetime, timedelta, timezone
from shapely.geometry import Point, MultiPoint, Polygon
from shapely.ops import unary_union
import json


import os
from pathlib import Path

# Paths to real NetCDF data
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CMEMS_PATH = _DATA_DIR / "cmems" / "currents_india.nc"
ERA5_PATH = _DATA_DIR / "era5" / "era5_wind_india.nc"


def get_environmental_forcing(lat: float, lon: float, dt: datetime = None):
    """
    Extract authentic ocean current (CMEMS) and wind (ERA5) at specified lat/lon.
    Falls back to regional oceanographic baselines if NetCDF outside bounding box.
    """
    current_speed = 0.25
    current_dir = 215.0
    wind_speed = 5.5
    wind_dir = 205.0
    data_sources = []

    # 1. CMEMS Real Ocean Currents
    if CMEMS_PATH.exists():
        try:
            import xarray as xr
            with xr.open_dataset(CMEMS_PATH) as ds:
                # Surface layer is depth=0
                u_val = float(ds['uo'].isel(time=0, depth=0).sel(latitude=lat, longitude=lon, method='nearest').values)
                v_val = float(ds['vo'].isel(time=0, depth=0).sel(latitude=lat, longitude=lon, method='nearest').values)
                if not np.isnan(u_val) and not np.isnan(v_val):
                    current_speed = float(np.hypot(u_val, v_val))
                    current_dir = float((np.degrees(np.arctan2(u_val, v_val)) + 360) % 360)
                    data_sources.append(f"CMEMS currents_india.nc (uo={u_val:.3f}, vo={v_val:.3f} m/s)")
        except Exception as e:
            print(f"[WARN] Failed to read CMEMS currents: {e}")

    # 2. ERA5 Real 10m Wind Fields
    if ERA5_PATH.exists():
        try:
            import xarray as xr
            with xr.open_dataset(ERA5_PATH) as ds:
                u10_val = float(ds['u10'].isel(valid_time=0).sel(latitude=lat, longitude=lon, method='nearest').values)
                v10_val = float(ds['v10'].isel(valid_time=0).sel(latitude=lat, longitude=lon, method='nearest').values)
                if not np.isnan(u10_val) and not np.isnan(v10_val):
                    wind_speed = float(np.hypot(u10_val, v10_val))
                    wind_dir = float((np.degrees(np.arctan2(u10_val, v10_val)) + 360) % 360)
                    data_sources.append(f"ERA5 era5_wind_india.nc (u10={u10_val:.2f}, v10={v10_val:.2f} m/s)")
        except Exception as e:
            print(f"[WARN] Failed to read ERA5 wind: {e}")

    source_desc = " + ".join(data_sources) if data_sources else "Regional climatological oceanographic baseline"
    return {
        "current_speed_ms": round(max(0.05, current_speed), 3),
        "current_dir_deg": round(current_dir, 1),
        "wind_speed_ms": round(max(1.0, wind_speed), 2),
        "wind_dir_deg": round(wind_dir, 1),
        "source": source_desc,
    }


def simulate_drift(
    spill_lat: float,
    spill_lon: float,
    spill_time: datetime,
    direction: str = "backward",
    duration_hours: int = 24,
    num_particles: int = 500,
    current_speed_ms: float = None,
    current_dir_deg: float = None,
    wind_speed_ms: float = None,
    wind_dir_deg: float = None,
    wind_drift_factor: float = 0.03,
    diffusion_coeff: float = 50.0,
):
    """
    Run particle-based Lagrangian drift simulation with authentic CMEMS currents & ERA5 wind.
    """
    # Sample real environmental data if not explicitly overridden
    forcing = get_environmental_forcing(spill_lat, spill_lon, spill_time)
    if current_speed_ms is None:
        current_speed_ms = forcing["current_speed_ms"]
    if current_dir_deg is None:
        current_dir_deg = forcing["current_dir_deg"]
    if wind_speed_ms is None:
        wind_speed_ms = forcing["wind_speed_ms"]
    if wind_dir_deg is None:
        wind_dir_deg = forcing["wind_dir_deg"]

    dt_seconds = 600  # 10-minute timesteps
    num_steps = int(duration_hours * 3600 / dt_seconds)
    time_sign = -1 if direction == "backward" else 1

    # Initialize particles at spill location with small spread
    spread = 0.005  # ~500m initial spread in degrees
    lats = np.random.normal(spill_lat, spread, num_particles)
    lons = np.random.normal(spill_lon, spread, num_particles)

    # Convert current/wind to velocity components (m/s → degrees/s approximately)
    # 1 degree latitude ≈ 111,320 m
    # 1 degree longitude ≈ 111,320 * cos(lat) m
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * np.cos(np.radians(spill_lat))

    # Current velocity components
    current_u = current_speed_ms * np.sin(np.radians(current_dir_deg))  # east
    current_v = current_speed_ms * np.cos(np.radians(current_dir_deg))  # north

    # Wind drift velocity components
    wind_u = wind_speed_ms * wind_drift_factor * np.sin(np.radians(wind_dir_deg))
    wind_v = wind_speed_ms * wind_drift_factor * np.cos(np.radians(wind_dir_deg))

    # Total advection
    total_u = current_u + wind_u  # east (m/s)
    total_v = current_v + wind_v  # north (m/s)

    # Store trajectory snapshots
    trajectory_points = []
    snapshot_interval = max(1, num_steps // 24)  # ~24 snapshots

    for step in range(num_steps):
        # Random diffusion
        diffusion_scale = np.sqrt(2 * diffusion_coeff * dt_seconds)
        dlat_diff = np.random.normal(0, diffusion_scale / meters_per_deg_lat, num_particles)
        dlon_diff = np.random.normal(0, diffusion_scale / meters_per_deg_lon, num_particles)

        # Advection + diffusion
        dlat = time_sign * (total_v * dt_seconds / meters_per_deg_lat) + dlat_diff
        dlon = time_sign * (total_u * dt_seconds / meters_per_deg_lon) + dlon_diff

        # Add slight variation in current per particle (turbulence)
        turbulence = np.random.normal(1.0, 0.1, num_particles)
        lats += dlat * turbulence
        lons += dlon * turbulence

        # Record snapshot
        if step % snapshot_interval == 0 or step == num_steps - 1:
            elapsed = (step + 1) * dt_seconds * time_sign
            snapshot_time = spill_time + timedelta(seconds=elapsed)

            # Compute spread as probability
            center_lat = np.mean(lats)
            center_lon = np.mean(lons)

            trajectory_points.append({
                "time": snapshot_time.isoformat(),
                "lat": round(float(center_lat), 6),
                "lon": round(float(center_lon), 6),
                "spread_lat": round(float(np.std(lats)), 6),
                "spread_lon": round(float(np.std(lons)), 6),
                "probability": round(1.0 - (step / num_steps) * 0.5, 3),  # Decreasing confidence
            })

    # Build probability cone polygon (convex hull of all particles at final step)
    final_points = [Point(lon, lat) for lat, lon in zip(lats, lons)]
    cone_polygon = MultiPoint(final_points).convex_hull

    # Build intermediate cone polygons for animation
    cone_geojson = None
    if isinstance(cone_polygon, Polygon):
        coords = list(cone_polygon.exterior.coords)
        cone_geojson = {
            "type": "Polygon",
            "coordinates": [[[round(c[0], 6), round(c[1], 6)] for c in coords]],
        }

    # Simulation parameters
    parameters = {
        "current_speed_ms": current_speed_ms,
        "current_dir_deg": current_dir_deg,
        "wind_speed_ms": wind_speed_ms,
        "wind_dir_deg": wind_dir_deg,
        "wind_drift_factor": wind_drift_factor,
        "diffusion_coeff": diffusion_coeff,
        "num_particles": num_particles,
        "dt_seconds": dt_seconds,
        "method": "euler_advection_with_diffusion",
        "forcing_source": forcing.get("source"),
        "note": f"Advection hydrodynamic forcing: {forcing.get('source')}",
    }

    # Build start/end times
    if direction == "backward":
        sim_start = spill_time - timedelta(hours=duration_hours)
        sim_end = spill_time
    else:
        sim_start = spill_time
        sim_end = spill_time + timedelta(hours=duration_hours)

    return {
        "direction": direction,
        "sim_start_time": sim_start.isoformat(),
        "sim_end_time": sim_end.isoformat(),
        "duration_hours": duration_hours,
        "trajectory_points": trajectory_points,
        "cone_geojson": cone_geojson,
        "parameters": parameters,
    }


def run_backward_drift(spill_lat, spill_lon, spill_time, duration_hours=24):
    """Convenience: run backward simulation using authentic CMEMS currents and ERA5 wind."""
    return simulate_drift(
        spill_lat, spill_lon, spill_time,
        direction="backward",
        duration_hours=duration_hours,
    )


def run_forward_drift(spill_lat, spill_lon, spill_time, duration_hours=48):
    """Convenience: run forward simulation using authentic CMEMS currents and ERA5 wind."""
    return simulate_drift(
        spill_lat, spill_lon, spill_time,
        direction="forward",
        duration_hours=duration_hours,
    )
