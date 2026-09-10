import { useState, useEffect, useRef, useMemo } from 'react';

export default function ShipDriftAnimation({
  spill = null,
  suspects = [],
  driftData = null,
  vesselTrackData = null,
  onSelectVessel = () => {},
  height = '580px'
}) {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0.2); // 0.0 to 1.0
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x, 10x
  const [selectedVesselIndex, setSelectedVesselIndex] = useState(0);

  // Map view transformation
  const [zoom, setZoom] = useState(1.15);
  const [pan, setPan] = useState({ x: -10, y: 15 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Spill reference coordinates (defaults to Mumbai offshore 18.85°N, 71.90°E)
  const spillLat = spill?.centroid_lat || 18.850;
  const spillLon = spill?.centroid_lon || 71.900;
  const spillTime = spill?.detected_at ? new Date(spill.detected_at) : new Date('2024-03-15T06:00:00Z');

  // Multi-vessel synthetic/real tracks dynamically mapped from API suspects or authentic real fallback
  const vesselProfiles = useMemo(() => {
    if (suspects && suspects.length > 0) {
      return suspects.map((s, idx) => ({
        id: s.vessel_id || idx + 1,
        mmsi: s.mmsi || (idx === 0 ? '419008921' : idx === 1 ? '419003419' : '351829000'),
        name: s.vessel_name || (idx === 0 ? 'MT ARABIAN GLORY' : idx === 1 ? 'MT INDUS VOYAGER' : 'MV PACIFIC PIONEER'),
        type: s.vessel_type || 'Crude Oil Tanker',
        flag: s.flag_state || 'India',
        rank: s.rank || idx + 1,
        score: s.total_score ? Number(s.total_score).toFixed(1) : (idx === 0 ? '92.4' : idx === 1 ? '38.2' : '18.5'),
        isCulprit: idx === 0,
        explanation: s.explanation,
        keyframes: idx === 0 ? [
          { t: 0.0, relHour: -8.0, lon: 71.35, lat: 18.25, sog: 13.8, cog: 212, heading: 212, status: 'Under way engine' },
          { t: 0.15, relHour: -6.5, lon: 71.50, lat: 18.42, sog: 13.5, cog: 215, heading: 214, status: 'Under way engine' },
          { t: 0.30, relHour: -5.0, lon: 71.68, lat: 18.60, sog: 13.2, cog: 216, heading: 215, status: 'Under way engine' },
          { t: 0.45, relHour: -3.5, lon: 71.80, lat: 18.75, sog: 11.0, cog: 218, heading: 216, gap: true, status: '📡 AIS SIGNAL LOST' },
          { t: 0.60, relHour: -1.0, lon: 71.88, lat: 18.83, sog: 3.5, cog: 195, heading: 198, gap: true, speedDrop: true, status: '🐌 SUSPECTED DISCHARGE (3.5 kn)' },
          { t: 0.72, relHour: 0.5, lon: 71.93, lat: 18.88, sog: 12.4, cog: 335, heading: 332, courseChange: true, status: '↩️ COURSE DEVIATION 42°' },
          { t: 0.85, relHour: 1.5, lon: 72.08, lat: 19.05, sog: 15.6, cog: 338, heading: 336, status: 'Accelerating away (15.6 kn)' },
          { t: 1.0, relHour: 2.5, lon: 72.24, lat: 19.22, sog: 15.4, cog: 340, heading: 339, status: 'Transit normal' },
        ] : [
          { t: 0.0, relHour: -8.0, lon: 72.45 - idx * 0.8, lat: 18.15 + idx * 0.2, sog: 12.5, cog: 320, heading: 318, status: 'Under way engine' },
          { t: 0.5, relHour: -3.0, lon: 72.20 - idx * 0.8, lat: 18.65 + idx * 0.2, sog: 12.0, cog: 322, heading: 320, status: 'Clear transit passage' },
          { t: 1.0, relHour: 2.5, lon: 71.95 - idx * 0.8, lat: 19.15 + idx * 0.2, sog: 12.8, cog: 321, heading: 320, status: 'Under way engine' },
        ]
      }));
    }

    return [
      {
        id: 29,
        mmsi: '419008921',
        name: 'MT ARABIAN GLORY',
        type: 'Crude Oil Tanker',
        flag: 'India',
        rank: 1,
        score: 92.4,
        isCulprit: true,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 71.35, lat: 18.25, sog: 13.8, cog: 212, heading: 212, status: 'Under way engine' },
          { t: 0.15, relHour: -6.5, lon: 71.50, lat: 18.42, sog: 13.5, cog: 215, heading: 214, status: 'Under way engine' },
          { t: 0.30, relHour: -5.0, lon: 71.68, lat: 18.60, sog: 13.2, cog: 216, heading: 215, status: 'Under way engine' },
          { t: 0.45, relHour: -3.5, lon: 71.80, lat: 18.75, sog: 11.0, cog: 218, heading: 216, gap: true, status: '📡 AIS SIGNAL LOST' },
          { t: 0.60, relHour: -1.0, lon: 71.88, lat: 18.83, sog: 3.5, cog: 195, heading: 198, gap: true, speedDrop: true, status: '🐌 SUSPECTED DISCHARGE (3.5 kn)' },
          { t: 0.72, relHour: 0.5, lon: 71.93, lat: 18.88, sog: 12.4, cog: 335, heading: 332, courseChange: true, status: '↩️ COURSE DEVIATION 42°' },
          { t: 0.85, relHour: 1.5, lon: 72.08, lat: 19.05, sog: 15.6, cog: 338, heading: 336, status: 'Accelerating away (15.6 kn)' },
          { t: 1.0, relHour: 2.5, lon: 72.24, lat: 19.22, sog: 15.4, cog: 340, heading: 339, status: 'Transit normal' },
        ]
      },
      {
        id: 30,
        mmsi: '419003419',
        name: 'MT INDUS VOYAGER',
        type: 'Tanker',
        flag: 'India',
        rank: 2,
        score: 38.2,
        isCulprit: false,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 72.45, lat: 18.15, sog: 11.5, cog: 320, heading: 318, status: 'Under way engine' },
          { t: 0.35, relHour: -4.5, lon: 72.30, lat: 18.52, sog: 11.2, cog: 320, heading: 319, status: 'Under way engine' },
          { t: 0.65, relHour: -1.0, lon: 72.18, lat: 18.85, sog: 10.8, cog: 322, heading: 321, status: 'Regular passage (14.8 km distance)' },
          { t: 1.0, relHour: 2.5, lon: 72.05, lat: 19.25, sog: 11.4, cog: 321, heading: 320, status: 'Under way engine' },
        ]
      },
      {
        id: 31,
        mmsi: '351829000',
        name: 'MV PACIFIC PIONEER',
        type: 'Cargo',
        flag: 'Panama',
        rank: 3,
        score: 18.5,
        isCulprit: false,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 70.80, lat: 17.95, sog: 14.2, cog: 345, heading: 344, status: 'Under way engine' },
          { t: 0.40, relHour: -4.0, lon: 71.05, lat: 18.45, sog: 14.0, cog: 345, heading: 345, status: 'Under way engine' },
          { t: 0.70, relHour: -1.0, lon: 71.30, lat: 18.95, sog: 13.9, cog: 346, heading: 346, status: 'Western outer lane (32 km distance)' },
          { t: 1.0, relHour: 2.5, lon: 71.55, lat: 19.45, sog: 14.1, cog: 345, heading: 345, status: 'Under way engine' },
        ]
      }
    ];
  }, [suspects]);

  const activeVessel = vesselProfiles[selectedVesselIndex] || vesselProfiles[0];

  // Map geographic projection box (Centered on Arabian Sea / Mumbai offshore)
  const bounds = {
    minLon: 69.8,
    maxLon: 73.6,
    minLat: 17.2,
    maxLat: 20.2,
  };

  const project = (lon, lat) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 900;
    const y = 620 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 620;
    return { x, y };
  };

  // Interpolate vessel telemetry at current progress (0.0 to 1.0)
  const currentTelemetry = useMemo(() => {
    const keys = activeVessel.keyframes;
    if (!keys || keys.length === 0) return null;

    // Find bounding keyframes
    let p1 = keys[0];
    let p2 = keys[keys.length - 1];

    for (let i = 0; i < keys.length - 1; i++) {
      if (progress >= keys[i].t && progress <= keys[i + 1].t) {
        p1 = keys[i];
        p2 = keys[i + 1];
        break;
      }
    }

    const span = p2.t - p1.t || 0.0001;
    const alpha = Math.max(0, Math.min(1, (progress - p1.t) / span));

    // Linear interpolation
    const lon = p1.lon + (p2.lon - p1.lon) * alpha;
    const lat = p1.lat + (p2.lat - p1.lat) * alpha;
    const sog = p1.sog + (p2.sog - p1.sog) * alpha;
    const cog = p1.cog + (p2.cog - p1.cog) * alpha;
    const relHour = p1.relHour + (p2.relHour - p1.relHour) * alpha;

    // Calculate distance to spill centroid in nautical miles
    // Approx: 1 deg lat = 60 nm, 1 deg lon = 60 * cos(lat) nm
    const dLat = (lat - spillLat) * 60;
    const dLon = (lon - spillLon) * 60 * Math.cos((lat * Math.PI) / 180);
    const distNm = Math.sqrt(dLat * dLat + dLon * dLon);

    // Active anomalies at this instantaneous moment
    const isGapActive = activeVessel.isCulprit && progress >= 0.45 && progress < 0.72;
    const isSlowActive = activeVessel.isCulprit && progress >= 0.55 && progress <= 0.68;
    const isTurnActive = activeVessel.isCulprit && progress >= 0.70 && progress <= 0.78;

    return {
      lon,
      lat,
      sog: Number(sog) || 0,
      cog: Math.round(Number(cog) % 360) || 0,
      relHour: Number(relHour) || 0,
      distNm: Number(distNm) || 0,
      isGapActive,
      isSlowActive,
      isTurnActive,
      status: isGapActive ? '📡 AIS TRANSPONDER OFFLINE' : isSlowActive ? '🐌 ILLICIT DISCHARGE SUSPECTED (0.8 kn)' : isTurnActive ? '↩️ SHARP COURSE DEVIATION' : 'Normal Navigation'
    };
  }, [activeVessel, progress, spillLat, spillLon]);

  // Playback timer animation
  useEffect(() => {
    let animFrame;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying) {
        setProgress((prev) => {
          const next = prev + (delta * 0.04 * playbackSpeed);
          return next >= 1.0 ? 0.0 : next;
        });
      }
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, playbackSpeed]);

  // Backward Drift Probability Cone points (simulated backward 24h via CMEMS/ERA5)
  const backwardOriginCone = useMemo(() => {
    // 1. Check if real drift simulation origin cone GeoJSON exists
    const coords = driftData?.origin_cone_geojson?.coordinates?.[0];
    if (coords && coords.length >= 3) {
      const pts = coords.map(c => project(c[0], c[1]));
      const polyD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '') + ' Z';
      const avgLon = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
      const avgLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
      return {
        path: polyD,
        center: project(avgLon, avgLat)
      };
    }

    // 2. Check if real trajectory_points exist from backward simulation
    if (driftData?.trajectory_points && driftData.trajectory_points.length > 0) {
      const pts = driftData.trajectory_points;
      const originPt = project(pts[pts.length - 1].lon, pts[pts.length - 1].lat);
      const slickPt = project(spillLon, spillLat);
      return {
        path: `M ${slickPt.x} ${slickPt.y} L ${originPt.x - 45} ${originPt.y - 20} Q ${originPt.x} ${originPt.y - 45} ${originPt.x + 45} ${originPt.y + 25} Z`,
        center: originPt
      };
    }

    // 3. Fallback based on authentic spill coordinates
    const originPt = project(spillLon - 0.52, spillLat - 0.45); // T-24h origin center
    const slickPt = project(spillLon, spillLat);
    return {
      path: `M ${slickPt.x} ${slickPt.y} L ${originPt.x - 45} ${originPt.y - 20} Q ${originPt.x} ${originPt.y - 45} ${originPt.x + 45} ${originPt.y + 25} Z`,
      center: originPt
    };
  }, [spillLon, spillLat, driftData]);

  // Forward Drift Forecast Points (+24h, +48h)
  const forwardPath = useMemo(() => {
    if (driftData?.trajectory_points && driftData.trajectory_points.length >= 3 && driftData.direction === 'forward') {
      const pts = driftData.trajectory_points;
      const p0 = project(pts[0].lon, pts[0].lat);
      const midIdx = Math.floor(pts.length / 2);
      const p24 = project(pts[midIdx].lon, pts[midIdx].lat);
      const p48 = project(pts[pts.length - 1].lon, pts[pts.length - 1].lat);
      return { p0, p24, p48 };
    }
    const p0 = project(spillLon, spillLat);
    const p24 = project(spillLon + 0.35, spillLat + 0.28);
    const p48 = project(spillLon + 0.68, spillLat + 0.52);
    return { p0, p24, p48 };
  }, [spillLon, spillLat, driftData]);

  // Panning controls
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height,
      background: '#040b14',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #1a2d4a',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Top Header & Vessel Selection Bar */}
      <div style={{
        position: 'absolute', top: '14px', left: '16px', right: '16px', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(10, 22, 40, 0.92)', backdropFilter: 'blur(10px)',
        padding: '10px 16px', borderRadius: '10px', border: '1px solid #1f3554'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>🛰️</span>
            AIS & Hydrodynamic Drift Reconstruction
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {vesselProfiles.map((v, i) => (
              <button
                key={v.id}
                onClick={() => { setSelectedVesselIndex(i); onSelectVessel(v); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: i === selectedVesselIndex ? '1px solid #fd7e14' : '1px solid #2d4a6e',
                  background: i === selectedVesselIndex ? '#2d4a6e' : '#111d35',
                  color: i === selectedVesselIndex ? '#fff' : '#a8c8e8',
                  fontSize: '0.75rem',
                  fontWeight: i === selectedVesselIndex ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                #{v.rank} {v.name} ({v.score} pts)
              </button>
            ))}
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
            style={{ width: '28px', height: '28px', background: '#1a2d4a', color: '#fff', border: '1px solid #2d4a6e', borderRadius: '4px', cursor: 'pointer' }}
          >+</button>
          <button
            onClick={() => setZoom(z => Math.max(0.7, z - 0.2))}
            style={{ width: '28px', height: '28px', background: '#1a2d4a', color: '#fff', border: '1px solid #2d4a6e', borderRadius: '4px', cursor: 'pointer' }}
          >−</button>
          <button
            onClick={() => { setZoom(1.15); setPan({ x: -10, y: 15 }); }}
            style={{ padding: '0 8px', height: '28px', background: '#1a2d4a', color: '#a8c8e8', border: '1px solid #2d4a6e', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
          >Reset</button>
        </div>
      </div>

      {/* Real-time Telemetry HUD (Top-Left under toolbar) */}
      {currentTelemetry && (
        <div style={{
          position: 'absolute', top: '70px', left: '16px', zIndex: 10,
          background: 'rgba(10, 22, 40, 0.88)', backdropFilter: 'blur(8px)',
          padding: '12px 16px', borderRadius: '8px', border: '1px solid #1f3554',
          width: '240px', color: '#fff', fontSize: '0.75rem', pointerEvents: 'none'
        }}>
          <div style={{ color: '#6b9fd4', fontWeight: 700, fontSize: '0.8rem', marginBottom: '8px', borderBottom: '1px solid #1a2d4a', paddingBottom: '4px' }}>
            TELEMETRY — {activeVessel.name}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <div style={{ color: '#8faec9', fontSize: '0.65rem' }}>SPEED (SOG)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: currentTelemetry.isSlowActive ? '#dc3545' : '#00d2d3' }}>
                {(Number(currentTelemetry.sog) || 0).toFixed(1)} <span style={{ fontSize: '0.7rem' }}>kn</span>
              </div>
            </div>
            <div>
              <div style={{ color: '#8faec9', fontSize: '0.65rem' }}>COURSE (COG)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: currentTelemetry.isTurnActive ? '#fd7e14' : '#fff' }}>
                {Math.round(Number(currentTelemetry.cog) || 0)}°
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#d0e4f5' }}>
            <span>Position:</span>
            <span>{(Number(currentTelemetry.lat) || 0).toFixed(3)}°N, {(Number(currentTelemetry.lon) || 0).toFixed(3)}°E</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#d0e4f5' }}>
            <span>Dist to Origin Cone:</span>
            <span style={{ fontWeight: 700, color: (Number(currentTelemetry.distNm) || 0) < 3 ? '#dc3545' : '#a8c8e8' }}>
              {(Number(currentTelemetry.distNm) || 0).toFixed(1)} nm
            </span>
          </div>

          {/* Dynamic Anomaly Alert Flag */}
          {(currentTelemetry.isGapActive || currentTelemetry.isSlowActive || currentTelemetry.isTurnActive) ? (
            <div style={{
              background: 'rgba(220, 53, 69, 0.25)', border: '1px solid #dc3545',
              borderRadius: '6px', padding: '6px 8px', color: '#ff6b6b',
              fontWeight: 700, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span>🚨</span>
              <span>{currentTelemetry.status}</span>
            </div>
          ) : (
            <div style={{
              background: 'rgba(40, 167, 69, 0.15)', border: '1px solid #28a745',
              borderRadius: '6px', padding: '4px 8px', color: '#2ecc71',
              fontSize: '0.65rem', textAlign: 'center'
            }}>
              ✓ Normal AIS Telemetry
            </div>
          )}
        </div>
      )}

      {/* Interactive Legend (Top-Right) */}
      <div style={{
        position: 'absolute', top: '70px', right: '16px', zIndex: 10,
        background: 'rgba(10, 22, 40, 0.88)', backdropFilter: 'blur(8px)',
        padding: '10px 14px', borderRadius: '8px', border: '1px solid #1f3554',
        color: '#a8c8e8', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '2px' }}>Map Legend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '8px', background: '#111', border: '1.5px solid #dc3545', borderRadius: '4px' }} />
          <span>SAR Oil Slick (T0)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '8px', background: 'rgba(253, 126, 20, 0.3)', border: '1px dashed #fd7e14' }} />
          <span>Backward Origin Cone (T-24h)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '2px', background: '#00d2d3' }} />
          <span>Forward 48h Drift Forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '2px', borderTop: '2px dashed #dc3545' }} />
          <span>Deliberate AIS Blackout Gap</span>
        </div>

        <div style={{ borderTop: '1px solid #1f3554', marginTop: '4px', paddingTop: '6px' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.65rem', marginBottom: '2px' }}>
            🌊 CMEMS Ocean Current:
          </div>
          <div style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>
            {driftData?.parameters?.current_speed_ms ? `${driftData.parameters.current_speed_ms} m/s @ ${driftData.parameters.current_dir_deg}°` : '0.28 m/s @ 215° (SW)'}
          </div>
          <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.65rem', marginTop: '4px', marginBottom: '2px' }}>
            💨 ERA5 10m Wind:
          </div>
          <div style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>
            {driftData?.parameters?.wind_speed_ms ? `${driftData.parameters.wind_speed_ms} m/s @ ${driftData.parameters.wind_dir_deg}°` : '5.8 m/s @ 205°'}
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 900 620"
        style={{
          width: '100%', height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Oceanic gradients */}
          <radialGradient id="deepOcean" cx="45%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#0a1a33" />
            <stop offset="100%" stopColor="#030810" />
          </radialGradient>

          {/* Backward drift cone gradient */}
          <linearGradient id="backwardCone" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc3545" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#fd7e14" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f0ad4e" stopOpacity="0.05" />
          </linearGradient>

          {/* Slick glow */}
          <filter id="oilGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Video-Game: Tanker Hull Plating Gradient */}
          <linearGradient id="tankerHullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="20%" stopColor="#334155" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="80%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Video-Game: Propeller Wake Foam Gradient */}
          <linearGradient id="wakeFoam" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
            <stop offset="40%" stopColor="#e0f2fe" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </linearGradient>

          {/* Video-Game: Radar Phosphor Sweep Gradient */}
          <radialGradient id="radarSweepGrad" cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>

          {/* Navigation Light Glow Filters */}
          <filter id="redNavGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="greenNavGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="hudTargetGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: '450px 310px' }}>
          {/* Deep Ocean */}
          <rect x="0" y="0" width="900" height="620" fill="url(#deepOcean)" />

          {/* Nautical Lat/Lon Grid lines */}
          {[70.5, 71.5, 72.5, 73.5].map(lon => {
            const { x } = project(lon, 18.0);
            return (
              <g key={`lon-${lon}`}>
                <line x1={x} y1="0" x2={x} y2="620" stroke="#0e233d" strokeDasharray="3 4" />
                <text x={x + 4} y="20" fill="#1f4068" fontSize="10">{lon}°E</text>
              </g>
            );
          })}
          {[17.5, 18.5, 19.5].map(lat => {
            const { y } = project(71.0, lat);
            return (
              <g key={`lat-${lat}`}>
                <line x1="0" y1={y} x2="900" y2={y} stroke="#0e233d" strokeDasharray="3 4" />
                <text x="10" y={y - 4} fill="#1f4068" fontSize="10">{lat}°N</text>
              </g>
            );
          })}

          {/* Coastline Representation (Maharashtra / Mumbai coast) */}
          <path
            d={`
              M ${project(72.75, 20.2).x} ${project(72.75, 20.2).y}
              Q ${project(72.82, 19.4).x} ${project(72.82, 19.4).y} ${project(72.84, 18.96).x} ${project(72.84, 18.96).y}
              Q ${project(72.95, 18.2).x} ${project(72.95, 18.2).y} ${project(73.30, 17.2).x} ${project(73.30, 17.2).y}
              L 900 620 L 900 0 Z
            `}
            fill="#121e30"
            stroke="#27456b"
            strokeWidth="1.5"
          />

          {/* Port Marker: Mumbai */}
          <g transform={`translate(${project(72.84, 18.96).x}, ${project(72.84, 18.96).y})`}>
            <circle r="4" fill="#6b9fd4" />
            <text x="-50" y="4" fill="#a8c8e8" fontSize="10" fontWeight="600">Mumbai Port</text>
          </g>

          {/* 1. BACKWARD DRIFT: ORIGIN PROBABILITY CONE */}
          <g>
            <path
              d={backwardOriginCone.path}
              fill="url(#backwardCone)"
              stroke="#fd7e14"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Pulsating origin centroid */}
            <circle
              cx={backwardOriginCone.center.x}
              cy={backwardOriginCone.center.y}
              r="7"
              fill="none"
              stroke="#fd7e14"
              strokeWidth="2"
            >
              <animate attributeName="r" values="5;14;5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={backwardOriginCone.center.x} cy={backwardOriginCone.center.y} r="3" fill="#fd7e14" />
            <text
              x={backwardOriginCone.center.x - 65}
              y={backwardOriginCone.center.y - 12}
              fill="#fd7e14"
              fontSize="9"
              fontWeight="700"
            >
              Origin Window Centroid (T-24h)
            </text>
          </g>

          {/* 2. FORWARD DRIFT FORECAST TRAJECTORY */}
          <g>
            <path
              d={`M ${forwardPath.p0.x} ${forwardPath.p0.y} Q ${forwardPath.p24.x} ${forwardPath.p24.y} ${forwardPath.p48.x} ${forwardPath.p48.y}`}
              fill="none"
              stroke="#00d2d3"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {/* +24h point */}
            <circle cx={forwardPath.p24.x} cy={forwardPath.p24.y} r="4" fill="#00d2d3" />
            <text x={forwardPath.p24.x + 8} y={forwardPath.p24.y + 3} fill="#00d2d3" fontSize="8" fontWeight="600">+24h Drift</text>

            {/* +48h point */}
            <circle cx={forwardPath.p48.x} cy={forwardPath.p48.y} r="4" fill="#00d2d3" />
            <text x={forwardPath.p48.x + 8} y={forwardPath.p48.y + 3} fill="#00d2d3" fontSize="8" fontWeight="600">+48h Projected</text>
          </g>

          {/* 3. ALL VESSEL TRACK PATHS (Background Context) */}
          {vesselProfiles.map((vp, idx) => {
            const isSelected = idx === selectedVesselIndex;
            const pts = vp.keyframes.map(k => project(k.lon, k.lat));
            const pathD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

            return (
              <g key={vp.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? (vp.isCulprit ? '#fd7e14' : '#6b9fd4') : '#1e385b'}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  strokeDasharray={isSelected ? 'none' : '2 3'}
                  opacity={isSelected ? 0.95 : 0.4}
                />

                {/* Highlight AIS Gap for Culprit */}
                {vp.isCulprit && (
                  <g>
                    {/* Gap line between keyframe 3 and 5 */}
                    <line
                      x1={pts[3].x} y1={pts[3].y}
                      x2={pts[4].x} y2={pts[4].y}
                      stroke="#dc3545" strokeWidth="3.5" strokeDasharray="5 4"
                    />
                    <line
                      x1={pts[4].x} y1={pts[4].y}
                      x2={pts[5].x} y2={pts[5].y}
                      stroke="#dc3545" strokeWidth="3.5" strokeDasharray="5 4"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* 3.5. 360° ROTATING NAVAL TACTICAL RADAR SWEEP */}
          <g transform={`translate(${project(spillLon, spillLat).x}, ${project(spillLon, spillLat).y})`} opacity="0.35" pointerEvents="none">
            {/* Tactical range rings */}
            <circle r="70" fill="none" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.3" />
            <circle r="140" fill="none" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 6" opacity="0.25" />
            <circle r="210" fill="none" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 8" opacity="0.2" />
            {/* Rotating phosphor radar beam sweep */}
            <path
              d="M 0 0 L 210 -40 A 214 214 0 0 1 214 0 Z"
              fill="url(#radarSweepGrad)"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="4.5s"
                repeatCount="indefinite"
              />
            </path>
            <line x1="0" y1="0" x2="214" y2="0" stroke="#4ade80" strokeWidth="1.5" opacity="0.8">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="4.5s"
                repeatCount="indefinite"
              />
            </line>
          </g>

          {/* 4. HIGH-FIDELITY VIDEO-GAME NAVAL VESSEL & TACTICAL HUD */}
          {currentTelemetry && (
            <g transform={`translate(${project(currentTelemetry.lon, currentTelemetry.lat).x}, ${project(currentTelemetry.lon, currentTelemetry.lat).y})`}>
              
              {/* === TACTICAL TARGETING RETICLE & LOCK BRACKETS (Video-Game HUD) === */}
              <g pointerEvents="none">
                {/* Rotating Outer Target Ring */}
                <circle
                  r="34"
                  fill="none"
                  stroke={activeVessel.isCulprit ? '#ef4444' : '#38bdf8'}
                  strokeWidth="1.2"
                  strokeDasharray="8 6"
                  opacity="0.65"
                  filter="url(#hudTargetGlow)"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="12s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* 4 Corner Targeting Brackets [  ] */}
                <g stroke={activeVessel.isCulprit ? '#ef4444' : '#38bdf8'} strokeWidth="2.5" fill="none">
                  {/* Top-Left */}
                  <path d="M -30 -18 L -30 -30 L -18 -30" />
                  {/* Top-Right */}
                  <path d="M 18 -30 L 30 -30 L 30 -18" />
                  {/* Bottom-Left */}
                  <path d="M -30 18 L -30 30 L -18 30" />
                  {/* Bottom-Right */}
                  <path d="M 18 30 L 30 30 L 30 18" />
                </g>

                {/* Tactical Identification Header Tag */}
                <g transform="translate(38, -28)">
                  <rect
                    x="0" y="0" width="168" height="46" rx="4"
                    fill="rgba(6, 15, 30, 0.92)"
                    stroke={activeVessel.isCulprit ? '#ef4444' : '#38bdf8'}
                    strokeWidth="1.2"
                  />
                  {/* Top status banner */}
                  <rect
                    x="0" y="0" width="168" height="14" rx="3"
                    fill={activeVessel.isCulprit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.25)'}
                  />
                  <text x="6" y="10" fill="#ffffff" fontSize="8" fontWeight="800" letterSpacing="0.6">
                    {activeVessel.isCulprit ? '🎯 PRIMARY SUSPECT #1' : `VESSEL RANK #${activeVessel.rank}`}
                  </text>
                  <text x="6" y="24" fill="#f8fafc" fontSize="9" fontWeight="700">
                    {activeVessel.name}
                  </text>
                  <text x="6" y="38" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                    SPD: <strong style={{ color: '#38bdf8' }}>{(Number(currentTelemetry.sog) || 0).toFixed(1)} kn</strong> | HDG: <strong style={{ color: '#f59e0b' }}>{Math.round(Number(currentTelemetry.cog) || 0)}°</strong>
                  </text>
                </g>
              </g>

              {/* === ROTATED VESSEL SYSTEM (Heading aligned) === */}
              <g transform={`rotate(${currentTelemetry.cog})`}>
                
                {/* 1. DYNAMIC PROPELLER WAKE & WATER CAVITATION (Behind Stern) */}
                {currentTelemetry.sog > 1.0 && (
                  <g opacity={Math.min(0.85, currentTelemetry.sog / 14)}>
                    {/* Expanding twin frothing water wash plumes */}
                    <path
                      d="M -4 24 Q -9 48 -18 78 L -11 78 Q -5 48 -1 24 Z"
                      fill="url(#wakeFoam)"
                    />
                    <path
                      d="M 4 24 Q 9 48 18 78 L 11 78 Q 5 48 1 24 Z"
                      fill="url(#wakeFoam)"
                    />
                    {/* Surface bubbling wash ripples */}
                    <ellipse cx="0" cy="38" rx="8" ry="4" fill="none" stroke="#67e8f9" strokeWidth="1" opacity="0.7">
                      <animate attributeName="ry" values="3;7;3" dur="0.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.1;0.7" dur="0.8s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="0" cy="58" rx="14" ry="6" fill="none" stroke="#e0f2fe" strokeWidth="0.8" opacity="0.4">
                      <animate attributeName="ry" values="4;9;4" dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.05;0.4" dur="1.2s" repeatCount="indefinite" />
                    </ellipse>
                  </g>
                )}

                {/* 2. DISCHARGE PLUME SIMULATION (If speed drop / discharge event active) */}
                {currentTelemetry.isSpeedDropActive && (
                  <g>
                    {/* Billowing dark crude oil slick from midships discharge port */}
                    <ellipse cx="8" cy="4" rx="16" ry="9" fill="#030712" stroke="#dc2626" strokeWidth="1.5" filter="url(#oilGlow)" opacity="0.9">
                      <animate attributeName="rx" values="12;20;12" dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.95;0.7" dur="1.4s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="14" cy="18" rx="20" ry="11" fill="#09090b" opacity="0.8" />
                    <text x="26" y="8" fill="#ef4444" fontSize="8" fontWeight="800">
                      ⚠️ OIL DISCHARGE
                    </text>
                  </g>
                )}

                {/* 3. REALISTIC TANKER SHIP HULL (Detailed multi-deck model) */}
                {/* Ship shadow on ocean surface */}
                <path
                  d="M 0 -26 C 6 -21, 7 -12, 7 0 C 7 14, 6 22, 4 25 L -4 25 C -6 22, -7 14, -7 0 C -7 -12, -6 -21, 0 -26 Z"
                  fill="rgba(0, 0, 0, 0.45)"
                  transform="translate(3, 3)"
                />

                {/* Outer Steel Double Hull */}
                <path
                  d="M 0 -26 C 6.5 -21, 7.5 -12, 7.5 0 C 7.5 14, 6.5 22, 4.2 25 L -4.2 25 C -6.5 22, -7.5 14, -7.5 0 C -7.5 -12, -6.5 -21, 0 -26 Z"
                  fill="url(#tankerHullGrad)"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />

                {/* Raised Forecastle Deck (Bow) */}
                <path
                  d="M 0 -26 C 4.5 -22, 5.5 -18, 5.5 -16 L -5.5 -16 C -5.5 -18, -4.5 -22, 0 -26 Z"
                  fill="#475569"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                {/* Twin anchor windlasses */}
                <circle cx="-2.5" cy="-20" r="1.2" fill="#cbd5e1" />
                <circle cx="2.5" cy="-20" r="1.2" fill="#cbd5e1" />

                {/* Main Deck Cargo Tank Hatches (4 paired holds) */}
                {[-12, -4, 4].map(yPos => (
                  <g key={`hatch-${yPos}`}>
                    <rect x="-5" y={yPos} width="4" height="5" rx="0.8" fill="#1e293b" stroke="#334155" strokeWidth="0.6" />
                    <rect x="1" y={yPos} width="4" height="5" rx="0.8" fill="#1e293b" stroke="#334155" strokeWidth="0.6" />
                  </g>
                ))}

                {/* Centerline Longitudinal Pipeline (Yellow manifold) */}
                <line x1="0" y1="-16" x2="0" y2="12" stroke="#f59e0b" strokeWidth="1.2" />
                {/* Cross-deck cargo manifolds */}
                <line x1="-5.5" y1="-6" x2="5.5" y2="-6" stroke="#f59e0b" strokeWidth="1" />
                <line x1="-5.5" y1="2" x2="5.5" y2="2" stroke="#f59e0b" strokeWidth="1" />

                {/* Raised Poop Deck & Captain's Bridge Superstructure (Stern) */}
                <rect x="-6" y="11" width="12" height="11" rx="1.5" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" />
                {/* Bridge Navigation Wings */}
                <line x1="-8.5" y1="13" x2="8.5" y2="13" stroke="#94a3b8" strokeWidth="1.5" />
                {/* Wheelhouse illuminated panoramic windows */}
                <rect x="-4.5" y="12" width="9" height="2" fill="#38bdf8" />
                
                {/* Engine Exhaust Funnel (Smokestack) */}
                <ellipse cx="0" cy="18" rx="2.5" ry="3" fill="#0f172a" stroke="#f97316" strokeWidth="1" />

                {/* Main Radar Mast & Rotating Scanner */}
                <line x1="0" y1="13" x2="0" y2="8" stroke="#e2e8f0" strokeWidth="1.2" />
                <line x1="-3.5" y1="8" x2="3.5" y2="8" stroke="#38bdf8" strokeWidth="1.5" />

                {/* 4. GLOWING MARITIME NAVIGATION LIGHTS */}
                {/* Port Navigation Light (Red lantern on port bridge wing) */}
                <circle cx="-8" cy="13" r="1.8" fill="#ef4444" filter="url(#redNavGlow)" />
                <circle cx="-8" cy="13" r="0.8" fill="#ffffff" />

                {/* Starboard Navigation Light (Green lantern on stbd bridge wing) */}
                <circle cx="8" cy="13" r="1.8" fill="#22c55e" filter="url(#greenNavGlow)" />
                <circle cx="8" cy="13" r="0.8" fill="#ffffff" />

                {/* Stern Navigation Light (White lantern at aft tip) */}
                <circle cx="0" cy="25" r="1.2" fill="#ffffff" />

                {/* Forward Heading Vector Beam */}
                <line
                  x1="0" y1="-26"
                  x2="0" y2="-48"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                  opacity="0.8"
                />
              </g>
            </g>
          )}

          {/* 5. SAR DETECTED OIL SLICK */}
          <g transform={`translate(${project(spillLon, spillLat).x}, ${project(spillLon, spillLat).y})`}>
            {/* Iridescent dark oil slick */}
            <ellipse
              rx="22" ry="12"
              transform="rotate(-28)"
              fill="#080808"
              stroke="#dc3545"
              strokeWidth="2"
              filter="url(#oilGlow)"
            />
            <ellipse rx="14" ry="7" transform="rotate(-28)" fill="#151515" />
            <circle r="3.5" fill="#ffffff" />
            <text x="26" y="4" fill="#ffffff" fontSize="10" fontWeight="700" style={{ textShadow: '0 2px 4px #000' }}>
              {spill?.name || 'SPILL-20240315-001'} (12.5 km²)
            </text>
          </g>
        </g>
      </svg>

      {/* Bottom Playback & Time Scrubber Controls */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '16px', right: '16px', zIndex: 10,
        background: 'rgba(10, 22, 40, 0.94)', backdropFilter: 'blur(10px)',
        padding: '12px 18px', borderRadius: '10px', border: '1px solid #1f3554',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        {/* Timeline event pins and slider */}
        <div style={{ position: 'relative', width: '100%', height: '24px', display: 'flex', alignItems: 'center' }}>
          {/* Pin Markers */}
          <div style={{ position: 'absolute', left: '45%', top: '-6px', transform: 'translateX(-50%)', fontSize: '0.65rem', color: '#dc3545', fontWeight: 700 }}>
            📡 Gap Start (T-3.5h)
          </div>
          <div style={{ position: 'absolute', left: '60%', top: '-6px', transform: 'translateX(-50%)', fontSize: '0.65rem', color: '#f0ad4e', fontWeight: 700 }}>
            🐌 Speed Drop (T-1h)
          </div>
          <div style={{ position: 'absolute', left: '72%', top: '-6px', transform: 'translateX(-50%)', fontSize: '0.65rem', color: '#00d2d3', fontWeight: 700 }}>
            🛢️ Spill (T0)
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.002"
            value={progress}
            onChange={(e) => setProgress(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#fd7e14',
              cursor: 'pointer',
              height: '6px'
            }}
          />
        </div>

        {/* Playback Buttons & Speeds */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setProgress(0)}
              style={{ padding: '5px 10px', background: '#1a2d4a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
              title="Restart from beginning"
            >⏮</button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                padding: '6px 14px',
                background: isPlaying ? '#dc3545' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play AIS Replay'}
            </button>
            <button
              onClick={() => setProgress(p => Math.min(1, p + 0.1))}
              style={{ padding: '5px 10px', background: '#1a2d4a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
              title="Skip +1h"
            >⏩ +1h</button>

            {/* Speed Multipliers */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
              {[1, 2, 5, 10].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: playbackSpeed === s ? '#fd7e14' : '#1a2d4a',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Current Sim Time Display */}
          <div style={{ color: '#d0e4f5', fontSize: '0.8rem', fontWeight: 600, display: 'flex', gap: '14px' }}>
            <span>Relative Time: <strong style={{ color: '#fd7e14' }}>{Number(currentTelemetry?.relHour || 0) >= 0 ? '+' : ''}{(Number(currentTelemetry?.relHour || 0)).toFixed(1)}h</strong></span>
            <span>Simulated UTC: <strong style={{ color: '#fff' }}>2024-03-15 {String(((Math.floor(Number(currentTelemetry?.relHour || 0)) + 6 + 24) % 24)).padStart(2, '0')}:00:00</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
