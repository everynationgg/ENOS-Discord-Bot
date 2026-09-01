import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeatureResourceMetrics } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;
  const timeframe = (req.nextUrl.searchParams.get('timeframe') || 'daily') as 'daily' | 'weekly';

  try {
    const data = await getFeatureResourceMetrics(guildId, timeframe);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
