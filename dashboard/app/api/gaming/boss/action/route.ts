import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { renderBossImage } from '@/lib/bossCanvas';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

function getWeekIdentifier(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function generateGlitchBossLore() {
  const apiKey = process.env.GEMINI_API_KEY;
  const defaultBoss = {
    bossName: 'ERROR-MOD: Corrupted Ye Tianshi',
    bossTitle: 'Anomalous Realm Anomaly',
    lore: 'A catastrophic system leak merged Where Winds Meet realm data with ENOS core protocols. Overdrive emergency defense activated!',
  };

  if (!apiKey) return defaultBoss;

  const prompt = `Generate a glitch-corrupted weekly RPG boss title for a Discord bot gaming event.
Blend the prefix "ERROR-MOD: Corrupted " with a boss/character from popular games.

Respond ONLY with a raw JSON object:
{
  "bossName": "ERROR-MOD: Corrupted [Boss Name]",
  "bossTitle": "The [Glitched System Title]",
  "lore": "A 2-sentence lore description of how system error corrupted this boss into the server."
}
Do not wrap in markdown or write any extra text.`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.bossName && parsed.bossTitle && parsed.lore) {
        return parsed;
      }
    } catch (e) {
      // Try next fallback
    }
  }

  return defaultBoss;
}

