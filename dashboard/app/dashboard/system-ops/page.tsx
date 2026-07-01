'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

export default function SystemOpsPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pruneStatus, setPruneStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/system/health').then((r) => r.json()).catch(() => null),
    ]).then(([cfg, h]) => {
      setConfigs(cfg);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  const triggerPrune = async () => {
    setPruneStatus('running');
    const res = await fetch('/api/system/prune', { method: 'POST' });
    setPruneStatus(res.ok ? 'done' : 'error');
    setTimeout(() => setPruneStatus('idle'), 4000);
  };

  const digestConfig = configs['digest'] || {};
  const isOnline = health?.last_seen
    ? Date.now() - new Date(health.last_seen).getTime() < 10 * 60 * 1000
    : false;

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
        <p>Monitor bot health, manage scheduled jobs, and configure the AI daily digest.</p>
      </div>

      {/* Health Status Cards */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-label">Bot Connection</div>
          <div className="stat-card-value" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="stat-card-sub">Heartbeat: every 5 min</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Last Heartbeat</div>
          <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>
            {health?.last_seen
              ? new Date(health.last_seen).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })
              : '—'}
          </div>
          <div className="stat-card-sub">
            {health?.last_seen
              ? new Date(health.last_seen).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
              : 'Never connected'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Data Pruning</div>
          <div className="stat-card-value" style={{ fontSize: '1rem' }}>
            <button
              className={`btn btn-sm ${pruneStatus === 'running' ? 'btn-secondary' : pruneStatus === 'done' ? 'btn-secondary' : 'btn-danger'}`}
              onClick={triggerPrune}
              disabled={pruneStatus === 'running'}
              id="prune-now-btn"
              style={{ marginTop: '0.25rem' }}
            >
              {pruneStatus === 'running' ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Pruning...</>
               : pruneStatus === 'done' ? '✅ Done'
               : pruneStatus === 'error' ? '❌ Failed'
               : '🗑️ Prune Now'}
            </button>
          </div>
          <div className="stat-card-sub">Removes records {'>'} 30 days</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Cron Jobs</div>
          <div className="stat-card-value" style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
            <span className="badge badge-active">Running</span>
          </div>
          <div className="stat-card-sub">Digest · Quests · Prune · LFG Expiry</div>
        </div>
      </div>

      <div className="feature-grid">
        {/* ─── Daily Digest ─── */}
        <FeatureCard
          id="digest"
          icon="📋"
          title="Multilingual Daily Digest"
          description="Reads the past 24h of community chat and generates a Taglish-aware Gemini summary in your digest channel."
          featureKey="digest"
          initialEnabled={digestConfig.enabled ?? false}
          initialConfig={digestConfig.config ?? {}}
        >
          {(config, setConfig) => (
            <>
              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">Digest Channel</span>
                <div className="section-divider-line" />
              </div>

              <div className="form-group">
                <label className="form-label">Digest Output Channel ID</label>
                <input
                  id="digest-channel"
                  className="form-input"
                  placeholder="#daily-digest-hub channel ID"
                  value={config.digest_channel_id || ''}
                  onChange={(e) => setConfig('digest_channel_id', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Post Time (24h, PST/Manila)</label>
                <input
                  id="digest-time"
                  className="form-input"
                  type="time"
                  value={config.post_time || '08:00'}
                  onChange={(e) => setConfig('post_time', e.target.value)}
                />
              </div>

              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">Source Channels</span>
                <div className="section-divider-line" />
              </div>

              <div className="form-group">
                <label className="form-label">Source Channel IDs (one per line)</label>
                <textarea
                  id="digest-source-channels"
                  className="form-textarea"
                  rows={4}
                  placeholder={'1234567890123456789\n9876543210987654321'}
                  value={(config.source_channel_ids || []).join('\n')}
                  onChange={(e) =>
                    setConfig(
                      'source_channel_ids',
                      e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean)
                    )
                  }
                />
                <span className="form-hint">Channels to scrape for the daily summary</span>
              </div>

              <div className="form-group">
                <label className="form-label">Gemini API Key</label>
                <input
                  id="gemini-api-key"
                  className="form-input"
                  type="password"
                  placeholder="AIza••••••••••"
                  value={config.gemini_api_key || ''}
                  onChange={(e) => setConfig('gemini_api_key', e.target.value)}
                />
                <span className="form-hint">Uses Gemini 1.5 Flash — low cost at daily cadence</span>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--accent-primary-dim)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                💡 Run <code style={{ color: 'var(--accent-primary)' }}>/admin run-digest</code> in Discord to trigger a test digest immediately.
              </div>
            </>
          )}
        </FeatureCard>
      </div>
    </div>
  );
}
