import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/social/auto-reactions — Fetch all triggers for the guild
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const { data, error } = await supabaseAdmin
      .from('auto_reactions')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/social/auto-reactions — Add or delete a trigger
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, id, trigger_word, reaction_emoji } = body;
    const guildId = getGuildId(req, body);

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
      const { error } = await supabaseAdmin
        .from('auto_reactions')
        .delete()
        .eq('id', id)
        .eq('guild_id', guildId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === 'add') {
      if (!trigger_word || !reaction_emoji) {
        return NextResponse.json({ error: 'Missing trigger word or emoji' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('auto_reactions')
        .insert({
          guild_id: guildId,
          trigger_word: trigger_word.trim(),
          reaction_emoji: reaction_emoji.trim(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
