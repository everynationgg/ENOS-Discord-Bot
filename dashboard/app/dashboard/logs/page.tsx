'use client';

import { useEffect, useState } from 'react';

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'verification', label: '🔐 Verifications' },
  { value: 'lfg_create', label: '🎮 LFG Sessions' },
  { value: 'coin_award', label: '💰 Coin Awards' },
  { value: 'tier_promotion', label: '⬆️ Tier Promotions' },
  { value: 'live_alert', label: '🔴 Live Alerts' },
  { value: 'digest', label: '📋 Digest Posts' },
];

const EVENT_ICONS: Record<string, string> = {
  verification: '🔐', lfg_create: '🎮', coin_award: '💰',
  tier_promotion: '⬆️', live_alert: '🔴', digest: '📋',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchLogs = (type: string) => {
    setLoading(true);
    const params = type ? `?type=${type}&limit=100` : '?limit=100';
    fetch(`/api/logs${params}`)
      .then((r) => r.json())
      .then((d) => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(''); }, []);

  const handleFilterChange = (type: string) => {
    setFilter(type);
    fetchLogs(type);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📋 Event Logs</h1>
        <p>Real-time audit log of all bot activity — verifications, LFG sessions, coin awards, and more.</p>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        {EVENT_TYPES.map((et) => (
          <button
            key={et.value}
            id={`log-filter-${et.value || 'all'}`}
            className={`btn btn-sm ${filter === et.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleFilterChange(et.value)}
          >
            {et.label}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => fetchLogs(filter)} id="refresh-logs-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Logs Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No logs found</div>
            <div className="empty-state-desc">Bot events will appear here as they happen.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>Timestamp (PHT)</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {EVENT_ICONS[log.event_type] || '📌'}
                        <span style={{ textTransform: 'capitalize' }}>{log.event_type.replace(/_/g, ' ')}</span>
                      </span>
                    </td>
                    <td>
                      {log.discord_id ? (
                        <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'var(--accent-primary-dim)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                          {log.discord_id}
                        </code>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {JSON.stringify(log.details).substring(0, 80)}
                        </code>
                      ) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Showing last {logs.length} events · Logs older than 30 days are automatically pruned.
      </div>
    </div>
  );
}
