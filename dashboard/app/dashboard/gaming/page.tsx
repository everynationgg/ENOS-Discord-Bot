'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

const GAME_BRANCHES = [
  'Where Winds Meet', 'Palworld', 'Wuwa', 'Hoyoverse', 'Enfi',
  'POE', 'BG3', 'D4', 'Minecraft', 'Phasmo', 'REPO', 'PEAK',
  'Subnautica 2', 'Devour', 'Demonologist', 'Valorant', 'CS2',
  'COD', 'HoK', 'ML', 'LOL', 'Others',
];

function TriviaStatusSection({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/gaming/trivia/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch trivia status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 10000);
    return () => clearInterval(timer);
  }, [refreshKey]);

  if (loading && !data) {
    return (
      <div style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 16, height: 16 }} /> Loading Trivia Live Status...
        </div>
      </div>
    );
  }

  if (!data || !data.has_drop || !data.drop) {
    return (
      <div style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Active Trivia Drop Status</h3>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No active or recent trivia drops found for this server. Use Force Trigger below to drop one.</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchStatus}>🔄 Refresh Status</button>
        </div>
      </div>
    );
  }

  const drop = data.drop;
  const stats = data.stats || { total_started: 0, total_answered: 0, total_correct: 0, total_incorrect: 0 };
  const participants = data.participants || [];
  const winners = drop.winners || [];
  const isActive = data.is_active;

  const statusColor = isActive
    ? '#22c55e'
    : drop.status === 'completed'
    ? '#3b82f6'
    : drop.status === 'skipped'
    ? '#ef4444'
    : '#a855f7';

  const statusLabel = isActive
    ? '🟢 ACTIVE DROP IN PROGRESS'
    : drop.status === 'completed'
    ? '🏁 SESSION COMPLETED'
    : drop.status === 'skipped'
    ? '❌ SESSION CANCELLED'
    : `⚡ ${drop.status.toUpperCase()}`;

  return (
    <div style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🧠</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Trivia Drop Live Status</h3>
              <span style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                backgroundColor: `${statusColor}22`,
                color: statusColor,
                border: `1px solid ${statusColor}44`,
                letterSpacing: '0.03em'
              }}>
                {statusLabel}
              </span>
            </div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Dropped: {new Date(drop.created_at).toLocaleString()} • Auto-Close: <strong>{drop.close_time}</strong> • Channel ID: <code>{drop.channel_id}</code>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={fetchStatus} title="Refresh Status">
            🔄 Refresh Status
          </button>
        </div>
      </div>

      {/* Question Card */}
      <div style={{
        padding: '0.875rem 1rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        borderLeft: '4px solid var(--accent-primary, #facc15)',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
          Active Question
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {drop.question}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Correct Answer:</span>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.15)',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            ✓ {drop.correct_answer}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>👥 Total Started</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{stats.total_started}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>📥 Answered</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem' }}>{stats.total_answered}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✅ Correct</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>{stats.total_correct}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>❌ Incorrect</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>{stats.total_incorrect}</div>
        </div>
      </div>

      {/* Podium Winners */}
      {winners && winners.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(250, 204, 21, 0.05)', borderRadius: '8px', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', marginBottom: '0.5rem' }}>
            🏆 Podium Winners
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {winners.map((w: any, idx: number) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem' }}>
                  <span>
                    {medal} <strong>{w.tag || w.user_id}</strong> <span style={{ color: 'var(--text-muted)' }}>({w.place})</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#facc15' }}>
                    {(w.speed_ms / 1000).toFixed(4)}s (+{w.points} pts)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Participant Breakdown Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            📊 Participant Answering Status ({participants.length})
          </span>
        </div>

        {participants.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
            No members have clicked 'Start Trivia' yet for this drop.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.4rem 0.5rem' }}>User</th>
                  <th style={{ padding: '0.4rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.5rem' }}>Speed</th>
                  <th style={{ padding: '0.4rem 0.5rem' }}>Started At</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p: any) => {
                  const isAnswered = !!p.answered_at;
                  const speedSec = p.speed_ms ? (p.speed_ms / 1000).toFixed(3) + 's' : '—';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>
                        {p.tag ? <span>{p.tag}</span> : <code style={{ fontSize: '0.75rem' }}>{p.user_id}</code>}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        {!isAnswered ? (
                          <span style={{ color: '#eab308', fontWeight: 600 }}>⏱️ Thinking...</span>
                        ) : p.is_correct ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Correct</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Incorrect</span>
                        )}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>
                        {speedSec}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(p.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BossPreviewCard({
  bossName,
  imageUrl,
  bgUrl,
  momImageUrl,
  dadImageUrl,
  kidImageUrl,
}: {
  bossName: string;
  imageUrl: string;
  bgUrl: string;
  momImageUrl: string;
  dadImageUrl: string;
  kidImageUrl: string;
}) {
  const [viewMode, setViewMode] = useState<'spawn' | 'combat'>('spawn');
  const [activeClass, setActiveClass] = useState<'mom' | 'dad' | 'kid'>('mom');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gaming/boss/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bossName: bossName || 'WEEKLY BOSS',
          imageUrl,
          bgUrl,
          userClassKey: activeClass,
          momImageUrl,
          dadImageUrl,
          kidImageUrl,
          viewMode,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to render preview');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewSrc(url);
    } catch (e: any) {
      setError(e.message || 'Error rendering preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [bossName, imageUrl, bgUrl, momImageUrl, dadImageUrl, kidImageUrl, viewMode, activeClass]);

  const hasIbbLinks = [imageUrl, bgUrl, momImageUrl, dadImageUrl, kidImageUrl].some(
    (u) => u && u.includes('ibb.co/') && !u.includes('i.ibb.co/')
  );

  return (
    <div
      style={{
        marginTop: '1rem',
        marginBottom: '1.25rem',
        padding: '1rem',
        backgroundColor: '#020617',
        borderRadius: '0.5rem',
        border: '1px dashed rgba(99, 102, 241, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🖼️</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            Boss Live Canvas Card Preview
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'spawn' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setViewMode('spawn')}
          >
            📢 Spawn Card View
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'combat' && activeClass === 'mom' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => { setViewMode('combat'); setActiveClass('mom'); }}
          >
            🛡️ M.O.M. Battle View
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'combat' && activeClass === 'dad' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => { setViewMode('combat'); setActiveClass('dad'); }}
          >
            🔨 D.A.D. Battle View
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'combat' && activeClass === 'kid' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => { setViewMode('combat'); setActiveClass('kid'); }}
          >
            ⚡ K.I.D. Battle View
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={fetchPreview}
            title="Re-render Canvas Preview"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {hasIbbLinks && (
        <div style={{ fontSize: '0.75rem', color: '#facc15', background: 'rgba(250, 204, 21, 0.1)', padding: '0.4rem 0.65rem', borderRadius: '4px', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
          ⚠️ <strong>ImgBB Webpage Link Detected (`ibb.co/`)</strong>: Cloud hosting servers (Vercel/AWS) get blocked by ImgBB Cloudflare anti-bot protection when fetching webpage links. Please copy the <strong>Direct Link</strong> (`https://i.ibb.co/.../image.png`) from ImgBB!
        </div>
      )}

      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '220px',
          borderRadius: '0.375rem',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            <div className="spinner" style={{ width: 16, height: 16 }} /> Rendering Canvas Composite Preview...
          </div>
        )}

        {!loading && previewSrc && (
          <img
            src={previewSrc}
            alt="Boss Canvas Preview"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '360px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}

        {!loading && !previewSrc && error && (
          <div style={{ fontSize: '0.8125rem', color: '#ef4444' }}>
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamingPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [triviaRefreshKey, setTriviaRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { setConfigs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36 }} /></div>
      </div>
    );
  }

  const lfgConfig = configs['lfg'] || {};
  const vaultConfig = configs['vault'] || {};
  const triviaConfig = configs['trivia'] || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🎮 Gaming</h1>
        <p>Configure LFG party finder, Vault Economy, Trivia Drops, and game branch settings.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Gaming</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-game-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'lfg' ? 'active' : ''}`}
            onClick={() => setActiveTab('lfg')}
            id="sidebar-game-lfg"
          >
            🔍 LFG Group Finder
          </button>
          <button
            className={`sidebar-item ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
            id="sidebar-game-vault"
          >
            💰 Vault Economy
          </button>
          <button
            className={`sidebar-item ${activeTab === 'trivia' ? 'active' : ''}`}
            onClick={() => setActiveTab('trivia')}
            id="sidebar-game-trivia"
          >
            🧠 Trivia Drop
          </button>
          <button
            className={`sidebar-item ${activeTab === 'boss' ? 'active' : ''}`}
            onClick={() => setActiveTab('boss')}
            id="sidebar-game-boss"
          >
            🐉 Weekly Boss
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>Gaming Settings</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Keep your gaming community active with party finders and automatic engagement reward systems.
              </p>

              <div className="overview-item">
                <h3>🔍 LFG — Group Finder</h3>
                <p>
                  Allows members to post LFG invite cards with a direct Link Button to connect players instantly to game voice channels.
                </p>
              </div>

              <div className="overview-item">
                <h3>💰 Vault Economy</h3>
                <p>
                  Reward users automatically with Vault Coins for voice and text activity, define custom role multipliers, and configure automatic rank-up tier roles.
                </p>
              </div>

              <div className="overview-item">
                <h3>🧠 Trivia Drop</h3>
                <p>
                  Auto-drops a daily AI-generated trivia question in a weighted random channel. Anti-cheat ephemeral shuffling per user, microsecond speed scoring, and podium point rewards all in one.
                </p>
              </div>

              <div className="overview-item">
                <h3>🐉 Weekly Boss Bounty RPG</h3>
                <p>
                  Self-balancing weekly boss RPG with M.O.M., D.A.D., and K.I.D. combat triad synergy, 5 AP weekly budgets, dynamic participant scaling, and Overkill Mode.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'lfg' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>LFG Configuration Guide</h3>
                <p>
                  The Looking-For-Group (LFG) finder helps players invite others to connect directly to server voice channels.
                </p>
                <ol>
                  <li>Create a text channel (e.g. <code>#lfg-posts</code>) and copy its ID into <strong>LFG Post Channel ID</strong>.</li>
                  <li>Set <strong>Session TTL</strong> (Time To Live) to define how long an active LFG invite card remains active before auto-expiring.</li>
                  <li>In the <strong>Voice Channel Mappings</strong> section, input the voice channel ID matching each game branch to generate direct invite buttons routing players into their voice calls.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Copying voice IDs:</strong><br />
                  Enable Developer Mode in Discord, right-click the voice channel in your server panel, and select <strong>Copy Channel ID</strong>.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="lfg"
                  icon="🔍"
                  title="LFG — Group Finder"
                  description="Dynamic party cards with a direct VC invite button. References pre-existing voice channels."
                  featureKey="lfg"
                  initialEnabled={lfgConfig.enabled ?? false}
                  initialConfig={lfgConfig.config ?? {}}
                >
                  {(config, setConfig) => (
                    <>
                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Channels</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">LFG Post Channel ID</label>
                        <input
                          id="lfg-channel"
                          className="form-input"
                          placeholder="Channel where LFG cards are posted"
                          value={config.lfg_channel_id || ''}
                          onChange={(e) => setConfig('lfg_channel_id', e.target.value)}
                        />
                      </div>

                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Session Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Session TTL: <strong style={{ color: 'var(--accent-primary)' }}>{config.session_ttl_minutes ?? 120} min</strong>
                        </label>
                        <input
                          id="lfg-ttl"
                          type="range"
                          className="form-slider"
                          min={30} max={480} step={30}
                          value={config.session_ttl_minutes ?? 120}
                          onChange={(e) => setConfig('session_ttl_minutes', parseInt(e.target.value))}
                        />
                        <div className="slider-labels">
                          <span className="form-hint">30 min</span>
                          <span className="form-hint">8 hours</span>
                        </div>
                      </div>

                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Voice Channel Mappings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', paddingRight: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Game</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Voice Channel ID</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Allowed Role ID</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Default Voice Status</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {GAME_BRANCHES.map((game) => {
                          const voiceMappings = config.voice_mappings || {};
                          const roleMappings = config.role_mappings || {};
                          const defaultStatuses = config.default_statuses || {};
                          return (
                            <div key={game} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {game}
                              </span>
                              <input
                                id={`lfg-vc-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="Voice Channel ID"
                                value={voiceMappings[game] || ''}
                                onChange={(e) => setConfig('voice_mappings', { ...voiceMappings, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`lfg-role-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="Allowed Role ID"
                                value={roleMappings[game] || ''}
                                onChange={(e) => setConfig('role_mappings', { ...roleMappings, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`lfg-status-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="e.g. Chilling"
                                value={defaultStatuses[game] || ''}
                                onChange={(e) => setConfig('default_statuses', { ...defaultStatuses, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Vault Economy Configuration Guide</h3>
                <p>
                  Reward server engagement automatically using custom coin multipliers and auto-ranked tiers.
                </p>
                <ul>
                  <li><strong>Coins per Message</strong>: Vault Coins awarded to users per text message sent.</li>
                  <li><strong>Coins per Voice Min</strong>: Vault Coins awarded to users per minute active in voice channels.</li>
                  <li><strong>Daily Quest Bonus</strong>: Coin reward received upon reaching the daily quest message count.</li>
                  <li><strong>Role Multipliers</strong>: Apply coin rate multipliers (e.g. VIP/Nitro Boosters get 1.5x rates). Right-click the target role in Discord Roles settings and select **Copy Role ID** to configure multipliers.</li>
                  <li><strong>Tier Roles</strong>: Auto-assigned Discord roles when a member accumulates a specific coin threshold. Right-click the role in Discord and select **Copy Role ID**.</li>
                </ul>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="vault"
                  icon="💰"
                  title="Vault Economy"
                  description="Track XP, award Vault Coins for chat & voice activity, manage role multipliers and tier roles."
                  featureKey="vault"
                  initialEnabled={vaultConfig.enabled ?? false}
                  initialConfig={vaultConfig.config ?? {}}
                >
                  {(config, setConfig) => {
                    const rates = config.rates || {};
                    const multipliers: any[] = config.role_multipliers || [];
                    const tierRoles = config.tier_roles || {};

                    return (
                      <>
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Coin Rates</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">Coins per Message</label>
                            <input
                              id="vault-msg-rate"
                              type="number" min={0} max={100}
                              className="form-input"
                              value={rates.message ?? 1}
                              onChange={(e) => setConfig('rates', { ...rates, message: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Coins per Voice Min</label>
                            <input
                              id="vault-voice-rate"
                              type="number" min={0} max={100}
                              className="form-input"
                              value={rates.voice_per_minute ?? 2}
                              onChange={(e) => setConfig('rates', { ...rates, voice_per_minute: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Daily Quest Bonus</label>
                            <input
                              id="vault-quest-bonus"
                              type="number" min={0} max={500}
                              className="form-input"
                              value={rates.daily_quest_bonus ?? 50}
                              onChange={(e) => setConfig('rates', { ...rates, daily_quest_bonus: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Quest Msg Threshold</label>
                            <input
                              id="vault-quest-threshold"
                              type="number" min={1} max={100}
                              className="form-input"
                              value={rates.daily_quest_message_threshold ?? 10}
                              onChange={(e) => setConfig('rates', { ...rates, daily_quest_message_threshold: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Role Multipliers</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {multipliers.map((m: any, i: number) => (
                            <div key={i} className="multiplier-row">
                              <input
                                id={`multiplier-role-${i}`}
                                className="form-input"
                                placeholder="Role ID"
                                value={m.role_id || ''}
                                onChange={(e) => {
                                  const updated = [...multipliers];
                                  updated[i] = { ...m, role_id: e.target.value };
                                  setConfig('role_multipliers', updated);
                                }}
                              />
                              <input
                                id={`multiplier-val-${i}`}
                                className="form-input"
                                type="number" step="0.1" min="0.1" max="10"
                                placeholder="e.g. 1.5"
                                value={m.multiplier || ''}
                                onChange={(e) => {
                                  const updated = [...multipliers];
                                  updated[i] = { ...m, multiplier: parseFloat(e.target.value) };
                                  setConfig('role_multipliers', updated);
                                }}
                              />
                              <button
                                id={`remove-multiplier-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('role_multipliers', multipliers.filter((_: any, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="add-multiplier-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('role_multipliers', [...multipliers, { role_id: '', multiplier: 1.5 }])}
                          >
                            + Add Multiplier
                          </button>
                        </div>

                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Tier Roles</span>
                          <div className="section-divider-line" />
                        </div>

                        {[
                          { key: 'bronze', emoji: '🥉', label: 'Bronze (Default)' },
                          { key: 'gold', emoji: '🥇', label: 'Gold (1,000 coins)' },
                          { key: 'platinum', emoji: '💎', label: 'Platinum (5,000 coins)' },
                        ].map(({ key, emoji, label }) => (
                          <div className="form-group" key={key}>
                            <label className="form-label">{emoji} {label} — Role ID</label>
                            <input
                              id={`tier-role-${key}`}
                              className="form-input"
                              placeholder="Discord Role ID"
                              value={tierRoles[key] || ''}
                              onChange={(e) => setConfig('tier_roles', { ...tierRoles, [key]: e.target.value })}
                            />
                          </div>
                        ))}
                      </>
                    );
                  }}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'trivia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0rem', width: '100%' }}>
              <TriviaStatusSection refreshKey={triviaRefreshKey} />
              <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Trivia Drop Configuration Guide</h3>
                <p>
                  The daily trivia system auto-generates a unique multiple-choice question via AI and drops it into a weighted random channel. The answer order is shuffled per player to prevent leaking answers.
                </p>
                <ol>
                  <li>Enable the feature and add the <strong>Channel Whitelist</strong> below — these are the channels where trivia can drop.</li>
                  <li>Set a <strong>Priority</strong> per channel: <code>high</code> (3x weight), <code>medium</code> (2x), or <code>low</code> (1x) — dead channels can be revived with low priority.</li>
                  <li>Optionally set a <strong>Topic</strong> for a channel (e.g. <code>Palworld survival mechanics</code>) for themed questions. Leave blank for general trivia.</li>
                  <li>Configure the <strong>Close Time</strong> (in 24h format, e.g. <code>22:00</code>) — sessions close at this time if 3 winners haven't claimed all spots first.</li>
                  <li>Set the server <strong>Timezone</strong> and <strong>Drops Per Day</strong> (1–3 drops daily, evenly auto-scheduled throughout daytime hours).</li>
                  <li>Optionally configure a <strong>Leaderboard Channel ID</strong> to post and auto-update a live Top 5 trivia points leaderboard.</li>
                  <li>Set <strong>Allowed Roles</strong> to restrict who can participate (leave empty to allow all members).</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Force Trigger / Skip:</strong><br />
                  Use the manual control buttons at the bottom of the config card to instantly spawn a drop or close the active session from this panel.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="trivia"
                  icon="🧠"
                  title="Daily Trivia Drop"
                  description="AI-generated daily trivia with anti-cheat ephemeral shuffling, microsecond podium scoring, and Vault-independent point rewards."
                  featureKey="trivia"
                  initialEnabled={triviaConfig.enabled ?? false}
                  initialConfig={triviaConfig.config ?? {}}
                >
                  {(config, setConfig) => {
                    const allowedChannels: any[] = config.allowed_channels || [];
                    const allowedRoles: string[] = config.allowed_roles || [];
                    const [manualStatus, setManualStatus] = useState<string>('');

                    const handleManualAction = async (action: string) => {
                      setManualStatus('loading');
                      try {
                        const res = await fetch('/api/gaming/trivia/action', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action }),
                        });
                        const data = await res.json();
                        setManualStatus(data.error ? `error: ${data.error}` : action === 'trigger' ? 'triggered' : action === 'skip' ? 'skipped' : 'rerolled');
                        if (!data.error) setTriviaRefreshKey((k) => k + 1);
                      } catch {
                        setManualStatus('error: request failed');
                      }
                      setTimeout(() => setManualStatus(''), 4000);
                    };

                    return (
                      <>
                        {/* Timezone & Close Time */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Schedule Settings</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">Timezone</label>
                            <input
                              id="trivia-timezone"
                              className="form-input"
                              placeholder="e.g. Asia/Manila, America/New_York"
                              value={config.timezone || ''}
                              onChange={(e) => setConfig('timezone', e.target.value)}
                            />
                            <span className="form-hint">IANA timezone string</span>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Auto-Close Time (24h)</label>
                            <input
                              id="trivia-close-time"
                              className="form-input"
                              placeholder="e.g. 22:00"
                              value={config.close_time || ''}
                              onChange={(e) => setConfig('close_time', e.target.value)}
                            />
                            <span className="form-hint">Between 01:00 – 23:00 (server timezone)</span>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Drops Per Day (1–3)</label>
                            <input
                              id="trivia-drops-per-day"
                              type="number"
                              min={1}
                              max={3}
                              className="form-input"
                              placeholder="1"
                              value={config.drops_per_day ?? 1}
                              onChange={(e) => {
                                const val = Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1));
                                setConfig('drops_per_day', val);
                              }}
                            />
                            <span className="form-hint">Number of daily trivia drops (max 3)</span>
                          </div>
                        </div>

                        {/* Channel Whitelist */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Channel Whitelist</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px', gap: '0.5rem', marginBottom: '0.4rem', paddingRight: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Priority</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Channel ID</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Topic</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Remove</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allowedChannels.map((ch: any, i: number) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px', gap: '0.5rem', alignItems: 'center' }}>
                              <select
                                id={`trivia-ch-priority-${i}`}
                                className="form-input"
                                value={ch.priority || 'medium'}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, priority: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                              >
                                <option value="high">🔴 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">🟢 Low</option>
                              </select>
                              <input
                                id={`trivia-ch-id-${i}`}
                                className="form-input"
                                placeholder="Channel ID"
                                value={ch.channel_id || ''}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, channel_id: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`trivia-ch-topic-${i}`}
                                className="form-input"
                                placeholder="e.g. Palworld"
                                value={ch.topic || ''}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, topic: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <button
                                id={`trivia-remove-ch-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('allowed_channels', allowedChannels.filter((_: any, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="trivia-add-channel-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('allowed_channels', [...allowedChannels, { channel_id: '', priority: 'medium', topic: '' }])}
                          >
                            + Add Channel
                          </button>
                        </div>

                        {/* Allowed Roles */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Participation Roles</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allowedRoles.map((roleId: string, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id={`trivia-role-${i}`}
                                className="form-input"
                                placeholder="Role ID or Role Name"
                                value={roleId}
                                onChange={(e) => {
                                  const updated = [...allowedRoles];
                                  updated[i] = e.target.value;
                                  setConfig('allowed_roles', updated);
                                }}
                              />
                              <button
                                id={`trivia-remove-role-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('allowed_roles', allowedRoles.filter((_: string, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="trivia-add-role-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('allowed_roles', [...allowedRoles, ''])}
                          >
                            + Add Role
                          </button>
                          <span className="form-hint">Leave empty to allow all members to participate.</span>
                        </div>

                        {/* Live Leaderboard Channel */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Live Point Tracker</span>
                          <div className="section-divider-line" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Leaderboard Channel ID</label>
                          <input
                            id="trivia-leaderboard-channel"
                            className="form-input"
                            placeholder="Channel where top 5 points are auto-posted"
                            value={config.leaderboard_channel_id || ''}
                            onChange={(e) => setConfig('leaderboard_channel_id', e.target.value)}
                          />
                          <span className="form-hint">Bot will post and edit a single message here as scores update. Leave empty to disable.</span>
                        </div>

                        {/* Manual Controls */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Manual Safety Controls</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            id="trivia-force-trigger"
                            className="btn btn-primary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('trigger')}
                          >
                            ⚡ Force Trigger
                          </button>
                          <button
                            id="trivia-skip"
                            className="btn btn-secondary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('skip')}
                          >
                            ⏭️ Skip / Close Active
                          </button>
                          <button
                            id="trivia-reroll"
                            className="btn btn-secondary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('reroll')}
                          >
                            🎲 Reroll Drop
                          </button>
                          {manualStatus && (
                            <span style={{
                              fontSize: '0.8125rem',
                              color: manualStatus.startsWith('error') ? 'var(--color-error)' : 'var(--color-success)',
                              fontWeight: 500,
                            }}>
                              {manualStatus === 'loading' ? '⏳ Processing...' :
                               manualStatus === 'triggered' ? '✅ Drop triggered!' :
                               manualStatus === 'skipped' ? '✅ Session closed.' :
                               manualStatus === 'rerolled' ? '✅ Rerolled successfully.' :
                               `❌ ${manualStatus}`}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  }}
                </FeatureCard>
              </div>
            </div>
          </div>
        )}

          {activeTab === 'boss' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Weekly Boss Bounty RPG Guide</h3>
                <p>
                  A self-balancing, zero-cost Discord RPG system where players choose a class and coordinate 3-class synergy loops to defeat a corrupted glitch boss.
                </p>
                <ol>
                  <li>Enable the feature below and set your target <strong>Boss Announcement Channel ID</strong>.</li>
                  <li>Players use <code>/boss status</code> or click the interactive Discord buttons to select a class (<strong>M.O.M.</strong>, <strong>D.A.D.</strong>, or <strong>K.I.D.</strong>) and spend 5 weekly AP.</li>
                  <li>Executing 3-class triad combos (M.O.M. Buff + D.A.D. Debuff + K.I.D. Nuke) deals <strong>60,000 DMG</strong> (Full Triad Meltdown).</li>
                  <li>Defeating the boss unlocks <strong>Overkill Mode</strong> with 1.5x bonus points and XP!</li>
                </ol>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="weekly-boss"
                  icon="🐉"
                  title="Weekly Boss Bounty RPG"
                  description="Self-balancing weekly boss RPG with M.O.M., D.A.D., and K.I.D. combat triad synergy, 5 AP weekly budgets, dynamic participant scaling, and Overkill Mode."
                  featureKey="weekly_boss"
                  initialEnabled={configs['weekly_boss']?.enabled ?? true}
                  initialConfig={configs['weekly_boss']?.config ?? {}}
                >
                  {(config, setConfig) => {
                    const gameName = config.game_name || '';
                    const bossName = config.override_name || '';
                    const baseHP = config.override_hp || '';
                    const imageUrl = config.custom_image_url || '';
                    const bgUrl = config.custom_bg_url || '';
                    const momImageUrl = config.mom_image_url || '';
                    const dadImageUrl = config.dad_image_url || '';
                    const kidImageUrl = config.kid_image_url || '';

                    return (
                      <>
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Boss Settings</span>
                          <div className="section-divider-line" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Boss Announcement Channel ID</label>
                          <input
                            id="boss-channel-id"
                            className="form-input"
                            placeholder="Channel ID for boss card posts (e.g. 1234567890)"
                            value={config.channel_id || ''}
                            onChange={(e) => setConfig('channel_id', e.target.value)}
                          />
                          <span className="form-hint">Channel where /boss status cards are posted</span>
                        </div>

                        {/* Manual Boss Configuration Controls */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">⚔️ Weekly Boss Setup</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">🎮 Game Name</label>
                            <input
                              id="boss-game-name"
                              className="form-input"
                              placeholder="e.g. Diablo 4, Wuthering Waves, Elden Ring"
                              value={gameName}
                              onChange={(e) => setConfig('game_name', e.target.value)}
                            />
                            <span className="form-hint">The game where the boss originates</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label">⚔️ Boss / Character Name</label>
                            <input
                              id="boss-override-name"
                              className="form-input"
                              placeholder="e.g. Lilith, Aemeth, Malenia"
                              value={bossName}
                              onChange={(e) => setConfig('override_name', e.target.value)}
                            />
                            <span className="form-hint">Name of the boss character</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">❤️ Manual Base HP (Optional Override)</label>
                          <input
                            id="boss-override-hp"
                            type="number"
                            className="form-input"
                            placeholder="e.g. 150000"
                            value={baseHP}
                            onChange={(e) => setConfig('override_hp', e.target.value)}
                          />
                          <span className="form-hint">Leave blank for automatic player-scaled HP</span>
                        </div>

                        {/* Boss & Background Image Section */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">🖼️ Boss Artwork & Environment</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">🧌 Boss Artwork Image URL (Displayed on Spawn & Combat)</label>
                            <input
                              id="boss-image-url"
                              className="form-input"
                              placeholder="https://.../boss_environment_art.png"
                              value={imageUrl}
                              onChange={(e) => setConfig('custom_image_url', e.target.value.trim())}
                            />
                            <span className="form-hint">
                              Full boss artwork image. Displayed ONLY on initial spawn, and on the right side during combat.
                            </span>
                          </div>

                          <div className="form-group">
                            <label className="form-label">🌄 Arena Background Image (Optional 16:9)</label>
                            <input
                              id="boss-bg-url"
                              className="form-input"
                              placeholder="https://.../arena_background.png"
                              value={bgUrl}
                              onChange={(e) => setConfig('custom_bg_url', e.target.value.trim())}
                            />
                            <span className="form-hint">
                              Optional custom background landscape/arena image
                            </span>
                          </div>
                        </div>

                        {/* Player Class Custom Images */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">🎭 Player Class Character Images (Transparent PNGs)</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">🛡️ M.O.M. Class Image</label>
                            <input
                              id="boss-mom-image-url"
                              className="form-input"
                              placeholder="https://.../mom_character.png"
                              value={momImageUrl}
                              onChange={(e) => setConfig('mom_image_url', e.target.value.trim())}
                            />
                            <span className="form-hint">Placed on left side when M.O.M. class is selected</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label">🔨 D.A.D. Class Image</label>
                            <input
                              id="boss-dad-image-url"
                              className="form-input"
                              placeholder="https://.../dad_character.png"
                              value={dadImageUrl}
                              onChange={(e) => setConfig('dad_image_url', e.target.value.trim())}
                            />
                            <span className="form-hint">Placed on left side when D.A.D. class is selected</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label">⚡ K.I.D. Class Image</label>
                            <input
                              id="boss-kid-image-url"
                              className="form-input"
                              placeholder="https://.../kid_character.png"
                              value={kidImageUrl}
                              onChange={(e) => setConfig('kid_image_url', e.target.value.trim())}
                            />
                            <span className="form-hint">Placed on left side when K.I.D. class is selected</span>
                          </div>
                        </div>

                        {/* Live Canvas Composite Preview Card */}
                        <BossPreviewCard
                          bossName={bossName}
                          imageUrl={imageUrl}
                          bgUrl={bgUrl}
                          momImageUrl={momImageUrl}
                          dadImageUrl={dadImageUrl}
                          kidImageUrl={kidImageUrl}
                        />

                        {/* Admin Quick Action Controls */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">🚀 Action Controls</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            id="boss-force-spawn"
                            className="btn btn-primary btn-sm"
                            disabled={config.boss_status === 'loading'}
                            onClick={async () => {
                              setConfig('boss_status', 'loading');
                              try {
                                const res = await fetch('/api/gaming/boss/action', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action: 'spawn',
                                    gameName,
                                    customName: bossName,
                                    customHp: baseHP,
                                    customImageUrl: imageUrl,
                                    customBgUrl: bgUrl,
                                  }),
                                });
                                const data = await res.json();
                                setConfig('boss_status', data.error ? `error: ${data.error}` : 'spawned');
                              } catch {
                                setConfig('boss_status', 'error: request failed');
                              }
                              setTimeout(() => setConfig('boss_status', ''), 4000);
                            }}
                          >
                            🚀 Spawn Boss & Post Card to Discord
                          </button>

                        <button
                          id="boss-force-end"
                          className="btn btn-secondary btn-sm"
                          disabled={config.boss_status === 'loading'}
                          onClick={async () => {
                            setConfig('boss_status', 'loading');
                            try {
                              const res = await fetch('/api/gaming/boss/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'end' }),
                              });
                              const data = await res.json();
                              setConfig('boss_status', data.error ? `error: ${data.error}` : 'ended');
                            } catch {
                              setConfig('boss_status', 'error: request failed');
                            }
                            setTimeout(() => setConfig('boss_status', ''), 4000);
                          }}
                        >
                          ⏹️ Force End / Reset AP
                        </button>

                        <button
                          id="boss-force-overkill"
                          className="btn btn-secondary btn-sm"
                          disabled={config.boss_status === 'loading'}
                          onClick={async () => {
                            setConfig('boss_status', 'loading');
                            try {
                              const res = await fetch('/api/gaming/boss/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'overkill' }),
                              });
                              const data = await res.json();
                              setConfig('boss_status', data.error ? `error: ${data.error}` : 'overkill');
                            } catch {
                              setConfig('boss_status', 'error: request failed');
                            }
                            setTimeout(() => setConfig('boss_status', ''), 4000);
                          }}
                        >
                          💥 Force Trigger Overkill
                        </button>

                        {config.boss_status && (
                          <span style={{
                            fontSize: '0.8125rem',
                            color: config.boss_status.startsWith('error') ? 'var(--color-error)' : 'var(--color-success)',
                            fontWeight: 500,
                          }}>
                            {config.boss_status === 'loading' ? '⏳ Processing...' :
                             config.boss_status === 'spawned' ? '✅ Boss spawned & posted to Discord!' :
                             config.boss_status === 'ended' ? '✅ Cycle ended & AP reset.' :
                             config.boss_status === 'overkill' ? '✅ Overkill Mode triggered!' :
                             `❌ ${config.boss_status}`}
                          </span>
                        )}
                      </div>
                    </>
                  );
                }}
              </FeatureCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
