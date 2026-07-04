'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function DashboardHome() {
  const { data: session, status } = useSession();
  const [health, setHealth] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (status !== 'authenticated') return;

    const guildId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('guild_id') || '' : '';
    const query = guildId ? `?guild_id=${guildId}` : '';

    Promise.all([
      fetch(`/api/system/health${query}`).then((r) => r.json()),
      fetch(`/api/config${query}`).then((r) => r.json()),
    ])
      .then(([healthData, configMap]) => {
        setHealth(healthData);
        const list = Object.entries(configMap).map(([key, val]: [string, any]) => ({
          feature_key: key,
          enabled: val.enabled,
          updated_at: val.updated_at || new Date().toISOString(),
        }));
        setConfigs(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36 }} /></div>
      </div>
    );
  }

  const enabledCount = configs.filter((c) => c.enabled).length;
  const isOnline = health?.last_seen
    ? Date.now() - new Date(health.last_seen).getTime() < 10 * 60 * 1000
    : false;

  const lastSeen = health?.last_seen
    ? new Date(health.last_seen).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    : 'Never';

  const rawGuildId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('guild_id') || process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || '' : '';

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🏰 Every Nation — ENOS</h1>
        <p>Bot Configuration Dashboard · Logged in as <strong style={{ color: 'var(--text-primary)' }}>{session?.user?.name}</strong></p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Navigation</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-home-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
            id="sidebar-home-status"
          >
            ⚡ Server Status
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>Welcome to EveryNation Bot Control</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Manage all modules and community engagement utilities for your Discord Server from one dynamic panel.
              </p>

              <div className="overview-item">
                <h3>🛡️ Moderation</h3>
                <p>Configure user verification flows, onboarding logic, dynamic server entry logs, and custom auto-assign roles for new community members.</p>
              </div>

              <div className="overview-item">
                <h3>🎮 Gaming</h3>
                <p>Enable and monitor user LFG (Looking for Group) notifications, configure game-branch channels, and manage vault economy items.</p>
              </div>

              <div className="overview-item">
                <h3>📡 Social</h3>
                <p>Track creator live streams (Twitch/YouTube), customize Gemini AI-powered birthday announcement queues, and configure right-click AI text translation limits.</p>
              </div>

              <div className="overview-item">
                <h3>⚙️ System Ops</h3>
                <p>Check the Discord bot client heartbeat, review machine resource statistics, and prune database storage records.</p>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Understanding Server Status</h3>
                <p>The status monitor displays live diagnostics of the ENOS client connection to your Discord guild.</p>
                <ul>
                  <li><strong>Bot Status</strong>: Reflected as online if the client has sent a heartbeat signal within the last 10 minutes.</li>
                  <li><strong>Active Features</strong>: The count of configuration modules currently toggled ON in your database.</li>
                  <li><strong>Bot Version</strong>: The code version deployed and running on Railway.</li>
                </ul>
                <div className="tip-box">
                  <strong>💡 Locating your Guild ID:</strong><br />
                  Enable Developer Mode in Discord, right-click the server icon on the left navigation list, and select <strong>Copy Server ID</strong>.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Live Status Dashboard</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Bot Status</div>
                    <div className="stat-card-value" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Last: {lastSeen}</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Active Features</div>
                    <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{enabledCount}</div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>of {configs.length} configured</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Bot Version</div>
                    <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{health?.bot_version || '—'}</div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Running on Railway</div>
                  </div>

                  <div className="stat-card" style={{ margin: 0 }}>
                    <div className="stat-card-label">Guild ID</div>
                    <div className="stat-card-value" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {rawGuildId ? `${rawGuildId.slice(0, 10)}…` : '—'}
                    </div>
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Every Nation Server</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.75rem' }}>Feature Status Overview</h4>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                            No features configured yet.
                          </td>
                        </tr>
                      ) : (
                        configs.map((cfg) => (
                          <tr key={cfg.feature_key}>
                            <td style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                              {cfg.feature_key.replace(/_/g, ' ')}
                            </td>
                            <td>
                              <span className={`badge ${cfg.enabled ? 'badge-active' : 'badge-inactive'}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>
                                {cfg.enabled ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
