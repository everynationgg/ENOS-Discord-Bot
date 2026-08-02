'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import DiscordEmbedPreview from '@/components/DiscordEmbedPreview';

interface Channel {
  id: string;
  name: string;
  type: number;
}

export default function LeaderboardsDashboard() {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<'vault' | 'boss' | 'trivia' | 'achievements'>('vault');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Dispatch Controls
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchLeaderboards = useCallback(async () => {
    try {
      const rawGuildId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('guild_id') || ''
          : '';
      const query = rawGuildId ? `?guild_id=${rawGuildId}` : '';
      const res = await fetch(`/api/gaming/leaderboards/data${query}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const rawGuildId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('guild_id') || ''
          : '';
      const query = rawGuildId ? `?guild_id=${rawGuildId}` : '';
      const res = await fetch(`/api/social/birthday/channels${query}`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.channels || [];
        setChannels(list);
        if (list.length > 0 && !selectedChannelId) {
          setSelectedChannelId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Discord channels:', e);
    }
  }, [selectedChannelId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchLeaderboards();
    fetchChannels();
  }, [status, fetchLeaderboards, fetchChannels]);

  const handleForcePost = async () => {
    if (!selectedChannelId) {
      setPostStatus({ success: false, message: 'Please select a target channel first.' });
      return;
    }

    setPosting(true);
    setPostStatus(null);

    try {
      const rawGuildId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('guild_id') || ''
          : '';

      const res = await fetch('/api/gaming/leaderboards/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guild_id: rawGuildId,
          channel_id: selectedChannelId,
          type: activeTab,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const chName = channels.find((c) => c.id === selectedChannelId)?.name || selectedChannelId;
        setPostStatus({
          success: true,
          message: `✓ Leaderboard card successfully force-posted to ${chName}!`,
        });
      } else {
        setPostStatus({
          success: false,
          message: json.error || 'Failed to post leaderboard to channel.',
        });
      }
    } catch (e: any) {
      setPostStatus({ success: false, message: e?.message || 'Network error occurred.' });
    } finally {
      setPosting(false);
    }
  };

  if (status === 'loading' || (loading && !data)) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading Leaderboards...</p>
        </div>
      </div>
    );
  }

  // Format Discord Embed Preview Data based on active tab
  const currentWeek = data?.current_week || '2026-W30';
  let embedTitle = '🏆 Vault Leaderboard — Every Nation';
  let embedColor = '#facc15';
  let embedFooter = 'Every Nation Vault • ₱1 = 1 Coin';
  let embedLines: string[] = [];

  if (activeTab === 'vault') {
    const list = data?.vault || [];
    embedLines = list.map((e: any, i: number) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      const tier = e.tier === 'gold' ? '🟡' : e.tier === 'silver' ? '⚪' : '🟤';
      const name = e.username ? `@${e.username}` : `<@${e.discord_id}>`;
      return `${medal} ${tier} **${name}** — **${e.coins.toLocaleString()}** coins (₱${Number(e.coins).toFixed(2)})`;
    });
  } else if (activeTab === 'boss') {
    embedTitle = `🏆 Weekly Boss Leaderboard (${currentWeek})`;
    embedFooter = 'ENOS RPG Participation Ledger • 1 Point = ₱1 PHP';
    const list = data?.boss || [];
    embedLines = list.map((e: any, i: number) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      const clsIcon = e.class_key === 'mom' ? '🛡️' : e.class_key === 'dad' ? '🔨' : e.class_key === 'kid' ? '⚡' : '👤';
      const apUsed = Math.max(0, 5 - (e.ap_remaining || 0));
      const name = e.username ? `@${e.username}` : `<@${e.user_id}>`;
      return `${medal} ${clsIcon} **${name}** — **${e.weekly_points} pts (₱${e.weekly_points})** | \`${apUsed}/5 AP\` (${Number(e.total_damage).toLocaleString()} DMG)`;
    });
  } else if (activeTab === 'trivia') {
    embedTitle = '🧠 Trivia Champions Leaderboard — Every Nation';
    embedColor = '#3b82f6';
    embedFooter = 'ENOS Trivia System • 1 Point = ₱1 PHP';
    const list = data?.trivia || [];
    embedLines = list.map((e: any, i: number) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      const name = e.username ? `@${e.username}` : `<@${e.discord_id}>`;
      return `${medal} 🧠 **${name}** — **${e.points.toLocaleString()} pts (₱${Number(e.points).toFixed(2)})**`;
    });
  } else if (activeTab === 'achievements') {
    embedTitle = '📜 Achievement: Recruitment — Every Nation';
    embedColor = '#8b5cf6';
    embedFooter = 'ENOS Achievements System • Tracked via Gatekeeper';
    embedLines = [
      '💜 **Enis (5 Invites)**: "They Who Herald the Nation" | 50 Vault Coins',
      '🔥 **Enara (50 Invites)**: "Those Who Exalt the Nation" | 1 Month Nitro + Boost',
      '👑 **Enorium (100 Invites)**: "The One Who Ordains the Nation" | 1 Year Nitro + Boost (Crown)',
    ];
  }

  const embedDescription = embedLines.length > 0 ? embedLines.join('\n') : '*No recorded entries found.*';

  return (
    <div className="page-wrapper">
      {/* Top Header */}
      <div className="page-header">
        <h1>🏆 Leaderboards & Live Dispatch</h1>
        <p>Real-time server leaderboards & manual channel broadcast controls</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Category Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Categories</div>
          <button
            className={`sidebar-item ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
            id="sidebar-lb-vault"
          >
            💰 Unified Vault
          </button>
          <button
            className={`sidebar-item ${activeTab === 'boss' ? 'active' : ''}`}
            onClick={() => setActiveTab('boss')}
            id="sidebar-lb-boss"
          >
            ⚔️ Weekly Boss
          </button>
          <button
            className={`sidebar-item ${activeTab === 'trivia' ? 'active' : ''}`}
            onClick={() => setActiveTab('trivia')}
            id="sidebar-lb-trivia"
          >
            🧠 Daily Trivia
          </button>
          <button
            className={`sidebar-item ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
            id="sidebar-lb-achievements"
          >
            🏆 Achievements
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            {/* 1. Left Side: Real-Time Auto-Updating Table */}
            <div
              style={{
                flex: '1 1 480px',
                minWidth: '340px',
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '1.25rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>
                    {activeTab === 'vault' ? '💰' : activeTab === 'boss' ? '⚔️' : activeTab === 'trivia' ? '🧠' : '📜'}
                  </span>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    {activeTab === 'vault'
                      ? 'Unified Vault Standings'
                      : activeTab === 'boss'
                      ? `Weekly Boss Standings (${currentWeek})`
                      : activeTab === 'trivia'
                      ? 'Trivia Champions Standings'
                      : 'Recruitment Achievement Standings'}
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={fetchLeaderboards}
                    title="Manual Refresh"
                    style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    🔄 Refresh Standings
                  </button>
                </div>
              </div>

              {lastRefreshed && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '1rem',
                  }}
                >
                  Last updated: {lastRefreshed.toLocaleTimeString()}
                </div>
              )}

              {/* Table Render */}
              {activeTab === 'vault' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '0.5rem' }}>Rank</th>
                        <th style={{ padding: '0.5rem' }}>Member</th>
                        <th style={{ padding: '0.5rem' }}>Coins (₱ PHP)</th>
                        <th style={{ padding: '0.5rem' }}>Today Msgs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.vault || []).map((row: any, idx: number) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                        return (
                          <tr
                            key={row.discord_id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{medal}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <img
                                  src={row.avatar_url}
                                  alt={row.username}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.username}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.discord_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                              {row.coins} Coins (₱{Number(row.coins).toFixed(2)})
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>{row.messages_today || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'boss' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '0.5rem' }}>Order</th>
                        <th style={{ padding: '0.5rem' }}>Member</th>
                        <th style={{ padding: '0.5rem' }}>Class</th>
                        <th style={{ padding: '0.5rem' }}>AP Used</th>
                        <th style={{ padding: '0.5rem' }}>Points (₱ PHP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.boss || []).map((row: any, idx: number) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                        const clsIcon = row.class_key === 'mom' ? '🛡️ M.O.M.' : row.class_key === 'dad' ? '🔨 D.A.D.' : row.class_key === 'kid' ? '⚡ K.I.D.' : '👤 None';
                        const apUsed = Math.max(0, 5 - (row.ap_remaining || 0));
                        return (
                          <tr
                            key={row.user_id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{medal}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <img
                                  src={row.avatar_url}
                                  alt={row.username}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.username}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>{clsIcon}</td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{apUsed}/5 AP</td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                              {row.weekly_points} pts (₱{row.weekly_points})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'trivia' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '0.5rem' }}>Rank</th>
                        <th style={{ padding: '0.5rem' }}>Member</th>
                        <th style={{ padding: '0.5rem' }}>Trivia Points (XP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.trivia || []).map((row: any, idx: number) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                        return (
                          <tr
                            key={row.discord_id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{medal}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <img
                                  src={row.avatar_url}
                                  alt={row.username}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.username}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.discord_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                              {row.points} pts
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'achievements' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '0.65rem 0.5rem', width: '50px' }}>Rank</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Member</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Title Achieved</th>
                        <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Valid Invites</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.achievements || []).map((row: any, idx: number) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                        return (
                          <tr
                            key={row.inviter_id || idx}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{medal}</td>
                            <td style={{ padding: '0.65rem 0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <img
                                  src={row.avatar_url}
                                  alt={row.username}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.username}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.inviter_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600 }}>
                              {row.tier_title}
                            </td>
                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>
                              {row.valid_invites}
                            </td>
                          </tr>
                        );
                      })}
                      {(!data?.achievements || data.achievements.length === 0) && (
                        <tr>
                          <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No valid member invite records logged yet. New invitations will appear here automatically.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Right Side: Force Post Controls & Discord Embed Live Preview */}
            <div
              style={{
                flex: '1 1 400px',
                minWidth: '340px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Force Post Control Card */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>🚀</span> Force Post to Discord Channel
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Select Target Discord Text Channel:
                  </label>
                  <select
                    className="input-field"
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {channels.length === 0 ? (
                      <option value="">No text channels found</option>
                    ) : (
                      channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} (ID: {ch.id})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {postStatus && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.8125rem',
                      background: postStatus.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${postStatus.success ? '#22c55e' : '#ef4444'}`,
                      color: postStatus.success ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {postStatus.message}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleForcePost}
                  disabled={posting || !selectedChannelId}
                  style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {posting ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16 }} /> Dispatching Embed...
                    </>
                  ) : (
                    <>🚀 Force Post {activeTab.toUpperCase()} Leaderboard</>
                  )}
                </button>
              </div>

              {/* Discord Embed Preview Card */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>👁️</span> Live Discord Embed Card Preview
                </div>

                <DiscordEmbedPreview
                  presetType="showcase"
                  title={embedTitle}
                  bodyMarkdown={embedDescription}
                  bannerUrl={activeTab === 'achievements' ? '/images/achievements-card-preview.png' : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