async function postBossCardToDiscord(guildId: string, boss: any) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) return;

  // Fetch guild_config for weekly_boss
  const { data: featureRow } = await supabaseAdmin
    .from('guild_config')
    .select('config')
    .eq('guild_id', guildId)
    .eq('feature_key', 'weekly_boss')
    .maybeSingle();

  const channelId = featureRow?.config?.channel_id;
  if (!channelId) return;

  const currentWeek = boss.week_identifier;

  // Fetch Class Distribution
  const { data: allPlayers } = await supabaseAdmin
    .from('boss_player_states')
    .select('class_key')
    .eq('guild_id', guildId)
    .eq('week_identifier', currentWeek);

  const classCounts = { mom: 0, dad: 0, kid: 0 };
  (allPlayers || []).forEach((p: any) => {
    if (p.class_key && classCounts[p.class_key as keyof typeof classCounts] !== undefined) {
      classCounts[p.class_key as keyof typeof classCounts]++;
    }
  });

  // Render Canvas Buffer
  let imageBuffer: Buffer | null = null;
  try {
    imageBuffer = await renderBossImage({
      bossName: boss.boss_name,
      bossTitle: boss.boss_title,
      currentHp: Number(boss.current_hp),
      maxHp: Number(boss.max_hp),
      isOverkill: boss.is_overkill,
      momBuff: boss.mom_buff,
      dadDebuff: boss.dad_debuff,
      lastAction: boss.last_action,
      classCounts,
    });
  } catch (err) {
    console.error('[BOSS CANVAS] Failed to render image in dashboard route:', err);
  }

  const embed: any = {
    title: `🎮 Weekly Boss Bounty — ${boss.boss_name}`,
    description:
      `**Lore**: ${boss.lore}\n\n` +
      `⚔️ **Last Action**: ${boss.last_action}\n` +
      `🛡️ **M.O.M. Buff**: ${boss.mom_buff ? '✅ **ACTIVE**' : '❌ Inactive'}\n` +
      `🔨 **D.A.D. Debuff**: ${boss.dad_debuff ? '✅ **ACTIVE**' : '❌ Inactive'}\n\n` +
      `HP: **${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()}** (100%)\n` +
      `👤 *Click a button below to pick your class and join the battle!*`,
    color: boss.is_overkill ? 15671108 : 6514417,
    footer: { text: `ENOS Weekly RPG System • Week ${currentWeek}` },
    timestamp: new Date().toISOString(),
  };

  if (imageBuffer) {
    embed.image = { url: 'attachment://weekly_boss_arena.png' };
  }

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: 'Pick M.O.M.', custom_id: 'boss_pick:mom', emoji: { name: '🛡️' } },
        { type: 2, style: 3, label: 'Pick D.A.D.', custom_id: 'boss_pick:dad', emoji: { name: '🔨' } },
        { type: 2, style: 4, label: 'Pick K.I.D.', custom_id: 'boss_pick:kid', emoji: { name: '⚡' } },
        { type: 2, style: 2, label: 'Skills Info', custom_id: 'boss_info', emoji: { name: '📖' } },
      ],
    },
  ];

  if (imageBuffer) {
    const formData = new FormData();
    formData.append(
      'payload_json',
      JSON.stringify({
        embeds: [embed],
        components,
      })
    );
    formData.append('files[0]', new Blob([Uint8Array.from(imageBuffer)], { type: 'image/png' }), 'weekly_boss_arena.png');

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
      },
      body: formData,
    }).catch((e) => console.error('[BOSS POST] Error posting boss card with image to Discord:', e));
  } else {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
        components,
      }),
    }).catch((e) => console.error('[BOSS POST] Error posting boss card to Discord:', e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { action, customName, customHp } = body;
    const currentWeek = getWeekIdentifier();

    if (action === 'spawn') {
      let bossName = customName ? customName.trim() : null;
      let bossTitle = 'Glitched System Threat';
      let lore = 'System anomaly detected in the gaming realm. Coordinate your triad skills to neutralize!';
      let hp = customHp ? parseInt(customHp, 10) : 150000;

      if (!bossName) {
        const aiData = await generateGlitchBossLore();
        bossName = aiData.bossName;
        bossTitle = aiData.bossTitle;
        lore = aiData.lore;
      }

      // Delete existing non-overkill boss season for current week before inserting new spawn
      await supabaseAdmin
        .from('boss_seasons')
        .delete()
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false);

      // Insert new boss season
      const { data: newBoss, error } = await supabaseAdmin
        .from('boss_seasons')
        .insert({
          guild_id: guildId,
          week_identifier: currentWeek,
          boss_name: bossName,
          boss_title: bossTitle,
          lore,
          max_hp: hp,
          current_hp: hp,
          is_overkill: false,
          is_defeated: false,
          mom_buff: false,
          dad_debuff: false,
          last_action: '⚡ Admin force spawned a new Weekly Boss!',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Post boss card embed directly to configured Discord channel
      await postBossCardToDiscord(guildId, newBoss);

      return NextResponse.json({ success: true, action: 'spawn', boss: newBoss });
    }

    if (action === 'end') {
      // Mark active boss as defeated & current_hp = 0
      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek);

      // Reset all player AP for the week
      await supabaseAdmin
        .from('boss_player_states')
        .update({ ap_remaining: 5, is_locked: false })
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek);

      return NextResponse.json({ success: true, action: 'end' });
    }

    if (action === 'overkill') {
      // Find active boss
      const { data: activeBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .order('is_overkill', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeBoss) {
        return NextResponse.json({ error: 'No active boss season found to trigger overkill.' }, { status: 400 });
      }

      // Defeat current boss
      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('id', activeBoss.id);

      // Delete existing overkill boss season for current week before inserting new overkill spawn
      await supabaseAdmin
        .from('boss_seasons')
        .delete()
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', true);

      // Spawn Overkill Boss
      const overkillName = `ERROR-MOD: Backup System Activated! (${activeBoss.boss_name.replace(/^ERROR-MOD: Corrupted /, '')})`;
      const { data: overkillBoss, error: okErr } = await supabaseAdmin
        .from('boss_seasons')
        .insert({
          guild_id: guildId,
          week_identifier: currentWeek,
          boss_name: overkillName,
          boss_title: '🔥 OVERKILL RECOVERY PHASE (1.5x BONUS XP & POINTS)',
          lore: 'Emergency backup matrix online! Defeat the Overkill Boss to earn 1.5x bonus points and XP for your server!',
          max_hp: activeBoss.max_hp,
          current_hp: activeBoss.max_hp,
          is_overkill: true,
          is_defeated: false,
          mom_buff: false,
          dad_debuff: false,
          last_action: '⚡ OVERKILL MODE ACTIVATED! Emergency Backup System online.',
        })
        .select()
        .single();

      if (okErr) {
        return NextResponse.json({ error: okErr.message }, { status: 500 });
      }

      // Post overkill boss card embed to Discord
      await postBossCardToDiscord(guildId, overkillBoss);

      return NextResponse.json({ success: true, action: 'overkill', boss: overkillBoss });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
