'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function SocialPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Birthday System state
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

  // Auto-Reaction System state
  const [autoReactions, setAutoReactions] = useState<any[]>([]);
  const [newTriggerWord, setNewTriggerWord] = useState('');
  const [newTriggerEmoji, setNewTriggerEmoji] = useState('');
  const [loadingReactions, setLoadingReactions] = useState(false);

  useEffect(() => {
    if (activeTab === 'auto_reactions') {
      setLoadingReactions(true);
      fetch('/api/social/auto-reactions')
        .then((r) => r.json())
        .then((data) => {
          setAutoReactions(Array.isArray(data) ? data : []);
          setLoadingReactions(false);
        })
        .catch(() => setLoadingReactions(false));
    }
  }, [activeTab]);

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
        fetch('/api/social/birthday/channels'),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setBirthdayEnabled(configData.birthday_enabled ?? false);
        setBirthdayChannelId(configData.birthday_channel_id || '');
        setLogChannelId(configData.log_channel_id || '');
        setAnnouncementTime(configData.announcement_time || '09:00');
        setAiPromptFormula(configData.ai_prompt_formula || '');
      }

      if (channelsRes.ok) {
        const channelsData = await channelsRes.json();
        setChannels(channelsData);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadBirthdaySystem();
  }, [loadBirthdaySystem]);

  // Load Upcoming Birthdays Queue
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch('/api/social/birthday/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
        
        // Initialize drafts and original notes
        const initialDrafts: Record<string, string> = {};
        const initialOriginals: Record<string, string> = {};
        data.forEach((item: any) => {
          initialDrafts[item.id] = item.draft_message || '';
          initialOriginals[item.id] = item.rough_notes || '';
        });
        setDrafts(initialDrafts);
        setOriginalNotes(initialOriginals);
      }
    } catch {}
    setQueueLoading(false);
  }, []);

  useEffect(() => {
    if (birthdayEnabled) {
      loadQueue();
    }
  }, [birthdayEnabled, loadQueue]);

  // Save Birthday System Configuration Settings
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

      if (!res.ok) throw new Error();
      setConfigSaveStatus('saved');
      setTimeout(() => setConfigSaveStatus('idle'), 3000);
    } catch {
      setConfigSaveStatus('error');
      setTimeout(() => setConfigSaveStatus('idle'), 3000);
    }
  };

  // Birthday Queue actions
  const handleTransform = async (id: string, notes: string) => {
    setTransformingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/social/birthday/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (data.polished) {
        setDrafts(prev => ({ ...prev, [id]: data.polished }));
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('AI Transformation failed.');
    }
    setTransformingIds(prev => ({ ...prev, [id]: false }));
  };

  const handleApprove = async (id: string) => {
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const draftMessage = drafts[id] || '';
      const roughNotes = originalNotes[id] || '';

      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve', draft_message: draftMessage, rough_notes: roughNotes }),
      });

      if (!res.ok) throw new Error('Save rejected');
      
      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to reflect approval status change
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const handleSendNow = async (id: string) => {
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const draftMessage = drafts[id] || '';
      const roughNotes = originalNotes[id] || '';

      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'send_now', draft_message: draftMessage, rough_notes: roughNotes }),
      });

      if (!res.ok) throw new Error('Trigger rejected');
      
      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to remove this item since it is now sent
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Send failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this birthday queue entry?')) return;
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });

      if (!res.ok) throw new Error('Delete rejected');
      
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

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Social Settings</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-social-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'live_alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('live_alerts')}
            id="sidebar-social-alerts"
          >
            🔴 Live Alert Hub
          </button>
          <button
            className={`sidebar-item ${activeTab === 'translator' ? 'active' : ''}`}
            onClick={() => setActiveTab('translator')}
            id="sidebar-social-translator"
          >
            🌍 Translation Assistant
          </button>
          <button
            className={`sidebar-item ${activeTab === 'auto_reactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('auto_reactions')}
            id="sidebar-social-reactions"
          >
            ⭐ Auto-Reaction Manager
          </button>
          <button
            className={`sidebar-item ${activeTab === 'birthday_settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('birthday_settings')}
            id="sidebar-social-birthdays"
          >
            🎂 Birthday Announcement
          </button>
          <button
            className={`sidebar-item ${activeTab === 'birthday_queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('birthday_queue')}
            id="sidebar-social-queue"
          >
            🎉 Birthday Queue Workspace
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>Social Integration Control</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Keep your community connected and updated with live alerts, text translations, and customized birthday announcements.
              </p>

              <div className="overview-item">
                <h3>🔴 Social Sync — Live Alert Hub</h3>
                <p>Auto-posts rich embeds when creators go live on Twitch or YouTube. Updates to 'Ended' state when stream closes.</p>
              </div>

              <div className="overview-item">
                <h3>🌍 Social Sync — Translation Assistant</h3>
                <p>Enables a context menu in Discord to translate message text into 10 target languages using Google Gemini AI.</p>
              </div>

              <div className="overview-item">
                <h3>⭐ Auto-Reaction Manager</h3>
                <p>Automatically reacts to configured trigger words/phrases with specific emojis, and option to mirror reactions.</p>
              </div>

              <div className="overview-item">
                <h3>🎂 AI Birthday Announcement Settings</h3>
                <p>Configure target channels, release schedules, and prompt formulas to release personalized AI-polished birthday announcements.</p>
              </div>

              <div className="overview-item">
                <h3>🎉 Birthday Queue Workspace</h3>
                <p>Manage and authorize upcoming birthday cards, transform rough member facts into polished greetings, and release them to Discord.</p>
              </div>
            </div>
          )}

          {activeTab === 'auto_reactions' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Auto-Reaction Guidelines</h3>
                <p>
                  Create automatic reactions to boost community expression and drive engagement:
                </p>
                <ol>
                  <li>Input a <strong>Trigger Word or Phrase</strong> (e.g. <code>gg</code>, <code>hype</code>).</li>
                  <li>Provide the <strong>Reaction Emoji</strong>. This can be a standard Unicode emoji or a custom Discord emoji.</li>
                  <li>Enable <strong>Reaction Mirroring</strong> to double standard reaction counts when server members react to messages.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Unicode vs Custom Emojis:</strong><br />
                  For standard emojis, paste the raw emoji (like 🔥). For custom emojis, ensure the bot has access to the server/emoji.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="auto_reactions"
                  icon="⭐"
                  title="Auto-Reaction Manager"
                  description="Automatically reacts to configured trigger words, and mirrors user reactions."
                  featureKey="auto_reactions"
                  initialEnabled={configs['auto_reactions']?.enabled ?? false}
                  initialConfig={configs['auto_reactions']?.config ?? {}}
                >
                  {(config, setConfig) => (
                    <>
                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <input
                          id="reactions-mirroring-toggle"
                          type="checkbox"
                          checked={config.reaction_mirroring ?? false}
                          onChange={(e) => setConfig('reaction_mirroring', e.target.checked)}
                          style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                        />
                        <label htmlFor="reactions-mirroring-toggle" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                          Enable Reaction Mirroring (Double Reactions)
                        </label>
                      </div>
                      <p className="form-hint" style={{ marginTop: '0.25rem' }}>
                        When enabled, the bot duplicates reactions added by server members to increase reaction count.
                      </p>

                      <div className="section-divider" style={{ marginTop: '1.5rem' }}>
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Add Reaction Trigger</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Trigger Word / Phrase</label>
                          <input
                            id="reactions-new-trigger"
                            className="form-input"
                            placeholder="e.g. hype, gg, congrats"
                            value={newTriggerWord}
                            onChange={(e) => setNewTriggerWord(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Reaction Emoji (Unicode or Name)</label>
                          <input
                            id="reactions-new-emoji"
                            className="form-input"
                            placeholder="e.g. 🔥, 👍, :hype:"
                            value={newTriggerEmoji}
                            onChange={(e) => setNewTriggerEmoji(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ height: '38px', padding: '0 1rem' }}
                          onClick={async () => {
                            if (!newTriggerWord.trim() || !newTriggerEmoji.trim()) {
                              alert('Please fill out both the trigger word and the emoji.');
                              return;
                            }
                            try {
                              const res = await fetch('/api/social/auto-reactions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'add',
                                  trigger_word: newTriggerWord,
                                  reaction_emoji: newTriggerEmoji,
                                }),
                              });
                              if (!res.ok) throw new Error('Failed to add trigger');
                              const newRow = await res.json();
                              setAutoReactions((prev) => [...prev, newRow]);
                              setNewTriggerWord('');
                              setNewTriggerEmoji('');
                            } catch (err: any) {
                              alert(err.message);
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>

                      <div className="section-divider" style={{ marginTop: '1.5rem' }}>
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Active Word Triggers</span>
                        <div className="section-divider-line" />
                      </div>

                      {loadingReactions ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                          <div className="spinner" style={{ width: 24, height: 24 }} />
                        </div>
                      ) : autoReactions.length === 0 ? (
                        <p className="form-hint" style={{ textAlign: 'center', padding: '1rem' }}>
                          No word triggers configured yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                          {autoReactions.map((trig) => (
                            <div key={trig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <span style={{ fontSize: '0.875rem' }}>
                                Trigger: <code style={{ color: 'var(--accent-primary)', backgroundColor: 'transparent', padding: 0 }}>{trig.trigger_word}</code> ➡️ {trig.reaction_emoji}
                              </span>
                              <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.8125rem' }}
                                onClick={async () => {
                                  if (!confirm('Are you sure you want to delete this trigger?')) return;
                                  try {
                                    const res = await fetch('/api/social/auto-reactions', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'delete', id: trig.id }),
                                    });
                                    if (!res.ok) throw new Error('Failed to delete trigger');
                                    setAutoReactions((prev) => prev.filter((t) => t.id !== trig.id));
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'live_alerts' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Live Alert Hub Guidelines</h3>
                <p>Auto-post cards when creators start streaming. Follow these steps to configure connections:</p>
                <ol>
                  <li>Enable Developer Mode in Discord, right-click the target text channel, and copy the ID into <strong>Alert Channel ID</strong>.</li>
                  <li>Right-click your notification role under Server Settings {"->"} Roles, copy the ID, and input it into <strong>Ping Role ID</strong>.</li>
                  <li>Register a Twitch application in the Developer Console and provide the Client ID and Secret.</li>
                  <li>Generate a YouTube Data API Key from the Google Cloud Console.</li>
                  <li>Add streamers using their exact Twitch handle, or YouTube channel ID (e.g. <code>UCxxxxxx</code>).</li>
                </ol>
              </div>

              <div className="feature-form-card">
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
              </div>
            </div>
          )}

          {activeTab === 'translator' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Translation Assistant Guidelines</h3>
                <p>Enables members to right-click messages in Discord and select <strong>Apps {"->"} Translate Message</strong>.</p>
                <ul>
                  <li><strong>Max Character Limit</strong>: Set the max characters per translation call (e.g. 1000) to control Gemini usage rates.</li>
                  <li><strong>User Cooldown</strong>: Set user spam limits in seconds (e.g. 10 seconds).</li>
                  <li><strong>Allowed Role ID(s)</strong>: Restrict command access to specified roles. Copy multiple role IDs and separate them with commas. Leave blank to allow everyone to translate.</li>
                </ul>
                <div className="tip-box">
                  <strong>💡 Copying role IDs:</strong><br />
                  Go to Server Settings {"->"} Roles, right-click the desired role, and select <strong>Copy Role ID</strong>.
                </div>
              </div>

              <div className="feature-form-card">
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
                        <label className="form-label">Allowed Role ID(s) (Optional)</label>
                        <input
                          id="translator-allowed-role"
                          className="form-input"
                          placeholder="e.g. roleId1, roleId2 (Leave blank for Everyone)"
                          value={config.allowed_role_id || ''}
                          onChange={(e) => setConfig('allowed_role_id', e.target.value)}
                        />
                        <span className="form-hint">Restrict usage to specific role IDs (comma-separated). Leave blank to allow everyone. Admins and Server Owners bypass this restriction automatically.</span>
                      </div>
                    </>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'birthday_settings' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Birthday Settings Guidelines</h3>
                <p>Announce community member birthdays using automated schedules and AI wishes.</p>
                <ol>
                  <li>Create a public channel (e.g. <code>#birthdays</code>) and copy the ID into <strong>Announcement Channel</strong>.</li>
                  <li>Configure <strong>Post Release Time</strong> in 24h format (e.g. `09:00`) when public announcements will release.</li>
                  <li>Set the <strong>AI Prompt Formula</strong> to instruct Google Gemini on writing style, formatting, and custom traits integration.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Channel ID lookup:</strong><br />
                  Enable Developer Mode, right-click the target channel, and select <strong>Copy Channel ID</strong>.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem' }}>
                <div className="feature-card-header" style={{ padding: 0, marginBottom: '1.5rem', borderBottom: 'none' }}>
                  <div className="feature-card-meta">
                    <div className="feature-card-icon">🎂</div>
                    <div>
                      <div className="feature-card-title">AI Birthday Announcement Settings</div>
                      <div className="feature-card-desc">Configure target channels, release schedules, and system instructions for Google Gemini AI.</div>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                      <div className="form-group">
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

                      <div className="form-group">
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
            </div>
          )}

          {activeTab === 'birthday_queue' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Birthday Queue Instructions</h3>
                <p>Review and authorize announcement cards for members celebrating birthdays in the next 3 days.</p>
                <ol>
                  <li>Type in traits or fun facts inside the <strong>Member Traits</strong> box (e.g. "loves FPS games, plays Valorant, always helpful").</li>
                  <li>Click <strong>🤖 Transform with AI</strong> to trigger Google Gemini AI to draft a polished greeting using your custom Prompt Formula.</li>
                  <li>Click <strong>💾 Save & Approve</strong> to queue the wish. The bot will release it publicly at the configured announcement hour on their birthday.</li>
                  <li>Use <strong>📣 Send Now</strong> to skip scheduling and post it immediately, or <strong>🗑️ Delete</strong> to clear the queue item.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Daily Processing:</strong><br />
                  Wishes that are approved will release automatically at the selected post hour on the user's birthday date.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>🎂 Upcoming Birthdays Workspace (Next 3 Days)</h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Polish details, transform with AI, and authorize announcements before release.</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={loadQueue}>🔄 Refresh Queue</button>
                </div>

                {!birthdayEnabled ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                    🎂 Birthday System is currently disabled. Enable it in the settings tab to view the queue workspace.
                  </div>
                ) : queueLoading ? (
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
                              id={`traits-input-${id}`}
                              className="form-textarea"
                              rows={2}
                              placeholder="Type in traits or fun facts..."
                              value={originalNotes[id] || ''}
                              onChange={(e) => setOriginalNotes(prev => ({ ...prev, [id]: e.target.value }))}
                              disabled={isTransforming || status === 'saving'}
                              style={{ width: '100%', fontSize: '0.8125rem' }}
                            />
                            <button
                              id={`transform-ai-btn-${id}`}
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTransform(id, originalNotes[id] || '')}
                              disabled={isTransforming || status === 'saving' || !(originalNotes[id]?.trim())}
                              style={{ position: 'absolute', right: '0.5rem', bottom: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              {isTransforming ? '⏳ Transforming...' : '🤖 Transform with AI'}
                            </button>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Edit Draft Message</label>
                            <textarea
                              id={`draft-input-${id}`}
                              className="form-textarea"
                              rows={3}
                              placeholder="AI Draft wishes will load here, or type your own greeting..."
                              value={drafts[id] || ''}
                              onChange={(e) => setDrafts(prev => ({ ...prev, [id]: e.target.value }))}
                              disabled={isTransforming || status === 'saving'}
                              style={{ width: '100%', fontSize: '0.8125rem' }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
