import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeatureConfig, upsertFeatureConfig } from '@/lib/supabase';
import { getDefaultNewsroomConfig } from '@/lib/newsroomRegistry';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/newsroom/config?category=games&guild_id=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const category = req.nextUrl.searchParams.get('category') || 'games';
    const featureKey = `newsroom_${category.toLowerCase()}`;

    const row = await getFeatureConfig(guildId, featureKey);
    const defaultConfig = getDefaultNewsroomConfig(category);

    if (!row) {
      return NextResponse.json({
        enabled: defaultConfig.enabled,
        config: defaultConfig,
      });
    }

    return NextResponse.json({
      enabled: row.enabled ?? false,
      config: { ...defaultConfig, ...(row.config || {}) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/newsroom/config
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const guildId = getGuildId(req, body);
    const category = (body.category || 'games').toLowerCase();
    const { enabled, config } = body;

    if (!category) {
      return NextResponse.json({ error: 'Missing category' }, { status: 400 });
    }

    const featureKey = `newsroom_${category}`;
    await upsertFeatureConfig(guildId, featureKey, Boolean(enabled), config || {});

    return NextResponse.json({ success: true, featureKey, enabled, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
