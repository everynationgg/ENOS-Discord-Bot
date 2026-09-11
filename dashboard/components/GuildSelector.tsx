'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export default function GuildSelector() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadGuilds() {
      try {
        const res = await fetch('/api/user/guilds');
        if (!res.ok) return;
        const data = await res.json();
        const list: Guild[] = data.guilds || [];
        setGuilds(list);

        const currentParam = searchParams.get('guild_id');
        const cookieMatch = typeof document !== 'undefined' ? document.cookie.match(/enos_guild_id=([^;]+)/) : null;
        const cookieVal = cookieMatch ? cookieMatch[1] : null;
        const saved = typeof window !== 'undefined' ? localStorage.getItem('enos_selected_guild_id') : null;

        let activeId = currentParam || cookieVal || saved || (list.length > 0 ? list[0].id : '');
        
        if (list.length > 0 && !list.some((g) => g.id === activeId)) {
          activeId = list[0].id;
        }

        if (activeId) {
          setSelectedGuildId(activeId);
          if (typeof document !== 'undefined') {
            document.cookie = `enos_guild_id=${activeId}; path=/; max-age=2592000; SameSite=Lax`;
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('enos_selected_guild_id', activeId);
          }
        }
      } catch (err) {
        console.error('Failed to load guilds:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGuilds();
  }, [searchParams]);

  const handleGuildChange = (newGuildId: string) => {
    setSelectedGuildId(newGuildId);
    if (typeof document !== 'undefined') {
      document.cookie = `enos_guild_id=${newGuildId}; path=/; max-age=2592000; SameSite=Lax`;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('enos_selected_guild_id', newGuildId);
      window.location.href = `${pathname}?guild_id=${newGuildId}`;
    }
  };

  if (loading) {
    return null;
  }

  if (guilds.length <= 1) {
    const singleGuild = guilds[0];
    if (!singleGuild) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Server:</span>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          🏰 {singleGuild.name}
        </span>
        <a
          href="/select-server"
          title="Switch Server"
          style={{
            fontSize: '0.75rem',
            color: 'var(--accent-primary)',
            textDecoration: 'none',
            padding: '3px 8px',
            borderRadius: '4px',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '600',
          }}
        >
          ⇄ Switch
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Server:</span>
      <select
        value={selectedGuildId}
        onChange={(e) => handleGuildChange(e.target.value)}
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--text-primary)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '0.85rem',
          fontWeight: '600',
          outline: 'none',
          cursor: 'pointer',
        }}
        id="dashboard-guild-selector"
      >
        {guilds.map((g) => (
          <option key={g.id} value={g.id} style={{ background: '#121218', color: '#fff' }}>
            🏰 {g.name}
          </option>
        ))}
      </select>
      <a
        href="/select-server"
        title="Switch Server"
        style={{
          fontSize: '0.75rem',
          color: 'var(--accent-primary)',
          textDecoration: 'none',
          padding: '3px 8px',
          borderRadius: '4px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '600',
        }}
      >
        ⇄ Switch
      </a>
    </div>
  );
}
