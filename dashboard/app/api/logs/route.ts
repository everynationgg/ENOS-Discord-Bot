import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBotLogs } from '@/lib/supabase';

const GUILD_ID = process.env.DISCORD_GUILD_ID!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const eventType = searchParams.get('type') || undefined;

  try {
    const logs = await getBotLogs(GUILD_ID, limit, eventType);
    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
