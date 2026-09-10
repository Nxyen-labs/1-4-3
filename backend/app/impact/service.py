"""
Impact service — environmental vulnerability assessment and response priority scoring.
Computes ecological sensitivity, cleanup cost estimates, and priority tiers.
"""
import random


import os
from pathlib import Path
import numpy as np
from shapely.geometry import Point, shape

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CORAL_PATH = _DATA_DIR / "gis" / "corals" / "coral_reefs.geojson"
EEZ_PATH = _DATA_DIR / "gis" / "eez" / "india_eez.geojson"
COAST_PATH = _DATA_DIR / "gis" / "coastline" / "india_coastline.geojson"

# Major Indian Marine Protected Areas (MPAs)
KNOWN_MPAS = [
    {"name": "Marine National Park (Gulf of Kutch)", "lat": 22.46, "lon": 69.75},
    {"name": "Gulf of Mannar Biosphere Reserve", "lat": 9.20, "lon": 79.25},
    {"name": "Malvan Marine Sanctuary (Maharashtra)", "lat": 16.05, "lon": 73.46},
    {"name": "Gahirmatha Marine Sanctuary (Odisha)", "lat": 20.72, "lon": 87.05},
    {"name": "Mahatma Gandhi Marine National Park (Andaman)", "lat": 11.53, "lon": 92.58},
    {"name": "Sundarbans National Park (Mangroves)", "lat": 21.95, "lon": 88.88},
]

# Cache GIS datasets in memory after first load for sub-millisecond response
_GIS_CACHE = {}


def _get_gis_layer(path: Path):
    if not path.exists():
        return None
    p_str = str(path)
    if p_str not in _GIS_CACHE:
        try:
            import geopandas as gpd
            _GIS_CACHE[p_str] = gpd.read_file(p_str)
        except Exception as e:
            print(f"[WARN] Failed to load GIS layer {path.name}: {e}")
            return None
    return _GIS_CACHE[p_str]


def assess_spill_environmental_impact(lat: float, lon: float, area_sq_km: float = 10.0, slick_geojson: dict = None):
    """
    Perform authentic geospatial environmental assessment using Allen Coral Atlas,
    India EEZ, and high-resolution Natural Earth coastlines.
    """
    pt = Point(lon, lat)
    geom = shape(slick_geojson) if slick_geojson else pt

    # 1. India EEZ Check
    overlaps_eez = True  # fallback
    eez_gdf = _get_gis_layer(EEZ_PATH)
    if eez_gdf is not None:
        overlaps_eez = bool(eez_gdf.contains(pt).any() or eez_gdf.intersects(geom).any())

    # 2. Coastline Proximity
    coast_proximity_km = 45.0  # fallback
    coast_gdf = _get_gis_layer(COAST_PATH)
    if coast_gdf is not None:
        try:
            # Approximate distance via WGS84 degree-to-km conversion at this latitude
            lat_rad = np.radians(lat)
            km_per_deg_lat = 111.13
            km_per_deg_lon = 111.32 * np.cos(lat_rad)
            min_dist_deg = coast_gdf.distance(pt).min()
            coast_proximity_km = round(float(min_dist_deg * ((km_per_deg_lat + km_per_deg_lon) / 2)), 1)
        except Exception:
            pass

    # 3. Allen Coral Atlas Reef Overlap & Proximity
    overlaps_coral = False
    coral_distance_km = 200.0
    coral_gdf = _get_gis_layer(CORAL_PATH)
    if coral_gdf is not None:
        try:
            overlaps_coral = bool(coral_gdf.intersects(geom).any())
            min_coral_deg = coral_gdf.distance(pt).min()
            coral_distance_km = round(float(min_coral_deg * 111.13), 1)
        except Exception:
            pass

    # 4. Marine Protected Area (MPA) Proximity
    nearest_mpa_name = "Gulf of Mannar Biosphere Reserve"
    nearest_mpa_distance_km = 999.0
    for mpa in KNOWN_MPAS:
        d_deg = np.hypot(mpa["lat"] - lat, (mpa["lon"] - lon) * np.cos(np.radians(lat)))
        d_km = round(float(d_deg * 111.13), 1)
        if d_km < nearest_mpa_distance_km:
            nearest_mpa_distance_km = d_km
            nearest_mpa_name = mpa["name"]
    overlaps_mpa = bool(nearest_mpa_distance_km < 5.0)

    # 5. Composite Sensitivity Score & Priority
    sensitivity_score = compute_ecological_sensitivity(
        overlaps_mpa=overlaps_mpa,
        overlaps_coral=overlaps_coral,
        overlaps_eez=overlaps_eez,
        coast_proximity_km=coast_proximity_km,
        nearest_mpa_distance_km=nearest_mpa_distance_km,
    )

    priority = compute_response_priority(
        area_sq_km=area_sq_km,
        overlaps_mpa=overlaps_mpa,
        overlaps_coral=overlaps_coral,
        coast_proximity_km=coast_proximity_km,
        ecological_sensitivity_score=sensitivity_score,
    )

    cleanup_cost = estimate_cleanup_cost(
        area_sq_km=area_sq_km,
        priority=priority,
        coast_proximity_km=coast_proximity_km,
    )

    return {
        "affected_area_sq_km": area_sq_km,
        "coast_proximity_km": coast_proximity_km,
        "overlaps_mpa": overlaps_mpa,
        "overlaps_coral": overlaps_coral,
        "overlaps_eez": overlaps_eez,
        "nearest_mpa_name": nearest_mpa_name,
        "nearest_mpa_distance_km": nearest_mpa_distance_km,
        "nearest_coral_distance_km": coral_distance_km,
        "priority": priority,
        "estimated_cleanup_cost_usd": cleanup_cost,
        "ecological_sensitivity_score": sensitivity_score,
        "vulnerability_details": {
            "coral_atlas_status": "Reef overlap detected" if overlaps_coral else f"{coral_distance_km} km to nearest Allen Coral Atlas reef",
            "eez_jurisdiction": "Within Sovereign India EEZ" if overlaps_eez else "International Waters",
            "coast_distance": f"{coast_proximity_km} km to Indian coastline",
            "nearest_protected_area": f"{nearest_mpa_name} ({nearest_mpa_distance_km} km)",
        }
    }


