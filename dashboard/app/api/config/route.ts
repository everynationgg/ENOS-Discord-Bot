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
      acc[row.feature_key] = { enabled: row.enabled, config: row.config, updated_at: row.updated_at };
      return acc;
    }, {});
    return NextResponse.json(configMap);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function postQuestLauncherCardToDiscord(guildId: string, channelId: string) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token || !channelId || typeof channelId !== 'string' || !channelId.trim()) return;

  const embed = {
    title: '📜 Every Nation Vault — Daily Quests Hub',
    description:
      `Welcome to the **Daily Quest Hub**!\n\n` +
      `Click **📜 Get Daily Quests** below to launch your personal daily quests for today. You will receive an ephemeral panel with live progress bars for:\n\n` +
      `💬 **Chat Quest** — Send active messages in community channels.\n` +
      `🎙️ **Voice Quest** — Hang out in voice channels with friends.\n` +
      `🧠 **Trivia Quest** — Participate in daily AI trivia drops.\n\n` +
      `🏆 Complete all 3 daily quests to earn bonus **Vault Coins (₱ PHP)**!`,
    color: 0xFACC15,
    footer: { text: 'Every Nation Vault • ENOS Quest Launcher' },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          custom_id: 'vault_get_daily_quests',
          label: '📜 Get Daily Quests',
          style: 3, // Green
          emoji: { name: '📜' },
        },
      ],
    },
  ];

  await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ embeds: [embed], components }),
  }).catch((e) => console.error('[VAULT LAUNCHER DISPATCH ERROR]:', e));
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

    // Automatically drop the Daily Quest Hub card to Discord when saving Vault Economy settings
    if (feature_key === 'vault_economy') {
      const targetChannelId = config?.quest_channel_id || config?.quest_launcher_channel_id;
      if (targetChannelId) {
        await postQuestLauncherCardToDiscord(guildId, targetChannelId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
