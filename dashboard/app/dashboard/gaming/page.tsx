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

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🎮 Gaming</h1>
        <p>Configure LFG party finder, Vault Economy, and game branch settings.</p>
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
        </div>
      </div>
    </div>
  );
}