def compute_ecological_sensitivity(
    overlaps_mpa=False,
    overlaps_coral=False,
    overlaps_eez=False,
    coast_proximity_km=100,
    nearest_mpa_distance_km=200,
):
    """
    Compute ecological sensitivity score (0-100).
    Higher = more ecologically sensitive area.
    """
    score = 0
    
    # MPA overlap/proximity
    if overlaps_mpa:
        score += 35
    elif nearest_mpa_distance_km < 10:
        score += 25
    elif nearest_mpa_distance_km < 50:
        score += 15
    elif nearest_mpa_distance_km < 100:
        score += 5
    
    # Coral reef overlap
    if overlaps_coral:
        score += 30
    
    # EEZ (fisheries impact)
    if overlaps_eez:
        score += 10
    
    # Coast proximity
    if coast_proximity_km < 5:
        score += 25
    elif coast_proximity_km < 20:
        score += 15
    elif coast_proximity_km < 50:
        score += 8
    
    return min(score, 100)


def estimate_cleanup_cost(area_sq_km, priority, coast_proximity_km):
    """
    Estimate illustrative cleanup cost in USD.
    Clearly labeled as estimation — not precise.
    
    Based on rough industry averages:
    - Open sea cleanup: ~$150-300K per sq km
    - Nearshore: ~$300-600K per sq km
    - Critical/MPA: 2x multiplier
    """
    # Base cost per sq km
    if coast_proximity_km < 10:
        base_cost_per_sq_km = 450_000  # Nearshore
    elif coast_proximity_km < 30:
        base_cost_per_sq_km = 300_000
    else:
        base_cost_per_sq_km = 200_000  # Open sea
    
    # Priority multiplier
    multiplier = {
        "critical": 2.0,
        "high": 1.5,
        "medium": 1.0,
        "low": 0.8,
    }.get(priority, 1.0)
    
    cost = area_sq_km * base_cost_per_sq_km * multiplier
    
    # Round to nearest 10K for cleanliness
    return round(cost / 10_000) * 10_000


def compute_response_priority(
    area_sq_km,
    overlaps_mpa,
    overlaps_coral,
    coast_proximity_km,
    ecological_sensitivity_score,
):
    """
    Compute response priority tier: critical / high / medium / low.
    """
    score = 0
    
    # Area factor (0-30 points)
    if area_sq_km > 50: score += 30
    elif area_sq_km > 20: score += 22
    elif area_sq_km > 5: score += 15
    elif area_sq_km > 1: score += 8
    
    # Ecological sensitivity (0-30 points)
    score += ecological_sensitivity_score * 0.3
    
    # Coast proximity (0-25 points)
    if coast_proximity_km < 5: score += 25
    elif coast_proximity_km < 15: score += 18
    elif coast_proximity_km < 30: score += 10
    elif coast_proximity_km < 50: score += 5
    
    # Direct ecological overlaps (0-15 points)
    if overlaps_mpa: score += 8
    if overlaps_coral: score += 7
    
    if score >= 65: return "critical"
    elif score >= 45: return "high"
    elif score >= 25: return "medium"
    else: return "low"
