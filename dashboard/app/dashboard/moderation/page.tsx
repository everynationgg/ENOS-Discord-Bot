'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

const DISCOVERY_SOURCES = [
  'TikTok Content', 'Discord Server Discovery', 'Streamer Community',
  'YouTube Recommendation', 'Word of Mouth',
];

export default function ModerationPage() {
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

  const gatekeeperConfig = configs['gatekeeper'] || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🛡️ Moderation</h1>
        <p>Configure automated entry control, onboarding flows, and server access management.</p>
      </div>

      <div className="feature-grid">
        {/* ─── Gatekeeper Onboarding ─── */}
        <FeatureCard
          id="gatekeeper"
          icon="🔐"
          title="Gatekeeper Onboarding"
          description="Automated 3-step verification flow. New members complete a form before gaining server access."
          featureKey="gatekeeper"
          initialEnabled={gatekeeperConfig.enabled ?? false}
          initialConfig={gatekeeperConfig.config ?? {}}
        >
          {(config, setConfig) => (
            <>
              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">Channels & Roles</span>
                <div className="section-divider-line" />
              </div>

              <div className="form-group">
                <label className="form-label">Landing Channel ID</label>
                <input
                  id="gatekeeper-landing-channel"
                  className="form-input"
                  placeholder="e.g. 1234567890123456789"
                  value={config.landing_channel_id || ''}
                  onChange={(e) => setConfig('landing_channel_id', e.target.value)}
                />
                <span className="form-hint">#landing-start-here channel ID</span>
              </div>

              <div className="form-group">
                <label className="form-label">Verification Log Channel ID</label>
                <input
                  id="gatekeeper-log-channel"
                  className="form-input"
                  placeholder="e.g. 1234567890123456789"
                  value={config.log_channel_id || ''}
                  onChange={(e) => setConfig('log_channel_id', e.target.value)}
                />
                <span className="form-hint">Channel where the bot will post submitted user details</span>
              </div>


              <div className="form-group">
                <label className="form-label">Entry (Restricted) Role ID</label>
                <input
                  id="gatekeeper-entry-role"
                  className="form-input"
                  placeholder="Role assigned to new members"
                  value={config.entry_role_id || ''}
                  onChange={(e) => setConfig('entry_role_id', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verified Member Role ID</label>
                <input
                  id="gatekeeper-verified-role"
                  className="form-input"
                  placeholder="Role granted after verification"
                  value={config.verified_role_id || ''}
                  onChange={(e) => setConfig('verified_role_id', e.target.value)}
                />
              </div>

              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">Welcome Message</span>
                <div className="section-divider-line" />
              </div>

              <div className="form-group">
                <label className="form-label">Welcome Text (Supports Markdown)</label>
                <textarea
                  id="gatekeeper-welcome-text"
                  className="form-textarea"
                  rows={5}
                  placeholder="Welcome to Every Nation! ..."
                  value={config.welcome_text || ''}
                  onChange={(e) => setConfig('welcome_text', e.target.value)}
                />
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--accent-primary-dim)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                💡 <strong style={{ color: 'var(--text-primary)' }}>After saving</strong>, run{' '}
                <code style={{ color: 'var(--accent-primary)', background: 'rgba(139,92,246,0.15)', padding: '0.1rem 0.35rem', borderRadius: 3 }}>
                  /admin setup-landing
                </code>{' '}
                in Discord to post the welcome embed.
              </div>
            </>
          )}
        </FeatureCard>
      </div>
    </div>
  );
}
