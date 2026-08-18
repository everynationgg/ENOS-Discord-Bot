import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeatureConfig, upsertFeatureConfig, supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/companion/config — fetch NPC companion configuration
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const configData = await getFeatureConfig(guildId, 'npc_companion');

    const defaultConfig = {
      sarcasm_level: 3,
      social_energy: 2,
      response_brevity: 'balanced',
      allowed_channel_ids: [],
      ambient_cooldown_minutes: 20,
      quiet_hours_enabled: false,
      quiet_hours_start: '02:00',
      quiet_hours_end: '08:00',
      banned_topics: [],
    };

    return NextResponse.json({
      enabled: configData?.enabled ?? false,
      config: { ...defaultConfig, ...(configData?.config || {}) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/companion/config — update NPC companion configuration
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { enabled, config } = body;

    await upsertFeatureConfig(guildId, 'npc_companion', Boolean(enabled), config || {});

    return NextResponse.json({ success: true, enabled, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
