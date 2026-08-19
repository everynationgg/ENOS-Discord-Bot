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

// GET /api/companion/members — list member relationships and learned facts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const search = req.nextUrl.searchParams.get('q')?.toLowerCase() || '';

    // Fetch relationships
    let query = supabaseAdmin
      .from('npc_relationships')
      .select('*')
      .eq('guild_id', guildId)
      .order('last_spoke_at', { ascending: false })
      .limit(100);

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    const { data: relationships, error: relError } = await query;
    if (relError) throw new Error(relError.message);

    // Fetch all memories for these users
    const userIds = (relationships || []).map((r) => r.user_id);
    const memoriesByUser: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const { data: memories } = await supabaseAdmin
        .from('npc_member_memories')
        .select('user_id, fact')
        .eq('guild_id', guildId)
        .in('user_id', userIds);

      if (memories) {
        for (const m of memories) {
          if (!memoriesByUser[m.user_id]) memoriesByUser[m.user_id] = [];
          memoriesByUser[m.user_id].push(m.fact);
        }
      }
    }

    const combined = (relationships || []).map((r) => ({
      ...r,
      facts: memoriesByUser[r.user_id] || [],
    }));

    return NextResponse.json({ members: combined });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/companion/members — purge a member's relationship and memory
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const guildId = getGuildId(req);

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await supabaseAdmin
      .from('npc_relationships')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    await supabaseAdmin
      .from('npc_member_memories')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    return NextResponse.json({ success: true, message: `Member ${userId} forgotten successfully` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
