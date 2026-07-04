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
  const digestConfig = configs['digest'] || {};

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
          <button
            className={`sidebar-item ${activeTab === 'digest' ? 'active' : ''}`}
            onClick={() => setActiveTab('digest')}
            id="sidebar-mod-digest"
          >
            📋 Daily Digest Settings
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

              <div className="overview-item">
                <h3>📋 Multilingual Daily Digest</h3>
                <p>
                  Scrape selected text channels every 24 hours to automatically generate a Taglish-aware Gemini summary digest sent to your moderation announcement channel.
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

          {activeTab === 'digest' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Daily Digest Guidelines</h3>
                <p>The daily digest scans pre-selected channels every 24 hours, summarizes conversations using AI, and outputs a daily report.</p>
                <ol>
                  <li>Create an output channel (e.g. <code>#daily-digest</code>) and copy the ID into <strong>Digest Output Channel ID</strong>.</li>
                  <li>Configure the daily posting time (in Manila/PST timezone) for the digest summary.</li>
                  <li>Under <strong>Source Channel IDs</strong>, paste the IDs of channels you wish the bot to scrape, one ID per line.</li>
                  <li>Provide a valid <strong>Gemini API Key</strong> to process summaries.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Active testing:</strong><br />
                  After saving configurations, run <code>/admin run-digest</code> in Discord to trigger a test summary immediately.
                </div>
              </div>

              <div className="feature-form-card">
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
          )}
        </div>
      </div>
    </div>
  );
}
