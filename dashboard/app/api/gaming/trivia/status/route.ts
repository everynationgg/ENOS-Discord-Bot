import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/gaming/trivia/status — Fetch active/recent trivia drop status & participant breakdown
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);

    // 1. Fetch current active or most recent trivia drop for this guild
    const { data: drops, error: dropErr } = await supabaseAdmin
      .from('trivia_drops')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dropErr) {
      return NextResponse.json({ error: dropErr.message }, { status: 500 });
    }

    if (!drops || drops.length === 0) {
      return NextResponse.json({
        has_drop: false,
        is_active: false,
        drop: null,
        stats: { total_started: 0, total_answered: 0, total_correct: 0, total_incorrect: 0 },
        participants: [],
      });
    }

    const drop = drops[0];

    // 2. Fetch participants for this drop
    const { data: participants, error: partErr } = await supabaseAdmin
      .from('trivia_participants')
      .select('*')
      .eq('drop_id', drop.id)
      .order('started_at', { ascending: false });

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    const totalStarted = participants?.length || 0;
    const answeredList = participants?.filter((p) => p.answered_at) || [];
    const totalAnswered = answeredList.length;
    const totalCorrect = answeredList.filter((p) => p.is_correct).length;
    const totalIncorrect = totalAnswered - totalCorrect;

    // Build map of user tags from winners if present
    const winners = drop.winners || [];
    const winnerTagMap: Record<string, string> = {};
    for (const w of winners) {
      if (w.user_id && w.tag) {
        winnerTagMap[w.user_id] = w.tag;
      }
    }

    const formattedParticipants = (participants || []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      tag: winnerTagMap[p.user_id] || null,
      started_at: p.started_at,
      answered_at: p.answered_at,
      speed_ms: p.speed_ms,
      is_correct: p.is_correct,
    }));

    return NextResponse.json({
      has_drop: true,
      is_active: drop.status === 'active',
      drop: {
        id: drop.id,
        guild_id: drop.guild_id,
        channel_id: drop.channel_id,
        message_id: drop.message_id,
        question: drop.question,
        correct_answer: drop.correct_answer,
        shuffled_answers: drop.shuffled_answers,
        winners: drop.winners || [],
        status: drop.status,
        close_time: drop.close_time,
        created_at: drop.created_at,
        completed_at: drop.completed_at,
      },
      stats: {
        total_started: totalStarted,
        total_answered: totalAnswered,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
      },
      participants: formattedParticipants,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
