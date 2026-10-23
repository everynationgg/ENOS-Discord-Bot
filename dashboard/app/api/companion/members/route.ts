import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface MemberQueryBody {
  guild_id?: string;
}

function getGuildId(req: NextRequest, body?: MemberQueryBody): string {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    req.cookies.get('enos_guild_id')?.value ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

interface NpcRelationshipRow {
  id: string;
  guild_id: string;
  user_id: string;
  display_name: string | null;
  familiarity_tier: number;
  interaction_count: number;
  first_seen_at: string;
  last_spoke_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface NpcMemoryRow {
  user_id: string;
  fact: string;
}

// GET /api/companion/members — list member relationships and learned facts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const search = req.nextUrl.searchParams.get('q')?.toLowerCase() || '';

    // Fetch relationships ordered by interaction_count
    let query = supabaseAdmin
      .from('npc_relationships')
      .select('*')
      .eq('guild_id', guildId)
      .order('interaction_count', { ascending: false })
      .limit(100);

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    const { data: relationships, error: relError } = await query;
    if (relError) throw new Error(relError.message);

    const relRows = (relationships || []) as NpcRelationshipRow[];
    const userIds = relRows.map((r) => r.user_id);
    const memoriesByUser: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const { data: memories, error: memError } = await supabaseAdmin
        .from('npc_member_memories')
        .select('user_id, fact')
        .eq('guild_id', guildId)
        .in('user_id', userIds);

      if (memError) throw new Error(memError.message);

      if (memories) {
        for (const m of (memories as NpcMemoryRow[])) {
          if (!memoriesByUser[m.user_id]) memoriesByUser[m.user_id] = [];
          memoriesByUser[m.user_id].push(m.fact);
        }
      }
    }

    const combined = relRows.map((r) => {
      const userFacts = memoriesByUser[r.user_id] || [];
      return {
        ...r,
        discord_id: r.user_id,
        user_id: r.user_id,
        interactions_count: r.interaction_count,
        interaction_count: r.interaction_count,
        facts: userFacts,
        memory_text: userFacts.join(' • '),
      };
    });

    return NextResponse.json({ members: combined });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/companion/members — purge a member's relationship and memory
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('discord_id') || searchParams.get('user_id');
    const guildId = getGuildId(req);

    if (!discordId) {
      return NextResponse.json({ error: 'User ID (discord_id) is required' }, { status: 400 });
    }

    const { error: memError } = await supabaseAdmin
      .from('npc_member_memories')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', discordId);

    if (memError) throw new Error(memError.message);

    const { error: relError } = await supabaseAdmin
      .from('npc_relationships')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', discordId);

    if (relError) throw new Error(relError.message);

    return NextResponse.json({ success: true, message: `Member ${discordId} forgotten successfully` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
