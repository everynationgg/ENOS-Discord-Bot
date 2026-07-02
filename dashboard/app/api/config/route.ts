import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertFeatureConfig, getGuildConfigs } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/config — fetch all feature configs for the guild
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const configs = await getGuildConfigs(guildId);
    // Convert to a keyed map for easy frontend access
    const configMap = configs.reduce((acc: Record<string, any>, row: any) => {
      acc[row.feature_key] = { enabled: row.enabled, config: row.config };
      return acc;
    }, {});
    return NextResponse.json(configMap);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/config — upsert a feature config
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { feature_key, enabled, config } = body;
    const guildId = getGuildId(req, body);

    if (!feature_key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await upsertFeatureConfig(guildId, feature_key, enabled, config || {});
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
