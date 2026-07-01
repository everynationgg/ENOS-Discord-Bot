import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBotHealth } from '@/lib/supabase';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const health = await getBotHealth(process.env.DISCORD_GUILD_ID!);
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
