import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const ROLE_LABELS = {
  coast_guard: 'Coast Guard',
  regional_manager: 'Regional Manager',
  higher_authority: 'Higher Authority',
};

export default function DashboardLayout({ children, title, navItems = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🛢️ OSDS</h1>
          <div className="subtitle">Oil Spill Detection System</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={item.active ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                item.onClick?.();
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}

          <div style={{ borderTop: '1px solid #1a2d4a', margin: '12px 0' }} />

          <a href="/" style={{ color: '#a8c8e8' }}>
            <span>🌍</span>
            <span>Public Dashboard</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="name">{user?.username || 'Unknown'}</div>
              <div className="role">{ROLE_LABELS[user?.role] || user?.role}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: '12px', color: '#a8c8e8', borderColor: '#1a2d4a' }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <h2>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.assigned_region && (
              <span className="badge badge-detected" style={{ fontSize: '0.6875rem' }}>
                📍 {user.assigned_region.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
              {new Date().toLocaleDateString('en-IN', { 
                day: 'numeric', month: 'short', year: 'numeric' 
              })}
            </span>
          </div>
        </div>
        <div className="page-body">
          {children}
        </div>
      </main>
    </div>
  );
}
