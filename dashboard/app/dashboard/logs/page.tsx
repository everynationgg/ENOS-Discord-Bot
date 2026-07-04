'use client';

import { useEffect, useState } from 'react';

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'verification', label: '🔐 Verifications' },
  { value: 'lfg_create', label: '🎮 LFG Sessions' },
  { value: 'coin_award', label: '💰 Coin Awards' },
  { value: 'tier_promotion', label: '⬆️ Tier Promotions' },
  { value: 'live_alert', label: '🔴 Live Alerts' },
  { value: 'digest', label: '📋 Digest Posts' },
];

const EVENT_ICONS: Record<string, string> = {
  verification: '🔐', lfg_create: '🎮', coin_award: '💰',
  tier_promotion: '⬆️', live_alert: '🔴', digest: '📋',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchLogs = (type: string) => {
    setLoading(true);
    const params = type ? `?type=${type}&limit=100` : '?limit=100';
    fetch(`/api/logs${params}`)
      .then((r) => r.json())
      .then((d) => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(''); }, []);

  const handleFilterChange = (type: string) => {
    setFilter(type);
    fetchLogs(type);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📋 Event Logs</h1>
        <p>Real-time audit log of all bot activity — verifications, LFG sessions, coin awards, and more.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Audit Logs</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-logs-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
            id="sidebar-logs-audit"
          >
            📊 Bot Event Logs
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>System Logging & Audit Trails</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Track live bot activity across your Discord server to debug issues and audit usage.
              </p>

              <div className="overview-item">
                <h3>📊 Bot Event Logs</h3>
                <p>Monitor real-time event triggers like member verifications, coin awards, daily digests, and live stream announcements.</p>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Understanding Audit Logs</h3>
                <p>The logs table tracks all asynchronous bot events and database actions.</p>
                <ul>
                  <li><strong>Verifications</strong>: Captured when new members complete onboarding.</li>
                  <li><strong>LFG Sessions</strong>: Created when a user triggers looking-for-group party finder cards.</li>
                  <li><strong>Coin Awards</strong>: Logged when voice or text chat points are calculated.</li>
                  <li><strong>Tier Promotions</strong>: Triggered when user points qualify them for higher ranks.</li>
                  <li><strong>Live Alerts</strong>: Posts logged for streaming announcements.</li>
                  <li><strong>Digest Posts</strong>: Logs from daily scraping runs.</li>
                </ul>
                <div className="tip-box">
                  <strong>💡 Data Retention:</strong><br />
                  Logs older than 30 days are automatically deleted during standard pruner operations.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Filter Bar */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {EVENT_TYPES.map((et) => (
                    <button
                      key={et.value}
                      id={`log-filter-${et.value || 'all'}`}
                      className={`btn btn-xs ${filter === et.value ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleFilterChange(et.value)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      {et.label}
                    </button>
                  ))}
                  <button className="btn btn-secondary btn-xs" style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => fetchLogs(filter)} id="refresh-logs-btn">
                    🔄 Refresh
                  </button>
                </div>

                {/* Logs Table */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {loading ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <div className="spinner" style={{ width: 24, height: 24 }} />
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <div className="empty-state-icon" style={{ fontSize: '1.25rem' }}>📭</div>
                      <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>No logs found</div>
                      <div className="empty-state-desc" style={{ fontSize: '0.75rem' }}>Bot events will appear here as they happen.</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>User</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => (
                            <tr key={log.id}>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {EVENT_ICONS[log.event_type] || '📌'}
                                  <span style={{ textTransform: 'capitalize' }}>{log.event_type.replace(/_/g, ' ')}</span>
                                </span>
                              </td>
                              <td>
                                {log.discord_id ? (
                                  <code style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', background: 'var(--accent-primary-dim)', padding: '0.05rem 0.3rem', borderRadius: 4 }}>
                                    {log.discord_id}
                                  </code>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {new Date(log.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Showing last {logs.length} events.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
