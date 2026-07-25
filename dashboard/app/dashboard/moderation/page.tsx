'use client';

import FeatureCard from '@/components/FeatureCard';
import DiscordEmbedPreview from '@/components/DiscordEmbedPreview';
import ImageUploader from '@/components/ImageUploader';
import { useEffect, useState } from 'react';

export default function ModerationPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // AI Help Desk state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Keyform states
  const [keyformConfigs, setKeyformConfigs] = useState<any[]>([]);
  const [selectedGameKey, setSelectedGameKey] = useState<string>('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingKeyform, setLoadingKeyform] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [keyformSaveStatus, setKeyformSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Form states
  const [gameKey, setGameKey] = useState('');
  const [gameName, setGameName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverPassword, setServerPassword] = useState('');
  const [targetChannelId, setTargetChannelId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRuleText, setNewRuleText] = useState('');

  // Announcebot states
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementChannelId, setAnnouncementChannelId] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [scheduledQueue, setScheduledQueue] = useState<any[]>([]);
  const [postingState, setPostingState] = useState<'idle' | 'posting' | 'scheduling' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAnnouncebotData = async () => {
    try {
      const [chRes, qRes] = await Promise.all([
        fetch('/api/social/birthday/channels'),
        fetch('/api/moderation/announcement/queue'),
      ]);
      if (chRes.ok) {
        const chData = await chRes.json();
        if (Array.isArray(chData)) setChannels(chData);
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        if (Array.isArray(qData)) setScheduledQueue(qData);
      }
    } catch (err) {
      console.error('[ANNOUNCEBOT FETCH ERROR]:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'announcebot') {
      fetchAnnouncebotData();
    }
  }, [activeTab]);

  const handlePostNow = async () => {
    if (!announcementText.trim() || !announcementChannelId.trim()) return;
    setPostingState('posting');
    setStatusMessage(null);
    try {
      const res = await fetch('/api/moderation/announcement/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: announcementChannelId.trim(),
          message: announcementText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to post announcement.');
      }
      setStatusMessage('✓ Announcement posted successfully to Discord!');
      setAnnouncementText('');
      setPostingState('idle');
    } catch (err: any) {
      setPostingState('error');
      setStatusMessage(`⚠️ ${err?.message || 'Failed to post announcement.'}`);
    }
  };

  const handleSchedulePost = async () => {
    if (!announcementText.trim() || !announcementChannelId.trim() || !scheduledDateTime) return;
    setPostingState('scheduling');
    setStatusMessage(null);
    try {
      const scheduledUtc = new Date(scheduledDateTime).toISOString();
      const res = await fetch('/api/moderation/announcement/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: announcementChannelId.trim(),
          message: announcementText.trim(),
          scheduled_at: scheduledUtc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to schedule announcement.');
      }
      setStatusMessage('✓ Announcement scheduled successfully!');
      setAnnouncementText('');
      setScheduledDateTime('');
      setPostingState('idle');
      fetchAnnouncebotData();
    } catch (err: any) {
      setPostingState('error');
      setStatusMessage(`⚠️ ${err?.message || 'Failed to schedule announcement.'}`);
    }
  };

  const handleDeleteScheduled = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled announcement?')) return;
    try {
      const res = await fetch(`/api/moderation/announcement/queue?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAnnouncebotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Showcase states
  const [showcasePreset, setShowcasePreset] = useState<'major' | 'patch' | 'showcase'>('major');
  const [showcaseTitleSize, setShowcaseTitleSize] = useState<'h1' | 'h2' | 'h3'>('h1');
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseBodySize, setShowcaseBodySize] = useState<'h2' | 'h3' | 'normal'>('normal');
  const [showcaseSummary, setShowcaseSummary] = useState('');
  const [showcaseBody, setShowcaseBody] = useState('');
  const [showcaseBannerUrl, setShowcaseBannerUrl] = useState('');
  const [showcaseVideoUrl, setShowcaseVideoUrl] = useState('');
  const [showcaseRewardCoins, setShowcaseRewardCoins] = useState(50);
  const [showcaseTryChannel, setShowcaseTryChannel] = useState('');
  const [showcaseChannelId, setShowcaseChannelId] = useState('');
  const [showcaseFeedbackChannelId, setShowcaseFeedbackChannelId] = useState('');
  const [showcaseDispatchState, setShowcaseDispatchState] = useState<'idle' | 'dispatching' | 'error'>('idle');
  const [showcaseStatusMsg, setShowcaseStatusMsg] = useState<string | null>(null);
  const [showcaseHistory, setShowcaseHistory] = useState<any[]>([]);

  // Dynamic Dropdown Items
  const [dropdownItems, setDropdownItems] = useState<
    Array<{
      id: string;
      label: string;
      description: string;
      hero_image_url: string;
      content_markdown: string;
    }>
  >([
    {
      id: 'item_1',
      label: '1. ⚔️ Weekly World Boss RPG 2.0',
      description: 'Master of Magic, Damage Absorbing Defender & King of Instant Damage',
      hero_image_url: '',
      content_markdown: '### ⚔️ Weekly World Boss RPG System\n• **M.O.M.** (Master of Magic): Support Class with healing & party buffs.\n• **D.A.D.** (Damage Absorbing Defender): Tank & Debuff Class with taunt & barrier shields.\n• **K.I.D.** (King of Instant Damage): Critical Hit & Burst DPS Class.\n• **Skill Tree**: Allocate stat points into DMG, Crit, AP Save, XP, and Loot!\n• **Commands**: `/boss attack`, `/boss stats`',
    },
  ]);

  const handleAddDropdownItem = () => {
    const newId = `item_${Date.now()}`;
    setDropdownItems((prev) => [
      ...prev,
      {
        id: newId,
        label: `${prev.length + 1}. New Feature Highlight`,
        description: 'Brief description for select menu',
        hero_image_url: '',
        content_markdown: 'Type details for this feature update...',
      },
    ]);
  };

  const handleUpdateDropdownItem = (index: number, key: string, value: string) => {
    setDropdownItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleRemoveDropdownItem = (index: number) => {
    setDropdownItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const fetchShowcaseHistory = async () => {
    try {
      const res = await fetch('/api/moderation/showcase/history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setShowcaseHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'showcase') {
      fetchShowcaseHistory();
      if (channels.length === 0) fetchAnnouncebotData();
    }
  }, [activeTab]);

  const handleApplyPreset = (preset: 'major' | 'patch' | 'showcase') => {
    setShowcasePreset(preset);
    if (preset === 'major') {
      setShowcaseTitleSize('h1');
      setShowcaseTitle('ENOS 2.0 Master System Released!');
      setShowcaseSummary('World Boss RPG 2.0, Daily AI Trivia, Vault Economy, and AI Support are now live!');
      setShowcaseBody('### What\'s New in ENOS 2.0:\n- ⚔️ **Weekly Boss RPG**: Fight raid bosses with 3 classes & 5-Attribute Skill Trees!\n- 🧠 **Daily AI Trivia Drops**: Test your knowledge with anti-cheat speed scoring!\n- 💰 **Vault Economy**: Earn coins automatically in voice channels & complete daily quests!\n- 🔑 **Keyform Whitelists**: One-click whitelist applications for Palworld & game servers!');
      setShowcaseRewardCoins(100);
    } else if (preset === 'patch') {
      setShowcaseTitleSize('h2');
      setShowcaseTitle('Weekly System Maintenance & Fixes');
      setShowcaseSummary('Patch notes for v1.4.2 performance and bug fixes.');
      setShowcaseBody('⚡ **Improvements**:\n- Reduced canvas render latency by 40%.\n- Improved daily trivia drop anti-cheat shuffling.\n\n🐛 **Fixes**:\n- Fixed edge case where voice streak rewards doubled on server restart.');
      setShowcaseRewardCoins(0);
    } else if (preset === 'showcase') {
      setShowcaseTitleSize('h1');
      setShowcaseTitle('Video Tutorial: How to Play Trivia & Earn Vault Coins');
      setShowcaseSummary('Watch our 1-minute video guide on daily trivia drops and economy rewards.');
      setShowcaseBody('Learn how microsecond speed scoring works, how anti-cheat shuffling protects answers, and how to cash in your points in the Vault!');
      setShowcaseRewardCoins(25);
    }
  };

  const handleDispatchShowcase = async () => {
    if (!showcaseTitle.trim() || !showcaseBody.trim() || !showcaseChannelId.trim()) return;
    setShowcaseDispatchState('dispatching');
    setShowcaseStatusMsg(null);
    try {
      const res = await fetch('/api/moderation/showcase/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: showcaseChannelId.trim(),
          feedback_channel_id: showcaseFeedbackChannelId.trim(),
          preset_type: showcasePreset,
          title_size: showcaseTitleSize,
          title: showcaseTitle.trim(),
          body_size: showcaseBodySize,
          summary: showcaseSummary.trim(),
          body_markdown: showcaseBody.trim(),
          banner_url: showcaseBannerUrl.trim(),
          video_url: showcaseVideoUrl.trim(),
          reward_coins: showcaseRewardCoins,
          try_feature_channel: showcaseTryChannel.trim(),
          dropdown_items: dropdownItems,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch showcase.');
      }
      setShowcaseStatusMsg('✓ Server update and feature showcase successfully published to Discord!');
      setShowcaseDispatchState('idle');
      fetchShowcaseHistory();
    } catch (err: any) {
      setShowcaseDispatchState('error');
      setShowcaseStatusMsg(`⚠️ ${err?.message || 'Failed to publish showcase.'}`);
    }
  };

  const fetchKeyformData = async () => {
    setLoadingKeyform(true);
    try {
      const [confRes, regRes] = await Promise.all([
        fetch('/api/moderation/keyform/config'),
        fetch('/api/moderation/keyform/registrations')
      ]);
      const confData = await confRes.json();
      const regData = await regRes.json();
      setKeyformConfigs(Array.isArray(confData) ? confData : []);
      setRegistrations(Array.isArray(regData) ? regData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKeyform(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'keyform') {
      fetchKeyformData();
    }
  }, [activeTab]);

  const handleSelectGameConfig = (gk: string) => {
    setSelectedGameKey(gk);
    if (!gk) {
      setGameKey('');
      setGameName('');
      setServerUrl('');
      setServerPassword('');
      setTargetChannelId('');
      setLogChannelId('');
      setRules([]);
      return;
    }
    const found = keyformConfigs.find(c => c.game_key === gk);
    if (found) {
      setGameKey(found.game_key);
      setGameName(found.game_name);
      setServerUrl(found.server_url);
      setServerPassword(found.server_password);
      setTargetChannelId(found.target_channel_id);
      setLogChannelId(found.log_channel_id);
      setRules(found.rules || []);
    }
  };

  const handleSaveKeyform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameKey || !gameName || !serverUrl || !serverPassword || !targetChannelId || !logChannelId) {
      alert('Please fill in all fields.');
      return;
    }
    setKeyformSaveStatus('saving');
    try {
      const res = await fetch('/api/moderation/keyform/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_key: gameKey,
          game_name: gameName,
          server_url: serverUrl,
          server_password: serverPassword,
          target_channel_id: targetChannelId,
          log_channel_id: logChannelId,
          rules,
        }),
      });
      if (!res.ok) throw new Error();
      setKeyformSaveStatus('saved');
      setTimeout(() => setKeyformSaveStatus('idle'), 2500);
      fetchKeyformData();
    } catch {
      setKeyformSaveStatus('error');
    }
  };

  const handleRevokeRegistration = async (id: string) => {
    if (!confirm('Are you sure you want to revoke access and remove this player registration?')) return;
    try {
      const res = await fetch(`/api/moderation/keyform/registrations?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchKeyformData();
      } else {
        alert('Failed to revoke access.');
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          <button
            className={`sidebar-item ${activeTab === 'keyform' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyform')}
            id="sidebar-mod-keyform"
          >
            🔑 Keyform Access
          </button>
          <button
            className={`sidebar-item ${activeTab === 'announcebot' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcebot')}
            id="sidebar-mod-announcebot"
          >
            📢 Announcebot
          </button>
          <button
            className={`sidebar-item ${activeTab === 'showcase' ? 'active' : ''}`}
            onClick={() => setActiveTab('showcase')}
            id="sidebar-mod-showcase"
          >
            🚀 Feature Showcase Publisher
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
                <h3>🚀 Feature Showcase Publisher</h3>
                <p>
                  Design and publish high-engagement update cards with hero banners, embedded video tutorials, interactive feedback modals, and Vault Coin rewards.
                </p>
              </div>

              <div className="overview-item">
                <h3>📢 Announcebot</h3>
                <p>
                  Broadcast announcements immediately as the bot to any channel or schedule posts using local time for automated future dispatching.
                </p>
              </div>

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

          {activeTab === 'keyform' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>🔑 Keyform Access Guidelines</h3>
                <p>
                  Create self-service registration forms for game servers (like Palworld, Minecraft, etc.) right inside Discord.
                </p>
                <ol>
                  <li>Create/bind a registration channel on Discord. Copy its ID for <strong>Target Channel ID</strong>.</li>
                  <li>Create a logging channel for registrations. Copy its ID for <strong>Logging Channel ID</strong>.</li>
                  <li>Set the server connection URL/IP and Password. These are delivered ephemerally to users who register and agree.</li>
                  <li>Build a checklist of server rules. These rules are dynamically populated in the Discord embed.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 How to setup on Discord:</strong><br />
                  Once configured and saved, run <code>/setup-keyform game:[game_key]</code> (e.g. <code>/setup-keyform game:palworld</code>) in your target channel to deploy the registration panel.
                </div>
              </div>

              <div className="feature-form-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>⚙️ Server Configuration</h3>
                  
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label">Select Game Server</label>
                    <select
                      className="form-input"
                      value={selectedGameKey}
                      onChange={(e) => handleSelectGameConfig(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      <option value="">➕ Setup New Game Server</option>
                      {keyformConfigs.map((c) => (
                        <option key={c.game_key} value={c.game_key}>
                          🎮 {c.game_name} ({c.game_key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <form onSubmit={handleSaveKeyform} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Game Key (e.g., palworld)</label>
                        <input
                          className="form-input"
                          placeholder="e.g. palworld"
                          value={gameKey}
                          onChange={(e) => setGameKey(e.target.value)}
                          disabled={!!selectedGameKey}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Game Display Name</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Palworld"
                          value={gameName}
                          onChange={(e) => setGameName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Server Connection URL / IP</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 192.168.1.100:8211"
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Server Password</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Server password"
                          value={serverPassword}
                          onChange={(e) => setServerPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Target Registration Channel ID</label>
                        <input
                          className="form-input"
                          placeholder="Discord channel ID"
                          value={targetChannelId}
                          onChange={(e) => setTargetChannelId(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Logging Channel ID</label>
                        <input
                          className="form-input"
                          placeholder="Discord channel ID"
                          value={logChannelId}
                          onChange={(e) => setLogChannelId(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Server Rules (Bullet Points)</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rules.length} rules</span>
                      </label>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input
                          className="form-input"
                          placeholder="Type a new rule bullet point..."
                          value={newRuleText}
                          onChange={(e) => setNewRuleText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newRuleText.trim()) {
                                setRules([...rules, newRuleText.trim()]);
                                setNewRuleText('');
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            if (newRuleText.trim()) {
                              setRules([...rules, newRuleText.trim()]);
                              setNewRuleText('');
                            }
                          }}
                          style={{ padding: '0 1rem' }}
                        >
                          Add
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {rules.map((rule, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8125rem'
                            }}
                          >
                            <span>• {rule}</span>
                            <button
                              type="button"
                              onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        {rules.length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No rules added. Rules will not display in the Discord embed.
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={keyformSaveStatus === 'saving'}
                      style={{
                        marginTop: '0.5rem',
                        backgroundColor: keyformSaveStatus === 'saved' ? '#10B981' : keyformSaveStatus === 'error' ? '#EF4444' : 'var(--accent-primary)',
                        borderColor: keyformSaveStatus === 'saved' ? '#10B981' : keyformSaveStatus === 'error' ? '#EF4444' : 'var(--accent-primary)',
                      }}
                    >
                      {keyformSaveStatus === 'saving' ? '💾 Saving Server Config...' : keyformSaveStatus === 'saved' ? '✓ Server Config Saved!' : '💾 Save Game Server Config'}
                    </button>
                  </form>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3>📋 Player Access Registrations ({registrations.length})</h3>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="form-input"
                        value={gameFilter}
                        onChange={(e) => setGameFilter(e.target.value)}
                        style={{ width: '130px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                      >
                        <option value="">All Games</option>
                        {Array.from(new Set(registrations.map(r => r.game_key))).map(gk => (
                          <option key={gk} value={gk}>{gk}</option>
                        ))}
                      </select>

                      <input
                        className="form-input"
                        placeholder="Search Discord/IGN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '180px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {loadingKeyform ? (
                      <div className="empty-state" style={{ padding: '2rem' }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
                    ) : registrations.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem' }}>
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-title">No registrations found</div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>IGN</th>
                              <th>Game</th>
                              <th>Date Joined</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registrations
                              .filter(r => !gameFilter || r.game_key === gameFilter)
                              .filter(r => !searchQuery || r.discord_tag.toLowerCase().includes(searchQuery.toLowerCase()) || r.ign.toLowerCase().includes(searchQuery.toLowerCase()))
                              .map((reg) => (
                                <tr key={reg.id}>
                                  <td>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                      @{reg.discord_tag}
                                    </span>
                                    <br />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{reg.discord_id}</span>
                                  </td>
                                  <td>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                                      {reg.ign}
                                    </code>
                                  </td>
                                  <td>
                                    <span style={{ textTransform: 'capitalize', color: 'var(--accent-primary)', fontWeight: 500 }}>
                                      {reg.game_key}
                                    </span>
                                  </td>
                                  <td>
                                    {new Date(reg.registered_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => handleRevokeRegistration(reg.id)}
                                      style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                    >
                                      Revoke Access
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'announcebot' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>📢 Announcebot Guide</h3>
                <p>
                  Announcebot allows server administrators to post announcements directly as the ENOS Bot to any channel instantly on demand.
                </p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <li style={{ marginBottom: '0.4rem' }}><strong>⚡ Pure Manual Control</strong>: No automated cron jobs or background polling overhead.</li>
                  <li style={{ marginBottom: '0.4rem' }}><strong>🎯 Direct Targeting</strong>: Pick any text channel or announcement channel from the list.</li>
                  <li style={{ marginBottom: '0.4rem' }}><strong>✨ Discord Formatting</strong>: Supports standard Markdown (bold <code>**</code>, italics <code>*</code>, links, codeblocks, emojis).</li>
                </ul>
                <div className="tip-box" style={{ marginTop: '1rem' }}>
                  <strong>💡 Pro Tip:</strong><br />
                  Make sure the ENOS Bot has permission to send messages and view the target channel in Discord.
                </div>
              </div>

              <div className="feature-form-card">
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem' }}>📢 Compose & Post Announcement</h3>

                  {/* Target Channel */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      🎯 Target Channel
                    </label>
                    <select
                      className="form-input"
                      value={announcementChannelId}
                      onChange={(e) => setAnnouncementChannelId(e.target.value)}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      <option value="">-- Select Channel from List --</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                    <span className="form-hint" style={{ display: 'block', marginBottom: '0.25rem' }}>Or manually enter / paste Channel ID:</span>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1111851611099254815"
                      value={announcementChannelId}
                      onChange={(e) => setAnnouncementChannelId(e.target.value.trim())}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Announcement Message Textarea */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      ✍️ Announcement Message Text
                    </label>
                    <textarea
                      className="form-input"
                      rows={6}
                      placeholder="Type your message here... Supports **bold**, *italics*, @mentions, and emojis!"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Discord character limit: 2000</span>
                      <span>{announcementText.length} / 2000</span>
                    </div>
                  </div>

                  {/* Broadcast Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={postingState !== 'idle' || !announcementText.trim() || !announcementChannelId.trim()}
                      onClick={handlePostNow}
                      style={{ backgroundColor: '#10b981', border: 'none', fontWeight: 600, padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}
                    >
                      {postingState === 'posting' ? 'Posting to Discord...' : '🚀 Broadcast Announcement Now'}
                    </button>
                  </div>

                  {/* Status Message Feedback */}
                  {statusMessage && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: postingState === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: postingState === 'error' ? '#f87171' : '#34d399', fontSize: '0.85rem' }}>
                      {statusMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'showcase' && (
            <div className="split-layout-detail">
              {/* Form & Controls (Left Column) */}
              <div className="feature-form-card" style={{ flex: '1 1 500px' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem' }}>🚀 Feature Showcase Publisher</h3>

                  {/* Preset Selector */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      ⚡ Preset Template Selector
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn ${showcasePreset === 'major' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleApplyPreset('major')}
                        style={{ flex: 1, fontSize: '0.8125rem' }}
                      >
                        🚀 Major Feature Drop
                      </button>
                      <button
                        type="button"
                        className={`btn ${showcasePreset === 'patch' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleApplyPreset('patch')}
                        style={{ flex: 1, fontSize: '0.8125rem' }}
                      >
                        🛠️ Micro-Patch Notes
                      </button>
                      <button
                        type="button"
                        className={`btn ${showcasePreset === 'showcase' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleApplyPreset('showcase')}
                        style={{ flex: 1, fontSize: '0.8125rem' }}
                      >
                        🎬 Video Showcase
                      </button>
                    </div>
                  </div>

                  {/* Target Channel */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      🎯 Target Channel
                    </label>
                    <select
                      className="form-input"
                      value={showcaseChannelId}
                      onChange={(e) => setShowcaseChannelId(e.target.value)}
                      style={{ width: '100%', marginBottom: '0.4rem' }}
                    >
                      <option value="">-- Select Channel from List --</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Or manually enter / paste Channel ID"
                      value={showcaseChannelId}
                      onChange={(e) => setShowcaseChannelId(e.target.value.trim())}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Title & Font Size Selector */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span>📌 Announcement Main Title</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Header Font Size:</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Title (e.g. PATCH 1.0 or ENOS 2.0 Released!)"
                        value={showcaseTitle}
                        onChange={(e) => setShowcaseTitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select
                        className="form-input"
                        value={showcaseTitleSize}
                        onChange={(e) => setShowcaseTitleSize(e.target.value as any)}
                        style={{ width: '130px' }}
                      >
                        <option value="h1"># H1 Extra Large</option>
                        <option value="h2">## H2 Large</option>
                        <option value="h3">### H3 Medium</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Summary / Tagline (Optional italicized tagline below title)"
                      value={showcaseSummary}
                      onChange={(e) => setShowcaseSummary(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Body Content & Formatting Selector */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span>✍️ Main Patch Notes Body</span>
                      <select
                        className="form-input"
                        value={showcaseBodySize}
                        onChange={(e) => setShowcaseBodySize(e.target.value as any)}
                        style={{ width: '150px', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      >
                        <option value="normal">Normal Body Text</option>
                        <option value="h2">## Subheader Size</option>
                        <option value="h3">### Sub-section Size</option>
                      </select>
                    </label>
                    <textarea
                      className="form-input"
                      rows={5}
                      placeholder="Type main release notes or patch overview text here..."
                      value={showcaseBody}
                      onChange={(e) => setShowcaseBody(e.target.value)}
                      style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>

                  {/* Dynamic Dropdown Items Builder */}
                  <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
                        📋 Dynamic Dropdown Options Builder ({dropdownItems.length})
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleAddDropdownItem}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                      >
                        ➕ Add Dropdown Option
                      </button>
                    </div>

                    {dropdownItems.map((item, idx) => (
                      <div key={item.id || idx} style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Option #{idx + 1}</span>
                          {dropdownItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDropdownItem(idx)}
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              🗑️ Remove
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Dropdown Label (e.g. 1. Hero RPG Class)"
                            value={item.label}
                            onChange={(e) => handleUpdateDropdownItem(idx, 'label', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Subtitle (e.g. Multi-phase raids)"
                            value={item.description}
                            onChange={(e) => handleUpdateDropdownItem(idx, 'description', e.target.value)}
                          />
                        </div>

                        {/* Hero Photo Upload for this specific update item */}
                        <ImageUploader
                          id={`dropdown-hero-uploader-${idx}`}
                          label="🖼️ Hero Artwork / Feature Photo for this selected update"
                          value={item.hero_image_url}
                          onChange={(url) => handleUpdateDropdownItem(idx, 'hero_image_url', url)}
                          placeholder="Upload or paste image URL..."
                          helpText="This photo pops up when member selects this option from the dropdown menu"
                        />

                        {/* Per-Item Custom Action Button & Link Overrides */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Button Label (e.g. ⚔️ Join Raid Arena)"
                            value={item.try_button_label || ''}
                            onChange={(e) => handleUpdateDropdownItem(idx, 'try_button_label', e.target.value)}
                            style={{ fontSize: '0.8rem' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Target Channel ID (Deep-link)"
                            value={item.try_channel_id || ''}
                            onChange={(e) => handleUpdateDropdownItem(idx, 'try_channel_id', e.target.value)}
                            style={{ fontSize: '0.8rem' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Video Tutorial URL (Optional)"
                            value={item.video_url || ''}
                            onChange={(e) => handleUpdateDropdownItem(idx, 'video_url', e.target.value)}
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>

                        <textarea
                          className="form-input"
                          rows={3}
                          placeholder="Detailed content shown in ephemeral popup when selected..."
                          value={item.content_markdown}
                          onChange={(e) => handleUpdateDropdownItem(idx, 'content_markdown', e.target.value)}
                          style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Main Embed Banner Upload (Optional) */}
                  <ImageUploader
                    id="showcase-banner-uploader"
                    label="🖼️ Main Announcement Banner (Optional)"
                    value={showcaseBannerUrl}
                    onChange={(url) => setShowcaseBannerUrl(url)}
                    placeholder="https://.../banner.png or upload image"
                    helpText="Appears at the bottom of the main announcement card"
                  />

                  {/* Private Admin Feedback Channel & Try Feature Deep-Link */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        🔒 Private Admin Feedback Channel ID
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Admin channel ID to receive feedback"
                        value={showcaseFeedbackChannelId}
                        onChange={(e) => setShowcaseFeedbackChannelId(e.target.value.trim())}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        🚀 "Try Feature" Channel ID
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Channel ID to deep-link users"
                        value={showcaseTryChannel}
                        onChange={(e) => setShowcaseTryChannel(e.target.value.trim())}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Video URL & Reward Setting */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        🎥 Video Tutorial URL
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://youtube.com/watch?v=..."
                        value={showcaseVideoUrl}
                        onChange={(e) => setShowcaseVideoUrl(e.target.value.trim())}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        🎁 Vault Coins Reward Amount
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        min={0}
                        max={1000}
                        value={showcaseRewardCoins}
                        onChange={(e) => setShowcaseRewardCoins(Number(e.target.value))}
                        style={{ width: '100%', textAlign: 'center' }}
                      />
                    </div>
                  </div>

                  {/* Dispatch Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={showcaseDispatchState !== 'idle' || !showcaseTitle.trim() || !showcaseBody.trim() || !showcaseChannelId.trim()}
                      onClick={handleDispatchShowcase}
                      style={{ backgroundColor: '#6366f1', border: 'none', fontWeight: 600, padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    >
                      {showcaseDispatchState === 'dispatching' ? 'Publishing Showcase...' : '🚀 Publish Showcase Update'}
                    </button>
                  </div>

                  {showcaseStatusMsg && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: showcaseDispatchState === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: showcaseDispatchState === 'error' ? '#f87171' : '#34d399', fontSize: '0.85rem' }}>
                      {showcaseStatusMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Discord Preview Simulator (Right Column) */}
              <div style={{ flex: '1 1 420px', minWidth: '320px' }}>
                <div style={{ position: 'sticky', top: '1rem' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.05rem', color: 'var(--text-muted)' }}>
                    👁️ Real-Time Discord Embed & Ephemeral Simulator
                  </h3>
                  <DiscordEmbedPreview
                    presetType={showcasePreset}
                    titleSize={showcaseTitleSize}
                    title={showcaseTitle}
                    bodySize={showcaseBodySize}
                    summary={showcaseSummary}
                    bodyMarkdown={showcaseBody}
                    bannerUrl={showcaseBannerUrl}
                    videoUrl={showcaseVideoUrl}
                    rewardCoins={showcaseRewardCoins}
                    tryFeatureChannel={showcaseTryChannel}
                    dropdownItems={dropdownItems}
                  />

                  {/* Past Showcase History */}
                  <div style={{ marginTop: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.95rem' }}>📜 Published Updates Log</h4>
                    {showcaseHistory.length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No updates published yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                        {showcaseHistory.slice(0, 10).map((item) => (
                          <div key={item.id} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                              <span>Channel: #{item.channel_id}</span>
                              <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
