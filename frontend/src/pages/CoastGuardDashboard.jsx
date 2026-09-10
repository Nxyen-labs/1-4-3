import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { spillsAPI, attributionAPI, driftAPI, vesselsAPI } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import MapView, { detectSectorForSpill } from '../components/map/MapView';
import ShipDriftAnimation from '../components/map/ShipDriftAnimation';
import DataUploadSection from '../components/upload/DataUploadSection';

const ANOMALY_ICONS = {
  speed_drop: '🐌', ais_gap: '📡', course_change: '↩️', route_deviation: '🔀'
};

const ANOMALY_LABELS = {
  speed_drop: 'Speed Drop', ais_gap: 'AIS Gap', course_change: 'Course Change', route_deviation: 'Route Deviation'
};

export default function CoastGuardDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [spills, setSpills] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [selectedSpill, setSelectedSpill] = useState(null);
  const [driftData, setDriftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSuspects, setLoadingSuspects] = useState(false);
  const [validating, setValidating] = useState(null);
  const [tacticalSector, setTacticalSector] = useState('mumbai');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [spillsRes, anomalyRes] = await Promise.all([
        spillsAPI.list().catch(() => ({ data: { spills: [] } })),
        attributionAPI.getAnomalyFeed().catch(() => ({ data: [] })),
      ]);
      const fetchedSpills = spillsRes.data.spills || [];
      setSpills(fetchedSpills);
      setAnomalies(anomalyRes.data || []);

      // Auto-select first spill or keep current selection
      if (fetchedSpills.length > 0) {
        const activeSpill = selectedSpill ? (fetchedSpills.find(s => s.id === selectedSpill.id) || fetchedSpills[0]) : fetchedSpills[0];
        setSelectedSpill(activeSpill);
        loadSpillDetails(activeSpill.id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpillDetails = async (spillId) => {
    setLoadingSuspects(true);
    try {
      const [suspectsRes, backwardRes, forwardRes] = await Promise.all([
        attributionAPI.getSuspects(spillId).catch(() => ({ data: [] })),
        driftAPI.getBackward(spillId).catch(() => ({ data: null })),
        driftAPI.getForward(spillId).catch(() => ({ data: null })),
      ]);
      setSuspects(suspectsRes.data || []);
      setDriftData({
        backward: backwardRes?.data,
        forward: forwardRes?.data,
      });

      // Automatically focus sector zoom to the spill's area
      const target = spills.find(s => s.id === spillId) || selectedSpill;
      if (target?.centroid_lat && target?.centroid_lon) {
        setTacticalSector(detectSectorForSpill(target.centroid_lat, target.centroid_lon));
      }
    } catch (err) {
      console.error('Error loading spill details:', err);
    } finally {
      setLoadingSuspects(false);
    }
  };

  const handleRunAttribution = async (spillId) => {
    if (!spillId) return;
    setLoadingSuspects(true);
    try {
      const res = await attributionAPI.evaluateSuspects(spillId);
      if (res.data) {
        setSuspects(res.data);
      }
    } catch (err) {
      console.error('Error running attribution:', err);
    } finally {
      setLoadingSuspects(false);
    }
  };

  const handleValidate = async (spillId, status) => {
    setValidating(spillId);
    try {
      await spillsAPI.validate(spillId, status);
      // Refresh
      const res = await spillsAPI.list();
      setSpills(res.data.spills || []);
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(null);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await attributionAPI.acknowledgeAnomaly(id);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview', active: activeSection === 'overview', onClick: () => setActiveSection('overview') },
    { id: 'animation', icon: '🎬', label: 'Ship & Drift Replay', active: activeSection === 'animation', onClick: () => setActiveSection('animation') },
    { id: 'map', icon: '🗺️', label: 'Tactical Map', active: activeSection === 'map', onClick: () => setActiveSection('map') },
    { id: 'suspects', icon: '🚢', label: 'Suspect Vessels', active: activeSection === 'suspects', onClick: () => setActiveSection('suspects') },
    { id: 'anomalies', icon: '🔔', label: 'Anomaly Alerts', active: activeSection === 'anomalies', onClick: () => setActiveSection('anomalies') },
    { id: 'validation', icon: '✅', label: 'Spill Validation', active: activeSection === 'validation', onClick: () => setActiveSection('validation') },
    { id: 'drift', icon: '🌊', label: 'Drift Analysis', active: activeSection === 'drift', onClick: () => setActiveSection('drift') },
    { id: 'upload', icon: '🛰️', label: 'Upload SAR Satellite Image', active: activeSection === 'upload', onClick: () => setActiveSection('upload') },
  ];

  if (loading) {
    return (
      <DashboardLayout title="Coast Guard Operations" navItems={navItems}>
        <div className="loading-spinner"><div className="spinner" /><p>Loading operational data...</p></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Coast Guard Operations" navItems={navItems}>
      {/* Overview Section */}
      {activeSection === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Active Spills</div>
              <div className="stat-value">{spills.filter(s => s.validation_status !== 'false_positive').length}</div>
            </div>
            <div className="stat-card stat-critical">
              <div className="stat-label">Unread Alerts</div>
              <div className="stat-value">{anomalies.length}</div>
            </div>
            <div className="stat-card stat-high">
              <div className="stat-label">Top Suspect Score</div>
              <div className="stat-value">{suspects[0]?.total_score?.toFixed(0) || '—'}<span className="stat-unit">/100</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Validation</div>
              <div className="stat-value">{spills.filter(s => s.validation_status === 'detected').length}</div>
            </div>
          </div>

          {/* Quick Action Replay Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #111d35 0%, #1a3a5c 100%)',
            border: '1px solid #2d4a6e', borderRadius: '10px', padding: '14px 20px',
            marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                🎬 4D Ship & Hydrodynamic Drift Reconstruction Ready
              </div>
              <div style={{ color: '#a8c8e8', fontSize: '0.8rem', marginTop: '2px' }}>
                Replay AIS track of suspect tanker MT ARABIAN GLORY, transponder gap, speed drop, and origin probability cone.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setActiveSection('animation')}
              >
                ▶ Launch AIS Replay →
              </button>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>🗺️ Live Maritime Operations Map</h3>
                <span style={{ fontSize: '0.75rem', color: '#6b9fd4' }}>Dedicated sector zoom — Click slick or vessel for telemetry</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <MapView
                spills={spills}
                selectedSpill={selectedSpill}
                suspects={suspects}
                driftData={driftData}
                onSelectSpill={(s) => { setSelectedSpill(s); loadSpillDetails(s.id); }}
                regionPreset={tacticalSector}
                viewMode="tactical"
                allowNational={false}
                height="560px"
              />
            </div>
          </div>

          {/* Spill List */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header"><h3>Detected Spills in Your Area</h3></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Spill</th><th>Severity</th><th>Area</th><th>Age</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {spills.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer', background: selectedSpill?.id === s.id ? '#eaf2fa' : undefined }}
                      onClick={() => { setSelectedSpill(s); loadSpillDetails(s.id); }}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className={`badge badge-${s.severity || 'low'}`}>{(s.severity || 'Unknown').toUpperCase()}</span></td>
                      <td>{s.area_sq_km?.toFixed(1)} km²</td>
                      <td>{s.age_estimate || '—'}</td>
                      <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedSpill(s); loadSpillDetails(s.id); setActiveSection('suspects'); }}>
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Ship & Drift 4D Animation Section */}
      {activeSection === 'animation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎬 4D Ship AIS Trajectory & Hydrodynamic Drift Reconstruction
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#6b9fd4', marginTop: '4px' }}>
                  Tracing {selectedSpill?.name || 'SPILL-20240315-001'} backward origin probability cone + vessel transponder behavior
                </div>
              </div>
              <span className="badge badge-critical" style={{ fontSize: '0.75rem' }}>
                Replay Mode: Active
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <ShipDriftAnimation
                spill={selectedSpill}
                suspects={suspects}
                driftData={driftData}
                height="620px"
              />
            </div>
          </div>

          {/* Key Behavioral Anomaly Findings */}
          <div className="card">
            <div className="card-header">
              <h3>🔍 Automated AIS Behavioral Correlation Findings</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#fdf0f1', border: '1px solid #dc3545', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#dc3545', marginBottom: '4px' }}>📡 75-Min AIS Transponder Gap</div>
                  <p style={{ fontSize: '0.75rem', color: '#333', margin: 0 }}>
                    MT ARABIAN GLORY stopped transmitting AIS 3.5h prior to detection precisely when crossing the estimated backward origin cone.
                  </p>
                </div>
                <div style={{ background: '#fffbf0', border: '1px solid #f0ad4e', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#b7791f', marginBottom: '4px' }}>🐌 Speed Drop to 3.5 Knots</div>
                  <p style={{ fontSize: '0.75rem', color: '#333', margin: 0 }}>
                    Vessel speed dropped from cruising 13.8 kn to 3.5 kn for 45 minutes near origin centroid (consistent with illicit oily bilge wash discharge).
                  </p>
                </div>
                <div style={{ background: '#eaf2fa', border: '1px solid #4a7ab5', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#1a2d4a', marginBottom: '4px' }}>↩️ 120° Course Deviation</div>
                  <p style={{ fontSize: '0.75rem', color: '#333', margin: 0 }}>
                    Upon resuming transponder broadcast, heading turned sharply from 215° to 335°, departing standard traffic separation schemes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tactical Map Section */}
      {activeSection === 'map' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0 }}>🗺️ Tactical Maritime Patrol Map</h3>
              <span style={{ fontSize: '0.75rem', color: '#6b9fd4' }}>Dedicated area zoom — Zero country-wide clutter</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'mumbai', label: 'Mumbai Area' },
                { id: 'gujarat', label: 'Gujarat Area' },
                { id: 'goa_konkan', label: 'Goa & Konkan Area' },
                { id: 'kerala', label: 'Kerala Area' },
                { id: 'tamil_nadu', label: 'Tamil Nadu Area' },
                { id: 'andhra_odisha', label: 'Andhra & Odisha Area' },
                { id: 'bengal', label: 'Bengal Area' },
                { id: 'andaman_area', label: 'Andaman Area' },
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setTacticalSector(sec.id)}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer',
                    background: tacticalSector === sec.id ? '#0284c7' : '#0b1626',
                    color: tacticalSector === sec.id ? '#fff' : '#94a3b8',
                    border: tacticalSector === sec.id ? '1px solid #38bdf8' : '1px solid #1a2d4a',
                  }}
                >
                  {sec.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <MapView
              spills={spills}
              selectedSpill={selectedSpill}
              suspects={suspects}
              driftData={driftData}
              onSelectSpill={(s) => { setSelectedSpill(s); loadSpillDetails(s.id); }}
              regionPreset={tacticalSector}
              viewMode="tactical"
              allowNational={false}
              height="620px"
            />
          </div>
        </div>
      )}

      {/* Suspect Vessels Section */}
      {activeSection === 'suspects' && (
        <>
          {/* Incident Selector Ribbon */}
          <div className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b9fd4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 Target Spill Incident
                </span>
                <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: '2px 0 0 0' }}>
                  {selectedSpill?.name || 'Select a spill to evaluate candidate vessels'}
                </h3>
              </div>

              {selectedSpill && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  onClick={() => handleRunAttribution(selectedSpill.id)}
                  disabled={loadingSuspects}
                >
                  {loadingSuspects ? '⏳ Evaluating...' : '⚡ Re-run Attribution Engine'}
                </button>
              )}
            </div>

            {/* Spill Incident Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {spills.map((s) => {
                const isSelected = selectedSpill?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSpill(s);
                      loadSpillDetails(s.id);
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      background: isSelected ? '#1e3a5f' : '#0b1626',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      border: isSelected ? '1px solid #4a7ab5' : '1px solid #1a2d4a',
                      boxShadow: isSelected ? '0 2px 8px rgba(74, 122, 181, 0.25)' : 'none'
                    }}
                  >
                    <span>🛰️ {s.name}</span>
                    <span className={`badge badge-${s.severity || 'high'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {(s.severity || 'high').toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Spill Telemetry Strip */}
            {selectedSpill && (
              <div style={{
                marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1a2d4a',
                display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#a8c8e8'
              }}>
                <span>📍 Location: <strong>{(selectedSpill.centroid_lat || 18.85).toFixed(2)}°N, {(selectedSpill.centroid_lon || 71.90).toFixed(2)}°E</strong></span>
                <span>🌊 Area: <strong>{(selectedSpill.area_sq_km || 12.5).toFixed(1)} km²</strong></span>
                <span>🛡️ Region: <strong>{(selectedSpill.region || 'West Coast').replace(/_/g, ' ').toUpperCase()}</strong></span>
                <span>⏳ Age: <strong>{selectedSpill.age_estimate || 'fresh'}</strong></span>
                <span>🔍 Status: <strong>{selectedSpill.validation_status || 'detected'}</strong></span>
              </div>
            )}
          </div>

          <div className="disclaimer-banner" style={{ marginBottom: '16px' }}>
            <span>⚠️</span>
            <span>These are <strong>candidate vessels</strong> ranked by attribution likelihood (proximity to backward drift cone, AIS transponder gaps, speed drops, and route deviations) — NOT confirmed culprits. Further maritime boarding and forensic verification required.</span>
          </div>

          {/* Loading Indicator */}
          {loadingSuspects ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b9fd4', fontSize: '0.88rem', fontWeight: 600 }}>
                  Analyzing AIS vessel tracking logs & CMEMS hydrodynamic backward drift origin cone...
                </p>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Correlating transponder timestamps, speed anomalies, and course alterations
                </span>
              </div>
            </div>
          ) : suspects.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '36px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚢</div>
                <h4 style={{ color: '#fff', marginBottom: '6px' }}>No Candidate Vessels Evaluated Yet</h4>
                <p style={{ fontSize: '0.82rem', maxWidth: '500px', margin: '0 auto 16px', color: '#a8c8e8' }}>
                  No candidate vessels are currently cached for <strong>{selectedSpill?.name || 'this incident'}</strong>. Click below to execute the multi-factor AIS attribution engine against commercial traffic.
                </p>
                {selectedSpill && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRunAttribution(selectedSpill.id)}
                    style={{ fontWeight: 700 }}
                  >
                    ⚡ Run Multi-Factor AIS Attribution Now
                  </button>
                )}
              </div>
            </div>
          ) : (
            suspects.map((s, idx) => {
              const summaryText = typeof s.explanation === 'string'
                ? s.explanation
                : (s.explanation?.summary || s.explanation?.proximity?.detail || 'Multi-factor AIS correlation detected within probable origin cone.');

              const rankBg = idx === 0 ? '#dc3545' : idx === 1 ? '#ea580c' : '#0284c7';

              return (
                <div key={s.id} className="card" style={{ marginBottom: '14px', border: idx === 0 ? '1px solid #dc3545' : '1px solid #1a2d4a' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', borderRadius: '50%', background: rankBg,
                        color: '#fff', fontSize: '0.75rem', fontWeight: 800
                      }}>#{s.rank}</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{s.vessel_name || 'Unknown Vessel'}</span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>({s.vessel_mmsi})</span>
                        </h3>
                        <div style={{ fontSize: '0.72rem', color: '#6b9fd4', marginTop: '1px' }}>
                          Flag: <strong>{s.vessel_flag || 'International'}</strong> • Type: <strong>{s.vessel_type || 'Tanker'}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge badge-detected">{s.vessel_type}</span>
                      <span style={{
                        fontWeight: 800, fontSize: '1.15rem',
                        color: (s.total_score || 0) >= 70 ? '#ef4444' : (s.total_score || 0) >= 40 ? '#f97316' : '#38bdf8'
                      }}>
                        {s.total_score?.toFixed(1)}<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/100</span>
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    {/* Confidence Track */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Attribution Confidence</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{((s.confidence || 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="confidence-track" style={{ background: '#0b1626', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          className="confidence-fill"
                          style={{
                            width: `${(s.confidence || 0) * 100}%`,
                            background: (s.confidence || 0) > 0.7 ? 'linear-gradient(90deg, #ea580c, #dc2626)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                            height: '100%',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>

                    {/* Factor Breakdown Grid */}
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                      Explainable Factor Decomposition:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { label: 'Proximity to Origin', score: s.proximity_score, weight: '25%' },
                        { label: 'Time Overlap', score: s.time_overlap_score, weight: '20%' },
                        { label: 'AIS Signal Gap', score: s.ais_gap_score, weight: '20%' },
                        { label: 'Speed Anomaly', score: s.speed_anomaly_score, weight: '15%' },
                        { label: 'Course Alteration', score: s.course_anomaly_score, weight: '10%' },
                        { label: 'Route Deviation', score: s.route_deviation_score, weight: '10%' },
                      ].map((f) => (
                        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#081322', padding: '6px 10px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.7rem', width: '115px', color: '#94a3b8' }}>{f.label}</span>
                          <div className="score-bar" style={{ flex: 1, height: '6px', background: '#132338', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${f.score || 0}%`,
                                height: '100%',
                                background: (f.score || 0) > 70 ? '#dc2626' : (f.score || 0) > 40 ? '#f97316' : '#0284c7',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, width: '32px', textAlign: 'right', color: '#fff' }}>{f.score?.toFixed(0) || 0}</span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', width: '26px' }}>{f.weight}</span>
                        </div>
                      ))}
                    </div>

                    {/* Human-Readable Explanation Box */}
                    <div style={{
                      padding: '10px 14px', background: '#0b1b30',
                      borderLeft: `3px solid ${rankBg}`, borderRadius: '4px',
                      fontSize: '0.78rem', color: '#d0e4f5', lineHeight: '1.4'
                    }}>
                      <strong style={{ color: '#fff' }}>Attribution Narrative: </strong>
                      {summaryText}
                    </div>

                    {/* Operational Action Buttons */}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setActiveSection('map')}
                      >
                        🗺️ View on Tactical Map
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setActiveSection('animation')}
                      >
                        🎬 Launch AIS Replay
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setActiveSection('anomalies')}
                      >
                        🔔 Check Anomaly Feed
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Anomaly Alerts Section */}
      {activeSection === 'anomalies' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>
            🔔 AIS Anomaly Alerts <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({anomalies.length} unacknowledged)</span>
          </h3>
          <div className="anomaly-feed">
            {anomalies.length === 0 ? (
              <div className="card"><div className="card-body" style={{ textAlign: 'center', color: '#9ca3af' }}>
                ✅ All anomaly alerts have been acknowledged.
              </div></div>
            ) : (
              anomalies.map((a) => (
                <div key={a.id} className={`anomaly-item ${a.acknowledged ? '' : 'unread'}`}>
                  <div className={`anomaly-icon ${a.anomaly_type}`}>
                    {ANOMALY_ICONS[a.anomaly_type] || '⚠️'}
                  </div>
                  <div className="anomaly-content">
                    <div className="anomaly-title">
                      {ANOMALY_LABELS[a.anomaly_type] || a.anomaly_type} — {a.vessel_name || a.vessel_mmsi}
                    </div>
                    <div className="anomaly-desc">{a.description}</div>
                    <div className="anomaly-time">
                      {a.detected_at ? new Date(a.detected_at).toLocaleString() : '—'} 
                      {a.value && ` | Value: ${a.value} | Threshold: ${a.threshold}`}
                    </div>
                  </div>
                  {!a.acknowledged && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAcknowledge(a.id)}>
                      Acknowledge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Validation Section */}
      {activeSection === 'validation' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>✅ Spill Review & Validation</h3>
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Spill</th><th>Severity</th><th>Area</th><th>Status</th><th>Validate</th></tr>
                </thead>
                <tbody>
                  {spills.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                      <td>{s.area_sq_km?.toFixed(1)} km²</td>
                      <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-success btn-sm"
                            disabled={validating === s.id || s.validation_status === 'confirmed'}
                            onClick={() => handleValidate(s.id, 'confirmed')}>
                            ✓ Confirm
                          </button>
                          <button className="btn btn-danger btn-sm"
                            disabled={validating === s.id || s.validation_status === 'false_positive'}
                            onClick={() => handleValidate(s.id, 'false_positive')}>
                            ✕ False Positive
                          </button>
                          <button className="btn btn-warning btn-sm"
                            disabled={validating === s.id || s.validation_status === 'needs_review'}
                            onClick={() => handleValidate(s.id, 'needs_review')}>
                            ? Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Drift Analysis Section */}
      {activeSection === 'drift' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>
            🌊 Drift Analysis — {selectedSpill?.name || 'Select a spill'}
          </h3>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>⏪ Backward Drift (Origin Trace)</h3></div>
              <div className="card-body">
                {driftData?.backward ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '12px' }}>
                      Simulated {driftData.backward.duration_hours}h backward from detection point.
                      Method: {driftData.backward.parameters?.method || 'euler_advection'}
                    </div>
                    <div className="disclaimer-banner" style={{ marginBottom: '12px' }}>
                      <span>📍</span>
                      <span>Origin shown as a <strong>probability cone</strong> — not a single confident point. Multiple origin locations are plausible.</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={(driftData.backward.trajectory_points || []).filter((_, i) => i % 4 === 0).map((p, i) => ({
                        hour: `T-${(driftData.backward.duration_hours || 24) - i * 4}h`,
                        probability: (p.probability * 100).toFixed(0),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                        <YAxis label={{ value: 'Prob %', angle: -90, fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="probability" fill="#4a7ab5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <p style={{ color: '#9ca3af', textAlign: 'center' }}>No backward drift data available</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>⏩ Forward Drift (Prediction)</h3></div>
              <div className="card-body">
                {driftData?.forward ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '12px' }}>
                      Predicted {driftData.forward.duration_hours}h forward from current position.
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={(driftData.forward.trajectory_points || []).filter((_, i) => i % 6 === 0).map((p, i) => ({
                        hour: `T+${i * 6}h`,
                        probability: (p.probability * 100).toFixed(0),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                        <YAxis label={{ value: 'Conf %', angle: -90, fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="probability" fill="#28a745" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <p style={{ color: '#9ca3af', textAlign: 'center' }}>No forward drift data available</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Real Data Upload Hub */}
      {activeSection === 'upload' && (
        <DataUploadSection onUploadSuccess={loadData} />
      )}
    </DashboardLayout>
  );
}
