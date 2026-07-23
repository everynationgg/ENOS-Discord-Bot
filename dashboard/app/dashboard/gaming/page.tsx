'use client';

import FeatureCard from '@/components/FeatureCard';
import { useEffect, useState } from 'react';

const GAME_BRANCHES = [
  'Where Winds Meet', 'Palworld', 'Wuwa', 'Hoyoverse', 'Enfi',
  'POE', 'BG3', 'D4', 'Minecraft', 'Phasmo', 'REPO', 'PEAK',
  'Subnautica 2', 'Devour', 'Demonologist', 'Valorant', 'CS2',
  'COD', 'HoK', 'ML', 'LOL', 'Others',
];

export default function GamingPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

  const lfgConfig = configs['lfg'] || {};
  const vaultConfig = configs['vault'] || {};
  const triviaConfig = configs['trivia'] || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🎮 Gaming</h1>
        <p>Configure LFG party finder, Vault Economy, Trivia Drops, and game branch settings.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Gaming</div>
          <button
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="sidebar-game-overview"
          >
            📋 Overview
          </button>
          <button
            className={`sidebar-item ${activeTab === 'lfg' ? 'active' : ''}`}
            onClick={() => setActiveTab('lfg')}
            id="sidebar-game-lfg"
          >
            🔍 LFG Group Finder
          </button>
          <button
            className={`sidebar-item ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
            id="sidebar-game-vault"
          >
            💰 Vault Economy
          </button>
          <button
            className={`sidebar-item ${activeTab === 'trivia' ? 'active' : ''}`}
            onClick={() => setActiveTab('trivia')}
            id="sidebar-game-trivia"
          >
            🧠 Trivia Drop
          </button>
          <button
            className={`sidebar-item ${activeTab === 'boss' ? 'active' : ''}`}
            onClick={() => setActiveTab('boss')}
            id="sidebar-game-boss"
          >
            🐉 Weekly Boss
          </button>
        </aside>

        {/* Detail Content Area */}
        <div className="detail-content">
          {activeTab === 'overview' && (
            <div className="overview-container">
              <h2>Gaming Settings</h2>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Keep your gaming community active with party finders and automatic engagement reward systems.
              </p>

              <div className="overview-item">
                <h3>🔍 LFG — Group Finder</h3>
                <p>
                  Allows members to post LFG invite cards with a direct Link Button to connect players instantly to game voice channels.
                </p>
              </div>

              <div className="overview-item">
                <h3>💰 Vault Economy</h3>
                <p>
                  Reward users automatically with Vault Coins for voice and text activity, define custom role multipliers, and configure automatic rank-up tier roles.
                </p>
              </div>

              <div className="overview-item">
                <h3>🧠 Trivia Drop</h3>
                <p>
                  Auto-drops a daily AI-generated trivia question in a weighted random channel. Anti-cheat ephemeral shuffling per user, microsecond speed scoring, and podium point rewards all in one.
                </p>
              </div>

              <div className="overview-item">
                <h3>🐉 Weekly Boss Bounty RPG</h3>
                <p>
                  Self-balancing weekly boss RPG with M.O.M., D.A.D., and K.I.D. combat triad synergy, 5 AP weekly budgets, dynamic participant scaling, and Overkill Mode.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'lfg' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>LFG Configuration Guide</h3>
                <p>
                  The Looking-For-Group (LFG) finder helps players invite others to connect directly to server voice channels.
                </p>
                <ol>
                  <li>Create a text channel (e.g. <code>#lfg-posts</code>) and copy its ID into <strong>LFG Post Channel ID</strong>.</li>
                  <li>Set <strong>Session TTL</strong> (Time To Live) to define how long an active LFG invite card remains active before auto-expiring.</li>
                  <li>In the <strong>Voice Channel Mappings</strong> section, input the voice channel ID matching each game branch to generate direct invite buttons routing players into their voice calls.</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Copying voice IDs:</strong><br />
                  Enable Developer Mode in Discord, right-click the voice channel in your server panel, and select <strong>Copy Channel ID</strong>.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="lfg"
                  icon="🔍"
                  title="LFG — Group Finder"
                  description="Dynamic party cards with a direct VC invite button. References pre-existing voice channels."
                  featureKey="lfg"
                  initialEnabled={lfgConfig.enabled ?? false}
                  initialConfig={lfgConfig.config ?? {}}
                >
                  {(config, setConfig) => (
                    <>
                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Channels</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">LFG Post Channel ID</label>
                        <input
                          id="lfg-channel"
                          className="form-input"
                          placeholder="Channel where LFG cards are posted"
                          value={config.lfg_channel_id || ''}
                          onChange={(e) => setConfig('lfg_channel_id', e.target.value)}
                        />
                      </div>

                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Session Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Session TTL: <strong style={{ color: 'var(--accent-primary)' }}>{config.session_ttl_minutes ?? 120} min</strong>
                        </label>
                        <input
                          id="lfg-ttl"
                          type="range"
                          className="form-slider"
                          min={30} max={480} step={30}
                          value={config.session_ttl_minutes ?? 120}
                          onChange={(e) => setConfig('session_ttl_minutes', parseInt(e.target.value))}
                        />
                        <div className="slider-labels">
                          <span className="form-hint">30 min</span>
                          <span className="form-hint">8 hours</span>
                        </div>
                      </div>

                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Voice Channel Mappings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', paddingRight: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Game</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Voice Channel ID</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Allowed Role ID</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Default Voice Status</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {GAME_BRANCHES.map((game) => {
                          const voiceMappings = config.voice_mappings || {};
                          const roleMappings = config.role_mappings || {};
                          const defaultStatuses = config.default_statuses || {};
                          return (
                            <div key={game} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {game}
                              </span>
                              <input
                                id={`lfg-vc-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="Voice Channel ID"
                                value={voiceMappings[game] || ''}
                                onChange={(e) => setConfig('voice_mappings', { ...voiceMappings, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`lfg-role-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="Allowed Role ID"
                                value={roleMappings[game] || ''}
                                onChange={(e) => setConfig('role_mappings', { ...roleMappings, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`lfg-status-${game.toLowerCase().replace(/\s+/g, '-')}`}
                                className="form-input"
                                placeholder="e.g. Chilling"
                                value={defaultStatuses[game] || ''}
                                onChange={(e) => setConfig('default_statuses', { ...defaultStatuses, [game]: e.target.value })}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Vault Economy Configuration Guide</h3>
                <p>
                  Reward server engagement automatically using custom coin multipliers and auto-ranked tiers.
                </p>
                <ul>
                  <li><strong>Coins per Message</strong>: Vault Coins awarded to users per text message sent.</li>
                  <li><strong>Coins per Voice Min</strong>: Vault Coins awarded to users per minute active in voice channels.</li>
                  <li><strong>Daily Quest Bonus</strong>: Coin reward received upon reaching the daily quest message count.</li>
                  <li><strong>Role Multipliers</strong>: Apply coin rate multipliers (e.g. VIP/Nitro Boosters get 1.5x rates). Right-click the target role in Discord Roles settings and select **Copy Role ID** to configure multipliers.</li>
                  <li><strong>Tier Roles</strong>: Auto-assigned Discord roles when a member accumulates a specific coin threshold. Right-click the role in Discord and select **Copy Role ID**.</li>
                </ul>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="vault"
                  icon="💰"
                  title="Vault Economy"
                  description="Track XP, award Vault Coins for chat & voice activity, manage role multipliers and tier roles."
                  featureKey="vault"
                  initialEnabled={vaultConfig.enabled ?? false}
                  initialConfig={vaultConfig.config ?? {}}
                >
                  {(config, setConfig) => {
                    const rates = config.rates || {};
                    const multipliers: any[] = config.role_multipliers || [];
                    const tierRoles = config.tier_roles || {};

                    return (
                      <>
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Coin Rates</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">Coins per Message</label>
                            <input
                              id="vault-msg-rate"
                              type="number" min={0} max={100}
                              className="form-input"
                              value={rates.message ?? 1}
                              onChange={(e) => setConfig('rates', { ...rates, message: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Coins per Voice Min</label>
                            <input
                              id="vault-voice-rate"
                              type="number" min={0} max={100}
                              className="form-input"
                              value={rates.voice_per_minute ?? 2}
                              onChange={(e) => setConfig('rates', { ...rates, voice_per_minute: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Daily Quest Bonus</label>
                            <input
                              id="vault-quest-bonus"
                              type="number" min={0} max={500}
                              className="form-input"
                              value={rates.daily_quest_bonus ?? 50}
                              onChange={(e) => setConfig('rates', { ...rates, daily_quest_bonus: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Quest Msg Threshold</label>
                            <input
                              id="vault-quest-threshold"
                              type="number" min={1} max={100}
                              className="form-input"
                              value={rates.daily_quest_message_threshold ?? 10}
                              onChange={(e) => setConfig('rates', { ...rates, daily_quest_message_threshold: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Role Multipliers</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {multipliers.map((m: any, i: number) => (
                            <div key={i} className="multiplier-row">
                              <input
                                id={`multiplier-role-${i}`}
                                className="form-input"
                                placeholder="Role ID"
                                value={m.role_id || ''}
                                onChange={(e) => {
                                  const updated = [...multipliers];
                                  updated[i] = { ...m, role_id: e.target.value };
                                  setConfig('role_multipliers', updated);
                                }}
                              />
                              <input
                                id={`multiplier-val-${i}`}
                                className="form-input"
                                type="number" step="0.1" min="0.1" max="10"
                                placeholder="e.g. 1.5"
                                value={m.multiplier || ''}
                                onChange={(e) => {
                                  const updated = [...multipliers];
                                  updated[i] = { ...m, multiplier: parseFloat(e.target.value) };
                                  setConfig('role_multipliers', updated);
                                }}
                              />
                              <button
                                id={`remove-multiplier-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('role_multipliers', multipliers.filter((_: any, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="add-multiplier-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('role_multipliers', [...multipliers, { role_id: '', multiplier: 1.5 }])}
                          >
                            + Add Multiplier
                          </button>
                        </div>

                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Tier Roles</span>
                          <div className="section-divider-line" />
                        </div>

                        {[
                          { key: 'bronze', emoji: '🥉', label: 'Bronze (Default)' },
                          { key: 'gold', emoji: '🥇', label: 'Gold (1,000 coins)' },
                          { key: 'platinum', emoji: '💎', label: 'Platinum (5,000 coins)' },
                        ].map(({ key, emoji, label }) => (
                          <div className="form-group" key={key}>
                            <label className="form-label">{emoji} {label} — Role ID</label>
                            <input
                              id={`tier-role-${key}`}
                              className="form-input"
                              placeholder="Discord Role ID"
                              value={tierRoles[key] || ''}
                              onChange={(e) => setConfig('tier_roles', { ...tierRoles, [key]: e.target.value })}
                            />
                          </div>
                        ))}
                      </>
                    );
                  }}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'trivia' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Trivia Drop Configuration Guide</h3>
                <p>
                  The daily trivia system auto-generates a unique multiple-choice question via AI and drops it into a weighted random channel. The answer order is shuffled per player to prevent leaking answers.
                </p>
                <ol>
                  <li>Enable the feature and add the <strong>Channel Whitelist</strong> below — these are the channels where trivia can drop.</li>
                  <li>Set a <strong>Priority</strong> per channel: <code>high</code> (3x weight), <code>medium</code> (2x), or <code>low</code> (1x) — dead channels can be revived with low priority.</li>
                  <li>Optionally set a <strong>Topic</strong> for a channel (e.g. <code>Palworld survival mechanics</code>) for themed questions. Leave blank for general trivia.</li>
                  <li>Configure the <strong>Close Time</strong> (in 24h format, e.g. <code>22:00</code>) — sessions close at this time if 3 winners haven't claimed all spots first.</li>
                  <li>Set the server <strong>Timezone</strong> and <strong>Drops Per Day</strong> (1–3 drops daily, evenly auto-scheduled throughout daytime hours).</li>
                  <li>Optionally configure a <strong>Leaderboard Channel ID</strong> to post and auto-update a live Top 5 trivia points leaderboard.</li>
                  <li>Set <strong>Allowed Roles</strong> to restrict who can participate (leave empty to allow all members).</li>
                </ol>
                <div className="tip-box">
                  <strong>💡 Force Trigger / Skip:</strong><br />
                  Use the manual control buttons at the bottom of the config card to instantly spawn a drop or close the active session from this panel.
                </div>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="trivia"
                  icon="🧠"
                  title="Daily Trivia Drop"
                  description="AI-generated daily trivia with anti-cheat ephemeral shuffling, microsecond podium scoring, and Vault-independent point rewards."
                  featureKey="trivia"
                  initialEnabled={triviaConfig.enabled ?? false}
                  initialConfig={triviaConfig.config ?? {}}
                >
                  {(config, setConfig) => {
                    const allowedChannels: any[] = config.allowed_channels || [];
                    const allowedRoles: string[] = config.allowed_roles || [];
                    const [manualStatus, setManualStatus] = useState<string>('');

                    const handleManualAction = async (action: string) => {
                      setManualStatus('loading');
                      try {
                        const res = await fetch('/api/gaming/trivia/action', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action }),
                        });
                        const data = await res.json();
                        setManualStatus(data.error ? `error: ${data.error}` : action === 'trigger' ? 'triggered' : action === 'skip' ? 'skipped' : 'rerolled');
                      } catch {
                        setManualStatus('error: request failed');
                      }
                      setTimeout(() => setManualStatus(''), 4000);
                    };

                    return (
                      <>
                        {/* Timezone & Close Time */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Schedule Settings</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">Timezone</label>
                            <input
                              id="trivia-timezone"
                              className="form-input"
                              placeholder="e.g. Asia/Manila, America/New_York"
                              value={config.timezone || ''}
                              onChange={(e) => setConfig('timezone', e.target.value)}
                            />
                            <span className="form-hint">IANA timezone string</span>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Auto-Close Time (24h)</label>
                            <input
                              id="trivia-close-time"
                              className="form-input"
                              placeholder="e.g. 22:00"
                              value={config.close_time || ''}
                              onChange={(e) => setConfig('close_time', e.target.value)}
                            />
                            <span className="form-hint">Between 01:00 – 23:00 (server timezone)</span>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Drops Per Day (1–3)</label>
                            <input
                              id="trivia-drops-per-day"
                              type="number"
                              min={1}
                              max={3}
                              className="form-input"
                              placeholder="1"
                              value={config.drops_per_day ?? 1}
                              onChange={(e) => {
                                const val = Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1));
                                setConfig('drops_per_day', val);
                              }}
                            />
                            <span className="form-hint">Number of daily trivia drops (max 3)</span>
                          </div>
                        </div>

                        {/* Channel Whitelist */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Channel Whitelist</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px', gap: '0.5rem', marginBottom: '0.4rem', paddingRight: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Priority</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Channel ID</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Topic</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Remove</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allowedChannels.map((ch: any, i: number) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px', gap: '0.5rem', alignItems: 'center' }}>
                              <select
                                id={`trivia-ch-priority-${i}`}
                                className="form-input"
                                value={ch.priority || 'medium'}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, priority: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                              >
                                <option value="high">🔴 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">🟢 Low</option>
                              </select>
                              <input
                                id={`trivia-ch-id-${i}`}
                                className="form-input"
                                placeholder="Channel ID"
                                value={ch.channel_id || ''}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, channel_id: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <input
                                id={`trivia-ch-topic-${i}`}
                                className="form-input"
                                placeholder="e.g. Palworld"
                                value={ch.topic || ''}
                                onChange={(e) => {
                                  const updated = [...allowedChannels];
                                  updated[i] = { ...ch, topic: e.target.value };
                                  setConfig('allowed_channels', updated);
                                }}
                                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                              />
                              <button
                                id={`trivia-remove-ch-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('allowed_channels', allowedChannels.filter((_: any, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="trivia-add-channel-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('allowed_channels', [...allowedChannels, { channel_id: '', priority: 'medium', topic: '' }])}
                          >
                            + Add Channel
                          </button>
                        </div>

                        {/* Allowed Roles */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Participation Roles</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allowedRoles.map((roleId: string, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id={`trivia-role-${i}`}
                                className="form-input"
                                placeholder="Role ID or Role Name"
                                value={roleId}
                                onChange={(e) => {
                                  const updated = [...allowedRoles];
                                  updated[i] = e.target.value;
                                  setConfig('allowed_roles', updated);
                                }}
                              />
                              <button
                                id={`trivia-remove-role-${i}`}
                                className="btn btn-danger btn-icon btn-sm"
                                onClick={() => setConfig('allowed_roles', allowedRoles.filter((_: string, j: number) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            id="trivia-add-role-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfig('allowed_roles', [...allowedRoles, ''])}
                          >
                            + Add Role
                          </button>
                          <span className="form-hint">Leave empty to allow all members to participate.</span>
                        </div>

                        {/* Live Leaderboard Channel */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Live Point Tracker</span>
                          <div className="section-divider-line" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Leaderboard Channel ID</label>
                          <input
                            id="trivia-leaderboard-channel"
                            className="form-input"
                            placeholder="Channel where top 5 points are auto-posted"
                            value={config.leaderboard_channel_id || ''}
                            onChange={(e) => setConfig('leaderboard_channel_id', e.target.value)}
                          />
                          <span className="form-hint">Bot will post and edit a single message here as scores update. Leave empty to disable.</span>
                        </div>

                        {/* Manual Controls */}
                        <div className="section-divider">
                          <div className="section-divider-line" />
                          <span className="section-divider-text">Manual Safety Controls</span>
                          <div className="section-divider-line" />
                        </div>

                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            id="trivia-force-trigger"
                            className="btn btn-primary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('trigger')}
                          >
                            ⚡ Force Trigger
                          </button>
                          <button
                            id="trivia-skip"
                            className="btn btn-secondary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('skip')}
                          >
                            ⏭️ Skip / Close Active
                          </button>
                          <button
                            id="trivia-reroll"
                            className="btn btn-secondary btn-sm"
                            disabled={manualStatus === 'loading'}
                            onClick={() => handleManualAction('reroll')}
                          >
                            🎲 Reroll Drop
                          </button>
                          {manualStatus && (
                            <span style={{
                              fontSize: '0.8125rem',
                              color: manualStatus.startsWith('error') ? 'var(--color-error)' : 'var(--color-success)',
                              fontWeight: 500,
                            }}>
                              {manualStatus === 'loading' ? '⏳ Processing...' :
                               manualStatus === 'triggered' ? '✅ Drop triggered!' :
                               manualStatus === 'skipped' ? '✅ Session closed.' :
                               manualStatus === 'rerolled' ? '✅ Rerolled successfully.' :
                               `❌ ${manualStatus}`}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  }}
                </FeatureCard>
              </div>
            </div>
          )}

          {activeTab === 'boss' && (
            <div className="split-layout-detail">
              <div className="feature-instructions">
                <h3>Weekly Boss Bounty RPG Guide</h3>
                <p>
                  A self-balancing, zero-cost Discord RPG system where players choose a class and coordinate 3-class synergy loops to defeat a corrupted glitch boss.
                </p>
                <ol>
                  <li>Enable the feature below and set your target <strong>Boss Announcement Channel ID</strong>.</li>
                  <li>Players use <code>/boss status</code> or click the interactive Discord buttons to select a class (<strong>M.O.M.</strong>, <strong>D.A.D.</strong>, or <strong>K.I.D.</strong>) and spend 5 weekly AP.</li>
                  <li>Executing 3-class triad combos (M.O.M. Buff + D.A.D. Debuff + K.I.D. Nuke) deals <strong>60,000 DMG</strong> (Full Triad Meltdown).</li>
                  <li>Defeating the boss unlocks <strong>Overkill Mode</strong> with 1.5x bonus points and XP!</li>
                </ol>
              </div>

              <div className="feature-form-card">
                <FeatureCard
                  id="weekly-boss"
                  icon="🐉"
                  title="Weekly Boss Bounty RPG"
                  description="Self-balancing weekly boss RPG with M.O.M., D.A.D., and K.I.D. combat triad synergy, 5 AP weekly budgets, dynamic participant scaling, and Overkill Mode."
                  featureKey="weekly_boss"
                  initialEnabled={configs['weekly_boss']?.enabled ?? true}
                  initialConfig={configs['weekly_boss']?.config ?? {}}
                >
                  {(config, setConfig) => (
                    <>
                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Boss Settings</span>
                        <div className="section-divider-line" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Boss Announcement Channel ID</label>
                        <input
                          id="boss-channel-id"
                          className="form-input"
                          placeholder="Channel ID for boss card posts (e.g. 1234567890)"
                          value={config.channel_id || ''}
                          onChange={(e) => setConfig('channel_id', e.target.value)}
                        />
                        <span className="form-hint">Channel where /boss status cards are posted</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Custom Boss Image URL (Optional)</label>
                        <input
                          id="boss-image-url"
                          className="form-input"
                          placeholder="https://.../transparent_boss.png"
                          value={config.custom_image_url || ''}
                          onChange={(e) => setConfig('custom_image_url', e.target.value)}
                        />
                        <span className="form-hint">Direct link to a transparent PNG for custom weekly boss rendering</span>
                      </div>

                      {/* Admin Quick Action Controls */}
                      <div className="section-divider">
                        <div className="section-divider-line" />
                        <span className="section-divider-text">Admin Quick Action Controls</span>
                        <div className="section-divider-line" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Manual Boss Name (Optional Override)</label>
                          <input
                            id="boss-override-name"
                            className="form-input"
                            placeholder="e.g. ERROR-MOD: Corrupted Malenia"
                            value={config.override_name || ''}
                            onChange={(e) => setConfig('override_name', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Manual Base HP (Optional Override)</label>
                          <input
                            id="boss-override-hp"
                            type="number"
                            className="form-input"
                            placeholder="e.g. 150000"
                            value={config.override_hp || ''}
                            onChange={(e) => setConfig('override_hp', e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          id="boss-force-spawn"
                          className="btn btn-primary btn-sm"
                          disabled={config.boss_status === 'loading'}
                          onClick={async () => {
                            setConfig('boss_status', 'loading');
                            try {
                              const res = await fetch('/api/gaming/boss/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'spawn',
                                  customName: config.override_name,
                                  customHp: config.override_hp,
                                }),
                              });
                              const data = await res.json();
                              setConfig('boss_status', data.error ? `error: ${data.error}` : 'spawned');
                            } catch {
                              setConfig('boss_status', 'error: request failed');
                            }
                            setTimeout(() => setConfig('boss_status', ''), 4000);
                          }}
                        >
                          🚀 Force Spawn Boss
                        </button>

                        <button
                          id="boss-force-end"
                          className="btn btn-secondary btn-sm"
                          disabled={config.boss_status === 'loading'}
                          onClick={async () => {
                            setConfig('boss_status', 'loading');
                            try {
                              const res = await fetch('/api/gaming/boss/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'end' }),
                              });
                              const data = await res.json();
                              setConfig('boss_status', data.error ? `error: ${data.error}` : 'ended');
                            } catch {
                              setConfig('boss_status', 'error: request failed');
                            }
                            setTimeout(() => setConfig('boss_status', ''), 4000);
                          }}
                        >
                          ⏹️ Force End / Reset AP
                        </button>

                        <button
                          id="boss-force-overkill"
                          className="btn btn-secondary btn-sm"
                          disabled={config.boss_status === 'loading'}
                          onClick={async () => {
                            setConfig('boss_status', 'loading');
                            try {
                              const res = await fetch('/api/gaming/boss/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'overkill' }),
                              });
                              const data = await res.json();
                              setConfig('boss_status', data.error ? `error: ${data.error}` : 'overkill');
                            } catch {
                              setConfig('boss_status', 'error: request failed');
                            }
                            setTimeout(() => setConfig('boss_status', ''), 4000);
                          }}
                        >
                          💥 Force Trigger Overkill
                        </button>

                        {config.boss_status && (
                          <span style={{
                            fontSize: '0.8125rem',
                            color: config.boss_status.startsWith('error') ? 'var(--color-error)' : 'var(--color-success)',
                            fontWeight: 500,
                          }}>
                            {config.boss_status === 'loading' ? '⏳ Processing...' :
                             config.boss_status === 'spawned' ? '✅ Boss spawned!' :
                             config.boss_status === 'ended' ? '✅ Cycle ended & AP reset.' :
                             config.boss_status === 'overkill' ? '✅ Overkill Mode triggered!' :
                             `❌ ${config.boss_status}`}
                          </span>
                        )}
                      </div>
                    </>
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
