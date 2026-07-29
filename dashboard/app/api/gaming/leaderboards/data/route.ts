import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getWeekIdentifier(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID || '';
    const currentWeek = getWeekIdentifier();

    const [vaultRes, bossRes, triviaRes] = await Promise.all([
      // Unified Vault Leaderboard
      supabaseAdmin
        .from('vault_balances')
        .select('discord_id, coins, tier, messages_today, voice_minutes, updated_at')
        .eq('guild_id', guildId)
        .order('coins', { ascending: false })
        .limit(10),

      // Weekly Boss Leaderboard (chronological participation)
      supabaseAdmin
        .from('boss_player_states')
        .select('user_id, total_damage, weekly_points, class_key, ap_remaining, created_at')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .order('created_at', { ascending: true })
        .limit(10),

      // Trivia Leaderboard
      supabaseAdmin
        .from('trivia_points')
        .select('discord_id, points, updated_at')
        .eq('guild_id', guildId)
        .order('points', { ascending: false })
        .limit(10),
    ]);

    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const userToken = (session as any)?.accessToken;
    const authHeader = token ? `Bot ${token}` : userToken ? `Bearer ${userToken}` : null;

    const rawVault = vaultRes.data || [];
    const rawBoss = bossRes.data || [];
    const rawTrivia = triviaRes.data || [];

    // Collect all unique Discord user IDs
    const userIds = Array.from(
      new Set([
        ...rawVault.map((v) => v.discord_id),
        ...rawBoss.map((b) => b.user_id),
        ...rawTrivia.map((t) => t.discord_id),
      ])
    ).filter(Boolean);

    // Fetch user profiles from Discord API (with caching / fallback)
    const userProfiles: Record<string, { username: string; avatar_url: string }> = {};

    if (authHeader) {
      await Promise.all(
        userIds.map(async (id) => {
          try {
            const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
              headers: { Authorization: authHeader },
            });
            if (res.ok) {
              const u = await res.json();
              const name = u.global_name || u.username || id;
              const avatar_url = u.avatar
                ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=64`
                : `https://cdn.discordapp.com/embed/avatars/0.png`;
              userProfiles[id] = { username: name, avatar_url };
              return;
            }
          } catch (e) {}
          userProfiles[id] = { username: id, avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png' };
        })
      );
    }

    const vault = rawVault.map((v) => ({
      ...v,
      username: userProfiles[v.discord_id]?.username || v.discord_id,
      avatar_url: userProfiles[v.discord_id]?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
    }));

    const boss = rawBoss.map((b) => ({
      ...b,
      username: userProfiles[b.user_id]?.username || b.user_id,
      avatar_url: userProfiles[b.user_id]?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
    }));

    const trivia = rawTrivia.map((t) => ({
      ...t,
      username: userProfiles[t.discord_id]?.username || t.discord_id,
      avatar_url: userProfiles[t.discord_id]?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
    }));

    return NextResponse.json({
      success: true,
      guild_id: guildId,
      current_week: currentWeek,
      vault,
      boss,
      trivia,
    });
  } catch (err: any) {
    console.error('[LEADERBOARD DATA ERROR]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
