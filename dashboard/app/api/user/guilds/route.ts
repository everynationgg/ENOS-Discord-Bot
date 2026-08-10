import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user's Discord guilds using session access token
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ guilds: [] });
    }

    const userGuilds = await res.json();
    if (!Array.isArray(userGuilds)) {
      return NextResponse.json({ guilds: [] });
    }

    // 2. Fetch list of active ENOS bot servers from database
    const { data: activeSettings } = await supabaseAdmin
      .from('guild_settings')
      .select('guild_id')
      .eq('is_active', true);

    const activeGuildIds = new Set((activeSettings || []).map((s) => s.guild_id));

    // Fallback default dev guild ID
    const defaultGuildId = process.env.DISCORD_GUILD_ID || process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || '';
    if (defaultGuildId) activeGuildIds.add(defaultGuildId);

    // 3. Filter user guilds: user must be owner or have Manage Server/Admin permission, AND bot must be in guild
    const manageableGuilds = userGuilds
      .filter((g: any) => {
        const isOwner = Boolean(g.owner);
        const perms = BigInt(g.permissions || '0');
        const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
        const canManage = (perms & BigInt(0x20)) === BigInt(0x20);

        const hasPerms = isOwner || isAdmin || canManage;
        const isBotActive = activeGuildIds.has(g.id) || g.id === defaultGuildId;

        return hasPerms && isBotActive;
      })
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
      }));

    // If list is empty but default guild exists, provide default fallback
    if (manageableGuilds.length === 0 && defaultGuildId) {
      manageableGuilds.push({
        id: defaultGuildId,
        name: 'Every Nation Guild',
        icon: null,
      });
    }

    return NextResponse.json({ guilds: manageableGuilds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load guilds' }, { status: 500 });
  }
}
