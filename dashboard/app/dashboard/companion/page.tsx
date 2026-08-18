'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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

export default function CompanionDashboard() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'vibe' | 'channels' | 'lore' | 'members'>('vibe');
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
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // New Lore Modal / Form
  const [showAddLore, setShowAddLore] = useState(false);
  const [newLoreTitle, setNewLoreTitle] = useState('');
  const [newLoreContent, setNewLoreContent] = useState('');
  const [newLoreCategory, setNewLoreCategory] = useState<'milestone' | 'tradition' | 'joke' | 'general'>('general');

  // Load configuration
  useEffect(() => {
    if (status !== 'authenticated') return;

    fetch('/api/companion/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setEnabled(data.enabled);
          setConfig(data.config);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load Lore
    fetch('/api/companion/lore')
      .then((res) => res.json())
      .then((data) => setLoreList(data.lore || []))
      .catch(() => {});

    // Load Members
    fetch('/api/companion/members')
      .then((res) => res.json())
      .then((data) => setMembersList(data.members || []))
      .catch(() => {});
  }, [status]);

  const handleSaveConfig = async (updatedConfig = config, updatedEnabled = enabled) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/companion/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: updatedEnabled, config: updatedConfig }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnable = (newVal: boolean) => {
    setEnabled(newVal);
    handleSaveConfig(config, newVal);
  };

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
    if (!confirm('Are you sure you want ENOS to permanently forget this member? All learned facts and relationship levels will be erased.')) return;

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
      {/* Header with Master Toggle */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>🤖</span> ENOS AI Community Member
          </h1>
          <p>The Nation's living digital resident. Observant, dry-witted, and part of the crew.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Master Feature Switch</div>
            <div style={{ fontSize: '0.8125rem', color: enabled ? '#34D399' : 'var(--text-muted)' }}>
              {enabled ? '🟢 Active in Server' : '⚪ Disabled'}
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggleEnable(e.target.checked)}
            />
            <span className="slider round" />
          </label>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('vibe')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vibe' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'vibe' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🎭 Vibe & Voice
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'channels' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'channels' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📡 Channels & Schedule
        </button>
        <button
          onClick={() => setActiveTab('lore')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'lore' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'lore' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📜 Community Lore ({loreList.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'members' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          👥 Member Roster ({membersList.length})
        </button>
      </div>

      {/* TAB 1: VIBE & VOICE */}
      {activeTab === 'vibe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Banter & Sarcasm Level</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Controls how sharp or playful ENOS's humor is in chat.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <input
                type="range"
                min={1}
                max={5}
                value={config.sarcasm_level}
                onChange={(e) => setConfig({ ...config, sarcasm_level: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontWeight: 700, fontSize: '1.25rem', minWidth: '2.5rem', color: 'var(--accent-primary)' }}>
                {config.sarcasm_level} / 5
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              <span>1: Chill & Grounded</span>
              <span>3: Dry Wit & Teasing (Default)</span>
              <span>5: Sharp Roaster</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Social Energy (Ambient Chatter)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Controls how often ENOS chimes into ambient chat without being pinged. (Direct mentions and "enos" name drops always trigger deliberation).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <input
                type="range"
                min={1}
                max={5}
                value={config.social_energy}
                onChange={(e) => setConfig({ ...config, social_energy: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontWeight: 700, fontSize: '1.25rem', minWidth: '2.5rem', color: 'var(--accent-primary)' }}>
                {config.social_energy} / 5
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              <span>1: Quiet Lurker (Rare)</span>
              <span>2: Balanced Regular (Default)</span>
              <span>5: Chatty Veteran</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Response Brevity</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Controls the sentence length of ENOS's replies to match natural chat rhythms.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {[
                { key: 'punchy', label: '⚡ Punchy (1 Line)', desc: 'Ultra-concise, quick witty drops' },
                { key: 'balanced', label: '💬 Balanced (1-2 Lines)', desc: 'Natural Discord chat cadence' },
                { key: 'thoughtful', label: '📖 Thoughtful (2-3 Lines)', desc: 'More expressive context' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setConfig({ ...config, response_brevity: item.key as any })}
                  style={{
                    flex: '1 1 200px',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: config.response_brevity === item.key ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: config.response_brevity === item.key ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-card)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
            {saveStatus === 'saved' && <span style={{ color: '#34D399', fontSize: '0.875rem' }}>✓ Settings saved</span>}
            {saveStatus === 'error' && <span style={{ color: '#EF4444', fontSize: '0.875rem' }}>✗ Failed to save</span>}
            <button
              className="btn btn-primary"
              onClick={() => handleSaveConfig()}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Voice Settings'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CHANNELS & SCHEDULE */}
      {activeTab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Allowed Channels</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Comma-separated Discord channel IDs where ENOS is permitted to read and respond. Leave empty to allow all public text channels.
            </p>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 123456789012345678, 987654321098765432 (or leave blank for all)"
              value={config.allowed_channel_ids.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  allowed_channel_ids: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Ambient Cooldown</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Minimum minutes of silence between unprompted ambient remarks in the same channel.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="number"
                className="form-control"
                style={{ width: '120px' }}
                min={5}
                max={120}
                value={config.ambient_cooldown_minutes}
                onChange={(e) => setConfig({ ...config, ambient_cooldown_minutes: Number(e.target.value) })}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>minutes</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Quiet Hours Schedule</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  During quiet hours, ENOS remains completely silent in ambient chat.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.quiet_hours_enabled}
                  onChange={(e) => setConfig({ ...config, quiet_hours_enabled: e.target.checked })}
                />
                <span className="slider round" />
              </label>
            </div>

            {config.quiet_hours_enabled && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Start Time (24h)</label>
                  <input
                    type="time"
                    className="form-control"
                    value={config.quiet_hours_start}
                    onChange={(e) => setConfig({ ...config, quiet_hours_start: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>End Time (24h)</label>
                  <input
                    type="time"
                    className="form-control"
                    value={config.quiet_hours_end}
                    onChange={(e) => setConfig({ ...config, quiet_hours_end: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
            {saveStatus === 'saved' && <span style={{ color: '#34D399', fontSize: '0.875rem' }}>✓ Settings saved</span>}
            {saveStatus === 'error' && <span style={{ color: '#EF4444', fontSize: '0.875rem' }}>✗ Failed to save</span>}
            <button
              className="btn btn-primary"
              onClick={() => handleSaveConfig()}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SERVER LORE */}
      {activeTab === 'lore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Server Lore & Inside Jokes</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                Facts and memories that ENOS knows about your community's history.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddLore(true)}>
              + Add Lore Item
            </button>
          </div>

          {showAddLore && (
            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--accent-primary)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>New Lore Entry</h4>
              <form onSubmit={handleAddLore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. The Great Phase 2 Raid Wipe"
                    value={newLoreTitle}
                    onChange={(e) => setNewLoreTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Category</label>
                  <select
                    className="form-control"
                    value={newLoreCategory}
                    onChange={(e) => setNewLoreCategory(e.target.value as any)}
                  >
                    <option value="milestone">Milestone (Server History)</option>
                    <option value="tradition">Tradition (Community Habit)</option>
                    <option value="joke">Inside Joke</option>
                    <option value="general">General Lore</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Description / Context</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Explain what happened so ENOS can naturally recall it in conversation..."
                    value={newLoreContent}
                    onChange={(e) => setNewLoreContent(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddLore(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Lore
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {loreList.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No server lore added yet. Click "+ Add Lore Item" to give ENOS memories of your community!
              </div>
            ) : (
              loreList.map((item) => (
                <div key={item.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(124, 58, 237, 0.15)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {item.category}
                      </span>
                      <button
                        onClick={() => handleDeleteLore(item.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.875rem' }}
                        title="Delete Lore"
                      >
                        🗑️
                      </button>
                    </div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{item.title}</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {item.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MEMBER ROSTER & PRIVACY */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Member Relationships & Learned Memory</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                View what ENOS has naturally learned about active members. You can wipe any member's data on request.
              </p>
            </div>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search member..."
              style={{ width: '240px' }}
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
            />
          </div>

          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1rem' }}>Member</th>
                  <th style={{ padding: '1rem' }}>Standing / Tier</th>
                  <th style={{ padding: '1rem' }}>Interactions</th>
                  <th style={{ padding: '1rem' }}>Learned Facts</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No member interaction records found.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const badge = tierBadges[m.familiarity_tier] || tierBadges[0];
                    return (
                      <tr key={m.id || m.user_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>
                          <div>{m.display_name || 'Unknown'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {m.user_id}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              padding: '0.25rem 0.625rem',
                              borderRadius: '999px',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              color: badge.color,
                              background: badge.bg,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                          {m.interaction_count} chats
                        </td>
                        <td style={{ padding: '1rem', maxWidth: '300px' }}>
                          {m.facts && m.facts.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                              {m.facts.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8125rem' }}>No facts recorded</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleForgetMember(m.user_id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#EF4444',
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                            }}
                          >
                            Forget Member
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
  );
}
