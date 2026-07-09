import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getKeyformConfigs, upsertKeyformConfig } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID ||
    'default_guild_id'
  );
}

// GET /api/moderation/keyform/config — fetch all keyform configurations
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const configs = await getKeyformConfigs(guildId);
    return NextResponse.json(configs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/moderation/keyform/config — upsert a keyform configuration
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { game_key, game_name, server_url, server_password, target_channel_id, log_channel_id, rules } = body;

    if (!game_key || !game_name || !server_url || !server_password || !target_channel_id || !log_channel_id || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    await upsertKeyformConfig(
      guildId,
      game_key.toLowerCase().trim(),
      game_name.trim(),
      server_url.trim(),
      server_password.trim(),
      target_channel_id.trim(),
      log_channel_id.trim(),
      rules
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
