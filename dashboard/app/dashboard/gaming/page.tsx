'use client';

import FeatureCard from '@/components/FeatureCard';
import ImageUploader from '@/components/ImageUploader';
import { useEffect, useState, useRef, useCallback } from 'react';

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
            No members have clicked &apos;Start Trivia&apos; yet for this drop.
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
  onFixIbbLinks,
}: {
  bossName: string;
  imageUrl: string;
  bgUrl: string;
  momImageUrl: string;
  dadImageUrl: string;
  kidImageUrl: string;
  onFixIbbLinks?: () => void;
}) {
  const [viewMode, setViewMode] = useState<'spawn' | 'combat'>('spawn');
  const [activeClass, setActiveClass] = useState<'mom' | 'dad' | 'kid'>('mom');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 420;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background
    const drawOverlay = () => {
      // 2. Draw Boss Image
      const targetClassUrl = activeClass === 'mom' ? momImageUrl : activeClass === 'dad' ? dadImageUrl : kidImageUrl;

      const drawBossAndUI = () => {
        if (imageUrl) {
          const bossImg = new Image();
          bossImg.crossOrigin = 'anonymous';
          bossImg.src = imageUrl;
          bossImg.onload = () => {
            ctx.drawImage(bossImg, 420, 40, 340, 340);
            drawUI();
          };
          bossImg.onerror = () => drawUI();
        } else {
          drawUI();
        }
      };

      if (viewMode === 'combat' && targetClassUrl) {
        const heroImg = new Image();
        heroImg.crossOrigin = 'anonymous';
        heroImg.src = targetClassUrl;
        heroImg.onload = () => {
          ctx.drawImage(heroImg, 40, 100, 260, 260);
          drawBossAndUI();
        };
        heroImg.onerror = () => drawBossAndUI();
      } else {
        drawBossAndUI();
      }
    };

    const drawUI = () => {
      // Dark gradient overlay for readability
      const grad = ctx.createLinearGradient(0, height - 120, 0, height);
      grad.addColorStop(0, 'rgba(2, 6, 23, 0)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - 120, width, 120);

      // Header Banner Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, 20, 380, 75);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, 380, 75);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('⚔️ WEEKLY BOSS BOUNTY RPG', 32, 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText((bossName || 'WEEKLY BOSS').toUpperCase(), 32, 65);

      // Status Badge
      ctx.fillStyle = viewMode === 'spawn' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(20, 370, 240, 30);
      ctx.fillStyle = viewMode === 'spawn' ? '#22c55e' : '#f59e0b';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(
        viewMode === 'spawn' ? '⚡ SPAWN CARD PREVIEW' : `⚔️ ${activeClass.toUpperCase()} COMBAT VIEW`,
        32,
        390
      );
    };

    if (bgUrl) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = bgUrl;
      bgImg.onload = () => {
        ctx.drawImage(bgImg, 0, 0, width, height);
        drawOverlay();
      };
      bgImg.onerror = () => {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
        drawOverlay();
      };
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
      drawOverlay();
    }
  }, [bossName, imageUrl, bgUrl, momImageUrl, dadImageUrl, kidImageUrl, viewMode, activeClass]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

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
            onClick={drawCanvas}
            title="Re-render Canvas Preview"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {hasIbbLinks && (
        <div style={{ fontSize: '0.75rem', color: '#facc15', background: 'rgba(250, 204, 21, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(250, 204, 21, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            ⚠️ <strong>ImgBB Webpage Link Detected (`ibb.co/`)</strong>: Direct links (`https://i.ibb.co/.../image.png`) recommended.
          </div>
          {onFixIbbLinks && (
            <button
              type="button"
              className="btn btn-sm btn-warning"
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
              onClick={onFixIbbLinks}
            >
              ✨ Auto-Fix Links to Direct URLs
            </button>
          )}
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
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '360px',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

function AchievementsCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const tiers = config.tiers || {
    enis: { title: 'They Who Herald the Nation', threshold: 5, reward_type: 'coins', reward_val: 50 },
    enara: { title: 'Those Who Exalt the Nation', threshold: 50, reward_type: 'nitro', reward_val: '1 Month Discord Nitro + Boost' },
    enorium: { title: 'The One Who Ordains the Nation', threshold: 100, reward_type: 'nitro', reward_val: '1 Year Discord Nitro + Boost', exclusive: true },
  };

  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/gaming/achievements/action');
      const data = await res.json();
      if (data.success && data.invites) {
        setInvites(data.invites);
      }
    } catch (e) {
      console.error('Failed to fetch invite log', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleUpdateStatus = async (inviteId: string, newStatus: string) => {
    try {
      setStatusMsg('Updating...');
      const res = await fetch('/api/gaming/achievements/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_invite_status', inviteId, newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Updated status to ${newStatus}`);
        fetchInvites();
      } else {
        setStatusMsg(`Error: ${data.error}`);
      }
    } catch {
      setStatusMsg('Error updating status');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">📢 Achievement Display & Announcement Channels</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Master Achievement Card Channel ID</label>
          <input
            id="achievement-channel-id"
            className="form-input"
            placeholder="Channel ID to post master achievement browser card"
            value={config.channel_id || ''}
            onChange={(e) => setConfig('channel_id', e.target.value)}
          />
          <span className="form-hint">Channel where the interactive achievement browser card is posted.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Staff Audit Log Channel ID</label>
          <input
            id="achievement-log-channel-id"
            className="form-input"
            placeholder="Channel ID for crown title swap & fraud alerts"
            value={config.log_channel_id || ''}
            onChange={(e) => setConfig('log_channel_id', e.target.value)}
          />
          <span className="form-hint">Channel where title transfers and moderator audit events are posted.</span>
        </div>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">🏆 Recruitment Achievement Tier Setup</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Enis Tier */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#A78BFA' }}>🟣 Tier I — Enis</h4>
          <div className="form-group">
            <label className="form-label">Title Phrase</label>
            <input
              className="form-input"
              value={tiers.enis?.title || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enis: { ...tiers.enis, title: e.target.value } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Invites Required</label>
            <input
              type="number" className="form-input"
              value={tiers.enis?.threshold ?? 5}
              onChange={(e) => setConfig('tiers', { ...tiers, enis: { ...tiers.enis, threshold: parseInt(e.target.value, 10) || 5 } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reward</label>
            <input
              className="form-input"
              value={tiers.enis?.reward_val || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enis: { ...tiers.enis, reward_val: e.target.value } })}
            />
          </div>
        </div>

        {/* Enara Tier */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#F97316' }}>🔥 Tier II — Enara</h4>
          <div className="form-group">
            <label className="form-label">Title Phrase</label>
            <input
              className="form-input"
              value={tiers.enara?.title || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enara: { ...tiers.enara, title: e.target.value } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Invites Required</label>
            <input
              type="number" className="form-input"
              value={tiers.enara?.threshold ?? 50}
              onChange={(e) => setConfig('tiers', { ...tiers, enara: { ...tiers.enara, threshold: parseInt(e.target.value, 10) || 50 } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reward</label>
            <input
              className="form-input"
              value={tiers.enara?.reward_val || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enara: { ...tiers.enara, reward_val: e.target.value } })}
            />
          </div>
        </div>

        {/* Enorium Tier */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid #F59E0B' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#F59E0B' }}>👑 Tier III — Enorium (Crown)</h4>
          <div className="form-group">
            <label className="form-label">Title Phrase</label>
            <input
              className="form-input"
              value={tiers.enorium?.title || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enorium: { ...tiers.enorium, title: e.target.value } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Invites Required</label>
            <input
              type="number" className="form-input"
              value={tiers.enorium?.threshold ?? 100}
              onChange={(e) => setConfig('tiers', { ...tiers, enorium: { ...tiers.enorium, threshold: parseInt(e.target.value, 10) || 100 } })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reward</label>
            <input
              className="form-input"
              value={tiers.enorium?.reward_val || ''}
              onChange={(e) => setConfig('tiers', { ...tiers, enorium: { ...tiers.enorium, reward_val: e.target.value } })}
            />
          </div>
        </div>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">🛡️ Qualification & Anti-Fraud Rules</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Minimum Account Age (Days)</label>
          <input
            type="number" className="form-input"
            value={config.min_account_age_days ?? 365}
            onChange={(e) => setConfig('min_account_age_days', parseInt(e.target.value, 10) || 365)}
          />
          <span className="form-hint">Accounts younger than this stay Pending until reaching target age.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Require Gatekeeper Onboarding</label>
          <select
            className="form-input"
            value={config.require_onboarding ? 'true' : 'false'}
            onChange={(e) => setConfig('require_onboarding', e.target.value === 'true')}
          >
            <option value="true">Enabled (Must complete onboarding)</option>
            <option value="false">Disabled</option>
          </select>
        </div>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">📜 Member Invite Audit & Moderation Log</span>
        <div className="section-divider-line" />
      </div>

      {statusMsg && <div style={{ fontSize: '0.8125rem', color: 'var(--color-success)', marginBottom: '0.5rem' }}>{statusMsg}</div>}

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border-color)' }}>
        {loading ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading invite records...</div>
        ) : invites.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>No invite records logged yet. New invites will appear here after onboarding.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Inviter ID</th>
                  <th style={{ padding: '0.5rem' }}>Invited Member ID</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Account Created</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{inv.inviter_id}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{inv.invited_member_id}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span className={`badge ${inv.status === 'valid' ? 'badge-success' : inv.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{new Date(inv.invited_account_created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {inv.status !== 'revoked' ? (
                        <button className="btn btn-sm btn-danger" onClick={() => handleUpdateStatus(inv.id, 'revoked')}>Revoke</button>
                      ) : (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleUpdateStatus(inv.id, 'valid')}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function VaultCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const rates = config.rates || {};
  const multipliers: any[] = config.role_multipliers || [];
  const tierRoles = config.tier_roles || {};
  const [dispatchingHub, setDispatchingHub] = useState(false);
  const [hubDispatchStatus, setHubDispatchStatus] = useState('');

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Financial Controls & Rates (1 Coin = ₱1 PHP)</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Daily Earning Cap (₱ PHP Max/Day)</label>
          <input
            id="vault-daily-cap"
            type="number" step="0.1" min="0.1" max="100"
            className="form-input"
            value={rates.daily_cap ?? 1.50}
            onChange={(e) => setConfig('rates', { ...rates, daily_cap: parseFloat(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Coins per Message (₱ PHP)</label>
          <input
            id="vault-msg-rate"
            type="number" step="0.01" min="0" max="10"
            className="form-input"
            value={rates.message ?? 0.02}
            onChange={(e) => setConfig('rates', { ...rates, message: parseFloat(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Coins per Voice Min (₱ PHP)</label>
          <input
            id="vault-voice-rate"
            type="number" step="0.01" min="0" max="10"
            className="form-input"
            value={rates.voice_per_minute ?? 0.01}
            onChange={(e) => setConfig('rates', { ...rates, voice_per_minute: parseFloat(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Daily Quest Hub Channel ID</label>
          <input
            id="vault-quest-channel"
            className="form-input"
            placeholder="Channel ID to post 'Get Daily Quests' card"
            value={config.quest_channel_id || ''}
            onChange={(e) => setConfig('quest_channel_id', e.target.value)}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!config.quest_channel_id || dispatchingHub}
              onClick={async () => {
                setDispatchingHub(true);
                setHubDispatchStatus('Dispatching launcher card to Discord...');
                try {
                  const res = await fetch('/api/gaming/vault/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'dispatch_quest_hub',
                      channel_id: config.quest_channel_id,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setHubDispatchStatus('✅ Daily Quest Hub card successfully posted to Discord!');
                  } else {
                    setHubDispatchStatus(`❌ Failed: ${data.error || 'Unknown error'}`);
                  }
                } catch (e: any) {
                  setHubDispatchStatus(`❌ Error: ${e.message}`);
                } finally {
                  setDispatchingHub(false);
                }
              }}
              style={{ backgroundColor: '#10b981', border: 'none', fontWeight: 600, fontSize: '0.8rem', width: '100%' }}
            >
              {dispatchingHub ? 'Posting to Discord...' : '🚀 Dispatch Quest Hub Card to Channel'}
            </button>
            {hubDispatchStatus && (
              <div style={{
                marginTop: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: hubDispatchStatus.startsWith('✅') ? '#34d399' : hubDispatchStatus.startsWith('❌') ? '#f87171' : '#facc15'
              }}>
                {hubDispatchStatus}
              </div>
            )}
          </div>
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
        <span className="section-divider-text">9 Nitro Badge Tier Roles</span>
        <div className="section-divider-line" />
      </div>

      {[
        { key: 'starter', emoji: '💨', label: 'Starter (0 coins)', rarity: 'COMMON' },
        { key: 'bronze', emoji: '🟤', label: 'Bronze (40 coins / ₱40)', rarity: 'UNCOMMON' },
        { key: 'silver', emoji: '⚪', label: 'Silver (125 coins / ₱125)', rarity: 'UNCOMMON' },
        { key: 'gold', emoji: '🟡', label: 'Gold (250 coins / ₱250)', rarity: 'RARE' },
        { key: 'platinum', emoji: '🪙', label: 'Platinum 1-Year (500 coins / ₱500)', rarity: 'RARE' },
        { key: 'diamond', emoji: '🔷', label: 'Diamond (1,000 coins / ₱1,000)', rarity: 'EPIC' },
        { key: 'emerald', emoji: '💚', label: 'Emerald (1,500 coins / ₱1,500)', rarity: 'EPIC' },
        { key: 'ruby', emoji: '🔴', label: 'Ruby (2,500 coins / ₱2,500)', rarity: 'LEGENDARY' },
        { key: 'opal', emoji: '🔮', label: 'Opal (3,000+ coins / ₱3,000+)', rarity: 'MYTHIC' },
      ].map(({ key, emoji, label, rarity }) => (
        <div className="form-group" key={key} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <label className="form-label" style={{ margin: 0 }}>{emoji} {label}</label>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>[▲ {rarity}]</span>
          </div>
          <input
            id={`tier-role-${key}`}
            className="form-input"
            placeholder="Discord Role ID to auto-assign"
            value={tierRoles[key] || ''}
            onChange={(e) => setConfig('tier_roles', { ...tierRoles, [key]: e.target.value })}
          />
        </div>
      ))}
    </>
  );
}

function DealsCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const [dealStatusMsg, setDealStatusMsg] = useState('');
  const [checkingDeals, setCheckingDeals] = useState(false);

  const handleTriggerDeals = async () => {
    setCheckingDeals(true);
    setDealStatusMsg('Scraping Steam & Epic Games Store for deals...');
    try {
      const res = await fetch('/api/gaming/deals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          channel_id: config.channel_id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDealStatusMsg(`✅ ${data.message}`);
      } else {
        setDealStatusMsg(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setDealStatusMsg(`❌ Error: ${e.message}`);
    } finally {
      setCheckingDeals(false);
    }
  };

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Target Channel & Filtering</span>
        <div className="section-divider-line" />
      </div>

      <div className="form-group">
        <label className="form-label">Alert Announcement Channel ID</label>
        <input
          id="deals-channel-id"
          className="form-input"
          placeholder="Channel ID to post deal alerts"
          value={config.channel_id || ''}
          onChange={(e) => setConfig('channel_id', e.target.value)}
        />
        <span className="form-hint">Text channel where deal cards will be posted</span>
      </div>

      <div className="form-group">
        <label className="form-label">Minimum Discount Threshold Filter</label>
        <select
          id="deals-min-discount"
          className="form-input"
          value={config.min_discount_percent ?? 50}
          onChange={(e) => setConfig('min_discount_percent', parseInt(e.target.value))}
        >
          <option value={50}>50% OFF or Greater (Recommended)</option>
          <option value={75}>75% OFF or Greater (Deep Discounts)</option>
          <option value={90}>90% OFF or Greater</option>
          <option value={100}>100% FREE ONLY (Giveaways & Free Games Only)</option>
        </select>
      </div>

      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!config.channel_id || checkingDeals}
          onClick={handleTriggerDeals}
          style={{ backgroundColor: '#10b981', border: 'none', fontWeight: 600, width: '100%' }}
        >
          {checkingDeals ? 'Scanning Platforms...' : '🚀 Force Check & Dispatch Deals Now'}
        </button>

        {dealStatusMsg && (
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: dealStatusMsg.startsWith('✅') ? '#34d399' : dealStatusMsg.startsWith('❌') ? '#f87171' : '#facc15'
          }}>
            {dealStatusMsg}
          </div>
        )}
      </div>
    </>
  );
}

function TriviaCardForm({ config, setConfig, setTriviaRefreshKey }: { config: any; setConfig: (key: string, val: any) => void; setTriviaRefreshKey: React.Dispatch<React.SetStateAction<number>> }) {
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
  };

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Trivia Channel Whitelist & Priority Weights</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {allowedChannels.map((item: any, i: number) => (
          <div key={i} className="multiplier-row" style={{ gridTemplateColumns: '2fr 1.2fr 2fr auto' }}>
            <input
              id={`trivia-chan-${i}`}
              className="form-input"
              placeholder="Channel ID (e.g. 123456789)"
              value={item.channel_id || ''}
              onChange={(e) => {
                const updated = [...allowedChannels];
                updated[i] = { ...item, channel_id: e.target.value };
                setConfig('allowed_channels', updated);
              }}
            />
            <select
              id={`trivia-weight-${i}`}
              className="form-input"
              value={item.weight || 'medium'}
              onChange={(e) => {
                const updated = [...allowedChannels];
                updated[i] = { ...item, weight: e.target.value };
                setConfig('allowed_channels', updated);
              }}
            >
              <option value="high">🔥 High (3x)</option>
              <option value="medium">⚡ Medium (2x)</option>
              <option value="low">🌱 Low (1x)</option>
            </select>
            <input
              id={`trivia-topic-${i}`}
              className="form-input"
              placeholder="Topic / Game (optional)"
              value={item.topic || ''}
              onChange={(e) => {
                const updated = [...allowedChannels];
                updated[i] = { ...item, topic: e.target.value };
                setConfig('allowed_channels', updated);
              }}
            />
            <button
              id={`remove-trivia-chan-${i}`}
              className="btn btn-danger btn-icon btn-sm"
              onClick={() => setConfig('allowed_channels', allowedChannels.filter((_: any, j: number) => j !== i))}
            >✕</button>
          </div>
        ))}
        <button
          id="add-trivia-channel-btn"
          className="btn btn-secondary btn-sm"
          onClick={() => setConfig('allowed_channels', [...allowedChannels, { channel_id: '', weight: 'medium', topic: '' }])}
        >
          + Add Channel Whitelist
        </button>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Schedule & Rewards</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Close Time (24h Format)</label>
          <input
            id="trivia-close-time"
            className="form-input"
            placeholder="e.g. 22:00"
            value={config.close_time || '22:00'}
            onChange={(e) => setConfig('close_time', e.target.value)}
          />
          <span className="form-hint">Daily time when active session closes if not filled</span>
        </div>
        <div className="form-group">
          <label className="form-label">Timezone</label>
          <input
            id="trivia-timezone"
            className="form-input"
            placeholder="e.g. Asia/Manila"
            value={config.timezone || 'Asia/Manila'}
            onChange={(e) => setConfig('timezone', e.target.value)}
          />
          <span className="form-hint">Used to determine daily drop schedule & close hour</span>
        </div>
        <div className="form-group">
          <label className="form-label">Drops Per Day</label>
          <input
            id="trivia-drops-per-day"
            type="number" min="1" max="5"
            className="form-input"
            value={config.drops_per_day ?? 1}
            onChange={(e) => setConfig('drops_per_day', parseInt(e.target.value) || 1)}
          />
          <span className="form-hint">Number of auto-scheduled trivia drops every day</span>
        </div>
        <div className="form-group">
          <label className="form-label">Leaderboard Channel ID (Optional)</label>
          <input
            id="trivia-lb-channel"
            className="form-input"
            placeholder="e.g. 123456789"
            value={config.leaderboard_channel_id || ''}
            onChange={(e) => setConfig('leaderboard_channel_id', e.target.value)}
          />
          <span className="form-hint">Auto-posts & updates Top 5 trivia points leaderboard</span>
        </div>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Allowed Roles (Access Control)</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {allowedRoles.map((roleId: string, i: number) => (
          <div key={i} className="multiplier-row" style={{ gridTemplateColumns: '1fr auto' }}>
            <input
              id={`trivia-role-${i}`}
              className="form-input"
              placeholder="Role ID"
              value={roleId}
              onChange={(e) => {
                const updated = [...allowedRoles];
                updated[i] = e.target.value;
                setConfig('allowed_roles', updated);
              }}
            />
            <button
              id={`remove-trivia-role-${i}`}
              className="btn btn-danger btn-icon btn-sm"
              onClick={() => setConfig('allowed_roles', allowedRoles.filter((_: any, j: number) => j !== i))}
            >✕</button>
          </div>
        ))}
        <button
          id="add-trivia-role-btn"
          className="btn btn-secondary btn-sm"
          onClick={() => setConfig('allowed_roles', [...allowedRoles, ''])}
        >
          + Add Allowed Role
        </button>
      </div>

      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
          ⚡ Manual Trivia Operations
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleManualAction('trigger')}
            style={{ backgroundColor: '#8b5cf6', border: 'none' }}
          >
            🚀 Force Spawn Drop Now
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleManualAction('skip')}
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
          >
            🛑 Force Close Active Session
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleManualAction('reroll')}
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none' }}
          >
            🎲 Reroll Question & Image
          </button>
        </div>
        {manualStatus && (
          <div style={{ marginTop: '0.5rem' }}>
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
          </div>
        )}
      </div>
    </>
  );
}

function BossCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const [bossSubTab, setBossSubTab] = useState<'active' | 'staging'>('active');
  const [showClassImages, setShowClassImages] = useState(false);
  const gameName = config.game_name || '';
  const bossName = config.override_name || '';
  const baseHP = config.override_hp || '';
  const imageUrl = config.custom_image_url || '';
  const bgUrl = config.custom_bg_url || '';
  const victoryImageUrl = config.victory_image_url || '';
  const momImageUrl = config.mom_image_url || '';
  const dadImageUrl = config.dad_image_url || '';
  const kidImageUrl = config.kid_image_url || '';

  const staged = config.staged_boss_config || {};

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          className={`btn btn-sm ${bossSubTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBossSubTab('active')}
        >
          ⚔️ Active Boss & Live Config
        </button>
        <button
          type="button"
          className={`btn btn-sm ${bossSubTab === 'staging' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setBossSubTab('staging')}
        >
          🗓️ Next Week&apos;s Boss Stager
        </button>
      </div>

      {/* Admin Quick Action Controls — Fixed at top */}
      <div style={{
        background: 'rgba(250, 204, 21, 0.05)',
        border: '1px solid rgba(250, 204, 21, 0.2)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#facc15' }}>
          ⚡ Admin Controls (Guild 1111851610474291240)
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
            onClick={async () => {
              if (!confirm('Are you sure you want to FORCE RESET the weekly boss? This will reset Boss HP and player AP for the current week.')) return;
              try {
                const res = await fetch('/api/gaming/boss/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'force_reset' }),
                });
                const data = await res.json();
                if (res.ok) {
                  alert(`✅ ${data.message || 'Boss reset successfully!'}`);
                } else {
                  alert(`❌ Reset failed: ${data.error || 'Unknown error'}`);
                }
              } catch (e: any) {
                alert(`❌ Request error: ${e.message}`);
              }
            }}
          >
            🔄 Force Weekly Reset
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ backgroundColor: '#3b82f6', border: 'none' }}
            onClick={async () => {
              if (!confirm('Are you sure you want to FORCE SPAWN the Weekly Boss? This will update or spawn the active boss for the current week.')) return;
              try {
                const res = await fetch('/api/gaming/boss/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'force_spawn',
                    boss_name: bossName,
                    hp: baseHP,
                    image_url: imageUrl,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  alert(`✅ ${data.message || 'Boss force spawned successfully!'}`);
                } else {
                  alert(`❌ Force spawn failed: ${data.error || 'Unknown error'}`);
                }
              } catch (e: any) {
                alert(`❌ Request error: ${e.message}`);
              }
            }}
          >
            ⚔️ Force Spawn Weekly Boss
          </button>
        </div>
      </div>

      {bossSubTab === 'active' ? (
        <>
          <div className="section-divider">
            <div className="section-divider-line" />
            <span className="section-divider-text">Active Boss Configuration</span>
            <div className="section-divider-line" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Game Name</label>
              <input
                id="boss-game-name"
                className="form-input"
                placeholder="e.g. Where Winds Meet"
                value={gameName}
                onChange={(e) => setConfig('game_name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Boss Name Override</label>
              <input
                id="boss-override-name"
                className="form-input"
                placeholder="e.g. Glitched Void Sovereign"
                value={bossName}
                onChange={(e) => setConfig('override_name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Base Max HP</label>
              <input
                id="boss-override-hp"
                type="number"
                className="form-input"
                placeholder="e.g. 500000"
                value={baseHP}
                onChange={(e) => setConfig('override_hp', parseInt(e.target.value) || '')}
              />
              <span className="form-hint">Scaled automatically based on total weekly participants</span>
            </div>

            <div className="form-group">
              <label className="form-label">Announcement Channel ID</label>
              <input
                id="boss-announcement-channel"
                className="form-input"
                placeholder="Channel ID to post weekly boss status card"
                value={config.channel_id || ''}
                onChange={(e) => setConfig('channel_id', e.target.value)}
              />
            </div>
          </div>

          {/* Collapsible Advanced Settings (Class Cards & Custom Images) */}
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowClassImages(!showClassImages)}
              style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
            >
              <span>🎨 Advanced Settings — Class Cards & Arena Artwork</span>
              <span>{showClassImages ? '▲ Hide' : '▼ Expand'}</span>
            </button>

            {showClassImages && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <ImageUploader
                    id="boss-custom-image"
                    label="Boss Banner Image URL"
                    value={imageUrl}
                    onChange={(url) => setConfig('custom_image_url', url)}
                    previewHeight="120px"
                  />
                  <ImageUploader
                    id="boss-custom-bg"
                    label="Boss Arena Background URL"
                    value={bgUrl}
                    onChange={(url) => setConfig('custom_bg_url', url)}
                    previewHeight="120px"
                  />
                  <ImageUploader
                    id="boss-victory-image"
                    label="Victory Background Image URL"
                    value={victoryImageUrl}
                    onChange={(url) => setConfig('victory_image_url', url)}
                    previewHeight="120px"
                  />
                  <ImageUploader
                    id="boss-mom-image"
                    label="M.O.M. Class Image URL"
                    value={momImageUrl}
                    onChange={(url) => setConfig('mom_image_url', url)}
                    previewHeight="120px"
                  />
                  <ImageUploader
                    id="boss-dad-image"
                    label="D.A.D. Class Image URL"
                    value={dadImageUrl}
                    onChange={(url) => setConfig('dad_image_url', url)}
                    previewHeight="120px"
                  />
                  <ImageUploader
                    id="boss-kid-image"
                    label="K.I.D. Class Image URL"
                    value={kidImageUrl}
                    onChange={(url) => setConfig('kid_image_url', url)}
                    previewHeight="120px"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="section-divider">
            <div className="section-divider-line" />
            <span className="section-divider-text">🗓️ Next Week&apos;s Staged Boss</span>
            <div className="section-divider-line" />
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Pre-configure next week&apos;s boss in advance. On Monday 00:00 GMT+8, the system automatically deploys these values to active boss status.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Staged Game Name</label>
              <input
                id="staged-game-name"
                className="form-input"
                placeholder="e.g. Palworld"
                value={staged.game_name || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, game_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Staged Boss Name</label>
              <input
                id="staged-boss-name"
                className="form-input"
                placeholder="e.g. Jetragon Corruptor"
                value={staged.override_name || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, override_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Staged Base Max HP</label>
              <input
                id="staged-boss-hp"
                type="number"
                className="form-input"
                placeholder="e.g. 600000"
                value={staged.override_hp || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, override_hp: parseInt(e.target.value) || '' })}
              />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <ImageUploader
              id="staged-boss-image"
              label="Staged Boss Banner Image URL"
              value={staged.custom_image_url || ''}
              onChange={(url) => setConfig('staged_boss_config', { ...staged, custom_image_url: url })}
              previewHeight="120px"
            />
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#8b5cf6', border: 'none', fontWeight: 600, width: '100%' }}
              onClick={async () => {
                if (!confirm('Force deploy staged boss configuration to active boss row immediately?')) return;
                try {
                  const res = await fetch('/api/gaming/boss/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'deploy_staged' }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert(`✅ ${data.message || 'Staged boss deployed successfully!'}`);
                  } else {
                    alert(`❌ Deployment failed: ${data.error || 'Unknown error'}`);
                  }
                } catch (e: any) {
                  alert(`❌ Request error: ${e.message}`);
                }
              }}
            >
              🚀 Force Deploy Next Week Staged Boss Now
            </button>
          </div>
        </>
      )}
    </>
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
  const vaultConfig = configs['vault'] || configs['vault_economy'] || {};
  const triviaConfig = configs['trivia'] || {};
  const dealsConfig = configs['free_game_alerts'] || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🎮 Gaming</h1>
        <p>Configure LFG party finder, Vault Economy, Free Game Deals, Trivia Drops, and game branch settings.</p>
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
            className={`sidebar-item ${activeTab === 'deals' ? 'active' : ''}`}
            onClick={() => setActiveTab('deals')}
            id="sidebar-game-deals"
          >
            🎁 Free Game Alerts
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
          <button
            className={`sidebar-item ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
            id="sidebar-game-achievements"
          >
            🏆 Achievements
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
                  {(config, setConfig) => <VaultCardForm config={config} setConfig={setConfig} />}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'deals' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>🎮 Free Game 50%OFF to FREE Game Alerts Guide</h3>
                <p>
                  Automatically monitor Steam, Epic Games Store, GOG, and Humble Store for free games and deep discount offers.
                </p>
                <ul>
                  <li><strong>Target Channel ID</strong>: Text channel where deal alerts are posted.</li>
                  <li><strong>Discount Threshold</strong>: Filter by minimum discount (e.g. 50% OFF, 75% OFF, or 100% FREE ONLY).</li>
                  <li><strong>Interactive Claim Buttons</strong>: Attached to deal cards so members can claim directly in Discord.</li>
                  <li><strong>Auto-Clean Expiry</strong>: Expired deal messages are automatically deleted from Discord when the deal ends.</li>
                </ul>
                <div className="tip-box">
                  <strong>💡 Manual Dispatch:</strong><br />
                  Click <strong>🚀 Force Check & Dispatch Deals Now</strong> to run an instant scan and post new deal cards to Discord right away.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="deals"
                  icon="🎮"
                  title="Free Game 50%OFF to FREE Game Alerts"
                  description="Multi-platform deal scraping (Steam, Epic, GOG), customizable discount thresholds, interactive claim buttons, and auto-expiry message deletion."
                  featureKey="free_game_alerts"
                  initialEnabled={dealsConfig.enabled ?? false}
                  initialConfig={dealsConfig.config ?? {}}
                >
                  {(config, setConfig) => <DealsCardForm config={config} setConfig={setConfig} />}
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
                  <li>Configure the <strong>Close Time</strong> (in 24h format, e.g. <code>22:00</code>) — sessions close at this time if 3 winners haven&apos;t claimed all spots first.</li>
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
                  {(config, setConfig) => <TriviaCardForm config={config} setConfig={setConfig} setTriviaRefreshKey={setTriviaRefreshKey} />}
                </FeatureCard>
              </div>
            </div>
          </div>
        )}

          {activeTab === 'boss' && (
            <div>
              <div className="feature-instructions" style={{ marginBottom: '1.5rem' }}>
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

              <FeatureCard
                id="weekly-boss"
                icon="🐉"
                title="Weekly Boss Bounty RPG"
                description="Self-balancing weekly boss RPG with M.O.M., D.A.D., and K.I.D. combat triad synergy, 5 AP weekly budgets, dynamic participant scaling, and Overkill Mode."
                featureKey="weekly_boss"
                initialEnabled={configs['weekly_boss']?.enabled ?? true}
                initialConfig={configs['weekly_boss']?.config ?? {}}
              >
                {(config, setConfig) => <BossCardForm config={config} setConfig={setConfig} />}
              </FeatureCard>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div>
              <div className="feature-instructions" style={{ marginBottom: '1.5rem' }}>
                <h3>ENOS Community Achievements System Guide</h3>
                <p>
                  Manage all ENOS community achievement modules (Recruitment, Boss RPG, Trivia, Vault Economy). Members earn progressive titles (Enis, Enara, Enorium), Vault Coins, and Discord Nitro rewards as they engage in server activities.
                </p>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="achievements-system"
                  icon="🏆"
                  title="ENOS Achievements System"
                  description="Unified 3-tier achievement platform supporting Recruitment invite tracking, Boss combat, Trivia drops, and Vault economy milestones."
                  featureKey="recruitment_achievement"
                  initialEnabled={configs['recruitment_achievement']?.enabled ?? true}
                  initialConfig={configs['recruitment_achievement']?.config ?? {}}
                >
                  {(config, setConfig) => <AchievementsCardForm config={config} setConfig={setConfig} />}
                </FeatureCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
