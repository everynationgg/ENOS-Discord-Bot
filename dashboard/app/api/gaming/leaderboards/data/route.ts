import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getWeekIdentifier(date = new Date()) {
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  const targetDate = new Date(date.getTime() + tzOffsetMs);
  const d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

interface CachedDiscordUser {
  username: string;
  avatar_url: string;
  expiresAt: number;
}

const discordUserCache = new Map<string, CachedDiscordUser>();
const DISCORD_CACHE_TTL = 3600 * 1000; // 1 hour
const MAX_DISCORD_CACHE_SIZE = 500;

interface VaultLeaderboardRow {
  discord_id: string;
  coins: number;
  tier: string;
  messages_today: number;
  voice_minutes: number;
  updated_at: string;
}

interface BossLeaderboardRow {
  user_id: string;
  total_damage: number;
  weekly_points: number;
  class_key: string;
  ap_remaining: number;
  created_at: string;
}

interface TriviaLeaderboardRow {
  discord_id: string;
  points: number;
  updated_at: string;
}

interface InviteLeaderboardRow {
  inviter_id: string;
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

    // Run 5 independent Supabase queries concurrently in Promise.all
    const [vaultRes, bossRes, triviaRes, invitesRes, _configRes] = await Promise.all([
      // 1. Unified Vault Leaderboard
      supabaseAdmin
        .from('vault_balances')
        .select('discord_id, coins, tier, messages_today, voice_minutes, updated_at')
        .eq('guild_id', guildId)
        .order('coins', { ascending: false })
        .limit(10),

      // 2. Weekly Boss Leaderboard
      supabaseAdmin
        .from('boss_player_states')
        .select('user_id, total_damage, weekly_points, class_key, ap_remaining, created_at')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .order('created_at', { ascending: true })
        .limit(10),

      // 3. Trivia Leaderboard
      supabaseAdmin
        .from('trivia_points')
        .select('discord_id, points, updated_at')
        .eq('guild_id', guildId)
        .order('points', { ascending: false })
        .limit(10),

      // 4. Recruitment Invites Leaderboard
      supabaseAdmin
        .from('member_invites')
        .select('inviter_id')
        .eq('guild_id', guildId)
        .eq('status', 'valid')
        .limit(500),

      // 5. Guild Config
      supabaseAdmin
        .from('guild_config')
        .select('feature_key, enabled, config')
        .eq('guild_id', guildId),
    ]);

    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const userToken = (session as { accessToken?: string })?.accessToken;
    const authHeader = token ? `Bot ${token}` : userToken ? `Bearer ${userToken}` : null;

    const rawVault = (vaultRes.data || []) as VaultLeaderboardRow[];
    const rawBoss = (bossRes.data || []) as BossLeaderboardRow[];
    const rawTrivia = (triviaRes.data || []) as TriviaLeaderboardRow[];
    const rawInvites = (invitesRes.data || []) as InviteLeaderboardRow[];

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
        ...rawVault.map((v) => v.discord_id),
        ...rawBoss.map((b) => b.user_id),
        ...rawTrivia.map((t) => t.discord_id),
        ...sortedAchievers.map((a) => a.inviter_id),
      ])
    ).filter(Boolean);

    // Fetch user profiles from Discord API with module-level TTL Map cache
    const userProfiles: Record<string, { username: string; avatar_url: string }> = {};

    if (authHeader) {
      await Promise.all(
        userIds.map(async (id) => {
          const cached = discordUserCache.get(id);
          if (cached && cached.expiresAt > Date.now()) {
            userProfiles[id] = { username: cached.username, avatar_url: cached.avatar_url };
            return;
          }

          try {
            const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
              headers: { Authorization: authHeader },
              next: { revalidate: 3600 },
            });
            if (res.ok) {
              const u = (await res.json()) as { global_name?: string; username?: string; avatar?: string };
              const name = u.global_name || u.username || id;
              const avatar_url = u.avatar
                ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=64`
                : `https://cdn.discordapp.com/embed/avatars/0.png`;

              if (discordUserCache.size >= MAX_DISCORD_CACHE_SIZE) {
                const oldestKey = discordUserCache.keys().next().value;
                if (oldestKey) discordUserCache.delete(oldestKey);
              }

              discordUserCache.set(id, {
                username: name,
                avatar_url,
                expiresAt: Date.now() + DISCORD_CACHE_TTL,
              });

              userProfiles[id] = { username: name, avatar_url };
              return;
            }
          } catch {
            // ignore network errors
          }
          userProfiles[id] = { username: id, avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png' };
        })
      );
    }

    function getDiscordAvatar(id: string) {
      try {
        const idx = (BigInt(id) >> BigInt(22)) % BigInt(6);
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
      } catch {
        return 'https://cdn.discordapp.com/embed/avatars/0.png';
      }
    }

    const vault = rawVault.map((v) => ({
      ...v,
      username: userProfiles[v.discord_id]?.username || `Member (${v.discord_id.slice(-4)})`,
      avatar_url: userProfiles[v.discord_id]?.avatar_url || getDiscordAvatar(v.discord_id),
    }));

    const boss = rawBoss.map((b) => ({
      ...b,
      username: userProfiles[b.user_id]?.username || `Member (${b.user_id.slice(-4)})`,
      avatar_url: userProfiles[b.user_id]?.avatar_url || getDiscordAvatar(b.user_id),
    }));

    const trivia = rawTrivia.map((t) => ({
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[LEADERBOARD DATA ERROR]:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
