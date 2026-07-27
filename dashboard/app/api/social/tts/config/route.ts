import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

    const { data } = await supabaseAdmin
      .from('guild_config')
      .select('config')
      .eq('guild_id', guildId)
      .eq('feature_key', 'en_tts')
      .maybeSingle();

    const config = data?.config || {
      enabled: true,
      default_language: 'en',
      default_voice_model: 'female',
      default_persona: 'default',
      max_characters: 200,
      ignored_prefixes: '!, //, (',
    };

    return NextResponse.json({
      success: true,
      voice_bot_client_id: process.env.DISCORD_VOICE_BOT_CLIENT_ID || '1531251424456081569',
      config,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { guild_id, config } = body;
    const guildId = guild_id || process.env.DISCORD_GUILD_ID!;

    const { error } = await supabaseAdmin
      .from('guild_config')
      .upsert({
        guild_id: guildId,
        feature_key: 'en_tts',
        config,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id,feature_key' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
