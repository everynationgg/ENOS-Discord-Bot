import { auth } from '@/lib/auth';
import { getBotHealth, getGuildConfigs } from '@/lib/supabase';

export const metadata = { title: 'Home — ENOS Dashboard' };

export default async function DashboardHome() {
  const session = await auth();
  const guildId = process.env.DISCORD_GUILD_ID!;

  let health = null;
  let configs: any[] = [];

  try {
    [health, configs] = await Promise.all([
      getBotHealth(guildId),
      getGuildConfigs(guildId),
    ]);
  } catch {}

  const enabledCount = configs.filter((c) => c.enabled).length;
  const isOnline = health?.last_seen
    ? Date.now() - new Date(health.last_seen).getTime() < 10 * 60 * 1000
    : false;

  const lastSeen = health?.last_seen
    ? new Date(health.last_seen).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    : 'Never';

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>🏰 Every Nation — ENOS</h1>
        <p>Bot Configuration Dashboard · Logged in as <strong style={{ color: 'var(--text-primary)' }}>{session?.user?.name}</strong></p>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Bot Status</div>
          <div className="stat-card-value" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="stat-card-sub">Last seen: {lastSeen}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Active Features</div>
          <div className="stat-card-value">{enabledCount}</div>
          <div className="stat-card-sub">of {configs.length} configured</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Bot Version</div>
          <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>
            {health?.bot_version || '—'}
          </div>
          <div className="stat-card-sub">Running on Railway</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Guild ID</div>
          <div className="stat-card-value" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
            {guildId ? `${guildId.slice(0, 8)}…` : '—'}
          </div>
          <div className="stat-card-sub">Every Nation Server</div>
        </div>
      </div>

      {/* Feature Status Overview */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3>Feature Status Overview</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No features configured yet. Visit a tab to get started.
                </td>
              </tr>
            ) : (
              configs.map((cfg) => (
                <tr key={cfg.feature_key}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {cfg.feature_key.replace(/_/g, ' ')}
                  </td>
                  <td>
                    <span className={`badge ${cfg.enabled ? 'badge-active' : 'badge-inactive'}`}>
                      {cfg.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    {new Date(cfg.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Links */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href="/dashboard/moderation" className="btn btn-secondary">🛡️ Moderation</a>
        <a href="/dashboard/gaming" className="btn btn-secondary">🎮 Gaming</a>
        <a href="/dashboard/social" className="btn btn-secondary">📡 Social</a>
        <a href="/dashboard/system-ops" className="btn btn-secondary">⚙️ System Ops</a>
        <a href="/dashboard/logs" className="btn btn-secondary">📋 Logs</a>
      </div>
    </div>
  );
}
