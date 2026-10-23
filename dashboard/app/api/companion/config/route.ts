import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeatureConfig, upsertFeatureConfig, supabaseAdmin } from '@/lib/supabase';

interface CompanionConfigBody {
  guild_id?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

function getGuildId(req: NextRequest, body?: CompanionConfigBody): string {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    req.cookies.get('enos_guild_id')?.value ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

function formatHour(val: unknown, fallback: string): string {
  if (typeof val === 'number') {
    return `${String(val).padStart(2, '0')}:00`;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const s = val.trim();
    if (s.includes(':')) {
      const parts = s.split(':');
      const h = parts[0] || '0';
      const m = parts[1] || '0';
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return `${s.padStart(2, '0')}:00`;
  }
  return fallback;
}

// GET /api/companion/config — fetch NPC companion configuration
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const configData =
      (await getFeatureConfig(guildId, 'npc_companion')) ||
      (await getFeatureConfig(guildId, 'npc'));

    const raw = (configData?.config as Record<string, unknown>) || {};
    const channels = (raw.allowed_channel_ids || raw.allowed_channels || []) as string[];

    const normalizedConfig = {
      sarcasm_level: Number(raw.sarcasm_level ?? 3),
      social_energy: Number(raw.social_energy ?? 2),
      response_brevity: (raw.response_brevity as string) || 'balanced',
      allowed_channel_ids: channels,
      allowed_channels: channels,
      ambient_cooldown_minutes: Number(raw.ambient_cooldown_minutes ?? 20),
      quiet_hours_enabled: Boolean(raw.quiet_hours_enabled ?? false),
      quiet_hours_start: formatHour(raw.quiet_hours_start, '02:00'),
      quiet_hours_end: formatHour(raw.quiet_hours_end, '08:00'),
      banned_topics: Array.isArray(raw.banned_topics) ? raw.banned_topics : [],
    };

    return NextResponse.json({
      enabled: configData?.enabled ?? false,
      config: normalizedConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/companion/config — update NPC companion configuration
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as CompanionConfigBody;
    const guildId = getGuildId(req, body);
    const { enabled, config = {} } = body;

    const channels = (config.allowed_channel_ids || config.allowed_channels || []) as string[];
    const normalizedConfig: Record<string, unknown> = {
      ...config,
      allowed_channels: channels,
      allowed_channel_ids: channels,
      quiet_hours_enabled: config.quiet_hours_enabled !== undefined ? Boolean(config.quiet_hours_enabled) : true,
      quiet_hours_start: formatHour(config.quiet_hours_start, '02:00'),
      quiet_hours_end: formatHour(config.quiet_hours_end, '08:00'),
      sarcasm_level: Number(config.sarcasm_level ?? 3),
      social_energy: Number(config.social_energy ?? 2),
      response_brevity: (config.response_brevity as string) || 'balanced',
      ambient_cooldown_minutes: Number(config.ambient_cooldown_minutes ?? 20),
    };

    await upsertFeatureConfig(guildId, 'npc_companion', Boolean(enabled), normalizedConfig);

    return NextResponse.json({ success: true, enabled: Boolean(enabled), config: normalizedConfig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
