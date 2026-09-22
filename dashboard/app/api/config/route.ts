import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertFeatureConfig, getGuildConfigs, supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    req.cookies.get('enos_guild_id')?.value ||
    process.env.DISCORD_GUILD_ID!
  );
}

function getWeekIdentifier(date = new Date()) {
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  const targetDate = new Date(date.getTime() + tzOffsetMs);
  const d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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

    // Fetch existing feature config to safely merge and prevent destructive overwrites on toggle
    const { data: existingRow } = await supabaseAdmin
      .from('guild_config')
      .select('config')
      .eq('guild_id', guildId)
      .eq('feature_key', feature_key)
      .maybeSingle();

    const existingConfig = existingRow?.config || {};
    const incomingConfig = config || {};

    // Merge incoming with existing
    const mergedConfig: Record<string, any> = { ...existingConfig, ...incomingConfig };

    // Guard: If incoming config is missing or has empty allowed_channels, retain existing allowed_channels
    if (
      (!Array.isArray(incomingConfig.allowed_channels) || incomingConfig.allowed_channels.length === 0) &&
      Array.isArray(existingConfig.allowed_channels) &&
      existingConfig.allowed_channels.length > 0
    ) {
      mergedConfig.allowed_channels = existingConfig.allowed_channels;
    }

    // Retain notification_channel_id if incoming omitted it
    if (!incomingConfig.notification_channel_id && existingConfig.notification_channel_id) {
      mergedConfig.notification_channel_id = existingConfig.notification_channel_id;
    }

    await upsertFeatureConfig(guildId, feature_key, enabled, mergedConfig);

    // Automatically drop the Daily Quest Hub card to Discord when saving Vault Economy settings
    if (feature_key === 'vault_economy') {
      const targetChannelId = config?.quest_channel_id || config?.quest_launcher_channel_id;
      if (targetChannelId) {
        await postQuestLauncherCardToDiscord(guildId, targetChannelId);
      }
    }

    // Auto-sync configured streamers to live_alerts table for bot poller
    if (feature_key === 'live_alerts' && Array.isArray(config?.streamers)) {
      try {
        const channelId = config.alert_channel_id || '1148233610206400643';
        const pingRoleId = config.ping_role_id || null;
        for (const s of config.streamers) {
          const cleanHandle = (s.handle || '').replace(/^@/, '').trim();
          if (cleanHandle && s.platform) {
            await supabaseAdmin.from('live_alerts').upsert(
              {
                guild_id: guildId,
                platform: s.platform.toLowerCase(),
                handle: cleanHandle,
                display_name: (s.display_name || cleanHandle).trim(),
                alert_channel_id: channelId,
                ping_role_id: pingRoleId,
              },
              { onConflict: 'guild_id,platform,handle' }
            );
          }
        }
      } catch (e) {
        console.error('[CONFIG API] Failed to auto-sync live_alerts:', e);
      }
    }

    // Auto-sync active boss_seasons row when saving Weekly Boss configuration
    if (feature_key === 'weekly_boss') {
      try {
        const currentWeek = getWeekIdentifier();

        const rawName = config?.override_name || config?.boss_name;
        const gameLabel = config?.game_name || 'Gaming Realm';
        const charName = rawName || 'Anomaly';

        const bossName = rawName ? rawName : undefined;
        const bossTitle = config?.boss_title || (config?.game_name ? `System Threat (${gameLabel})` : undefined);
        const lore = config?.lore || (config?.override_name || config?.game_name ? `A space-time realm rift merged ${gameLabel} data with ENOS core protocols. ${charName} has manifested in the server! Coordinate your triad skills to neutralize!` : undefined);
        const maxHp = config?.override_hp || config?.max_hp || 150000;

        const updatePayload: any = {
          updated_at: new Date().toISOString(),
          last_action: '🎨 Live Boss configuration updated from Admin Dashboard!',
        };
        if (bossName) updatePayload.boss_name = bossName;
        if (bossTitle) updatePayload.boss_title = bossTitle;
        if (lore) updatePayload.lore = lore;
        if (maxHp) {
          updatePayload.max_hp = Number(maxHp);
          updatePayload.is_defeated = false;
        }
        if (config?.custom_image_url !== undefined) updatePayload.custom_image_url = config.custom_image_url || null;
        if (config?.custom_bg_url !== undefined) updatePayload.custom_bg_url = config.custom_bg_url || null;

        const { data: existing } = await supabaseAdmin
          .from('boss_seasons')
          .select('id, max_hp, current_hp')
          .eq('guild_id', guildId)
          .eq('week_identifier', currentWeek)
          .eq('is_overkill', false)
          .maybeSingle();

        if (existing) {
          if (maxHp) {
            const existingDamage = Math.max(0, Number(existing.max_hp || 0) - Number(existing.current_hp || 0));
            updatePayload.current_hp = Math.max(1, Number(maxHp) - existingDamage);
          }
          await supabaseAdmin
            .from('boss_seasons')
            .update(updatePayload)
            .eq('id', existing.id);
        } else {
          // If pre-staged boss config exists, deploy staged settings instead of old active settings
          const staged = config?.staged_boss_config;
          const sName = staged?.override_name || staged?.boss_name;
          const finalName = sName || bossName || charName;
          const finalTitle = staged?.boss_title || bossTitle || `System Threat (${staged?.game_name || gameLabel})`;
          const finalLore = staged?.lore || lore || `A space-time realm rift merged ${staged?.game_name || gameLabel} data with ENOS core protocols. ${finalName} has manifested in the server! Coordinate your triad skills to neutralize!`;
          const finalHp = Number(staged?.override_hp || staged?.max_hp || maxHp);
          const finalImg = staged?.custom_image_url || config?.custom_image_url || null;
          const finalBg = staged?.custom_bg_url || config?.custom_bg_url || null;

          await supabaseAdmin
            .from('boss_seasons')
            .insert({
              guild_id: guildId,
              week_identifier: currentWeek,
              boss_name: finalName,
              boss_title: finalTitle,
              lore: finalLore,
              max_hp: finalHp,
              current_hp: finalHp,
              is_defeated: false,
              is_overkill: false,
              mom_buff: false,
              dad_debuff: false,
              custom_image_url: finalImg,
              custom_bg_url: finalBg,
              last_action: '⚡ Admin deployed Weekly Boss from Dashboard!',
            });
        }
      } catch (e) {
        console.error('[CONFIG API] Failed to auto-sync boss_seasons:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
