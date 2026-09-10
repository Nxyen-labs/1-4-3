"""
Seed demo data into the database.
Creates: 4 default users, 3 demo spills with full pipeline results,
vessels with AIS tracks, suspect scores, anomaly flags, and impact assessments.

Run: python -m scripts.seed_demo_data
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, async_session, Base
from app.auth.models import User
from app.auth.jwt import hash_password
from app.spills.models import Spill
from app.vessels.models import Vessel, AISTrack
from app.attribution.models import SuspectScore, AnomalyFlag
from app.drift.models import DriftSimulation
from app.impact.models import ImpactAssessment


async def seed():
    # Create all tables
    async with engine.begin() as conn:
        if "postgresql" in str(engine.url):
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            except Exception as e:
                print(f"PostGIS notice: {e}")
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables created")

    async with async_session() as db:
        # ============ USERS ============
        users = [
            User(
                username="public_user", email="public@demo.com",
                password_hash=hash_password("demo123"),
                role="public", assigned_region=None,
            ),
            User(
                username="coast_guard", email="cg@demo.com",
                password_hash=hash_password("demo123"),
                role="coast_guard", assigned_region="west_coast",
            ),
            User(
                username="regional_mgr", email="rm@demo.com",
                password_hash=hash_password("demo123"),
                role="regional_manager", assigned_region="west_coast",
            ),
            User(
                username="authority", email="auth@demo.com",
                password_hash=hash_password("demo123"),
                role="higher_authority", assigned_region=None,
            ),
        ]
        for u in users:
            db.add(u)
        await db.flush()
        print(f"[OK] Created {len(users)} users (password: demo123 for all)")

        # ============ SPILLS ============
        spill_time = datetime(2024, 3, 15, 6, 0, 0, tzinfo=timezone.utc)
        spills = [
            Spill(
                name="SPILL-20240315-001",
                detected_at=spill_time,
                image_timestamp=spill_time - timedelta(hours=1),
                centroid_lat=18.850,
                centroid_lon=71.900,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [71.86, 18.82],
                        [71.94, 18.83],
                        [71.95, 18.88],
                        [71.88, 18.87],
                        [71.86, 18.82]
                    ]]
                },
                area_sq_km=12.5,
                perimeter_km=18.3,
                elongation_ratio=3.2,
                fragmentation_index=2.1,
                age_estimate="hours",
                severity="high",
                validation_status="confirmed",
                validated_by=2,  # coast_guard
                validated_at=spill_time + timedelta(hours=2),
                region="west_coast",
                model_confidence={"oil": 0.89, "lookalike": 0.08, "sea": 0.03},
            ),
            Spill(
                name="SPILL-20240312-002",
                detected_at=spill_time - timedelta(days=3),
                image_timestamp=spill_time - timedelta(days=3, hours=1),
                centroid_lat=19.120,
                centroid_lon=72.150,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [72.12, 19.10],
                        [72.18, 19.11],
                        [72.17, 19.14],
                        [72.13, 19.13],
                        [72.12, 19.10]
                    ]]
                },
                area_sq_km=3.8,
                perimeter_km=8.1,
                elongation_ratio=2.1,
                fragmentation_index=5.7,
                age_estimate="day",
                severity="medium",
                validation_status="confirmed",
                validated_by=2,
                validated_at=spill_time - timedelta(days=2),
                region="west_coast",
                model_confidence={"oil": 0.75, "lookalike": 0.18, "sea": 0.07},
            ),
            Spill(
                name="SPILL-20240310-003",
                detected_at=spill_time - timedelta(days=5),
                image_timestamp=spill_time - timedelta(days=5, hours=2),
                centroid_lat=9.150,
                centroid_lon=79.350,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [79.28, 9.10],
                        [79.42, 9.12],
                        [79.40, 9.20],
                        [79.30, 9.18],
                        [79.28, 9.10]
                    ]]
                },
                area_sq_km=52.0,
                perimeter_km=45.7,
                elongation_ratio=5.8,
                fragmentation_index=0.8,
                age_estimate="fresh",
                severity="critical",
                validation_status="detected",
                region="southeast_coast",
                model_confidence={"oil": 0.94, "lookalike": 0.04, "sea": 0.02},
            ),
        ]
        for s in spills:
            db.add(s)
        await db.flush()
        for s in spills:
            await db.refresh(s)
        print(f"[OK] Created {len(spills)} demo spills")

        # ============ VESSELS ============
        vessels_data = [
            {"mmsi": "419001001", "vessel_name": "MT ARABIAN STAR", "imo": "9801001",
             "call_sign": "VJAA", "vessel_type": "Tanker", "length_m": 250, "width_m": 44,
             "draft_m": 14.5, "flag_state": "India"},
            {"mmsi": "419002002", "vessel_name": "MV OCEAN PRIDE", "imo": "9801002",
             "call_sign": "VJBB", "vessel_type": "Cargo", "length_m": 180, "width_m": 28,
             "draft_m": 10.2, "flag_state": "India"},
            {"mmsi": "419003003", "vessel_name": "MV MUMBAI EXPRESS", "imo": "9801003",
             "call_sign": "VJCC", "vessel_type": "Container", "length_m": 300, "width_m": 48,
             "draft_m": 13.0, "flag_state": "India"},
            {"mmsi": "419004004", "vessel_name": "FV SAGAR MITRA", "imo": "",
             "call_sign": "VJDD", "vessel_type": "Fishing", "length_m": 25, "width_m": 7,
             "draft_m": 3.5, "flag_state": "India"},
            {"mmsi": "419005005", "vessel_name": "MT CRUDE CARRIER", "imo": "9801005",
             "call_sign": "VJEE", "vessel_type": "Tanker", "length_m": 280, "width_m": 50,
             "draft_m": 16.0, "flag_state": "India"},
            {"mmsi": "538006006", "vessel_name": "MV SEA DRAGON", "imo": "9801006",
             "call_sign": "V7AA", "vessel_type": "Cargo", "length_m": 190, "width_m": 30,
             "draft_m": 11.0, "flag_state": "Marshall Islands"},
            {"mmsi": "636007007", "vessel_name": "MV LIBERIA STAR", "imo": "9801007",
             "call_sign": "ELAA", "vessel_type": "Tanker", "length_m": 220, "width_m": 38,
             "draft_m": 13.5, "flag_state": "Liberia"},
            {"mmsi": "419008008", "vessel_name": "TUG SAMRAT", "imo": "",
             "call_sign": "VJFF", "vessel_type": "Tug", "length_m": 35, "width_m": 10,
             "draft_m": 4.0, "flag_state": "India"},
        ]
        vessels = []
        for vd in vessels_data:
            v = Vessel(**vd)
            db.add(v)
            vessels.append(v)
        await db.flush()
        for v in vessels:
            await db.refresh(v)
        print(f"[OK] Created {len(vessels)} vessels")

        # ============ AIS TRACKS (simplified — key points per vessel) ============
        import random
        random.seed(42)
        spill_lat, spill_lon = 18.85, 71.90
        
        for v_idx, vessel in enumerate(vessels):
            base_lat = spill_lat + random.uniform(-0.3, 0.3)
            base_lon = spill_lon + random.uniform(-0.3, 0.3)
            base_speed = random.uniform(8, 14)
            base_course = random.uniform(150, 250)
            
            num_points = 120  # 10 hours of data at 5-min intervals
            for i in range(num_points):
                t = spill_time - timedelta(hours=5) + timedelta(minutes=i * 5)
                hours_from_spill = (t - spill_time).total_seconds() / 3600
                
                speed = base_speed + random.uniform(-1, 1)
                course = base_course + random.uniform(-3, 3)
                
                # Suspect vessel anomalies
                if v_idx == 0:  # MT ARABIAN STAR
                    if -3 <= hours_from_spill <= -1:
                        continue  # AIS gap
                    if -1 < hours_from_spill <= 0.5:
                        speed = random.uniform(0.5, 2.0)
                        base_lat += (spill_lat - base_lat) * 0.05
                        base_lon += (spill_lon - base_lon) * 0.05
                    if 0.5 < hours_from_spill <= 1:
                        course = (base_course + 120) % 360
                        speed = random.uniform(14, 16)
                
                lat = base_lat + (i * 0.001 * random.uniform(0.8, 1.2))
                lon = base_lon + (i * 0.0008 * random.uniform(0.8, 1.2))
                
                track = AISTrack(
                    vessel_id=vessel.id,
                    base_datetime=t,
                    lat=round(lat, 6),
                    lon=round(lon, 6),
                    sog=round(max(0, speed), 1),
                    cog=round(course % 360, 1),
                    heading=round((course + random.uniform(-5, 5)) % 360, 1),
                    nav_status="Under way using engine",
                )
                db.add(track)
        
        await db.flush()
        print("[OK] Created AIS track points for all vessels")

        # ============ DRIFT SIMULATIONS ============
        backward_traj = [
            {"time": (spill_time - timedelta(hours=h)).isoformat(),
             "lat": round(spill_lat + h * 0.008, 6),
             "lon": round(spill_lon + h * 0.006, 6),
             "probability": round(1 - h * 0.03, 3)}
            for h in range(0, 25)
        ]
        forward_traj = [
            {"time": (spill_time + timedelta(hours=h)).isoformat(),
             "lat": round(spill_lat - h * 0.006, 6),
             "lon": round(spill_lon - h * 0.005, 6),
             "probability": round(1 - h * 0.015, 3)}
            for h in range(0, 49)
        ]

        drift_back = DriftSimulation(
            spill_id=spills[0].id, direction="backward",
            sim_start_time=spill_time - timedelta(hours=24),
            sim_end_time=spill_time, duration_hours=24,
            trajectory_points=backward_traj,
            parameters={"method": "euler_advection", "current_speed": 0.25, "wind_speed": 6.0},
        )
        drift_fwd = DriftSimulation(
            spill_id=spills[0].id, direction="forward",
            sim_start_time=spill_time,
            sim_end_time=spill_time + timedelta(hours=48),
            duration_hours=48,
            trajectory_points=forward_traj,
            parameters={"method": "euler_advection", "current_speed": 0.25, "wind_speed": 6.0},
        )
        db.add(drift_back)
        db.add(drift_fwd)
        await db.flush()
        print("[OK] Created drift simulations (backward + forward)")

        # ============ SUSPECT SCORES ============
        suspect_scores = [
            SuspectScore(
                spill_id=spills[0].id, vessel_id=vessels[0].id, rank=1,
                total_score=82.5, proximity_score=92, time_overlap_score=85,
                ais_gap_score=95, speed_anomaly_score=78, course_anomaly_score=65,
                route_deviation_score=55, isolation_forest_score=0.87, confidence=0.82,
                explanation={
                    "proximity": {"score": 92, "detail": "Distance from origin cone: 2.3 nm. Very close — strong spatial correlation"},
                    "time_overlap": {"score": 85, "detail": "Vessel was in origin area for 18.5h out of 24h origin window"},
                    "ais_gap": {"score": 95, "detail": "AIS gap of 120 minutes near spill location — potential deliberate transponder shutdown"},
                    "speed_anomaly": {"score": 78, "detail": "2 speed drop events. Minimum speed: 0.8 knots — consistent with stopping for discharge"},
                    "course_anomaly": {"score": 65, "detail": "1 sudden course change. Maximum change: 120° — consistent with evasive maneuvering"},
                    "route_deviation": {"score": 55, "detail": "Route deviation: 8.2 nm from direct path"},
                    "summary": "Attribution likelihood: 82.5/100 (confidence: 82%). This vessel is a CANDIDATE — this is not a confirmed attribution.",
                },
            ),
            SuspectScore(
                spill_id=spills[0].id, vessel_id=vessels[4].id, rank=2,
                total_score=45.2, proximity_score=60, time_overlap_score=50,
                ais_gap_score=20, speed_anomaly_score=40, course_anomaly_score=30,
                route_deviation_score=35, isolation_forest_score=0.42, confidence=0.45,
                explanation={
                    "proximity": {"score": 60, "detail": "Distance from origin cone: 12.8 nm. Moderate proximity"},
                    "time_overlap": {"score": 50, "detail": "Vessel was in origin area for 10h out of 24h window"},
                    "ais_gap": {"score": 20, "detail": "AIS gap of 15 min — not particularly unusual"},
                    "speed_anomaly": {"score": 40, "detail": "1 minor speed variation"},
                    "course_anomaly": {"score": 30, "detail": "Normal course adjustments"},
                    "route_deviation": {"score": 35, "detail": "Minor route variation"},
                    "summary": "Attribution likelihood: 45.2/100 (confidence: 45%). This vessel is a CANDIDATE.",
                },
            ),
            SuspectScore(
                spill_id=spills[0].id, vessel_id=vessels[6].id, rank=3,
                total_score=31.8, proximity_score=45, time_overlap_score=35,
                ais_gap_score=15, speed_anomaly_score=25, course_anomaly_score=20,
                route_deviation_score=28, isolation_forest_score=0.31, confidence=0.32,
                explanation={
                    "proximity": {"score": 45, "detail": "Distance from origin cone: 18.5 nm"},
                    "time_overlap": {"score": 35, "detail": "Vessel was in origin area for 7h out of 24h window"},
                    "ais_gap": {"score": 15, "detail": "Brief AIS gap — likely signal interference"},
                    "speed_anomaly": {"score": 25, "detail": "Normal speed pattern"},
                    "course_anomaly": {"score": 20, "detail": "Normal navigation"},
                    "route_deviation": {"score": 28, "detail": "Slight route variation"},
                    "summary": "Attribution likelihood: 31.8/100 (confidence: 32%). This vessel is a CANDIDATE.",
                },
            ),
        ]
        for ss in suspect_scores:
            db.add(ss)
        await db.flush()
        print("[OK] Created suspect scores (top 3 ranked)")

        # ============ ANOMALY FLAGS ============
        anomaly_flags = [
            AnomalyFlag(
                vessel_id=vessels[0].id, spill_id=spills[0].id,
                anomaly_type="ais_gap",
                detected_at=spill_time - timedelta(hours=3),
                value=120, threshold=30,
                description="AIS signal gap of 120 minutes near spill location — potential deliberate transponder shutdown",
                acknowledged=False,
            ),
            AnomalyFlag(
                vessel_id=vessels[0].id, spill_id=spills[0].id,
                anomaly_type="speed_drop",
                detected_at=spill_time - timedelta(hours=1),
                value=0.8, threshold=2.0,
                description="Speed dropped to 0.8 knots (below 2.0 kn threshold) for 45 minutes — consistent with stopping",
                acknowledged=False,
            ),
            AnomalyFlag(
                vessel_id=vessels[0].id, spill_id=spills[0].id,
                anomaly_type="course_change",
                detected_at=spill_time + timedelta(minutes=30),
                value=120, threshold=45,
                description="Course changed by 120° (threshold: 45°) from 210° to 330° — possible evasive maneuver",
                acknowledged=False,
            ),
            AnomalyFlag(
                vessel_id=vessels[4].id, spill_id=spills[0].id,
                anomaly_type="speed_drop",
                detected_at=spill_time - timedelta(hours=2),
                value=3.5, threshold=2.0,
                description="Minor speed reduction to 3.5 knots — may be normal operational slowdown",
                acknowledged=True,
            ),
        ]
        for af in anomaly_flags:
            db.add(af)
        await db.flush()
        print("[OK] Created anomaly flags")

        # ============ IMPACT ASSESSMENTS ============
        impacts = [
            ImpactAssessment(
                spill_id=spills[0].id,
                affected_area_sq_km=15.2,
                coast_proximity_km=45.3,
                overlaps_mpa=False,
                overlaps_coral=False,
                overlaps_eez=True,
                nearest_mpa_name="Gulf of Kutch Marine National Park",
                nearest_mpa_distance_km=180.5,
                priority="high",
                estimated_cleanup_cost_usd=2850000,
                ecological_sensitivity_score=42,
                affected_regions=["west_coast"],
                vulnerability_details={
                    "mpa_risk": "low", "coral_risk": "none",
                    "fisheries_impact": "moderate", "shipping_lane_impact": "high",
                },
            ),
            ImpactAssessment(
                spill_id=spills[1].id,
                affected_area_sq_km=4.1,
                coast_proximity_km=22.8,
                overlaps_mpa=False,
                overlaps_coral=False,
                overlaps_eez=True,
                nearest_mpa_name="Marine National Park, Gulf of Kutch",
                nearest_mpa_distance_km=195.0,
                priority="medium",
                estimated_cleanup_cost_usd=780000,
                ecological_sensitivity_score=35,
                affected_regions=["west_coast"],
                vulnerability_details={
                    "mpa_risk": "low", "coral_risk": "none",
                    "fisheries_impact": "low", "shipping_lane_impact": "moderate",
                },
            ),
            ImpactAssessment(
                spill_id=spills[2].id,
                affected_area_sq_km=58.5,
                coast_proximity_km=8.2,
                overlaps_mpa=True,
                overlaps_coral=True,
                overlaps_eez=True,
                nearest_mpa_name="Gulf of Mannar Marine National Park",
                nearest_mpa_distance_km=3.5,
                priority="critical",
                estimated_cleanup_cost_usd=12500000,
                ecological_sensitivity_score=91,
                affected_regions=["southeast_coast"],
                vulnerability_details={
                    "mpa_risk": "critical", "coral_risk": "high",
                    "fisheries_impact": "critical", "shipping_lane_impact": "high",
                },
            ),
        ]
        for imp in impacts:
            db.add(imp)
        await db.flush()
        print("[OK] Created impact assessments")

        await db.commit()
        print("\n[SUCCESS] Demo data seeded successfully!")
        print("\n[INFO] Login credentials (all passwords: demo123):")
        print("   Public:           public_user")
        print("   Coast Guard:      coast_guard")
        print("   Regional Manager: regional_mgr")
        print("   Higher Authority: authority")


if __name__ == "__main__":
    asyncio.run(seed())
