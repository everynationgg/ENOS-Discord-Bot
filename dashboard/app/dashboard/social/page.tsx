'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function SocialPage() {
  // Existing Twitch/YouTube state
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // New Birthday System state
  const [birthdayEnabled, setBirthdayEnabled] = useState(false);
  const [birthdayChannelId, setBirthdayChannelId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [announcementTime, setAnnouncementTime] = useState('09:00');
  const [aiPromptFormula, setAiPromptFormula] = useState('');
  
  const [channels, setChannels] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  
  // Track current edit draft text in scratchpad per queue item ID
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Track original rough notes (before AI transform) per queue item ID to support reset
  const [originalNotes, setOriginalNotes] = useState<Record<string, string>>({});
  // Track loading status of individual queue items during LLM call
  const [transformingIds, setTransformingIds] = useState<Record<string, boolean>>({});
  // Track save status of individual cards
  const [cardStatus, setCardStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const [configSaveStatus, setConfigSaveStatus] = useState<SaveStatus>('idle');

  // Load existing alerts configurations
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { 
        setConfigs(d); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch Birthday system configurations and Discord channels
  const loadBirthdaySystem = useCallback(async () => {
    try {
      const [configRes, channelsRes] = await Promise.all([
        fetch('/api/social/birthday/config'),
        fetch('/api/social/birthday/channels')
      ]);

      if (configRes.ok) {
        const config = await configRes.json();
        setBirthdayEnabled(config.birthday_enabled);
        setBirthdayChannelId(config.birthday_channel_id || '');
        setLogChannelId(config.log_channel_id || '');
        setAnnouncementTime(config.announcement_time || '09:00');
        setAiPromptFormula(config.ai_prompt_formula || '');
      }

      if (channelsRes.ok) {
        const textChannels = await channelsRes.json();
        setChannels(textChannels || []);
      }
    } catch (err) {
      console.error('Error loading birthday configuration:', err);
    }
  }, []);

  // Fetch Birthday Approval Queue
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch('/api/social/birthday/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data || []);
        // Initialize drafts
        const initialDrafts: Record<string, string> = {};
        data.forEach((item: any) => {
          initialDrafts[item.id] = item.scratchpad_text || '';
        });
        setDrafts(prev => ({ ...initialDrafts, ...prev }));
      }
    } catch (err) {
      console.error('Error loading birthday queue:', err);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBirthdaySystem();
  }, [loadBirthdaySystem]);

  useEffect(() => {
    if (birthdayEnabled) {
      loadQueue();
    }
  }, [birthdayEnabled, loadQueue]);

  // Handle Birthday Configuration Save
  const handleSaveConfig = async () => {
    setConfigSaveStatus('saving');
    try {
      const res = await fetch('/api/social/birthday/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthday_enabled: birthdayEnabled,
          birthday_channel_id: birthdayChannelId,
          log_channel_id: logChannelId,
          announcement_time: announcementTime,
          ai_prompt_formula: aiPromptFormula,
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      setConfigSaveStatus('saved');
      setTimeout(() => setConfigSaveStatus('idle'), 2500);
    } catch {
      setConfigSaveStatus('error');
    }
  };

  // Handle Transform with AI
  const handleAITransform = async (id: string, userId: string, ign: string) => {
    const currentText = drafts[id] || '';
    
    // Save current notes to originalNotes to allow reset
    setOriginalNotes(prev => ({ ...prev, [id]: currentText }));
    setTransformingIds(prev => ({ ...prev, [id]: true }));

    try {
      const res = await fetch('/api/social/birthday/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ign: ign,
          current_text: currentText,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Transformation failed');
      }

      const data = await res.json();
      setDrafts(prev => ({ ...prev, [id]: data.text }));
    } catch (err: any) {
      alert(`AI Transformation Failed: ${err.message}`);
    } finally {
      setTransformingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Handle Reset Notes
  const handleResetNotes = (id: string) => {
    const original = originalNotes[id] || '';
    setDrafts(prev => ({ ...prev, [id]: original }));
  };

  // Handle Approve & Schedule
  const handleApprove = async (id: string) => {
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          scratchpad_text: drafts[id] || '',
          is_approved: true,
        }),
      });

      if (!res.ok) throw new Error('Approval failed');
      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to update statuses
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch {
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  // Handle Send Now
  const handleSendNow = async (id: string) => {
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          scratchpad_text: drafts[id] || '',
          action: 'send_now',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }

      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to remove this item since it is now sent
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Send failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  // Handle Delete / Dismiss
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this birthday queue item?')) return;
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'delete',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed');
      }

      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to remove this item since it is now deleted
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

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
        <p>Configure live stream alerts and manage community member birthday announcements.</p>
      </div>

      <div className="feature-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Twitch & YouTube live alerts feature card */}
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

        {/* Dynamic Birthday Reminder card using Custom Elements */}
        <div className={`feature-card ${birthdayEnabled ? 'is-active' : ''}`} id="feature-card-birthday">
          
          <div className="feature-card-header">
            <div className="feature-card-meta">
              <div className="feature-card-icon">🎂</div>
              <div>
                <div className="feature-card-title">AI Birthday Announcement & Approval Engine</div>
                <div className="feature-card-desc">Scan upcoming member birthdays, use AI to polish custom wishes, and approve them to release on Discord.</div>
              </div>
            </div>

            <div className="toggle-wrap">
              <span className={`toggle-label ${birthdayEnabled ? 'on' : ''}`}>
                {birthdayEnabled ? 'ON' : 'OFF'}
              </span>
              <label className="toggle" id="toggle-birthday">
                <input
                  type="checkbox"
                  checked={birthdayEnabled}
                  onChange={(e) => setBirthdayEnabled(e.target.checked)}
                  aria-label="Toggle Birthday Reminder System"
                />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
          </div>

          <div className={`feature-card-body ${birthdayEnabled ? 'open' : ''}`}>
            <div className="feature-card-content" style={{ opacity: birthdayEnabled ? 1 : 0.4, pointerEvents: birthdayEnabled ? 'auto' : 'none', transition: 'all 0.2s ease-in-out' }}>
              
              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">System Configuration</span>
                <div className="section-divider-line" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Announcement Channel</label>
                  <select
                    id="birthday-announcement-channel"
                    className="form-select"
                    value={birthdayChannelId}
                    onChange={(e) => setBirthdayChannelId(e.target.value)}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- Select Channel --</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="form-hint">Discord channel where birthday cards will be publicly announced.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Optional Member Log Channel</label>
                  <select
                    id="birthday-log-channel"
                    className="form-select"
                    value={logChannelId}
                    onChange={(e) => setLogChannelId(e.target.value)}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- Disabled --</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="form-hint">Channel to log verification entries when new users set their birthday.</span>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Post Release Time (24h Format, e.g. 09:00)</label>
                  <input
                    id="birthday-release-time"
                    className="form-input"
                    placeholder="09:00"
                    value={announcementTime}
                    onChange={(e) => setAnnouncementTime(e.target.value)}
                    style={{ width: '100px' }}
                  />
                  <span className="form-hint">Release scheduled wishes at this hour on their birthday.</span>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">AI Formula / System Prompt Formula</label>
                  <textarea
                    id="birthday-ai-formula"
                    className="form-textarea"
                    rows={4}
                    placeholder="Instructions for generating the birthday announcement..."
                    value={aiPromptFormula}
                    onChange={(e) => setAiPromptFormula(e.target.value)}
                  />
                  <span className="form-hint">Base prompt given to Gemini to polish notes into greetings.</span>
                </div>
              </div>

              <div className="save-bar" style={{ margin: '1rem -1.5rem -1.5rem', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                <span className={`save-bar-status ${configSaveStatus}`}>{
                  {
                    idle: '',
                    saving: '⏳ Saving...',
                    saved: '✅ Configuration Saved',
                    error: '❌ Save failed',
                  }[configSaveStatus]
                }</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveConfig}
                  disabled={configSaveStatus === 'saving'}
                  id="save-birthday-config-btn"
                >
                  {configSaveStatus === 'saving' ? 'Saving' : '💾 Save Settings'}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Birthday Approval Queue Workspace */}
        {birthdayEnabled && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>🎂 Upcoming Birthdays Workspace (Next 3 Days)</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Polish details, transform with AI, and authorize announcements before release.</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadQueue}>🔄 Refresh Queue</button>
            </div>

            {queueLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : queue.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                🎉 No birthdays coming up in the next 3 days!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                {queue.map((item) => {
                  const id = item.id;
                  const isTransforming = transformingIds[id] || false;
                  const status = cardStatus[id] || 'idle';
                  const isItemApproved = item.is_approved;

                  return (
                    <div key={id} style={{ border: isItemApproved ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                      
                      {isItemApproved && (
                        <span className="badge badge-active" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                          🚀 Approved & Scheduled
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ fontSize: '1.5rem' }}>👤</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            User Mention: <code style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>&lt;@{item.user_id}&gt;</code>
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            In-Game Name (IGN): <strong style={{ color: 'var(--text-secondary)' }}>{item.ign || 'N/A'}</strong> · Date: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(item.target_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                        <textarea
                          id={`scratchpad-${id}`}
                          className="form-textarea"
                          rows={4}
                          placeholder="Write traits, inside jokes, or gaming achievements (e.g. carried team to victory, loves coffee)..."
                          value={drafts[id] ?? ''}
                          onChange={(e) => setDrafts(prev => ({ ...prev, [id]: e.target.value }))}
                          style={{ width: '100%', resize: 'vertical' }}
                          disabled={isTransforming}
                        />
                        {isTransforming && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 'var(--radius-sm)' }}>
                            <div className="spinner" style={{ width: 24, height: 24 }} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            id={`ai-transform-${id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAITransform(id, item.user_id, item.ign || '')}
                            disabled={isTransforming}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            ✨ Transform with AI
                          </button>
                          
                          {originalNotes[id] !== undefined && (
                            <button
                              id={`reset-notes-${id}`}
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleResetNotes(id)}
                              disabled={isTransforming}
                            >
                              🔄 Reset Notes
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.8125rem', color: status === 'error' ? 'var(--text-danger)' : 'var(--text-muted)' }}>
                            {
                              {
                                idle: '',
                                saving: '⏳ Processing...',
                                saved: '✅ Success!',
                                error: '❌ Error occurred',
                              }[status]
                            }
                          </span>
                          
                          <button
                            id={`delete-btn-${id}`}
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(id)}
                            disabled={isTransforming || status === 'saving'}
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            🗑️ Delete
                          </button>

                          <button
                            id={`send-now-btn-${id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSendNow(id)}
                            disabled={isTransforming || status === 'saving'}
                            style={{ border: '1px solid var(--border-subtle)' }}
                          >
                            📣 Send Now
                          </button>

                          <button
                            id={`approve-btn-${id}`}
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(id)}
                            disabled={isTransforming || status === 'saving'}
                            style={{ background: isItemApproved ? 'var(--bg-card)' : 'var(--accent-primary)', border: isItemApproved ? '1px solid var(--border-subtle)' : 'none', color: isItemApproved ? 'var(--text-secondary)' : '#ffffff' }}
                          >
                            {isItemApproved ? '🚀 Re-Approve Wish' : '🚀 Approve & Schedule'}
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Translation Assistant feature card */}
        <FeatureCard
          id="translator"
          icon="🌍"
          title="Social Sync — Translation Assistant"
          description="Enables a context menu in Discord to translate message text into 10 target languages using Google Gemini AI."
          featureKey="translator"
          initialEnabled={configs['translator']?.enabled ?? false}
          initialConfig={configs['translator']?.config ?? { character_limit: 1000, cooldown_seconds: 10 }}
        >
          {(config, setConfig) => (
            <>
              <div className="section-divider">
                <div className="section-divider-line" />
                <span className="section-divider-text">Usage Constraints</span>
                <div className="section-divider-line" />
              </div>

              <div className="form-group">
                <label className="form-label">Max Character Limit</label>
                <input
                  id="translator-char-limit"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1000"
                  value={config.character_limit ?? 1000}
                  onChange={(e) => setConfig('character_limit', parseInt(e.target.value) || 0)}
                />
                <span className="form-hint">Restricts the maximum characters allowed per translation request (helps control Gemini API usage).</span>
              </div>

              <div className="form-group">
                <label className="form-label">User Cooldown (Seconds)</label>
                <input
                  id="translator-cooldown"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 10"
                  value={config.cooldown_seconds ?? 10}
                  onChange={(e) => setConfig('cooldown_seconds', parseInt(e.target.value) || 0)}
                />
                <span className="form-hint">Spam protection: seconds a user must wait between translation requests.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Allowed Role ID (Optional)</label>
                <input
                  id="translator-allowed-role"
                  className="form-input"
                  placeholder="Leave blank for Everyone"
                  value={config.allowed_role_id || ''}
                  onChange={(e) => setConfig('allowed_role_id', e.target.value)}
                />
                <span className="form-hint">Restrict usage to a specific role. Leave blank to allow everyone on the server to use it.</span>
              </div>
            </>
          )}
        </FeatureCard>

      </div>
    </div>
  );
}
