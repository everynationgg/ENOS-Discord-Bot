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

  // Live Alerts System state (Twitch & TikTok)
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [newAlertHandle, setNewAlertHandle] = useState('');
  const [newAlertPlatform, setNewAlertPlatform] = useState<'twitch' | 'tiktok'>('twitch');
  const [newAlertChannelId, setNewAlertChannelId] = useState('');
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  // EN TTS System state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsLanguage, setTtsLanguage] = useState('en');
  const [ttsVoiceModel, setTtsVoiceModel] = useState('female');
  const [ttsPersona, setTtsPersona] = useState('default');
  const [ttsMaxChars, setTtsMaxChars] = useState(200);
  const [ttsIgnoredPrefixes, setTtsIgnoredPrefixes] = useState('!, //, (');
  const [ttsVoiceBotClientId, setTtsVoiceBotClientId] = useState('1531251424456081569');
  const [loadingTts, setLoadingTts] = useState(false);
  const [saveTtsStatus, setSaveTtsStatus] = useState<SaveStatus>('idle');

  // Dynamic Temporary Voice Channel state
  const [tempVoiceEnabled, setTempVoiceEnabled] = useState(false);
  const [tempVoiceHubId, setTempVoiceHubId] = useState('');
  const [tempVoiceTemplate, setTempVoiceTemplate] = useState("🎮 {username}'s Room");
  const [tempVoiceLimit, setTempVoiceLimit] = useState(0);
  const [saveTempVoiceStatus, setSaveTempVoiceStatus] = useState<SaveStatus>('idle');

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
    if (activeTab === 'live_alerts') {
      setLoadingAlerts(true);
      Promise.all([
        fetch('/api/social/live-alerts').then((r) => r.json()),
        fetch('/api/social/birthday/channels').then((r) => r.json()),
      ])
        .then(([alertsData, channelsData]) => {
          setLiveAlerts(Array.isArray(alertsData) ? alertsData : (alertsData?.alerts || []));
          const channelList = Array.isArray(channelsData) ? channelsData : (channelsData?.channels || []);
          setChannels(channelList);
          setLoadingAlerts(false);
        })
        .catch(() => setLoadingAlerts(false));
    }
    if (activeTab === 'en_tts') {
      setLoadingTts(true);
      fetch('/api/social/tts/config')
        .then((r) => r.json())
        .then((data) => {
          if (data.voice_bot_client_id) setTtsVoiceBotClientId(data.voice_bot_client_id);
          // Top-level enabled comes from the standard guild_config.enabled column
          setTtsEnabled(data.enabled ?? true);
          const cfg = data.config || {};
          setTtsLanguage(cfg.default_language || 'en');
          setTtsVoiceModel(cfg.default_voice_model || 'female');
          setTtsPersona(cfg.default_persona || 'default');
          setTtsMaxChars(cfg.max_characters || 200);
          setTtsIgnoredPrefixes(cfg.ignored_prefixes || '!, //, (');
          setLoadingTts(false);
        })
        .catch(() => setLoadingTts(false));
    }
  }, [activeTab]);

  // Load existing alerts configurations
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { 
        setConfigs(d); 
        const tv = d['temp_voice'];
        if (tv) {
          setTempVoiceEnabled(tv.enabled ?? false);
          if (tv.config?.hub_channel_id) setTempVoiceHubId(tv.config.hub_channel_id);
          if (tv.config?.default_name_template) setTempVoiceTemplate(tv.config.default_name_template);
          if (tv.config?.default_user_limit !== undefined) setTempVoiceLimit(tv.config.default_user_limit);
        }
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
      const res = await fetch(`/api/social/birthday/queue?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setQueue(Array.isArray(data) ? data : []);
        
        // Initialize drafts and original notes
        const initialDrafts: Record<string, string> = {};
        const initialOriginals: Record<string, string> = {};
        data.forEach((item: any) => {
          initialDrafts[item.id] = item.scratchpad_text || item.draft_message || '';
          initialOriginals[item.id] = item.rough_notes || item.scratchpad_text || '';
        });
        setDrafts(initialDrafts);
        setOriginalNotes(initialOriginals);
      }
    } catch {}
    setQueueLoading(false);
  }, []);

  // Always load the queue on mount and whenever the birthday_queue tab becomes active
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (activeTab === 'birthday_queue') {
      loadQueue();
    }
  }, [activeTab, loadQueue]);

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
  const handleTransform = async (id: string, notes: string, userId?: string, ign?: string) => {
    setTransformingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/social/birthday/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ign: ign || 'N/A',
          current_text: notes,
          notes,
        }),
      });
      const data = await res.json();
      const polishedText = data.polished || data.text;
      if (polishedText) {
        setDrafts(prev => ({ ...prev, [id]: polishedText }));
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
        body: JSON.stringify({
          id,
          action: 'approve',
          scratchpad_text: draftMessage,
          draft_message: draftMessage,
          rough_notes: roughNotes,
        }),
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
        body: JSON.stringify({
          id,
          action: 'send_now',
          scratchpad_text: draftMessage,
          draft_message: draftMessage,
          rough_notes: roughNotes,
        }),
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
    if (!confirm('Are you sure you want to dismiss this birthday from the queue? It will not re-appear for this date.')) return;
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });

      if (!res.ok) throw new Error('Delete rejected');
      
      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      // Reload queue to remove this item since it is now dismissed
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Dismiss failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const handleSendAdminAlert = async (id: string) => {
    setCardStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/social/birthday/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'send_admin_alert' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Alert trigger failed');

      setCardStatus(prev => ({ ...prev, [id]: 'saved' }));
      loadQueue();
      setTimeout(() => setCardStatus(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      alert(`Admin alert failed: ${err.message}`);
      setCardStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const saveTtsSettings = async () => {
    setSaveTtsStatus('saving');
    try {
      const res = await fetch('/api/social/tts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            enabled: ttsEnabled,
            default_language: ttsLanguage,
            default_voice_model: ttsVoiceModel,
            default_persona: ttsPersona,
            max_characters: ttsMaxChars,
            ignored_prefixes: ttsIgnoredPrefixes,
          },
        }),
      });

      if (res.ok) {
        setSaveTtsStatus('saved');
        setTimeout(() => setSaveTtsStatus('idle'), 2500);
      } else {
        setSaveTtsStatus('error');
      }
    } catch (e) {
      setSaveTtsStatus('error');
    }
  };

  const saveTempVoiceSettings = async () => {
    setSaveTempVoiceStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_key: 'temp_voice',
          enabled: tempVoiceEnabled,
          config: {
            hub_channel_id: tempVoiceHubId,
            default_name_template: tempVoiceTemplate,
            default_user_limit: Number(tempVoiceLimit) || 0,
          },
        }),
      });

      if (res.ok) {
        setSaveTempVoiceStatus('saved');
        setTimeout(() => setSaveTempVoiceStatus('idle'), 2500);
      } else {
        setSaveTempVoiceStatus('error');
      }
    } catch {
      setSaveTempVoiceStatus('error');
    }
  };

  const toggleTempVoice = async (nextEnabled: boolean) => {
    setTempVoiceEnabled(nextEnabled);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_key: 'temp_voice',
          enabled: nextEnabled,
          config: {
            hub_channel_id: tempVoiceHubId,
            default_name_template: tempVoiceTemplate,
            default_user_limit: Number(tempVoiceLimit) || 0,
          },
        }),
      });
    } catch {}
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
            onClick={() => {
              setActiveTab('birthday_queue');
              loadQueue();
            }}
            id="sidebar-social-queue"
          >
            🎉 Birthday Queue Workspace
          </button>
          <button
            className={`sidebar-item ${activeTab === 'en_tts' ? 'active' : ''}`}
            onClick={() => setActiveTab('en_tts')}
            id="sidebar-social-tts"
          >
            🎙️ EN TTS & Voice Herald
          </button>
          <button
            className={`sidebar-item ${activeTab === 'temp_voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('temp_voice')}
            id="sidebar-social-tempvoice"
          >
            🔊 Dynamic Voice Channels
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
                <p>Auto-posts rich embeds when creators go live on Twitch or TikTok. Updates to &apos;Ended&apos; state when stream closes.</p>
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

              <div className="overview-item">
                <h3>🎙️ EN TTS &amp; Voice Herald</h3>
                <p>Summons a dedicated Text-to-Speech sub-bot into voice channels to read messages aloud with configurable language, pitch, and character persona.</p>
              </div>

              <div className="overview-item">
                <h3>🔊 Dynamic Voice Channels (Join to Create)</h3>
                <p>Enables members to click a starter channel to automatically spawn customized, self-cleaning voice rooms with in-channel setup modals and creator controls.</p>
              </div>
            </div>
          )}

          {activeTab === 'live_alerts' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Live Stream Alert Guidelines</h3>
                <p>
                  Automatically notify your Discord server when creators start streaming:
                </p>
                <ol>
                  <li>Select the <strong>Platform</strong> (Twitch 👾 or TikTok 🎵).</li>
                  <li>Enter the streamer&apos;s <strong>Username / Handle</strong>.</li>
                  <li>Select the <strong>Target Discord Channel</strong> for automated live alert announcements.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Stream Status Updates:</strong><br />
                  The bot checks streamer status every 5 minutes and updates announcements in real time when streams go live or offline.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Register Stream Alert Target</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Platform</label>
                    <select
                      className="form-input"
                      value={newAlertPlatform}
                      onChange={(e) => setNewAlertPlatform(e.target.value as 'twitch' | 'tiktok')}
                    >
                      <option value="twitch">👾 Twitch</option>
                      <option value="tiktok">🎵 TikTok</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Streamer Handle</label>
                    <input
                      className="form-input"
                      placeholder="e.g. streamer_name"
                      value={newAlertHandle}
                      onChange={(e) => setNewAlertHandle(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Target Channel</label>
                    <select
                      className="form-input"
                      value={newAlertChannelId}
                      onChange={(e) => setNewAlertChannelId(e.target.value)}
                    >
                      <option value="">Select channel...</option>
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ height: '38px', padding: '0 1rem' }}
                    onClick={async () => {
                      if (!newAlertHandle.trim() || !newAlertChannelId.trim()) {
                        alert('Please provide streamer handle and select a target channel.');
                        return;
                      }
                      try {
                        const res = await fetch('/api/social/live-alerts', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            platform: newAlertPlatform,
                            handle: newAlertHandle,
                            channel_id: newAlertChannelId,
                          }),
                        });
                        if (!res.ok) throw new Error('Failed to add live alert handle');
                        const data = await res.json();
                        if (data.alert) setLiveAlerts((prev) => [data.alert, ...prev]);
                        setNewAlertHandle('');
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                  >
                    Add Alert
                  </button>
                </div>

                <div className="section-divider" style={{ marginTop: '1rem' }}>
                  <div className="section-divider-line" />
                  <span className="section-divider-text">Configured Live Stream Alerts</span>
                  <div className="section-divider-line" />
                </div>

                {loadingAlerts ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                    <div className="spinner" style={{ width: 24, height: 24 }} />
                  </div>
                ) : liveAlerts.length === 0 ? (
                  <p className="form-hint" style={{ textAlign: 'center', padding: '1rem' }}>
                    No Twitch or TikTok stream alerts configured yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {(liveAlerts || []).map((alertItem) => (
                      <div
                        key={alertItem.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>
                            {alertItem.platform === 'twitch' ? '👾' : '🎵'}
                          </span>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {alertItem.platform}: @{alertItem.handle}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Channel: <code style={{ padding: '0 4px' }}>#{(channels || []).find((c) => c.id === alertItem.channel_id)?.name || alertItem.channel_id}</code>
                              {alertItem.is_live ? ' · 🔴 LIVE NOW' : ' · ⚪ Offline'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.8125rem' }}
                          onClick={async () => {
                            if (!confirm(`Delete stream alert for @${alertItem.handle}?`)) return;
                            try {
                              const res = await fetch(`/api/social/live-alerts?id=${alertItem.id}`, { method: 'DELETE' });
                              if (!res.ok) throw new Error('Failed to delete alert');
                              setLiveAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));
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
                  <li>Register a Twitch application in the Developer Console and provide the Client ID and Secret (for Twitch streamers).</li>
                  <li>Add streamers using their exact Twitch handle, or TikTok username (e.g. <code>@username</code>).</li>
                </ol>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="live-alerts"
                  icon="🔴"
                  title="Social Sync — Live Alert Hub"
                  description="Auto-posts rich embeds when creators go live on Twitch or TikTok. Updates to 'Ended' state when stream closes."
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
                        </div>

                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Streamer List</span>
                          <div className="section-divider-line" />
                        </div>

                        <div className="streamer-row" style={{ marginBottom: '-0.25rem' }}>
                          {['Platform', 'Handle / Username', 'Display Name', ''].map((h) => (
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
                                <option value="tiktok">🎵 TikTok</option>
                              </select>
                              <input
                                id={`streamer-handle-${i}`}
                                className="form-input"
                                placeholder={s.platform === 'tiktok' ? '@username' : 'username'}
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
                          {birthdayChannelId && !channels.some((c) => c.id === birthdayChannelId) && (
                            <option value={birthdayChannelId}># birthday-announcements ({birthdayChannelId})</option>
                          )}
                          {channels.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <span className="form-hint">Discord channel where birthday cards will be publicly announced.</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Admin Reminder & Log Channel (1-Day Ahead Birthday Alerts)</label>
                        <select
                          id="birthday-log-channel"
                          className="form-select"
                          value={logChannelId}
                          onChange={(e) => setLogChannelId(e.target.value)}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', width: '100%', color: 'var(--text-primary)' }}
                        >
                          <option value="">-- Disabled --</option>
                          {logChannelId && !channels.some((c) => c.id === logChannelId) && (
                            <option value={logChannelId}># admin-reminders ({logChannelId})</option>
                          )}
                          {channels.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <span className="form-hint">Target channel to receive 1-day-ahead birthday admin alerts and birthday verification logs.</span>
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
                  <li>Type in traits or fun facts inside the <strong>Member Traits</strong> box (e.g. &quot;loves FPS games, plays Valorant, always helpful&quot;).</li>
                  <li>Click <strong>🤖 Transform with AI</strong> to trigger Google Gemini AI to draft a polished greeting using your custom Prompt Formula.</li>
                  <li>Click <strong>💾 Save & Approve</strong> to queue the wish. The bot will release it publicly at the configured announcement hour on their birthday.</li>
                  <li>Use <strong>📣 Send Now</strong> to skip scheduling and post it immediately, or <strong>🗑️ Delete</strong> to clear the queue item.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Daily Processing:</strong><br />
                  Wishes that are approved will release automatically at the selected post hour on the user&apos;s birthday date.
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
                        <div key={id} style={{ border: isItemApproved ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          
                          {/* Card Header: User Info & Status Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: '220px', flex: '1 1 auto' }}>
                              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>👤</div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                  User Mention: <code style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>&lt;@{item.user_id}&gt;</code>
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                  In-Game Name (IGN): <strong style={{ color: 'var(--text-secondary)' }}>{item.ign || 'N/A'}</strong> · Date: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(item.target_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</strong>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                              {item.admin_alert_sent ? (
                                <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.72rem', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap' }}>
                                  🔔 Admin Alert Sent
                                </span>
                              ) : (
                                <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#FACC15', border: '1px solid rgba(234,179,8,0.3)', fontSize: '0.72rem', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap' }}>
                                  ⏳ Alert Pending
                                </span>
                              )}
                              {isItemApproved && (
                                <span className="badge badge-active" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.72rem', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap' }}>
                                  🚀 Approved & Scheduled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Member Traits / Notes Box */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', margin: 0, fontWeight: 600 }}>
                                Member Traits & Notes (Input for AI)
                              </label>
                              <button
                                id={`transform-ai-btn-${id}`}
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleTransform(id, originalNotes[id] || '', item.user_id, item.ign)}
                                disabled={isTransforming || status === 'saving'}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                {isTransforming ? '⏳ Transforming...' : '🤖 Transform with AI'}
                              </button>
                            </div>
                            <textarea
                              id={`traits-input-${id}`}
                              className="form-textarea"
                              rows={2}
                              placeholder="Type in traits or fun facts (e.g. loves FPS games, always helpful)..."
                              value={originalNotes[id] || ''}
                              onChange={(e) => setOriginalNotes(prev => ({ ...prev, [id]: e.target.value }))}
                              disabled={isTransforming || status === 'saving'}
                              style={{ width: '100%', fontSize: '0.8125rem' }}
                            />
                          </div>

                          {/* Polished Draft Message Box */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', fontWeight: 600 }}>Edit Draft Message</label>
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

                          {/* Action Buttons Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                id={`delete-btn-${id}`}
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(id)}
                                disabled={isTransforming || status === 'saving'}
                                style={{ padding: '0.25rem 0.6rem' }}
                              >
                                🗑️ Dismiss
                              </button>

                              <button
                                id={`alert-btn-${id}`}
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSendAdminAlert(id)}
                                disabled={isTransforming || status === 'saving'}
                                style={{ border: '1px solid var(--border-subtle)' }}
                                title="Send Discord admin reminder now"
                              >
                                🔔 Send Admin Alert
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
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'en_tts' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>EN TTS & Voice Herald Guidelines</h3>
                <p>Summons a dedicated Text-to-Speech sub-bot into your voice channels to read messages aloud.</p>
                <ol>
                  <li>Use the toggle to enable or disable the TTS system server-wide.</li>
                  <li>Set default language, voice pitch, and character persona for the Herald.</li>
                  <li>Configure <strong>Max Characters Per Message</strong> to control how long spoken messages can be.</li>
                  <li>Add <strong>Ignored Prefixes</strong> (comma-separated) for messages the bot should stay silent on.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Invite the Voice Herald Sub-Bot:</strong><br />
                  The TTS feature uses a separate dedicated bot. Use the button to invite it to your server before using <code>/tts join</code>.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="en-tts"
                  icon="🎙️"
                  title="EN TTS — Text-To-Speech & Voice Herald"
                  description="Summons a dedicated voice sub-bot to read messages aloud in voice channels with selectable languages, pitches, and personas."
                  featureKey="en_tts"
                  initialEnabled={ttsEnabled}
                  initialConfig={{
                    default_language: ttsLanguage,
                    default_voice_model: ttsVoiceModel,
                    default_persona: ttsPersona,
                    max_characters: ttsMaxChars,
                    ignored_prefixes: ttsIgnoredPrefixes,
                  }}
                >
                  {() => (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                        <a
                          href={`https://discord.com/api/oauth2/authorize?client_id=${ttsVoiceBotClientId}&permissions=3146752&scope=bot`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                        >
                          🔗 Invite Voice Herald Bot
                        </a>
                      </div>

                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Voice Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Default Spoken Language</label>
                          <select
                            id="tts-default-language"
                            className="form-input"
                            value={ttsLanguage}
                            onChange={(e) => setTtsLanguage(e.target.value)}
                            style={{ width: '100%', marginTop: '0.35rem' }}
                          >
                            <option value="en">English (US)</option>
                            <option value="ja">Japanese (日本語)</option>
                            <option value="tl">Tagalog (Filipino)</option>
                            <option value="es">Spanish (Español)</option>
                            <option value="fr">French (Français)</option>
                            <option value="de">German (Deutsch)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Default Voice Model / Pitch</label>
                          <select
                            id="tts-default-voice-model"
                            className="form-input"
                            value={ttsVoiceModel}
                            onChange={(e) => setTtsVoiceModel(e.target.value)}
                            style={{ width: '100%', marginTop: '0.35rem' }}
                          >
                            <option value="female">Female Voice</option>
                            <option value="male">Male Voice</option>
                            <option value="neutral">Neutral Voice</option>
                            <option value="deep">Deep Voice</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Default Character Persona</label>
                          <select
                            id="tts-default-persona"
                            className="form-input"
                            value={ttsPersona}
                            onChange={(e) => setTtsPersona(e.target.value)}
                            style={{ width: '100%', marginTop: '0.35rem' }}
                          >
                            <option value="default">Default Natural</option>
                            <option value="announcer">Hype Stadium Announcer</option>
                            <option value="error_mod">Glitched / ERROR-MOD</option>
                            <option value="calm">Calm & Chill</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Max Characters Per Message</label>
                          <input
                            id="tts-max-chars"
                            type="number"
                            className="form-input"
                            value={ttsMaxChars}
                            onChange={(e) => setTtsMaxChars(Number(e.target.value))}
                            style={{ width: '100%', marginTop: '0.35rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: '0.25rem' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Ignored Message Prefixes</label>
                        <input
                          id="tts-ignored-prefixes"
                          type="text"
                          className="form-input"
                          value={ttsIgnoredPrefixes}
                          onChange={(e) => setTtsIgnoredPrefixes(e.target.value)}
                          placeholder="!, //, ("
                          style={{ width: '100%', marginTop: '0.35rem' }}
                        />
                        <span className="form-hint">
                          Messages starting with these symbols will not be spoken aloud by TTS.
                        </span>
                      </div>

                      <div className="section-divider" style={{ marginTop: '1rem' }}>
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Save Detailed Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                          id="save-tts-settings-btn"
                          className="btn btn-secondary btn-sm"
                          onClick={saveTtsSettings}
                          disabled={saveTtsStatus === 'saving'}
                        >
                          {saveTtsStatus === 'saving' ? '⏳ Saving...' : '💾 Save TTS Settings'}
                        </button>
                        {saveTtsStatus === 'saved' && <span style={{ color: '#22c55e', fontSize: '0.875rem' }}>✓ Saved!</span>}
                        {saveTtsStatus === 'error' && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>❌ Failed to save.</span>}
                      </div>
                    </>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'temp_voice' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Dynamic Voice Channels Guide</h3>
                <p>
                  Allows community members to spawn private or public temporary voice rooms on demand:
                </p>
                <ol>
                  <li>
                    Select your <strong>Starter Hub Voice Channel</strong> (e.g. <code>➕ Create VC</code>).
                  </li>
                  <li>
                    When a member clicks that channel in Discord, ENOS automatically creates a new voice room right underneath it and moves them in.
                  </li>
                  <li>
                    ENOS pings the room owner in the voice chat with a <strong>⚙️ Setup Room / Privacy</strong> button.
                  </li>
                  <li>
                    Clicking the button pops up a Discord modal allowing the owner to rename the room, set user limits, and mark it Private with <code>@friend</code> whitelisting.
                  </li>
                  <li>
                    The owner receives in-channel <strong>Kick</strong>, <strong>Mute</strong>, and <strong>Deafen</strong> powers. The room automatically deletes when everyone leaves.
                  </li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Zero Clutter:</strong><br />
                  Temporary channels vanish instantly when empty, keeping your server sidebar clean.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <FeatureCard
                  id="temp-voice"
                  icon="🔊"
                  title="Dynamic Voice Channels"
                  description="Auto-spawning, self-cleaning temporary voice rooms with modal setup and creator controls"
                  featureKey="temp_voice"
                  initialEnabled={tempVoiceEnabled}
                  initialConfig={{
                    hub_channel_id: tempVoiceHubId,
                    default_name_template: tempVoiceTemplate,
                    default_user_limit: tempVoiceLimit,
                  }}
                  onToggle={toggleTempVoice}
                >
                  {() => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Starter Voice Channel (Hub)</label>
                        <select
                          id="tempvoice-hub-select"
                          className="form-input"
                          value={tempVoiceHubId}
                          onChange={(e) => setTempVoiceHubId(e.target.value)}
                          style={{ width: '100%', marginTop: '0.35rem' }}
                        >
                          <option value="">Select Starter Hub Channel...</option>
                          {channels
                            .filter((c) => c.type === 2 || c.name.includes('🔊') || !c.name.startsWith('#'))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          {channels
                            .filter((c) => c.type !== 2 && !c.name.includes('🔊') && c.name.startsWith('#'))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                        <span className="form-hint">
                          When members click into this voice channel, ENOS spawns their temporary room right below it.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Default Room Name Template</label>
                        <input
                          id="tempvoice-template-input"
                          type="text"
                          className="form-input"
                          value={tempVoiceTemplate}
                          onChange={(e) => setTempVoiceTemplate(e.target.value)}
                          placeholder="🎮 {username}'s Room"
                          style={{ width: '100%', marginTop: '0.35rem' }}
                        />
                        <span className="form-hint">
                          Use <code>{'{username}'}</code> as a placeholder for the member&apos;s name.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Default Player Limit</label>
                        <input
                          id="tempvoice-limit-input"
                          type="number"
                          min={0}
                          max={99}
                          className="form-input"
                          value={tempVoiceLimit}
                          onChange={(e) => setTempVoiceLimit(Number(e.target.value))}
                          placeholder="0 for unlimited"
                          style={{ width: '100%', marginTop: '0.35rem' }}
                        />
                        <span className="form-hint">
                          Set to 0 for unlimited, or specify a default capacity (e.g. 4 or 5).
                        </span>
                      </div>

                      <div className="section-divider" style={{ marginTop: '1rem' }}>
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Save Configuration</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                          id="save-tempvoice-settings-btn"
                          className="btn btn-secondary btn-sm"
                          onClick={saveTempVoiceSettings}
                          disabled={saveTempVoiceStatus === 'saving'}
                        >
                          {saveTempVoiceStatus === 'saving' ? '⏳ Saving...' : '💾 Save Voice Settings'}
                        </button>
                        {saveTempVoiceStatus === 'saved' && <span style={{ color: '#22c55e', fontSize: '0.875rem' }}>✓ Saved!</span>}
                        {saveTempVoiceStatus === 'error' && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>❌ Failed to save.</span>}
                      </div>
                    </div>
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
