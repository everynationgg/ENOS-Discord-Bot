'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchData();
  }, [category.id]);

  const fetchData = async () => {
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
  };

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
        channel_id: channelId,
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
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Loading {category.name} Newsroom settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Header Card */}
      <div className={`p-6 rounded-2xl bg-gradient-to-r ${category.color} text-white shadow-xl flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{category.icon}</span>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{category.name} Newsroom</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md">
                {category.badge}
              </span>
            </div>
            <p className="text-white/80 text-sm mt-1">{category.description}</p>
          </div>
        </div>

        {/* Master Enable/Disable Toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-14 h-8 bg-black/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-400"></div>
          <span className="ml-3 text-sm font-semibold uppercase tracking-wider">
            {enabled ? 'Active' : 'Disabled'}
          </span>
        </label>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Main Settings Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Destination & Frequency Settings */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            ⚙️ Post Destination & Timing
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Discord Output Channel or Forum
            </label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Select Discord Channel or Forum --</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Select a Text Channel for embeds or a 💬 **Forum Channel** for automated Thread creation per news item.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Check Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="15m">Every 15 minutes</option>
                <option value="30m">Every 30 minutes</option>
                <option value="1h">Every 1 hour</option>
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="24h">Daily (24h)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Max Posts / Run
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* AI Summaries Toggle */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">AI Article TL;DR (Gemini)</p>
              <p className="text-xs text-slate-500">Auto-generate 2 key bullet points for news posts.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiSummaries}
                onChange={(e) => setAiSummaries(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Content Filters & Keyword Blacklists */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            🛡️ Content Filters & Keywords
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Keyword Blacklist (Comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. spoiler, rumor, leaked, nsfw"
              value={keywordBlacklist}
              onChange={(e) => setKeywordBlacklist(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">Skip articles matching any blacklisted words in title or description.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Keyword Whitelist (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. trailer, official, announcement"
              value={keywordWhitelist}
              onChange={(e) => setKeywordWhitelist(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">If set, only post articles matching at least one whitelisted word.</p>
          </div>
        </div>
      </div>

      {/* Built-in & Custom News Feeds Provider Manager */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              📡 Active News Outlets & Feeds
            </h3>
            <p className="text-xs text-slate-400">Toggle built-in RSS sources or add your own custom RSS feed URLs below.</p>
          </div>
        </div>

        {/* Built-in Sources List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {category.defaultSources.map((source) => {
            const isChecked = enabledSources.includes(source.id);
            return (
              <div
                key={source.id}
                onClick={() => handleToggleSource(source.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  isChecked
                    ? 'bg-indigo-950/40 border-indigo-500/50 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm">{source.name}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[280px]">{source.feedUrl}</p>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // handled by parent div onClick
                  className="h-5 w-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            );
          })}
        </div>

        {/* Custom Sources Section */}
        {customSources.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custom RSS Outlets</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customSources.map((cs) => {
                const isChecked = enabledSources.includes(cs.id);
                return (
                  <div
                    key={cs.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                      isChecked
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-100'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="cursor-pointer" onClick={() => handleToggleSource(cs.id)}>
                      <p className="font-semibold text-sm text-emerald-400">🔗 {cs.name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[240px]">{cs.feedUrl}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSource(cs.id)}
                        className="h-5 w-5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSource(cs.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs font-semibold"
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
        <form onSubmit={handleAddCustomSource} className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Custom Source Name (e.g. Polygon)"
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="RSS Feed URL (https://.../feed.xml)"
            value={newCustomUrl}
            onChange={(e) => setNewCustomUrl(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl px-4 py-2.5 transition-all"
          >
            + Add Custom RSS Feed
          </button>
        </form>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving Settings...' : 'Save Category Settings'}
        </button>
      </div>
    </div>
  );
}
