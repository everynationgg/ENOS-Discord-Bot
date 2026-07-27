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

    return NextResponse.json({
      success: true,
      guild_id: guildId,
      current_week: currentWeek,
      vault: vaultRes.data || [],
      boss: bossRes.data || [],
      trivia: triviaRes.data || [],
    });
  } catch (err: any) {
    console.error('[LEADERBOARD DATA ERROR]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
