'use client';

import FeatureCard from '@/components/FeatureCard';
import ImageUploader from '@/components/ImageUploader';
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
            value={rates.daily_cap ?? 2.50}
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
              value={item.priority || item.weight || 'medium'}
              onChange={(e) => {
                const updated = [...allowedChannels];
                updated[i] = { ...item, priority: e.target.value, weight: e.target.value };
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
              onClick={() => setConfig('allowed_channels', allowedChannels.filter((_, j: number) => j !== i))}
            >✕</button>
          </div>
        ))}
        <button
          id="add-trivia-channel-btn"
          className="btn btn-secondary btn-sm"
          onClick={() => setConfig('allowed_channels', [...allowedChannels, { channel_id: '', priority: 'medium', weight: 'medium', topic: '' }])}
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
        <div className="form-group">
          <label className="form-label">Notification / Alert Channel ID (Optional)</label>
          <input
            id="trivia-notif-channel"
            className="form-input"
            placeholder="e.g. 1530883419678969856"
            value={config.notification_channel_id || ''}
            onChange={(e) => setConfig('notification_channel_id', e.target.value)}
          />
          <span className="form-hint">Posts & sweeps live trivia alerts in your daily quests channel</span>
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const gameName = config.game_name || '';
  const bossName = config.override_name || '';
  const baseHP = config.override_hp || '';
  const imageUrl = config.custom_image_url || '';
  const bgUrl = config.custom_bg_url || '';
  const victoryImageUrl = config.victory_image_url || '';
  const lossImageUrl = config.loss_image_url || '';
  const momImageUrl = config.mom_image_url || '';
  const dadImageUrl = config.dad_image_url || '';
  const kidImageUrl = config.kid_image_url || '';

  const staged = config.staged_boss_config || {};

  const handleBossAction = async (action: string) => {
    if (!confirm(`Confirm action: ${action}?`)) return;
    setActionLoading(action);
    try {
      const body: any = {
        action,
        config,
        customName: bossName,
        gameName,
        customTitle: config.boss_title,
        customLore: config.lore,
        customHp: baseHP,
        customImageUrl: imageUrl,
        customBgUrl: bgUrl,
      };
      const res = await fetch('/api/gaming/boss/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      alert(res.ok ? `✅ ${data.message || 'Success'}` : `❌ ${data.error || 'Error'}`);
    } catch (e: any) { alert(`❌ Request error: ${e.message}`); }
    finally { setActionLoading(null); }
  };

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
          ⚡ Admin Controls
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', fontWeight: 600 }}
            disabled={actionLoading === 'push_live'}
            onClick={() => handleBossAction('push_live')}
            title="Deploy current Live settings immediately to Discord"
          >
            {actionLoading === 'push_live' ? 'Deploying...' : '⚡ Push Live Now'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 600 }}
            disabled={actionLoading === 'slay'}
            onClick={() => handleBossAction('slay')}
          >
            {actionLoading === 'slay' ? 'Executing...' : '💥 Kill Boss (Slay)'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#eab308', color: '#000', border: 'none', fontWeight: 600 }}
            disabled={actionLoading === 'reroll'}
            onClick={() => handleBossAction('reroll')}
          >
            {actionLoading === 'reroll' ? 'Rerolling...' : '🎲 Reroll Lore'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}
            disabled={actionLoading === 'revive'}
            onClick={() => handleBossAction('revive')}
          >
            {actionLoading === 'revive' ? 'Reviving...' : '🔄 Revive / Reset HP'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', fontWeight: 600 }}
            disabled={actionLoading === 'deploy_staged'}
            onClick={() => handleBossAction('deploy_staged')}
          >
            {actionLoading === 'deploy_staged' ? 'Deploying...' : '🚀 Deploy Staged'}
          </button>
        </div>
      </div>

      {bossSubTab === 'active' ? (
        <>
          <div className="section-divider">
            <div className="section-divider-line" />
            <span className="section-divider-text">⚔️ Live Boss Configuration</span>
            <div className="section-divider-line" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Boss Announcement Channel ID</label>
              <input
                id="boss-channel-id"
                className="form-input"
                placeholder="Channel ID where weekly boss spawns and combat cards are posted"
                value={config.channel_id || ''}
                onChange={(e) => setConfig('channel_id', e.target.value)}
              />
              <span className="form-hint">Target Discord channel for Monday 00:00 boss spawns, Saturday conclusions, and live combat cards.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Active Game Realm</label>
              <input
                id="boss-game-name"
                className="form-input"
                placeholder="e.g. Subnautica 2, Palworld"
                value={gameName}
                onChange={(e) => setConfig('game_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Custom Boss Name Override</label>
              <input
                id="boss-name"
                className="form-input"
                placeholder="e.g. Leviathan: Bangus"
                value={bossName}
                onChange={(e) => setConfig('override_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Boss Subtitle / Class Title</label>
              <input
                id="boss-title"
                className="form-input"
                placeholder="e.g. System Threat (Subnautica 2)"
                value={config.boss_title || ''}
                onChange={(e) => setConfig('boss_title', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Base HP Override (Optional)</label>
              <input
                id="boss-hp"
                type="number"
                className="form-input"
                placeholder="Auto-calculated dynamically if blank"
                value={baseHP}
                onChange={(e) => setConfig('override_hp', parseInt(e.target.value) || '')}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Custom Boss Lore & Backstory</label>
              <textarea
                id="boss-lore"
                className="form-textarea"
                rows={3}
                placeholder="Custom lore explaining the boss..."
                value={config.lore || ''}
                onChange={(e) => setConfig('lore', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                🎨 Custom Artwork & Visual Overrides
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowClassImages(!showClassImages)}
              >
                {showClassImages ? 'Hide Artwork Settings' : 'Configure Custom Artwork'}
              </button>
            </div>

            {showClassImages && (
              <div style={{
                background: 'var(--surface-elevated)',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginTop: '0.5rem'
              }}>
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
                    id="boss-loss-image"
                    label="Loss / Defeat Image URL"
                    value={lossImageUrl}
                    onChange={(url) => setConfig('loss_image_url', url)}
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
                value={staged.override_name || staged.boss_name || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, override_name: e.target.value, boss_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Staged Boss Subtitle / Class Title</label>
              <input
                id="staged-boss-title"
                className="form-input"
                placeholder="e.g. System Threat (Palworld)"
                value={staged.boss_title || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, boss_title: e.target.value })}
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
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Staged Custom Boss Lore</label>
              <textarea
                id="staged-boss-lore"
                className="form-textarea"
                rows={3}
                placeholder="Describe next week's boss lore..."
                value={staged.lore || ''}
                onChange={(e) => setConfig('staged_boss_config', { ...staged, lore: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <ImageUploader
              id="staged-boss-image"
              label="Staged Boss Banner Image URL"
              value={staged.custom_image_url || ''}
              onChange={(url) => setConfig('staged_boss_config', { ...staged, custom_image_url: url })}
              previewHeight="120px"
            />
            <ImageUploader
              id="staged-boss-bg-image"
              label="Staged Arena Background Image URL"
              value={staged.custom_bg_url || ''}
              onChange={(url) => setConfig('staged_boss_config', { ...staged, custom_bg_url: url })}
              previewHeight="120px"
            />
            <ImageUploader
              id="staged-boss-victory-image"
              label="Staged Victory Background Image URL"
              value={staged.victory_image_url || ''}
              onChange={(url) => setConfig('staged_boss_config', { ...staged, victory_image_url: url })}
              previewHeight="120px"
            />
            <ImageUploader
              id="staged-boss-loss-image"
              label="Staged Loss / Defeat Image URL"
              value={staged.loss_image_url || ''}
              onChange={(url) => setConfig('staged_boss_config', { ...staged, loss_image_url: url })}
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

function LFGCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const [dispatchingLauncher, setDispatchingLauncher] = useState(false);
  const [launcherStatus, setLauncherStatus] = useState('');

  const handleDeployLauncher = async () => {
    if (!config.lfg_channel_id) return;
    setDispatchingLauncher(true);
    setLauncherStatus('Deploying LFG Launcher card to Discord...');
    try {
      const res = await fetch('/api/gaming/lfg/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy_lfg_launcher',
          lfg_channel_id: config.lfg_channel_id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLauncherStatus('✅ LFG Launcher card successfully posted to Discord!');
      } else {
        setLauncherStatus(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setLauncherStatus(`❌ Error: ${e.message}`);
    } finally {
      setDispatchingLauncher(false);
    }
  };

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Channels & Interactive Launcher</span>
        <div className="section-divider-line" />
      </div>

      <div className="form-group">
        <label className="form-label">LFG Post Channel ID</label>
        <input
          id="lfg-channel"
          className="form-input"
          placeholder="Channel ID where launcher and party cards live"
          value={config.lfg_channel_id || ''}
          onChange={(e) => setConfig('lfg_channel_id', e.target.value)}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!config.lfg_channel_id || dispatchingLauncher}
            onClick={handleDeployLauncher}
            style={{ backgroundColor: '#8b5cf6', border: 'none', fontWeight: 600, fontSize: '0.8rem', width: '100%' }}
          >
            {dispatchingLauncher ? 'Deploying to Discord...' : '🚀 Deploy / Refresh LFG Launcher Post'}
          </button>
          {launcherStatus && (
            <div style={{
              marginTop: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: launcherStatus.startsWith('✅') ? '#34d399' : launcherStatus.startsWith('❌') ? '#f87171' : '#facc15'
            }}>
              {launcherStatus}
            </div>
          )}
        </div>
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
        <span className="section-divider-text">Game Role Mappings (Optional Ping Roles)</span>
        <div className="section-divider-line" />
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
        💡 <strong>Voice rooms are dynamic:</strong> Parties automatically link to whichever voice channel the creator is sitting in (including temporary voice rooms). Optionally specify Discord Role IDs below to restrict ping permissions for specific games.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', marginBottom: '0.5rem', paddingRight: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Game</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Allowed Role ID (Optional)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {GAME_BRANCHES.map((game) => {
          const roleMappings = config.role_mappings || {};
          return (
            <div key={game} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {game}
              </span>
              <input
                id={`lfg-role-${game.toLowerCase().replace(/\s+/g, '-')}`}
                className="form-input"
                placeholder="Discord Role ID (optional)"
                value={roleMappings[game] || ''}
                onChange={(e) => setConfig('role_mappings', { ...roleMappings, [game]: e.target.value })}
                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
              />
            </div>
          );
        })}
      </div>
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
                  The Looking-For-Group (LFG) finder helps players squad up and jump straight into voice channels together.
                </p>
                <ol>
                  <li>Create or designate a read-only Discord channel (e.g. <code>#lfg-posts</code>) and paste its ID into <strong>LFG Post Channel ID</strong>.</li>
                  <li>Click <strong>🚀 Deploy / Refresh LFG Launcher Post</strong> to post the permanent <code>[ 🎮 Look For Group ]</code> button card.</li>
                  <li>Members click the button to open the party creator modal without typing slash commands.</li>
                  <li><strong>Dynamic Voice Channels:</strong> Party cards automatically bind to whichever voice room the creator is currently sitting in (including temporary voice rooms spawned from <code>🎤┊Create VC</code>).</li>
                  <li>Set <strong>Session TTL</strong> to define how long an active party card stays posted before auto-deleting.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Copying Channel IDs:</strong><br />
                  Enable Developer Mode in Discord settings, right-click the text channel in your server panel, and select <strong>Copy Channel ID</strong>.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="lfg"
                  icon="🔍"
                  title="LFG — Group Finder"
                  description="Dynamic party cards with an interactive Discord launcher button. Connects directly to creator's voice channel."
                  featureKey="lfg"
                  initialEnabled={lfgConfig.enabled ?? false}
                  initialConfig={lfgConfig.config ?? {}}
                >
                  {(config, setConfig) => <LFGCardForm config={config} setConfig={setConfig} />}
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
        </div>
      </div>
    </div>
  );
}
