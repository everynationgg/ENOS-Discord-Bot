'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

export default function SocialPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

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

  const liveConfig = configs['live_alerts'] || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📡 Social</h1>
        <p>Configure live stream alerts for Twitch and YouTube creators in your community.</p>
      </div>

      <div className="feature-grid">
        <FeatureCard
          id="live-alerts"
          icon="🔴"
          title="Social Sync — Live Alert Hub"
          description="Auto-posts rich embeds when creators go live on Twitch or YouTube. Updates to 'Ended' state when stream closes."
          featureKey="live_alerts"
          initialEnabled={liveConfig.enabled ?? false}
          initialConfig={liveConfig.config ?? {}}
        >
          {(config, setConfig) => {
            const streamers: any[] = config.streamers || [];

            return (
              <>
                <div className="section-divider">
                  <div className="section-divider-line" />
                  <span className="section-divider-text">Alert Settings</span>
                  <div className="section-divider-line" />
                </div>

                <div className="form-group">
                  <label className="form-label">Alert Channel ID</label>
                  <input
                    id="live-alert-channel"
                    className="form-input"
                    placeholder="Channel for live notifications (e.g. #general-chat)"
                    value={config.alert_channel_id || ''}
                    onChange={(e) => setConfig('alert_channel_id', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ping Role ID</label>
                  <input
                    id="live-ping-role"
                    className="form-input"
                    placeholder="Role to mention when a stream goes live"
                    value={config.ping_role_id || ''}
                    onChange={(e) => setConfig('ping_role_id', e.target.value)}
                  />
                </div>

                <div className="section-divider">
                  <div className="section-divider-line" />
                  <span className="section-divider-text">API Credentials</span>
                  <div className="section-divider-line" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Twitch Client ID</label>
                    <input
                      id="twitch-client-id"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={config.twitch_client_id || ''}
                      onChange={(e) => setConfig('twitch_client_id', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Twitch Client Secret</label>
                    <input
                      id="twitch-client-secret"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={config.twitch_client_secret || ''}
                      onChange={(e) => setConfig('twitch_client_secret', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">YouTube API Key</label>
                    <input
                      id="youtube-api-key"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={config.youtube_api_key || ''}
                      onChange={(e) => setConfig('youtube_api_key', e.target.value)}
                    />
                  </div>
                </div>

                <div className="section-divider">
                  <div className="section-divider-line" />
                  <span className="section-divider-text">Streamer List</span>
                  <div className="section-divider-line" />
                </div>

                {/* Column headers */}
                <div className="streamer-row" style={{ marginBottom: '-0.25rem' }}>
                  {['Platform', 'Handle / Channel ID', 'Display Name', ''].map((h) => (
                    <span key={h} style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {streamers.map((s: any, i: number) => (
                    <div key={i} className="streamer-row">
                      <select
                        id={`streamer-platform-${i}`}
                        className="form-select"
                        value={s.platform || 'twitch'}
                        onChange={(e) => {
                          const updated = [...streamers];
                          updated[i] = { ...s, platform: e.target.value };
                          setConfig('streamers', updated);
                        }}
                        style={{ padding: '0.375rem 2rem 0.375rem 0.625rem', fontSize: '0.8125rem' }}
                      >
                        <option value="twitch">🟣 Twitch</option>
                        <option value="youtube">🔴 YouTube</option>
                      </select>
                      <input
                        id={`streamer-handle-${i}`}
                        className="form-input"
                        placeholder={s.platform === 'youtube' ? 'UCxxxxxxx...' : 'username'}
                        value={s.handle || ''}
                        onChange={(e) => {
                          const updated = [...streamers];
                          updated[i] = { ...s, handle: e.target.value };
                          setConfig('streamers', updated);
                        }}
                        style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                      />
                      <input
                        id={`streamer-name-${i}`}
                        className="form-input"
                        placeholder="Display name"
                        value={s.display_name || ''}
                        onChange={(e) => {
                          const updated = [...streamers];
                          updated[i] = { ...s, display_name: e.target.value };
                          setConfig('streamers', updated);
                        }}
                        style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                      />
                      <button
                        id={`remove-streamer-${i}`}
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => setConfig('streamers', streamers.filter((_: any, j: number) => j !== i))}
                      >✕</button>
                    </div>
                  ))}

                  <button
                    id="add-streamer-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfig('streamers', [...streamers, { platform: 'twitch', handle: '', display_name: '' }])}
                  >
                    + Add Streamer
                  </button>
                </div>
              </>
            );
          }}
        </FeatureCard>
      </div>
    </div>
  );
}
