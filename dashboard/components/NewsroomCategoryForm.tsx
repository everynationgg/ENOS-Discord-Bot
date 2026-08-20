'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  NewsroomCategoryDef,
  NewsroomConfig,
  NewsroomSource,
} from '@/lib/newsroomRegistry';

interface NewsroomCategoryFormProps {
  category: NewsroomCategoryDef;
}

export default function NewsroomCategoryForm({ category }: NewsroomCategoryFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [upcomingChannelId, setUpcomingChannelId] = useState('');
  const [reviewChannelId, setReviewChannelId] = useState('');
  const [frequency, setFrequency] = useState<'15m' | '30m' | '1h' | '6h' | '12h' | '24h'>('30m');
  const [maxPosts, setMaxPosts] = useState(2);
  const [aiSummaries, setAiSummaries] = useState(false);
  const [enabledSources, setEnabledSources] = useState<string[]>([]);
  const [customSources, setCustomSources] = useState<NewsroomSource[]>([]);
  const [keywordBlacklist, setKeywordBlacklist] = useState('');
  const [keywordWhitelist, setKeywordWhitelist] = useState('');

  // Custom feed inputs
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');

  // Channels state
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch channel list
      const channelRes = await fetch('/api/social/birthday/channels');
      if (channelRes.ok) {
        const chanData = await channelRes.json();
        setChannels(Array.isArray(chanData) ? chanData : []);
      }

      // Fetch newsroom category config
      const configRes = await fetch(`/api/newsroom/config?category=${category.id}`);
      if (configRes.ok) {
        const data = await configRes.json();
        setEnabled(data.enabled ?? false);
        const cfg: NewsroomConfig = data.config || {};
        setChannelId(cfg.channel_id || '');
        setUpcomingChannelId(cfg.upcoming_channel_id || cfg.channel_id || '');
        setReviewChannelId(cfg.review_channel_id || '');
        setFrequency(cfg.posting_frequency || '30m');
        setMaxPosts(cfg.max_posts_per_run || 2);
        setAiSummaries(cfg.ai_summaries ?? false);
        setEnabledSources(cfg.enabled_sources || category.defaultSources.filter((s) => s.enabled).map((s) => s.id));
        setCustomSources(cfg.custom_sources || []);
        setKeywordBlacklist((cfg.keyword_blacklist || []).join(', '));
        setKeywordWhitelist((cfg.keyword_whitelist || []).join(', '));
      }
    } catch (err: any) {
      console.error('Failed to load newsroom category config:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleSource = (sourceId: string) => {
    if (enabledSources.includes(sourceId)) {
      setEnabledSources(enabledSources.filter((id) => id !== sourceId));
    } else {
      setEnabledSources([...enabledSources, sourceId]);
    }
  };

  const handleAddCustomSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomName.trim() || !newCustomUrl.trim()) return;

    try {
      new URL(newCustomUrl.trim());
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid URL (including http:// or https://).' });
      return;
    }

    const newSource: NewsroomSource = {
      id: `custom_${Date.now()}`,
      name: newCustomName.trim(),
      feedUrl: newCustomUrl.trim(),
      enabled: true,
      isCustom: true,
    };

    setCustomSources([...customSources, newSource]);
    setEnabledSources([...enabledSources, newSource.id]);
    setNewCustomName('');
    setNewCustomUrl('');
    setStatusMsg({ type: 'success', text: `Added custom feed "${newSource.name}"!` });
  };

  const handleRemoveCustomSource = (sourceId: string) => {
    setCustomSources(customSources.filter((s) => s.id !== sourceId));
    setEnabledSources(enabledSources.filter((id) => id !== sourceId));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);

    const blacklistArr = keywordBlacklist
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const whitelistArr = keywordWhitelist
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      category: category.id,
      enabled,
      config: {
        enabled,
        channel_id: upcomingChannelId || channelId,
        upcoming_channel_id: upcomingChannelId,
        review_channel_id: reviewChannelId,
        posting_frequency: frequency,
        max_posts_per_run: Number(maxPosts),
        ai_summaries: aiSummaries,
        enabled_sources: enabledSources,
        custom_sources: customSources,
        keyword_blacklist: blacklistArr,
        keyword_whitelist: whitelistArr,
      },
    };

    try {
      const res = await fetch('/api/newsroom/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatusMsg({ type: 'success', text: `Saved ${category.name} Newsroom settings!` });
      } else {
        const err = await res.json();
        setStatusMsg({ type: 'error', text: err.error || 'Failed to save settings.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Network error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Loading {category.name} Newsroom configuration...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Category Card Header */}
      <div className="newsroom-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="feature-card-icon" style={{ fontSize: '1.75rem', width: 48, height: 48 }}>
            {category.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>{category.name} Newsroom</h2>
              <span className="badge" style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)', border: '1px solid var(--border-subtle)' }}>
                {category.badge}
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {category.description}
            </p>
          </div>
        </div>

        {/* Master Enable/Disable Toggle */}
        <div className="toggle-wrap">
          <span className={`toggle-label ${enabled ? 'on' : ''}`}>
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </div>

      {statusMsg && (
        <div className={statusMsg.type === 'success' ? 'toast-success' : 'toast-error'} style={{ padding: '0.875rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
          {statusMsg.text}
        </div>
      )}

      {/* Main Settings Split Grid */}
      <div className="split-layout-detail">
        {/* Left Column: Post Destination & Timing */}
        <div className="feature-form-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            ⚙️ Post Destination & Timing
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">📢 Upcoming Drops, Trailers & Announcements Channel</label>
              <select
                value={upcomingChannelId || channelId}
                onChange={(e) => setUpcomingChannelId(e.target.value)}
                className="form-select"
              >
                <option value="">-- Select Channel or Forum for Upcoming Content --</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Destinations for announcements, trailers, episode/album drops, and game/movie reveals.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">⭐️ Reviews, Ratings & Editorials Channel (Optional)</label>
              <select
                value={reviewChannelId}
                onChange={(e) => setReviewChannelId(e.target.value)}
                className="form-select"
              >
                <option value="">-- Same as Upcoming Channel (Single Channel) --</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Select a separate channel or forum for scores, critiques, and reviews. If unselected, all content goes to the primary channel.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Check Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="form-select"
                >
                  <option value="15m">Every 15 minutes</option>
                  <option value="30m">Every 30 minutes</option>
                  <option value="1h">Every 1 hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="12h">Every 12 hours</option>
                  <option value="24h">Daily (24h)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Max Posts / Run</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={maxPosts}
                  onChange={(e) => setMaxPosts(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>

            {/* AI Summaries Toggle */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  AI Article TL;DR (Gemini)
                </p>
                <span className="form-hint">Auto-generate 2 key bullet points for news posts.</span>
              </div>
              <div className="toggle-wrap">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={aiSummaries}
                    onChange={(e) => setAiSummaries(e.target.checked)}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content Filters & Keywords */}
        <div className="feature-form-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            🛡️ Content Filters & Keywords
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Keyword Blacklist (Comma separated)</label>
              <input
                type="text"
                placeholder="e.g. spoiler, rumor, leaked, nsfw"
                value={keywordBlacklist}
                onChange={(e) => setKeywordBlacklist(e.target.value)}
                className="form-input"
              />
              <span className="form-hint">Skip articles matching any blacklisted words in title or description.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Keyword Whitelist (Optional)</label>
              <input
                type="text"
                placeholder="e.g. trailer, official, announcement"
                value={keywordWhitelist}
                onChange={(e) => setKeywordWhitelist(e.target.value)}
                className="form-input"
              />
              <span className="form-hint">If set, only post articles matching at least one whitelisted word.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Built-in & Custom News Feeds Provider Manager */}
      <div className="feature-form-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          📡 Active News Outlets & Feeds
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Toggle built-in RSS sources or add your own custom RSS feed URLs below.
        </p>

        {/* Built-in Sources Grid */}
        <div className="newsroom-source-grid">
          {category.defaultSources.map((source) => {
            const isChecked = enabledSources.includes(source.id);
            return (
              <div
                key={source.id}
                onClick={() => handleToggleSource(source.id)}
                className={`newsroom-source-card ${isChecked ? 'active' : ''}`}
              >
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
                    {source.name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.feedUrl}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // Handled by parent div click
                  style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
              </div>
            );
          })}
        </div>

        {/* Custom Sources Section */}
        {customSources.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
              Custom RSS Outlets
            </h4>
            <div className="newsroom-source-grid">
              {customSources.map((cs) => {
                const isChecked = enabledSources.includes(cs.id);
                return (
                  <div
                    key={cs.id}
                    className={`newsroom-source-card ${isChecked ? 'custom-active' : ''}`}
                  >
                    <div style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => handleToggleSource(cs.id)}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--success)', margin: 0 }}>
                        🔗 {cs.name}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cs.feedUrl}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSource(cs.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--success)', cursor: 'pointer' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSource(cs.id)}
                        className="btn btn-sm btn-danger"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Custom Feed Form */}
        <form onSubmit={handleAddCustomSource} style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Custom Source Name (e.g. Polygon)"
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            className="form-input"
          />
          <input
            type="text"
            placeholder="RSS Feed URL (https://.../feed.xml)"
            value={newCustomUrl}
            onChange={(e) => setNewCustomUrl(e.target.value)}
            className="form-input"
          />
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
          >
            + Add Custom Feed
          </button>
        </form>
      </div>

      {/* Bottom Save Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '0.875rem 2rem', fontSize: '1rem', fontWeight: 700 }}
        >
          {saving ? 'Saving Settings...' : `Save ${category.name} Settings`}
        </button>
      </div>
    </div>
  );
}
