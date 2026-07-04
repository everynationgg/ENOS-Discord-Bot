'use client';

import { useEffect, useState } from 'react';

export default function SystemOpsPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pruneStatus, setPruneStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch('/api/system/health')
      .then((r) => r.json())
      .then((h) => {
        setHealth(h);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const triggerPrune = async () => {
    setPruneStatus('running');
    const res = await fetch('/api/system/prune', { method: 'POST' });
    setPruneStatus(res.ok ? 'done' : 'error');
    setTimeout(() => setPruneStatus('idle'), 4000);
  };

  const isOnline = health?.last_seen
    ? Date.now() - new Date(health.last_seen).getTime() < 10 * 60 * 1000
    : false;

  const lastHeartbeatTime = health?.last_seen
    ? new Date(health.last_seen).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })
    : '—';

  const lastHeartbeatDate = health?.last_seen
    ? new Date(health.last_seen).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
    : 'Never connected';

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36 }} /></div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>⚙️ System Ops</h1>
        <p>Monitor bot health, manage scheduled jobs, and configure the database cleanup pruner.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">System Ops</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-sys-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
            id="sidebar-sys-health"
          >
            ⚡ Bot Health & Heartbeat
          </button>
          <button
            className={`sidebar-item ${activeTab === 'pruner' ? 'active' : ''}`}
            onClick={() => setActiveTab('pruner')}
            id="sidebar-sys-pruner"
          >
            🗑️ Pruner Operations
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>System Operations & Diagnostics</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Monitor connection health status, trigger cleanups, and manage high-level operations.
              </p>

              <div className="overview-item">
                <h3>⚡ Bot Health & Heartbeat</h3>
                <p>Monitor status heartbeats, check client version metadata, and trace automated cron job flags.</p>
              </div>

              <div className="overview-item">
                <h3>🗑️ Pruner Operations</h3>
                <p>Manually clean up database storage logs and delete message records older than 30 days.</p>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Bot Diagnostics & Health</h3>
                <p>This panel displays active metadata and connection heartbeats received from the bot client.</p>
                <ul>
                  <li><strong>Bot Connection</strong>: Displays online state. The client updates a heartbeat timestamp in the database once every 5 minutes.</li>
                  <li><strong>Last Heartbeat</strong>: The exact Manila/PST time the bot client was last seen.</li>
                  <li><strong>Cron Jobs</strong>: Confirms whether background schedulers are actively processing recurring tasks.</li>
                </ul>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ margin: 0 }}>System Monitor</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Bot Connection</div>
                    <div className="stat-card-value" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Heartbeat: every 5 min</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Last Heartbeat</div>
                    <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>{lastHeartbeatTime}</div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>{lastHeartbeatDate}</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Bot Version</div>
                    <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{health?.bot_version || '—'}</div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Running on Railway</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Cron Jobs</div>
                    <div className="stat-card-value" style={{ fontSize: '0.875rem' }}><span className="badge badge-active" style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>Running</span></div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Digest · LFG Expiry · Prune</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pruner' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Database Pruning Operations</h3>
                <p>Optimize storage records and comply with data retention limits.</p>
                <ul>
                  <li><strong>Auto Pruning</strong>: Deletes expired chat traces older than 30 days automatically.</li>
                  <li><strong>Manual Prune</strong>: Forcing a manual prune instantly scans database logs and clears expired items.</li>
                </ul>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Storage Management</h3>
                <div className="stat-card" style={{ margin: 0 }}>
                  <div className="stat-card-label">Data Pruning Cleanup</div>
                  <div className="stat-card-value" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                    <button
                      className={`btn btn-sm ${pruneStatus === 'running' ? 'btn-secondary' : pruneStatus === 'done' ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={triggerPrune}
                      disabled={pruneStatus === 'running'}
                      id="prune-now-btn"
                    >
                      {pruneStatus === 'running' ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Pruning...</>
                       : pruneStatus === 'done' ? '✅ Done'
                       : pruneStatus === 'error' ? '❌ Failed'
                       : '🗑️ Prune Now'}
                    </button>
                  </div>
                  <div className="stat-card-sub" style={{ marginTop: '0.5rem' }}>Clears message logs and entries older than 30 days.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
