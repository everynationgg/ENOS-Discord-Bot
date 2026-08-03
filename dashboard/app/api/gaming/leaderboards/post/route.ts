import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

function getWeekIdentifier(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { guild_id, channel_id, type } = body;
    const guildId = guild_id || process.env.DISCORD_GUILD_ID || '';
    const currentWeek = getWeekIdentifier();

    if (!channel_id || typeof channel_id !== 'string' || !channel_id.trim()) {
      return NextResponse.json(
        { success: false, error: 'Target Channel ID is required.' },
        { status: 400 }
      );
    }

    if (!DISCORD_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'DISCORD_TOKEN environment variable is missing.' },
        { status: 500 }
      );
    }

    let embed: any = null;

    if (type === 'vault') {
      const { data: top } = await supabaseAdmin
        .from('vault_balances')
        .select('discord_id, coins, tier')
        .eq('guild_id', guildId)
        .order('coins', { ascending: false })
        .limit(10);

      const lines = (top || []).map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const tierEmoji = entry.tier === 'gold' ? '🟡' : entry.tier === 'silver' ? '⚪' : '🟤';
        return `${medal} ${tierEmoji} <@${entry.discord_id}> — **${entry.coins.toLocaleString()}** coins (₱${entry.coins.toFixed(2)})`;
      });

      embed = {
        title: '🏆 Vault Leaderboard — Every Nation',
        description: lines.join('\n') || '*No records yet.*',
        color: 0xfacc15,
        footer: { text: 'Every Nation Vault • ₱1 = 1 Coin' },
        timestamp: new Date().toISOString(),
      };
    } else if (type === 'boss') {
      const { data: top } = await supabaseAdmin
        .from('boss_player_states')
        .select('user_id, total_damage, weekly_points, class_key, ap_remaining')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .order('created_at', { ascending: true })
        .limit(10);

      const lines = (top || []).map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const clsIcon = entry.class_key === 'mom' ? '🛡️' : entry.class_key === 'dad' ? '🔨' : entry.class_key === 'kid' ? '⚡' : '👤';
        const apUsed = Math.max(0, 5 - (entry.ap_remaining || 0));
        return `${medal} ${clsIcon} <@${entry.user_id}> — **${entry.weekly_points} pts (₱${entry.weekly_points})** | \`${apUsed}/5 AP\` (${entry.total_damage.toLocaleString()} DMG)`;
      });

      embed = {
        title: `🏆 Weekly Boss Leaderboard (${currentWeek})`,
        description: `*Ranked in chronological participation order (first combatant to join up to the last)*:\n\n` + (lines.join('\n') || '*No participants yet.*'),
        color: 0xfacc15,
        footer: { text: 'ENOS RPG Participation Ledger • 1 Point = ₱1 PHP' },
        timestamp: new Date().toISOString(),
      };
    } else if (type === 'trivia') {
      const { data: top } = await supabaseAdmin
        .from('trivia_points')
        .select('discord_id, points')
        .eq('guild_id', guildId)
        .order('points', { ascending: false })
        .limit(10);

      const lines = (top || []).map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        return `${medal} 🧠 <@${entry.discord_id}> — **${entry.points.toLocaleString()} pts (₱${entry.points.toFixed(2)})**`;
      });

      embed = {
        title: '🧠 Trivia Champions Leaderboard — Every Nation',
        description: lines.join('\n') || '*No trivia champions yet.*',
        color: 0x3b82f6,
        footer: { text: 'ENOS Trivia System • 1 Point = ₱1 PHP' },
        timestamp: new Date().toISOString(),
      };
    } else if (type === 'achievements') {
      await supabaseAdmin.from('system_logs').insert({
        event_type: 'achievement_dispatch_card',
        payload: { channel_id, timestamp: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: 'Master Achievement Card dispatch requested! The bot is posting the interactive graphic card to your channel.',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid leaderboard type specified.' },
        { status: 400 }
      );
    }

    // Dispatch message to Discord Channel via REST API
    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channel_id.trim()}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errJson = await discordRes.json().catch(() => ({}));
      const errMsg = errJson?.message || discordRes.statusText;
      return NextResponse.json(
        { success: false, error: `Discord API Error (${discordRes.status}): ${errMsg}` },
        { status: discordRes.status }
      );
    }

    const sentData = await discordRes.json();

    // Log bot event in Supabase
    await supabaseAdmin.from('bot_event_logs').insert({
      guild_id: guildId,
      event_type: 'leaderboard_force_posted',
      details: {
        channel_id,
        leaderboard_type: type,
        message_id: sentData.id,
        posted_by: session.user?.name || session.user?.email || 'Admin',
      },
    });

    return NextResponse.json({
      success: true,
      message_id: sentData.id,
    });
  } catch (err: any) {
    console.error('[LEADERBOARD POST EXCEPTION]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
