'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Providers from '@/components/Providers';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

function SelectServerContent() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchGuilds() {
      try {
        const res = await fetch('/api/user/guilds');
        if (!res.ok) {
          throw new Error('Failed to load server list');
        }
        const data = await res.json();
        const list: Guild[] = data.guilds || [];
        setGuilds(list);

        // If only 1 guild exists, auto-select it for frictionless access
        if (list.length === 1) {
          handleSelectGuild(list[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Could not fetch your Discord servers.');
      } finally {
        setLoading(false);
      }
    }

    fetchGuilds();
  }, []);

  const handleSelectGuild = (guild: Guild) => {
    setSelectingId(guild.id);
    if (typeof document !== 'undefined') {
      document.cookie = `enos_guild_id=${guild.id}; path=/; max-age=2592000; SameSite=Lax`;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('enos_selected_guild_id', guild.id);
      localStorage.setItem('enos_selected_guild_name', guild.name);
    }
    window.location.href = `/dashboard?guild_id=${guild.id}`;
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div className="login-logo">🏰</div>
        <h1 className="login-title">Select Server</h1>
        <p className="login-subtitle">
          Choose the community you want to configure
        </p>

        {error && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.8125rem',
              textAlign: 'left',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>
              ⏳
            </span>
            Discovering your managed servers...
          </div>
        ) : guilds.length === 0 ? (
          <div style={{ padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              No servers with ENOS bot installed were found where you have Administrator or Manage Server permissions.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Make sure the bot has been invited to your server and you are logged in with the correct Discord account.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {guilds.map((g) => {
              const isSelected = selectingId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => handleSelectGuild(g)}
                  disabled={Boolean(selectingId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1.125rem',
                    background: isSelected
                      ? 'rgba(139, 92, 246, 0.25)'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    cursor: selectingId ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectingId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectingId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {g.icon ? (
                      <img
                        src={g.icon}
                        alt={g.name}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent-primary), #6D28D9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.9rem',
                        }}
                      >
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Administrator Access
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {isSelected ? 'Loading...' : 'Select →'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            {session?.user?.name ? `Logged in as ${session.user.name}` : 'Discord Authentication'}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              textDecoration: 'underline',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SelectServerPage() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <SelectServerContent />
      </Suspense>
    </Providers>
  );
}
