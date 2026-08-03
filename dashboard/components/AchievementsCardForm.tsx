'use client';

import React, { useState, useEffect } from 'react';

export default function AchievementsCardForm({ config, setConfig }: { config: any; setConfig: (key: string, val: any) => void }) {
  const tiers = config.tiers || {
    enis: { title: 'They Who Herald the Nation', threshold: 5, reward_type: 'coins', reward_val: 50 },
    enara: { title: 'Those Who Exalt the Nation', threshold: 50, reward_type: 'nitro', reward_val: '1 Month Discord Nitro + Boost' },
    enorium: { title: 'The One Who Ordains the Nation', threshold: 100, reward_type: 'nitro', reward_val: '1 Year Discord Nitro + Boost', exclusive: true },
  };

  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/gaming/achievements/action');
      const data = await res.json();
      if (data.success && data.invites) {
        setInvites(data.invites);
      }
    } catch (e) {
      console.error('Failed to fetch invite log', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleUpdateStatus = async (inviteId: string, newStatus: string) => {
    try {
      setStatusMsg('Updating...');
      const res = await fetch('/api/gaming/achievements/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_invite_status', inviteId, newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Updated status to ${newStatus}`);
        fetchInvites();
      } else {
        setStatusMsg(`Error: ${data.error}`);
      }
    } catch {
      setStatusMsg('Error updating status');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleDispatchCard = async () => {
    if (!config.channel_id) {
      setStatusMsg('❌ Please enter a Master Achievement Card Channel ID first.');
      setTimeout(() => setStatusMsg(''), 4000);
      return;
    }

    setDispatching(true);
    setStatusMsg('⏳ Dispatching achievement card to Discord...');
    try {
      const res = await fetch('/api/gaming/achievements/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch_card', channel_id: config.channel_id }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('✅ Master Achievement Card successfully posted to Discord!');
      } else {
        setStatusMsg(`❌ Error: ${data.error}`);
      }
    } catch {
      setStatusMsg('❌ Failed to send dispatch request.');
    } finally {
      setDispatching(false);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const customAchievements = config.custom_achievements || [
    {
      id: 'recruitment',
      name: 'Recruitment',
      description: 'Track successful member invitations to Every Nation.',
      image_url: '/images/achievements-card-preview.png',
      tiers: {
        enis: { title: 'They Who Herald the Nation', threshold: 5, reward_val: '50 Vault Coins' },
        enara: { title: 'Those Who Exalt the Nation', threshold: 50, reward_val: '1 Month Discord Nitro + Boost' },
        enorium: { title: 'The One Who Ordains the Nation', threshold: 100, reward_val: '1 Year Discord Nitro + Boost', exclusive: true },
      },
    },
  ];

  const handleImageUpload = async (file: File, index: number) => {
    try {
      setUploadingIndex(index);
      setStatusMsg('⏳ Uploading graphic image...');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        const list = [...customAchievements];
        list[index] = { ...list[index], image_url: data.url };
        setConfig('custom_achievements', list);
        setStatusMsg('✅ Image uploaded successfully!');
      } else {
        setStatusMsg(`❌ Upload failed: ${data.error}`);
      }
    } catch {
      setStatusMsg('❌ Failed to upload image.');
    } finally {
      setUploadingIndex(null);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  const handleAddAchievement = () => {
    const newCard = {
      id: `achievement_${Date.now()}`,
      name: 'New Achievement',
      description: 'Describe the achievement requirements...',
      image_url: '/images/achievements-card-preview.png',
      tiers: {
        enis: { title: 'Enis Title Phrase', threshold: 10, reward_val: '100 Vault Coins' },
        enara: { title: 'Enara Title Phrase', threshold: 50, reward_val: 'Special Discord Role' },
        enorium: { title: 'Enorium Crown Title', threshold: 100, reward_val: 'Nitro / Crown Title', exclusive: true },
      },
    };
    setConfig('custom_achievements', [...customAchievements, newCard]);
  };

  const handleDeleteAchievement = (index: number) => {
    if (customAchievements.length <= 1) {
      setStatusMsg('❌ Minimum 1 achievement card required.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    const list = customAchievements.filter((_: any, i: number) => i !== index);
    setConfig('custom_achievements', list);
  };

  return (
    <>
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">📢 Achievement Display & Announcement Channels</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Master Achievement Card Channel ID</label>
          <input
            id="achievement-channel-id"
            className="form-input"
            placeholder="Channel ID to post master achievement browser card"
            value={config.channel_id || ''}
            onChange={(e) => setConfig('channel_id', e.target.value)}
          />
          <span className="form-hint">Channel where the interactive achievement browser card is posted.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Staff Audit Log Channel ID</label>
          <input
            id="achievement-log-channel-id"
            className="form-input"
            placeholder="Channel ID for crown title swap & fraud alerts"
            value={config.log_channel_id || ''}
            onChange={(e) => setConfig('log_channel_id', e.target.value)}
          />
          <span className="form-hint">Channel where title transfers and moderator audit events are posted.</span>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={dispatching}
          onClick={handleDispatchCard}
        >
          {dispatching ? '⏳ Dispatching...' : '🚀 Post / Dispatch Master Achievement Card to Discord'}
        </button>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">🏆 Achievement Cards Manager (Upload & Configure)</span>
        <div className="section-divider-line" />
      </div>

      {/* Achievement Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {customAchievements.map((item: any, idx: number) => (
          <div
            key={item.id || idx}
            style={{
              background: 'var(--bg-secondary)',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#A78BFA' }}>
                📜 Achievement #{idx + 1}: {item.name || 'Untitled'}
              </h4>
              {customAchievements.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  onClick={() => handleDeleteAchievement(idx)}
                >
                  🗑️ Delete Card
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Image Upload Box */}
              <div>
                <label className="form-label">Graphic Image</label>
                <div
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <img
                    src={item.image_url || '/images/achievements-card-preview.png'}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: '130px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    id={`file-input-${idx}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageUpload(e.target.files[0], idx);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={uploadingIndex === idx}
                    onClick={() => document.getElementById(`file-input-${idx}`)?.click()}
                    style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center' }}
                  >
                    {uploadingIndex === idx ? '⏳ Uploading...' : '📁 Upload Graphic Image'}
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Achievement Name</label>
                  <input
                    className="form-input"
                    value={item.name || ''}
                    onChange={(e) => {
                      const list = [...customAchievements];
                      list[idx] = { ...list[idx], name: e.target.value };
                      setConfig('custom_achievements', list);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    className="form-input"
                    value={item.description || ''}
                    onChange={(e) => {
                      const list = [...customAchievements];
                      list[idx] = { ...list[idx], description: e.target.value };
                      setConfig('custom_achievements', list);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tiers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              {/* Enis Tier */}
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#A78BFA', fontSize: '0.85rem' }}>🟣 Tier I — Enis</h5>
                <input
                  className="form-input"
                  placeholder="Title Phrase"
                  style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}
                  value={item.tiers?.enis?.title || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enis: { ...list[idx].tiers?.enis, title: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
                <input
                  className="form-input"
                  placeholder="Reward Description"
                  style={{ fontSize: '0.8rem' }}
                  value={item.tiers?.enis?.reward_val || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enis: { ...list[idx].tiers?.enis, reward_val: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
              </div>

              {/* Enara Tier */}
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#F97316', fontSize: '0.85rem' }}>🔥 Tier II — Enara</h5>
                <input
                  className="form-input"
                  placeholder="Title Phrase"
                  style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}
                  value={item.tiers?.enara?.title || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enara: { ...list[idx].tiers?.enara, title: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
                <input
                  className="form-input"
                  placeholder="Reward Description"
                  style={{ fontSize: '0.8rem' }}
                  value={item.tiers?.enara?.reward_val || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enara: { ...list[idx].tiers?.enara, reward_val: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
              </div>

              {/* Enorium Tier */}
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#EAB308', fontSize: '0.85rem' }}>👑 Tier III — Enorium</h5>
                <input
                  className="form-input"
                  placeholder="Title Phrase"
                  style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}
                  value={item.tiers?.enorium?.title || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enorium: { ...list[idx].tiers?.enorium, title: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
                <input
                  className="form-input"
                  placeholder="Reward Description"
                  style={{ fontSize: '0.8rem' }}
                  value={item.tiers?.enorium?.reward_val || ''}
                  onChange={(e) => {
                    const list = [...customAchievements];
                    list[idx] = { ...list[idx], tiers: { ...list[idx].tiers, enorium: { ...list[idx].tiers?.enorium, reward_val: e.target.value } } };
                    setConfig('custom_achievements', list);
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleAddAchievement}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          ➕ Add New Achievement Card
        </button>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">🛡️ Qualification & Anti-Fraud Rules</span>
        <div className="section-divider-line" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Minimum Account Age (Days)</label>
          <input
            type="number" className="form-input"
            value={config.min_account_age_days ?? 365}
            onChange={(e) => setConfig('min_account_age_days', parseInt(e.target.value, 10) || 365)}
          />
          <span className="form-hint">Accounts younger than this stay Pending until reaching target age.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Require Gatekeeper Onboarding</label>
          <select
            className="form-input"
            value={config.require_onboarding ? 'true' : 'false'}
            onChange={(e) => setConfig('require_onboarding', e.target.value === 'true')}
          >
            <option value="true">Enabled (Must complete onboarding)</option>
            <option value="false">Disabled</option>
          </select>
        </div>
      </div>

      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">📜 Member Invite Audit & Moderation Log</span>
        <div className="section-divider-line" />
      </div>

      {statusMsg && <div style={{ fontSize: '0.8125rem', color: 'var(--color-success)', marginBottom: '0.5rem' }}>{statusMsg}</div>}

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border-color)' }}>
        {loading ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading invite records...</div>
        ) : invites.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>No invite records logged yet. New invites will appear here after onboarding.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Inviter ID</th>
                  <th style={{ padding: '0.5rem' }}>Invited Member ID</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Account Created</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{inv.inviter_id}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{inv.invited_member_id}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span className={`badge ${inv.status === 'valid' ? 'badge-success' : inv.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
                      {new Date(inv.invited_account_created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {inv.status === 'valid' ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#ef4444', fontSize: '0.7rem' }}
                          onClick={() => handleUpdateStatus(inv.id, 'revoked')}
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#22c55e', fontSize: '0.7rem' }}
                          onClick={() => handleUpdateStatus(inv.id, 'valid')}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
