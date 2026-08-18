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

// GET /api/companion/lore — list all server lore
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const { data, error } = await supabaseAdmin
      .from('npc_server_lore')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ lore: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/companion/lore — add or update server lore
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { id, title, content, category } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const payload: any = {
      guild_id: guildId,
      title: title.trim(),
      content: content.trim(),
      category: category || 'general',
    };

    if (id) {
      payload.id = id;
    }

    const { data, error } = await supabaseAdmin
      .from('npc_server_lore')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, item: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/companion/lore — remove a lore entry
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const guildId = getGuildId(req);

    if (!id) {
      return NextResponse.json({ error: 'Lore ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('npc_server_lore')
      .delete()
      .eq('id', id)
      .eq('guild_id', guildId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
