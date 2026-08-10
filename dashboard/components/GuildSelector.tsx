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
        const saved = typeof window !== 'undefined' ? localStorage.getItem('enos_selected_guild_id') : null;

        let activeId = currentParam || saved || (list.length > 0 ? list[0].id : '');
        
        if (list.length > 0 && !list.some((g) => g.id === activeId)) {
          activeId = list[0].id;
        }

        if (activeId) {
          setSelectedGuildId(activeId);
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
  }, []);

  const handleGuildChange = (newGuildId: string) => {
    setSelectedGuildId(newGuildId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enos_selected_guild_id', newGuildId);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('guild_id', newGuildId);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (loading || guilds.length <= 1) {
    return null; // Hide dropdown if only 1 guild exists or loading
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
    </div>
  );
}
