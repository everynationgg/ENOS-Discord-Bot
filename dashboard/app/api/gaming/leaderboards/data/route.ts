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

    const [vaultRes, bossRes, triviaRes, invitesRes] = await Promise.all([
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

      // Recruitment Invites Leaderboard (graceful fallback)
      supabaseAdmin
        .from('member_invites')
        .select('inviter_id')
        .eq('status', 'valid')
        .then(
          (r) => r,
          () => ({ data: [] as any[], error: null })
        ),
    ]);

    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const userToken = (session as any)?.accessToken;
    const authHeader = token ? `Bot ${token}` : userToken ? `Bearer ${userToken}` : null;

    const rawVault = vaultRes.data || [];
    const rawBoss = bossRes.data || [];
    const rawTrivia = triviaRes.data || [];
    const rawInvites = (invitesRes as any)?.data || [];

    // Aggregate invites per inviter
    const inviteCounts: Record<string, number> = {};
    for (const inv of rawInvites) {
      if (inv.inviter_id) {
        inviteCounts[inv.inviter_id] = (inviteCounts[inv.inviter_id] || 0) + 1;
      }
    }

    const sortedAchievers = Object.entries(inviteCounts)
      .map(([inviter_id, valid_invites]) => ({ inviter_id, valid_invites }))
      .sort((a, b) => b.valid_invites - a.valid_invites)
      .slice(0, 10);

    // Collect all unique Discord user IDs
    const userIds = Array.from(
      new Set([
        ...rawVault.map((v: any) => v.discord_id),
        ...rawBoss.map((b: any) => b.user_id),
        ...rawTrivia.map((t: any) => t.discord_id),
        ...sortedAchievers.map((a) => a.inviter_id),
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

    function getDiscordAvatar(id: string) {
      try {
        const idx = (BigInt(id) >> BigInt(22)) % BigInt(6);
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
      } catch (e) {
        return 'https://cdn.discordapp.com/embed/avatars/0.png';
      }
    }

    const vault = rawVault.map((v: any) => ({
      ...v,
      username: userProfiles[v.discord_id]?.username || `Member (${v.discord_id.slice(-4)})`,
      avatar_url: userProfiles[v.discord_id]?.avatar_url || getDiscordAvatar(v.discord_id),
    }));

    const boss = rawBoss.map((b: any) => ({
      ...b,
      username: userProfiles[b.user_id]?.username || `Member (${b.user_id.slice(-4)})`,
      avatar_url: userProfiles[b.user_id]?.avatar_url || getDiscordAvatar(b.user_id),
    }));

    const trivia = rawTrivia.map((t: any) => ({
      ...t,
      username: userProfiles[t.discord_id]?.username || `Member (${t.discord_id.slice(-4)})`,
      avatar_url: userProfiles[t.discord_id]?.avatar_url || getDiscordAvatar(t.discord_id),
    }));

    const achievements = sortedAchievers.map((a) => {
      let tierTitle = 'Unranked Recruiter';
      if (a.valid_invites >= 100) tierTitle = '👑 Enorium (The One Who Ordains)';
      else if (a.valid_invites >= 50) tierTitle = '🔥 Enara (Those Who Exalt)';
      else if (a.valid_invites >= 5) tierTitle = '💜 Enis (They Who Herald)';

      return {
        ...a,
        tier_title: tierTitle,
        username: userProfiles[a.inviter_id]?.username || `Member (${a.inviter_id.slice(-4)})`,
        avatar_url: userProfiles[a.inviter_id]?.avatar_url || getDiscordAvatar(a.inviter_id),
      };
    });

    return NextResponse.json({
      success: true,
      guild_id: guildId,
      current_week: currentWeek,
      vault,
      boss,
      trivia,
      achievements,
    });
  } catch (err: any) {
    console.error('[LEADERBOARD DATA ERROR]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
