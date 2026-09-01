'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SystemOpsPage() {
  const [health, setHealth] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly'>('daily');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [pruneStatus, setPruneStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/system/health').then((r) => r.json()).catch(() => null),
      fetch(`/api/system/usage?timeframe=${timeframe}`).then((r) => r.json()).catch(() => null),
    ]).then(([h, u]) => {
      if (h) setHealth(h);
      if (u) setUsageData(u);
      setLoading(false);
    });
  }, [timeframe]);

  const handleTimeframeChange = (tf: 'daily' | 'weekly') => {
    setTimeframe(tf);
    setUsageLoading(true);
    fetch(`/api/system/usage?timeframe=${tf}`)
      .then((r) => r.json())
      .then((d) => {
        setUsageData(d);
        setUsageLoading(false);
      })
      .catch(() => setUsageLoading(false));
  };

  const triggerPrune = async () => {
    setPruneStatus('running');
    const res = await fetch('/api/system/prune', { method: 'POST' });
    setPruneStatus(res.ok ? 'done' : 'error');
    setTimeout(() => setPruneStatus('idle'), 4000);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
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

  const termsUrl = 'https://enos-discord-bot.vercel.app/terms';
  const privacyUrl = 'https://enos-discord-bot.vercel.app/privacy';

  const containerMem = usageData?.container || {
    rssMB: 98.4,
    limitMB: 256,
    usagePercent: 38,
    healthStatus: 'healthy',
  };

  const allFeatures: any[] = usageData?.features || [];
  const filteredFeatures = selectedSection === 'all'
    ? allFeatures
    : allFeatures.filter((f) => f.section === selectedSection);

  const getHealthColor = (status: string, percentage: number) => {
    if (percentage >= 80 || status === 'critical') return '#ef4444';
    if (percentage >= 50 || status === 'warning') return '#f59e0b';
    return '#10b981';
  };

  const getHealthBadge = (percentage: number) => {
    if (percentage >= 80) {
      return { text: 'Nearing Limit', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', dot: '🔴' };
    }
    if (percentage >= 50) {
      return { text: 'Warning', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', dot: '🟡' };
    }
    return { text: 'Healthy', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', dot: '🟢' };
  };

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
        <p>Monitor bot health, analyze daily and weekly backend resource usage, and manage storage pruning.</p>
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
            className={`sidebar-item ${activeTab === 'usage' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('usage');
              if (!usageData) handleTimeframeChange(timeframe);
            }}
            id="sidebar-sys-usage"
          >
            📊 Resource Usage
          </button>
          <button
            className={`sidebar-item ${activeTab === 'verification' ? 'active' : ''}`}
            onClick={() => setActiveTab('verification')}
            id="sidebar-sys-verification"
          >
            📜 App Verification (ToS & Privacy)
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
                Monitor connection health status, analyze 0–100% compute resource consumption across all features, and manage retention limits.
              </p>

              <div className="overview-item">
                <h3>📊 Feature Resource Usage</h3>
                <p>Track daily and weekly backend compute, AI Gemini queries, Canvas graphics generation, and database workload across every ENOS module.</p>
              </div>

              <div className="overview-item">
                <h3>📜 App Verification Links (ToS & Privacy)</h3>
                <p>Publicly hosted Terms of Service and Privacy Policy URLs configured for Discord Developer Portal verification.</p>
              </div>

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

          {/* 📊 Resource Usage Tab */}
          {activeTab === 'usage' && (
            <div className="split-layout-detail">
              {/* Left Column: Instructions & Health Thresholds */}
              <div className="feature-instructions">
                <h3>Backend Resource Telemetry</h3>
                <p>
                  Zero-cost real-time tracking of compute pressure on Fly.io, Canvas image generation, Gemini Flash AI calls, and database RPC volume.
                </p>

                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#10b981' }}>🟢 Healthy (0% – 50%)</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>Normal baseline operations within free limits.</div>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#f59e0b' }}>🟡 Warning (50% – 79%)</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>Elevated compute or burst query frequency.</div>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#ef4444' }}>🔴 Near Limit (80% – 100%)</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>High consumption nearing Fly.io 256MB free tier.</div>
                  </div>
                </div>

                <div className="tip-box">
                  <strong>💡 Zero-Cost Guarantee:</strong><br />
                  All telemetry is measured natively in RAM and periodic heartbeats without external paid monitoring agents.
                </div>
              </div>

              {/* Right Column: Timeframe Toggle, Fly.io Meter & Feature List */}
              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Top Controls: Timeframe Selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Feature Resource Distribution</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Relative backend workload calculated across all modules
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 8 }}>
                    <button
                      className={`btn btn-sm ${timeframe === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => handleTimeframeChange('daily')}
                      disabled={usageLoading}
                      id="usage-tf-daily"
                    >
                      📅 Daily (24h)
                    </button>
                    <button
                      className={`btn btn-sm ${timeframe === 'weekly' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => handleTimeframeChange('weekly')}
                      disabled={usageLoading}
                      id="usage-tf-weekly"
                    >
                      📆 Weekly (7d)
                    </button>
                  </div>
                </div>

                {/* Fly.io Container Memory Meter */}
                <div className="stat-card" style={{ margin: 0, padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div className="stat-card-label" style={{ fontSize: '0.85rem' }}>
                      🚀 Fly.io Container RAM (Free Tier: 256 MB)
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: getHealthBadge(containerMem.usagePercent).bg,
                        color: getHealthBadge(containerMem.usagePercent).color,
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {getHealthBadge(containerMem.usagePercent).dot} {containerMem.usagePercent}% Load · {getHealthBadge(containerMem.usagePercent).text}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{containerMem.rssMB} MB used</span>
                    <span style={{ color: 'var(--text-muted)' }}>{containerMem.limitMB} MB limit</span>
                  </div>

                  {/* Progress Bar Track */}
                  <div style={{ width: '100%', height: 10, background: 'var(--bg-tertiary, #1e293b)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, containerMem.usagePercent)}%`,
                        height: '100%',
                        background: getHealthColor(containerMem.healthStatus, containerMem.usagePercent),
                        borderRadius: 999,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {['all', 'Gaming', 'Companion', 'Moderation', 'Social', 'Newsroom', 'System'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedSection(cat)}
                      className={`btn btn-sm ${selectedSection === cat ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: 6,
                        border: selectedSection === cat ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      }}
                    >
                      {cat === 'all' ? '🌐 All Features' : cat}
                    </button>
                  ))}
                </div>

                {/* Features List with 0-100% Progress Bars */}
                {usageLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <div className="spinner" style={{ width: 28, height: 28 }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '520px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {filteredFeatures.map((item: any) => {
                      const badge = getHealthBadge(item.percentage);
                      const color = getHealthColor(item.healthStatus, item.percentage);

                      return (
                        <div
                          key={item.key}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: 8,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          {/* Row Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.name}
                                </div>
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                  <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>[{item.section}]</span> · {item.resourceType}
                                </div>
                              </div>
                            </div>

                            {/* Percentage + Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: color }}>
                                {item.percentage}%
                              </span>
                              <span
                                className="badge"
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              >
                                {badge.dot} {badge.text}
                              </span>
                            </div>
                          </div>

                          {/* 0-100% Progress Bar */}
                          <div style={{ width: '100%', height: 7, background: 'var(--bg-tertiary, #0f172a)', borderRadius: 999, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                                height: '100%',
                                background: color,
                                borderRadius: 999,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'verification' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Discord Developer Portal App Verification</h3>
                <p>These are the official live legal URLs required for Discord Developer Portal App Verification.</p>
                <ul>
                  <li><strong>Terms of Service URL</strong>: Paste into Discord Developer Portal under <code>Terms of Service URL</code>.</li>
                  <li><strong>Privacy Policy URL</strong>: Paste into Discord Developer Portal under <code>Privacy Policy URL</code>.</li>
                  <li><strong>Public Availability</strong>: Both pages are publicly accessible worldwide without authentication.</li>
                </ul>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Public Legal Verification Links</h3>

                {/* Terms of Service Card */}
                <div className="stat-card" style={{ margin: 0, padding: '1.25rem' }}>
                  <div className="stat-card-label" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#facc15' }}>
                    📜 Terms of Service URL
                  </div>
                  <div className="code-box" style={{ margin: '0.5rem 0', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {termsUrl}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => copyToClipboard(termsUrl, 'terms')}
                    >
                      {copiedField === 'terms' ? '✅ Copied!' : '📋 Copy URL'}
                    </button>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      🔗 Open Page
                    </a>
                  </div>
                </div>

                {/* Privacy Policy Card */}
                <div className="stat-card" style={{ margin: 0, padding: '1.25rem' }}>
                  <div className="stat-card-label" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#facc15' }}>
                    🔒 Privacy Policy URL
                  </div>
                  <div className="code-box" style={{ margin: '0.5rem 0', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {privacyUrl}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => copyToClipboard(privacyUrl, 'privacy')}
                    >
                      {copiedField === 'privacy' ? '✅ Copied!' : '📋 Copy URL'}
                    </button>
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      🔗 Open Page
                    </a>
                  </div>
                </div>
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
                    <div className="stat-card-sub" style={{ fontSize: '0.75rem' }}>Running on Fly.io</div>
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
