'use client';

import FeatureCard from '@/components/FeatureCard';
import { useState, useEffect, useCallback } from 'react';

interface CompanionConfig {
  sarcasm_level: number;
  social_energy: number;
  response_brevity: 'punchy' | 'balanced' | 'thoughtful';
  allowed_channel_ids: string[];
  ambient_cooldown_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  banned_topics: string[];
}

interface LoreItem {
  id: string;
  title: string;
  content: string;
  category: 'milestone' | 'tradition' | 'joke' | 'general';
  created_at: string;
}

interface MemberProfile {
  id: string;
  user_id: string;
  display_name: string;
  familiarity_tier: number;
  interaction_count: number;
  last_spoke_at: string;
  facts: string[];
}

export default function CompanionPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'vibe' | 'channels' | 'lore' | 'members'>('overview');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<CompanionConfig>({
    sarcasm_level: 3,
    social_energy: 2,
    response_brevity: 'balanced',
    allowed_channel_ids: [],
    ambient_cooldown_minutes: 20,
    quiet_hours_enabled: false,
    quiet_hours_start: '02:00',
    quiet_hours_end: '08:00',
    banned_topics: [],
  });

  const [loreList, setLoreList] = useState<LoreItem[]>([]);
  const [membersList, setMembersList] = useState<MemberProfile[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [loading, setLoading] = useState(true);

  // New Lore Form
  const [showAddLore, setShowAddLore] = useState(false);
  const [newLoreTitle, setNewLoreTitle] = useState('');
  const [newLoreContent, setNewLoreContent] = useState('');
  const [newLoreCategory, setNewLoreCategory] = useState<'milestone' | 'tradition' | 'joke' | 'general'>('general');

  const loadData = useCallback(async () => {
    try {
      const [configRes, loreRes, membersRes] = await Promise.all([
        fetch('/api/companion/config'),
        fetch('/api/companion/lore'),
        fetch('/api/companion/members'),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) {
          setEnabled(data.enabled);
          setConfig(data.config);
        }
      }

      if (loreRes.ok) {
        const data = await loreRes.json();
        setLoreList(data.lore || []);
      }

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembersList(data.members || []);
      }
    } catch (e) {
      console.error('Failed to load ENOS NPC data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddLore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoreTitle.trim() || !newLoreContent.trim()) return;

    try {
      const res = await fetch('/api/companion/lore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newLoreTitle,
          content: newLoreContent,
          category: newLoreCategory,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLoreList([data.item, ...loreList]);
        setNewLoreTitle('');
        setNewLoreContent('');
        setShowAddLore(false);
      }
    } catch (err) {
      console.error('Failed to add lore:', err);
    }
  };

  const handleDeleteLore = async (id: string) => {
    try {
      const res = await fetch(`/api/companion/lore?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLoreList(loreList.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete lore:', err);
    }
  };

  const handleForgetMember = async (userId: string) => {
    if (!confirm('Permanently purge this member\'s memories and relationship level?')) return;

    try {
      const res = await fetch(`/api/companion/members?user_id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setMembersList(membersList.filter((m) => m.user_id !== userId));
      }
    } catch (err) {
      console.error('Failed to forget member:', err);
    }
  };

  const filteredMembers = membersList.filter((m) =>
    (m.display_name || m.user_id).toLowerCase().includes(searchMember.toLowerCase())
  );

  const tierBadges = [
    { label: 'Stranger', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
    { label: 'Acquaintance', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.1)' },
    { label: 'Regular', color: '#34D399', bg: 'rgba(52, 211, 153, 0.1)' },
    { label: 'Veteran', color: '#FACC15', bg: 'rgba(250, 204, 21, 0.15)' },
  ];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🤖 ENOS NPC</h1>
        <p>The Nation's living digital resident. Observant, dry-witted, and part of the crew.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar Navigation */}
        <aside className="sidebar-master">
          <div className="sidebar-title">NPC Controls</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-npc-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'vibe' ? 'active' : ''}`}
            onClick={() => setActiveTab('vibe')}
            id="sidebar-npc-vibe"
          >
            🎭 Vibe & Voice
          </button>
          <button
            className={`sidebar-item ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
            id="sidebar-npc-channels"
          >
            📡 Channels & Schedule
          </button>
          <button
            className={`sidebar-item ${activeTab === 'lore' ? 'active' : ''}`}
            onClick={() => setActiveTab('lore')}
            id="sidebar-npc-lore"
          >
            📜 Community Lore ({loreList.length})
          </button>
          <button
            className={`sidebar-item ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
            id="sidebar-npc-members"
          >
            👥 Member Roster ({membersList.length})
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>ENOS NPC Hub</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                ENOS participates in Discord conversations as an observant, dry-witted regular member. It remembers people, respects server culture, and knows when to stay silent.
              </p>

              <div className="overview-item">
                <h3>🎭 Tone & Social Expression</h3>
                <p>Adjust how sharp or playful ENOS's banter is, and control how frequently it chimes into ambient chat.</p>
              </div>

              <div className="overview-item">
                <h3>📡 Channel Management & Cooldowns</h3>
                <p>Restrict ENOS to designated hangout channels, configure minimum ambient cooldowns, and set quiet hours.</p>
              </div>

              <div className="overview-item">
                <h3>📜 Community Lore & Memory</h3>
                <p>Teach ENOS inside jokes, server traditions, and historical milestones that it can organically reference.</p>
              </div>

              <div className="overview-item">
                <h3>👥 Privacy & Member Standing</h3>
                <p>View familiarity levels (Stranger $\to$ Veteran) and learned facts, with one-click member forget tools.</p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <FeatureCard
                  id="npc-master-card"
                  icon="🤖"
                  title="ENOS NPC Engine"
                  description="Enable or disable ENOS's presence in your Discord channels."
                  featureKey="npc_companion"
                  initialEnabled={enabled}
                  initialConfig={config}
                >
                  {(_cfg, _setCfg) => (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <p>
                        Status: <strong style={{ color: enabled ? '#22C55E' : 'var(--text-muted)' }}>{enabled ? 'Active in Server' : 'Disabled'}</strong>
                      </p>
                      <p style={{ marginTop: '0.5rem' }}>
                        Use the tabs on the left to configure ENOS's personality, schedule, community memories, and member relationship roster.
                      </p>
                    </div>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {/* TAB 2: VIBE & VOICE */}
          {activeTab === 'vibe' && (
            <div className="feature-grid">
              <FeatureCard
                id="npc-voice-settings"
                icon="🎭"
                title="Vibe & Voice Settings"
                description="Tune ENOS's personality traits and conversational length."
                featureKey="npc_companion"
                initialEnabled={enabled}
                initialConfig={config}
              >
                {(cfg, setCfg) => {
                  const sarcasm = cfg.sarcasm_level ?? 3;
                  const social = cfg.social_energy ?? 2;
                  const brevity = cfg.response_brevity || 'balanced';

                  return (
                    <>
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label">Banter & Sarcasm Level</label>
                          <span className="slider-value" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                            {sarcasm} / 5
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={sarcasm}
                          onChange={(e) => setCfg('sarcasm_level', Number(e.target.value))}
                          className="form-slider"
                        />
                        <div className="slider-labels">
                          <span className="form-hint">1: Chill & Grounded</span>
                          <span className="form-hint">3: Dry Wit (Default)</span>
                          <span className="form-hint">5: Sharp Roaster</span>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label">Social Energy (Ambient Chatter)</label>
                          <span className="slider-value" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                            {social} / 5
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={social}
                          onChange={(e) => setCfg('social_energy', Number(e.target.value))}
                          className="form-slider"
                        />
                        <div className="slider-labels">
                          <span className="form-hint">1: Quiet Lurker</span>
                          <span className="form-hint">2: Balanced (Default)</span>
                          <span className="form-hint">5: Chatty Veteran</span>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Response Brevity</label>
                        <select
                          className="form-select"
                          value={brevity}
                          onChange={(e) => setCfg('response_brevity', e.target.value)}
                        >
                          <option value="punchy">⚡ Punchy (1 Line Max)</option>
                          <option value="balanced">💬 Balanced (1–2 Lines, Default)</option>
                          <option value="thoughtful">📖 Thoughtful (2–3 Lines)</option>
                        </select>
                        <span className="form-hint">
                          Keeps ENOS's replies compact and aligned with Discord chatting rhythms.
                        </span>
                      </div>
                    </>
                  );
                }}
              </FeatureCard>
            </div>
          )}

          {/* TAB 3: CHANNELS & SCHEDULE */}
          {activeTab === 'channels' && (
            <div className="feature-grid">
              <FeatureCard
                id="npc-channel-settings"
                icon="📡"
                title="Channels & Schedule"
                description="Control where and when ENOS is active in your server."
                featureKey="npc_companion"
                initialEnabled={enabled}
                initialConfig={config}
              >
                {(cfg, setCfg) => {
                  const allowedChannels = (cfg.allowed_channel_ids || []).join(', ');
                  const cooldown = cfg.ambient_cooldown_minutes ?? 20;
                  const quietEnabled = cfg.quiet_hours_enabled ?? false;
                  const qStart = cfg.quiet_hours_start || '02:00';
                  const qEnd = cfg.quiet_hours_end || '08:00';

                  return (
                    <>
                      <div className="form-group">
                        <label className="form-label">Allowed Channel IDs</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 123456789012345678, 987654321098765432 (or leave empty for all)"
                          value={allowedChannels}
                          onChange={(e) =>
                            setCfg(
                              'allowed_channel_ids',
                              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            )
                          }
                        />
                        <span className="form-hint">
                          Comma-separated channel IDs. If empty, ENOS listens in all public channels.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Ambient Cooldown (Minutes)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={5}
                          max={120}
                          value={cooldown}
                          onChange={(e) => setCfg('ambient_cooldown_minutes', Number(e.target.value))}
                        />
                        <span className="form-hint">
                          Minimum minutes between spontaneous remarks in the same channel.
                        </span>
                      </div>

                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label">Quiet Hours</label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={quietEnabled}
                              onChange={(e) => setCfg('quiet_hours_enabled', e.target.checked)}
                            />
                            <div className="toggle-track" />
                            <div className="toggle-thumb" />
                          </label>
                        </div>
                        <span className="form-hint">
                          ENOS stays completely silent in ambient chat during quiet hours.
                        </span>
                      </div>

                      {quietEnabled && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                          <div className="form-group">
                            <label className="form-label">Start Time (24h)</label>
                            <input
                              type="time"
                              className="form-input"
                              value={qStart}
                              onChange={(e) => setCfg('quiet_hours_start', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">End Time (24h)</label>
                            <input
                              type="time"
                              className="form-input"
                              value={qEnd}
                              onChange={(e) => setCfg('quiet_hours_end', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  );
                }}
              </FeatureCard>
            </div>
          )}

          {/* TAB 4: SERVER LORE */}
          {activeTab === 'lore' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Community Lore & Inside Jokes</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
                    Memories and traditions ENOS can naturally reference in chat.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddLore(!showAddLore)}
                >
                  {showAddLore ? '✕ Cancel' : '+ Add Lore'}
                </button>
              </div>

              {showAddLore && (
                <div className="feature-card is-active" style={{ marginBottom: '1.25rem' }}>
                  <div className="feature-card-content" style={{ borderTop: 'none', paddingTop: '1.25rem' }}>
                    <form onSubmit={handleAddLore} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">Lore Title</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. The Great Phase 2 Raid Wipe"
                          value={newLoreTitle}
                          onChange={(e) => setNewLoreTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                          className="form-select"
                          value={newLoreCategory}
                          onChange={(e) => setNewLoreCategory(e.target.value as any)}
                        >
                          <option value="milestone">Milestone (Server History)</option>
                          <option value="tradition">Tradition (Community Habit)</option>
                          <option value="joke">Inside Joke</option>
                          <option value="general">General Lore</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description / Context</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          placeholder="What happened and why it matters to the server..."
                          value={newLoreContent}
                          onChange={(e) => setNewLoreContent(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddLore(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          Save Lore
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
                {loreList.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    No community lore recorded yet. Click "+ Add Lore" to teach ENOS about your server history!
                  </div>
                ) : (
                  loreList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '1rem',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              background: 'var(--accent-primary-dim)',
                              color: 'var(--accent-primary)',
                            }}
                          >
                            {item.category}
                          </span>
                          <button
                            onClick={() => handleDeleteLore(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8125rem' }}
                            title="Delete Lore"
                          >
                            🗑️
                          </button>
                        </div>
                        <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.9375rem' }}>{item.title}</h4>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {item.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MEMBER ROSTER */}
          {activeTab === 'members' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Member Relationships & Learned Memory</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
                    What ENOS has organically learned about active community members.
                  </p>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search member..."
                  style={{ width: '220px' }}
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Member</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Standing</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Chats</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Learned Facts</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No member records found.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => {
                        const badge = tierBadges[m.familiarity_tier] || tierBadges[0];
                        return (
                          <tr key={m.id || m.user_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                              <div>{m.display_name || 'Unknown'}</div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>ID: {m.user_id}</div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '999px',
                                  fontWeight: 600,
                                  fontSize: '0.6875rem',
                                  color: badge.color,
                                  background: badge.bg,
                                }}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                              {m.interaction_count} chats
                            </td>
                            <td style={{ padding: '0.75rem 1rem', maxWidth: '280px' }}>
                              {m.facts && m.facts.length > 0 ? (
                                <ul style={{ margin: 0, paddingLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                  {m.facts.map((f, i) => (
                                    <li key={i}>{f}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>No facts recorded</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => handleForgetMember(m.user_id)}
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                }}
                              >
                                Forget
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
