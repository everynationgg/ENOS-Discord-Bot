'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

export default function ModerationPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // AI Help Desk state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

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
          <button
            className={`sidebar-item ${activeTab === 'help_desk' ? 'active' : ''}`}
            onClick={() => setActiveTab('help_desk')}
            id="sidebar-mod-helpdesk"
          >
            🤖 AI Support Help Desk
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

              <div className="overview-item">
                <h3>🤖 AI Support Help Desk</h3>
                <p>
                  Deploy a conversational AI agent inside temporary private threads to answer FAQs and handle server support questions automatically.
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

          {activeTab === 'help_desk' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>AI Support Help Desk Setup</h3>
                <p>
                  Deploy a self-service AI Agent that runs inside temporary, secure private threads:
                </p>
                <ol>
                  <li>
                    Create a channel (e.g. <code>#ask-the-bot</code>) where members can start chats. Input its ID in <strong>Launcher Channel ID</strong>.
                  </li>
                  <li>
                    Create a log channel (e.g. <code>#support-transcripts</code>) where transcripts of closed sessions are archived. Input its ID in <strong>Transcript Log Channel ID</strong>.
                  </li>
                  <li>
                    Define the bot's tone and instructions in <strong>AI Persona / Instructions</strong>.
                  </li>
                  <li>
                    Populate **Custom Q&A Knowledge cards** with server rules or common FAQs. Gemini reads these cards to supply exact server facts!
                  </li>
                  <li>
                    Click **Save Settings** to persist the configuration, then click **Sync Launcher Card** to post the `💬 Start Chat` launcher card!
                  </li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Auto-Clean Timeout:</strong><br />
                  To prevent clutter, threads auto-delete if they remain inactive for the duration set by the Inactivity Timeout slider.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="help_desk"
                  icon="🤖"
                  title="AI Support Help Desk"
                  description="Deploy conversational AI agents inside private threads to handle server FAQs automatically."
                  featureKey="help_desk"
                  initialEnabled={configs['help_desk']?.enabled ?? false}
                  initialConfig={configs['help_desk']?.config ?? {}}
                >
                  {(config, setConfig) => {
                    const faqList = config.faq_list || [];

                    const handleSyncLauncher = async () => {
                      if (!config.launcher_channel_id || !config.launcher_channel_id.trim()) {
                        alert('Please configure and save a valid Launcher Channel ID first.');
                        return;
                      }
                      setSyncStatus('syncing');
                      try {
                        const res = await fetch('/api/moderation/helpdesk/sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ launcher_channel_id: config.launcher_channel_id }),
                        });
                        if (!res.ok) {
                          const errData = await res.json();
                          throw new Error(errData.error || 'Failed to sync');
                        }
                        setSyncStatus('synced');
                        setTimeout(() => setSyncStatus('idle'), 2500);
                      } catch (err: any) {
                        alert(`Sync failed: ${err.message}`);
                        setSyncStatus('error');
                      }
                    };

                    return (
                      <>
                        <div className="form-group">
                          <label className="form-label">Launcher Channel ID</label>
                          <input
                            id="helpdesk-launcher-channel"
                            className="form-input"
                            placeholder="e.g. 1111851611099254815"
                            value={config.launcher_channel_id || ''}
                            onChange={(e) => setConfig('launcher_channel_id', e.target.value)}
                          />
                          <span className="form-hint">Channel where the permanent "Start Chat" embed is posted</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Transcript Log Channel ID</label>
                          <input
                            id="helpdesk-log-channel"
                            className="form-input"
                            placeholder="e.g. 1111851611099254815"
                            value={config.transcript_channel_id || ''}
                            onChange={(e) => setConfig('transcript_channel_id', e.target.value)}
                          />
                          <span className="form-hint">Channel where closed support chat transcripts are sent</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Inactivity Timeout: {config.inactivity_timeout_minutes ?? 30} mins</label>
                          <input
                            id="helpdesk-timeout-slider"
                            type="range"
                            min="15"
                            max="120"
                            step="5"
                            value={config.inactivity_timeout_minutes ?? 30}
                            onChange={(e) => setConfig('inactivity_timeout_minutes', parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                          />
                          <span className="form-hint">Delete thread if inactive for this long</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label">AI Persona / Instructions</label>
                          <textarea
                            id="helpdesk-system-prompt"
                            className="form-textarea"
                            rows={4}
                            placeholder="e.g. You are the Every Nation Support Agent. Keep answers brief..."
                            value={config.ai_system_prompt || ''}
                            onChange={(e) => setConfig('ai_system_prompt', e.target.value)}
                          />
                          <span className="form-hint">System prompt instructions for Gemini AI chatbot</span>
                        </div>

                        <div className="section-divider" style={{ marginTop: '1.5rem' }}>
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Add FAQ Entry</span>
                          <div className="section-divider-line" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">FAQ Question</label>
                          <input
                            id="faq-new-question"
                            className="form-input"
                            placeholder="e.g. How do I get roles?"
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">FAQ Answer</label>
                          <textarea
                            id="faq-new-answer"
                            className="form-textarea"
                            rows={2}
                            placeholder="e.g. Go to #roles-select and click..."
                            value={newAnswer}
                            onChange={(e) => setNewAnswer(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ width: '100%' }}
                          onClick={() => {
                            if (!newQuestion.trim() || !newAnswer.trim()) {
                              alert('Please enter both a question and an answer.');
                              return;
                            }
                            const updated = [...faqList, { question: newQuestion.trim(), answer: newAnswer.trim() }];
                            setConfig('faq_list', updated);
                            setNewQuestion('');
                            setNewAnswer('');
                          }}
                        >
                          Add FAQ Card
                        </button>

                        <div className="section-divider" style={{ marginTop: '1.5rem' }}>
                          <div className="section-divider-line" />
                          <span className="section-divider-text">FAQ Knowledge base ({faqList.length})</span>
                          <div className="section-divider-line" />
                        </div>

                        {faqList.length === 0 ? (
                          <p className="form-hint" style={{ textAlign: 'center' }}>No custom FAQ cards added yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {faqList.map((faq: any, idx: number) => (
                              <div key={idx} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                                  <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Q: {faq.question}</strong>
                                  <button
                                    type="button"
                                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem' }}
                                    onClick={() => {
                                      const updated = faqList.filter((_: any, i: number) => i !== idx);
                                      setConfig('faq_list', updated);
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>A: {faq.answer}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="section-divider" style={{ marginTop: '1.5rem' }}>
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Actions</span>
                          <div className="section-divider-line" />
                        </div>

                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            width: '100%',
                            backgroundColor: syncStatus === 'synced' ? '#10B981' : syncStatus === 'syncing' ? '#6B7280' : 'var(--accent-primary)',
                            borderColor: syncStatus === 'synced' ? '#10B981' : syncStatus === 'syncing' ? '#6B7280' : 'var(--accent-primary)',
                          }}
                          disabled={syncStatus === 'syncing'}
                          onClick={handleSyncLauncher}
                        >
                          {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? '✓ Launcher Card Synced!' : 'Sync Launcher Card'}
                        </button>
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
