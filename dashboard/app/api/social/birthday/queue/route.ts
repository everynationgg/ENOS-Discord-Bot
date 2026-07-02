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

// GET /api/social/birthday/queue — Fetch unsent birthday queue items
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const { data, error } = await supabaseAdmin
      .from('birthday_queue')
      .select('*')
      .eq('guild_id', guildId)
      .eq('is_sent', false)
      .order('target_date', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/social/birthday/queue — Update scratchpad notes and approval status
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, scratchpad_text, is_approved } = body;
    const guildId = getGuildId(req, body);

    if (!id) {
      return NextResponse.json({ error: 'Missing queue item ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('birthday_queue')
      .update({
        scratchpad_text: scratchpad_text || '',
        is_approved: typeof is_approved === 'boolean' ? is_approved : false,
      })
      .eq('id', id)
      .eq('guild_id', guildId); // Enforce guild isolation

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
