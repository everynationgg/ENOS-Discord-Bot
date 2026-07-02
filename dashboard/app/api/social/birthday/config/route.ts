import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// GET /api/social/birthday/config — Fetch server-specific birthday configuration
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from('guild_settings')
      .select('*')
      .eq('guild_id', GUILD_ID)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // If no row exists yet, return default settings
    const config = data || {
      guild_id: GUILD_ID,
      birthday_enabled: false,
      birthday_channel_id: null,
      log_channel_id: null,
      announcement_time: '09:00',
      ai_prompt_formula: 'You are an enthusiastic gaming community bot. Write a short, fun, 2-sentence birthday wish. Keep it gaming-themed.',
    };

    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/social/birthday/config — Save/Upsert server-specific birthday configuration
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { birthday_enabled, birthday_channel_id, log_channel_id, announcement_time, ai_prompt_formula } = body;

    if (typeof birthday_enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid birthday_enabled state' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('guild_settings')
      .upsert({
        guild_id: GUILD_ID,
        birthday_enabled,
        birthday_channel_id: birthday_channel_id || null,
        log_channel_id: log_channel_id || null,
        announcement_time: announcement_time || '09:00',
        ai_prompt_formula: ai_prompt_formula || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
