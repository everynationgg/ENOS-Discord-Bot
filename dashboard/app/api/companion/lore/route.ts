import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface LorePostBody {
  guild_id?: string;
  id?: string;
  title?: string;
  content?: string;
  category?: string;
  topic?: string;
  fact_text?: string;
}

function getGuildId(req: NextRequest, body?: LorePostBody): string {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    req.cookies.get('enos_guild_id')?.value ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

interface NpcServerLoreRow {
  id: string;
  guild_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
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

    const lore = ((data || []) as NpcServerLoreRow[]).map((row) => ({
      ...row,
      topic: row.title,
      fact_text: row.content,
    }));

    return NextResponse.json({ lore });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/companion/lore — add or update server lore
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as LorePostBody;
    const guildId = getGuildId(req, body);
    const category = body.category || 'general';
    const title = (body.title || body.topic || category).trim();
    const content = (body.content || body.fact_text || '').trim();

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    interface LoreRecord {
      id?: string;
      guild_id: string;
      category: string;
      title: string;
      content: string;
    }

    const payload: LoreRecord = {
      guild_id: guildId,
      category,
      title,
      content,
    };

    if (body.id) {
      payload.id = body.id;
    }

    const { data, error } = await supabaseAdmin
      .from('npc_server_lore')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const item = data
      ? {
          ...data,
          topic: (data as NpcServerLoreRow).title,
          fact_text: (data as NpcServerLoreRow).content,
        }
      : null;

    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
