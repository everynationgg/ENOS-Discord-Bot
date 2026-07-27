import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, channel_id } = body;
    const guildId = getGuildId(req, body);

    if (action === 'dispatch_quest_hub') {
      const chId = channel_id || body?.quest_channel_id;
      if (!chId || typeof chId !== 'string' || !chId.trim()) {
        return NextResponse.json({ error: 'Daily Quest Hub Channel ID is required.' }, { status: 400 });
      }

      if (!DISCORD_TOKEN) {
        return NextResponse.json({ error: 'DISCORD_TOKEN is missing on server.' }, { status: 500 });
      }

      const targetChannelId = chId.trim();

      // Fetch existing config to check for old launcher message ID
      const { data: existing } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .in('feature_key', ['vault', 'vault_economy'])
        .maybeSingle();

      const config = existing?.config || {};
      if (config.quest_launcher_message_id) {
        await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages/${config.quest_launcher_message_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
        }).catch(() => {});
      }

      // Sweep recent messages in target channel for stray launcher embeds
      try {
        const sweepRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages?limit=25`, {
          headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
        }).catch(() => null);

        if (sweepRes && sweepRes.ok) {
          const msgs = await sweepRes.json();
          for (const msg of msgs || []) {
            if (msg.embeds && msg.embeds.length > 0) {
              const embed = msg.embeds[0];
              const isLauncher =
                embed.title === '📜 Every Nation Vault — Daily Quests Hub' ||
                embed.footer?.text?.includes('ENOS Quest Launcher');
              if (isLauncher) {
                await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages/${msg.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {}

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
              style: 3, // Green Success
              emoji: { name: '📜' },
            },
          ],
        },
      ];

      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed], components }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return NextResponse.json({ error: `Discord API Error (${res.status}): ${errJson?.message || res.statusText}` }, { status: res.status });
      }

      const sentMsg = await res.json();

      // Save channel_id and message_id in guild_config
      const updatedConfig = {
        ...config,
        quest_channel_id: targetChannelId,
        quest_launcher_channel_id: targetChannelId,
        quest_launcher_message_id: sentMsg.id,
      };

      for (const fKey of ['vault', 'vault_economy']) {
        await supabaseAdmin.from('guild_config').upsert({
          guild_id: guildId,
          feature_key: fKey,
          enabled: true,
          config: updatedConfig,
          updated_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true, message_id: sentMsg.id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
