'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

export default function ModerationPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Moderation</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-mod-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'gatekeeper' ? 'active' : ''}`}
            onClick={() => setActiveTab('gatekeeper')}
            id="sidebar-mod-gatekeeper"
          >
            🔐 Gatekeeper Onboarding
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>Moderation Control</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Keep your server secure and streamline the process of welcoming new members.
              </p>

              <div className="overview-item">
                <h3>🔐 Gatekeeper Onboarding</h3>
                <p>
                  Automate server entry verification. Requires new members to read rules, answer sign-up details (like their In-Game Name and Discovery Source), and agree to guidelines in a restricted channel before gaining full server access.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'gatekeeper' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Gatekeeper Setup Guidelines</h3>
                <p>
                  The onboarding system restricts new members to a landing channel until they complete a secure sign-up modal.
                </p>
                <ol>
                  <li>Create a channel where new users start (e.g. <code>#landing-start-here</code>). Enable Developer Mode, right-click the channel, and copy its ID for <strong>Landing Channel ID</strong>.</li>
                  <li>Create a private channel for moderation logs. Copy its ID for <strong>Log Channel ID</strong>. The bot will log all sign-up details here.</li>
                  <li>Create a restricted role (e.g. <code>@unverified</code>) with permissions disabled across other channels. Enter its ID for <strong>Entry Role ID</strong>.</li>
                  <li>Enter the role ID that users should receive upon completing verification (e.g. <code>@verified</code>) in <strong>Verified Member Role ID</strong>.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Active Setup:</strong><br />
                  After configuring and saving settings, run the <code>/admin setup-landing</code> slash command in Discord to render the entry button panel.
                </div>
              </div>

              <div className="feature-form-card">
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
          )}
        </div>
      </div>
    </div>
  );
}
