import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/moderation/showcase/history — Fetch past showcase updates and statistics
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

    const { data: updates, error } = await supabaseAdmin
      .from('showcase_updates')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      if (error.code === '42P01') return NextResponse.json([]);
      throw new Error(error.message);
    }

    return NextResponse.json(updates || []);
  } catch (err: any) {
    console.error('[SHOWCASE HISTORY GET ERROR]:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
