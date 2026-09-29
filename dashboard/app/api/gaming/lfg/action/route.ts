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
    const { action, lfg_channel_id } = body;
    const guildId = getGuildId(req, body);

    if (action === 'deploy_lfg_launcher') {
      const chId = lfg_channel_id || body?.channel_id;
      if (!chId || typeof chId !== 'string' || !chId.trim()) {
        return NextResponse.json({ error: 'LFG Channel ID is required.' }, { status: 400 });
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
        .eq('feature_key', 'lfg')
        .maybeSingle();

      const config = existing?.config || {};
      if (config.lfg_launcher_message_id) {
        await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages/${config.lfg_launcher_message_id}`, {
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
                embed.title === '🎮 Every Nation — Look For Group (LFG) Hub' ||
                embed.footer?.text?.includes('ENOS LFG Hub');
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
        title: '🎮 Every Nation — Look For Group (LFG) Hub',
        description:
          `Looking for a squad? Click **🎮 Look For Group** below to find teammates for your gaming session!\n\n` +
          `**How to Host a Party:**\n` +
          `1️⃣ Join any voice room or hop into \`🎤┊Create VC\` to create your personal room\n` +
          `2️⃣ Click **🎮 Look For Group** below\n` +
          `3️⃣ Fill in the game, party size, and optional role/friend mentions\n` +
          `4️⃣ ENOS broadcasts your party card right here with a direct voice join button!\n\n` +
          `*Party cards automatically delete when the session expires or ends.*`,
        color: 0x8B5CF6,
        footer: { text: 'Every Nation Gaming • ENOS LFG Hub' },
        timestamp: new Date().toISOString(),
      };

      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              custom_id: 'lfg_launcher_create',
              label: '🎮 Look For Group',
              style: 1, // Blurple Primary
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
        lfg_channel_id: targetChannelId,
        lfg_launcher_message_id: sentMsg.id,
      };

      await supabaseAdmin.from('guild_config').upsert({
        guild_id: guildId,
        feature_key: 'lfg',
        enabled: true,
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message_id: sentMsg.id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
