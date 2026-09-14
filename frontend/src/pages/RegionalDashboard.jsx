import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../auth/AuthContext';
import { spillsAPI, dashboardAPI, vesselsAPI, reportsAPI } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import MapView from '../components/map/MapView';

const SEVERITY_COLORS = {
  critical: '#dc3545', high: '#fd7e14', medium: '#f0ad4e', low: '#28a745', unknown: '#9ca3af'
};

export default function RegionalDashboard() {
  const { user } = useAuth();
  const region = user?.assigned_region || 'west_coast';
  const [activeSection, setActiveSection] = useState('overview');
  const [period, setPeriod] = useState('all'); // 'day', 'week', 'month', 'all'
  const [stats, setStats] = useState(null);
  const [spills, setSpills] = useState([]);
  const [classification, setClassification] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, spillsRes, classRes] = await Promise.all([
        dashboardAPI.getRegionStats(region).catch(() => ({ data: null })),
        spillsAPI.list({ region }).catch(() => ({ data: { spills: [] } })),
        vesselsAPI.getClassification().catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setSpills(spillsRes.data.spills || []);
      setClassification(classRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (spillId) => {
    setDownloading(true);
    try {
      const res = await reportsAPI.downloadPDF(spillId);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-spill-${spillId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const severityData = stats?.severity_breakdown
    ? Object.entries(stats.severity_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const filteredSpills = spills.filter(s => {
    if (period === 'all') return true;
    if (!s.detected_at) return true;
    const dt = new Date(s.detected_at);
    const now = new Date();
    const diffDays = (now - dt) / (1000 * 60 * 60 * 24);
    if (period === 'day') return diffDays <= 1;
    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    return true;
  });

  const navItems = [
    { id: 'overview', icon: '', label: 'Region Overview', active: activeSection === 'overview', onClick: () => setActiveSection('overview') },
    { id: 'map', icon: '', label: 'Regional Map', active: activeSection === 'map', onClick: () => setActiveSection('map') },
    { id: 'spills', icon: '', label: 'Spills', active: activeSection === 'spills', onClick: () => setActiveSection('spills') },
    { id: 'vessels', icon: '', label: 'Vessel Classification', active: activeSection === 'vessels', onClick: () => setActiveSection('vessels') },
    { id: 'reports', icon: '', label: 'Reports', active: activeSection === 'reports', onClick: () => setActiveSection('reports') },
  ];

  if (loading) {
    return (
      <DashboardLayout title={`Regional Manager — ${region.replace(/_/g, ' ')}`} navItems={navItems}>
        <div className="loading-spinner"><div className="spinner" /><p>Loading region data...</p></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Regional Manager — ${region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`} navItems={navItems}>
      {activeSection === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Spills (Region)</div>
              <div className="stat-value">{stats?.total_spills || 0}</div>
            </div>
            <div className="stat-card stat-low">
              <div className="stat-label">Confirmed</div>
              <div className="stat-value">{stats?.confirmed_spills || 0}</div>
            </div>
            <div className="stat-card stat-high">
              <div className="stat-label">Total Affected Area</div>
              <div className="stat-value">{stats?.total_area_sq_km?.toFixed(1) || '0'} <span className="stat-unit">km²</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Ecological Sensitivity</div>
              <div className="stat-value">{stats?.avg_ecological_sensitivity?.toFixed(0) || '0'}<span className="stat-unit">/100</span></div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Severity Distribution</h3></div>
              <div className="card-body">
                {severityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={severityData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}
                        label={({ name, value }) => `${name}: ${value}`}>
                        {severityData.map((e) => (
                          <Cell key={e.name} fill={SEVERITY_COLORS[e.name] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No data</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>Vessel Types in Region</h3></div>
              <div className="card-body">
                {classification.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={classification.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                      <XAxis dataKey="vessel_type" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0a1628" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No classification data</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Regional Spill Map Section */}
      {activeSection === 'map' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>Regional Map — {region.replace(/_/g, ' ').toUpperCase()}</h3>
              <p style={{ fontSize: '0.75rem', color: '#6b9fd4', margin: '2px 0 0 0' }}>
                Showing {filteredSpills.length} spill incident{filteredSpills.length === 1 ? '' : 's'} detected in your jurisdiction
              </p>
            </div>
            {/* Period Selector */}
            <div style={{ display: 'inline-flex', background: '#0a1628', padding: '3px', borderRadius: '8px', border: '1px solid #1e3a5f', gap: '3px' }}>
              {[
                { id: 'day', label: 'Last 24h' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'Last 30 Days' },
                { id: 'all', label: 'All Time' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: period === p.id ? 700 : 500,
                    backgroundColor: period === p.id ? '#2563eb' : 'transparent',
                    color: period === p.id ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <MapView
              spills={filteredSpills}
              regionPreset={region}
              viewMode="regional"
              allowNational={false}
              height="600px"
            />
          </div>
        </div>
      )}


      {activeSection === 'spills' && (
        <div className="card">
          <div className="card-header"><h3>Spills in {region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Spill</th><th>Detected</th><th>Severity</th><th>Area</th><th>Status</th><th>Age</th></tr>
              </thead>
              <tbody>
                {spills.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontSize: '0.75rem' }}>{s.detected_at ? new Date(s.detected_at).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                    <td>{s.area_sq_km?.toFixed(1)} km²</td>
                    <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                    <td>{s.age_estimate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'vessels' && (
        <div className="card">
          <div className="card-header"><h3>Vessel Classification Lookup</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Vessel Type</th><th>Count</th><th>Vessels</th></tr>
              </thead>
              <tbody>
                {classification.map((c) => (
                  <tr key={c.vessel_type}>
                    <td><span className="badge badge-detected" style={{ fontWeight: 600 }}>{c.vessel_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.count}</td>
                    <td style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                      {c.vessel_names?.slice(0, 5).join(', ')}
                      {c.vessel_names?.length > 5 && ` +${c.vessel_names.length - 5} more`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'reports' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Report Generation</h3>
          <div className="card">
            <div className="card-header"><h3>Generate PDF Evidence Report</h3></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Spill</th><th>Severity</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {spills.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                      <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" disabled={downloading}
                          onClick={() => handleDownloadReport(s.id)}>
                          {downloading ? 'Generating...' : 'Download PDF'}
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
    </DashboardLayout>
  );
}
