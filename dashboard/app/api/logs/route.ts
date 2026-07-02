import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBotLogs } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const eventType = searchParams.get('type') || undefined;
  const guildId = searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

  try {
    const logs = await getBotLogs(guildId, limit, eventType);
    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
