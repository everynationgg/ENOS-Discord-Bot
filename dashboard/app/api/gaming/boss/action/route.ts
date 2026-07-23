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

async function postBossCardToDiscord(guildId: string, boss: any) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[BOSS POST] DISCORD_TOKEN is missing!');
    return;
  }

  // Fetch all channel IDs configured for weekly_boss
  const { data: featureRows } = await supabaseAdmin
    .from('guild_config')
    .select('config, guild_id')
    .eq('feature_key', 'weekly_boss');

  const channelIds: string[] = [];
  if (featureRows && featureRows.length > 0) {
    featureRows.forEach((r: any) => {
      if (r.config?.channel_id && typeof r.config.channel_id === 'string' && r.config.channel_id.trim()) {
        channelIds.push(r.config.channel_id.trim());
      }
    });
  }

  if (channelIds.length === 0) {
    console.error('[BOSS POST] No channel ID configured in Weekly Boss panel!');
    return;
  }

  const currentWeek = boss.week_identifier;

  const { data: allPlayers } = await supabaseAdmin
    .from('boss_player_states')
    .select('class_key')
    .eq('week_identifier', currentWeek);

  const classCounts = { mom: 0, dad: 0, kid: 0 };
  (allPlayers || []).forEach((p: any) => {
    if (p.class_key && classCounts[p.class_key as keyof typeof classCounts] !== undefined) {
      classCounts[p.class_key as keyof typeof classCounts]++;
    }
  });

  let imageBuffer: Buffer | null = null;
  try {
    imageBuffer = await renderBossImage({
      bossName: boss.boss_name,
      bossTitle: boss.boss_title,
      customImageUrl: boss.custom_image_url,
      customBgUrl: boss.custom_bg_url,
      currentHp: Number(boss.current_hp),
      maxHp: Number(boss.max_hp),
      isOverkill: boss.is_overkill,
      viewMode: 'spawn',
      momBuff: boss.mom_buff,
      dadDebuff: boss.dad_debuff,
      classCounts,
      lastAction: boss.last_action,
    });
  } catch (e) {
    console.error('[BOSS POST] Error rendering boss canvas:', e);
  }

  const hpPct = Math.round((Number(boss.current_hp) / Number(boss.max_hp)) * 100);
  const filled = Math.round(hpPct / 10);
  const hpBar = '🟩'.repeat(filled) + '⬛'.repeat(10 - filled);

  const embed = {
    title: `${boss.is_overkill ? '💀 OVERKILL MODE' : '⚔️ Weekly Boss Bounty'} — ${boss.boss_name}`,
    description:
      `**Lore**: ${boss.lore}\n\n` +
      `**Last Action**: ${boss.last_action || 'None'}\n` +
      `**M.O.M. Buff**: ${boss.mom_buff ? '✅ Active' : '❌ Inactive'}\n` +
      `**D.A.D. Debuff**: ${boss.dad_debuff ? '✅ Active' : '❌ Inactive'}\n\n` +
      `HP: **${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()}** (${hpPct}%)\n` +
      `${hpBar}\n` +
      `*Click a button below to pick your class and join the battle!*`,
    color: boss.is_overkill ? 0xdc2626 : 0x6d28d9,
    footer: {
      text: `ENOS Weekly RPG System • Week ${boss.week_identifier} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    },
    image: imageBuffer ? { url: 'attachment://weekly_boss_arena.png' } : undefined,
  };

  const components = [
    {
      type: 1,
      components: [
        { type: 2, custom_id: 'boss_pick:mom', label: 'Pick M.O.M.', style: 1, emoji: { name: '🛡️' } },
        { type: 2, custom_id: 'boss_pick:dad', label: 'Pick D.A.D.', style: 3, emoji: { name: '🔨' } },
        { type: 2, custom_id: 'boss_pick:kid', label: 'Pick K.I.D.', style: 4, emoji: { name: '⚡' } },
        { type: 2, custom_id: 'boss_info', label: 'Skills Info', style: 2, emoji: { name: '📖' } },
      ],
    },
  ];

  for (const chId of channelIds) {
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

      await fetch(`https://discord.com/api/v10/channels/${chId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${token}` },
        body: formData,
      }).catch((e) => console.error(`[BOSS POST] Error posting boss card to Discord channel ${chId}:`, e));
    } else {
      await fetch(`https://discord.com/api/v10/channels/${chId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed], components }),
      }).catch((e) => console.error(`[BOSS POST] Error posting boss card to Discord channel ${chId}:`, e));
    }
  }
}

async function resolveDirectImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  if (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) return url;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
    });
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<img\s+src=["'](https:\/\/i\.ibb\.co\/[^"']+)["']/i);
      if (ogMatch && ogMatch[1]) {
        return ogMatch[1];
      }
    }
  } catch (e) {
    // ignore
  }

  return url;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { action, customName, gameName, customHp, customImageUrl: rawImageUrl, customBgUrl: rawBgUrl } = body;
    const currentWeek = getWeekIdentifier();
    const resolvedImageUrl = await resolveDirectImageUrl(rawImageUrl);
    const resolvedBgUrl = await resolveDirectImageUrl(rawBgUrl);

    if (action === 'spawn') {
      const charName = customName && customName.trim() ? customName.trim() : 'Corrupted Anomaly';
      const gameLabel = gameName && gameName.trim() ? gameName.trim() : 'Gaming Realm';

      const bossName = charName.startsWith('ERROR-MOD:') ? charName : `ERROR-MOD: Corrupted ${charName}`;
      const bossTitle = `System Threat (${gameLabel})`;
      const lore = `A space-time realm rift merged ${gameLabel} data with ENOS core protocols. ${charName} has manifested in the server! Coordinate your triad skills to neutralize!`;
      const hp = customHp ? parseInt(customHp, 10) : 150000;

      // Check for existing active boss row for current week
      const { data: existingBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      let activeBoss: any = null;
      if (existingBoss) {
        // Update existing row
        const { data: updated, error: updErr } = await supabaseAdmin
          .from('boss_seasons')
          .update({
            boss_name: bossName,
            boss_title: bossTitle,
            lore,
            max_hp: hp,
            current_hp: hp,
            is_defeated: false,
            mom_buff: false,
            dad_debuff: false,
            custom_image_url: resolvedImageUrl || null,
            custom_bg_url: resolvedBgUrl || null,
            last_action: '⚡ Admin force spawned a new Weekly Boss!',
          })
          .eq('id', existingBoss.id)
          .select()
          .single();

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        activeBoss = updated;
      } else {
        // Insert new row
        const { data: inserted, error: insErr } = await supabaseAdmin
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
            custom_image_url: resolvedImageUrl || null,
            custom_bg_url: resolvedBgUrl || null,
            last_action: '⚡ Admin force spawned a new Weekly Boss!',
          })
          .select()
          .single();

        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        activeBoss = inserted;
      }

      const targetGuildId = activeBoss.guild_id || guildId;
      await postBossCardToDiscord(targetGuildId, activeBoss);

      return NextResponse.json({ success: true, action: 'spawn', boss: activeBoss });
    }

    if (action === 'update_image') {
      const { data: existingBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      if (!existingBoss) {
        return NextResponse.json({ error: 'No active boss season found to update' }, { status: 400 });
      }

      const { data: updatedBoss, error } = await supabaseAdmin
        .from('boss_seasons')
        .update({
          custom_image_url: customImageUrl || null,
          last_action: '🎨 Boss Artwork updated from Admin Dashboard!',
        })
        .eq('id', existingBoss.id)
        .select()
        .single();

      if (error || !updatedBoss) {
        return NextResponse.json({ error: error?.message || 'Failed to update boss image' }, { status: 500 });
      }

      const targetGuildId = updatedBoss.guild_id || guildId;
      await postBossCardToDiscord(targetGuildId, updatedBoss);

      return NextResponse.json({ success: true, action: 'update_image', boss: updatedBoss });
    }

    if (action === 'end') {
      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('week_identifier', currentWeek);

      await supabaseAdmin
        .from('boss_player_states')
        .update({ ap_remaining: 5, is_locked: false })
        .eq('week_identifier', currentWeek);

      return NextResponse.json({ success: true, action: 'end' });
    }

    if (action === 'overkill') {
      const { data: currentBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      if (!currentBoss) {
        return NextResponse.json({ error: 'No active normal boss found to transition to Overkill.' }, { status: 400 });
      }

      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('id', currentBoss.id);

      const overkillHp = Math.round(Number(currentBoss.max_hp) * 1.5);
      const { data: overkillBoss, error: okErr } = await supabaseAdmin
        .from('boss_seasons')
        .insert({
          guild_id: currentBoss.guild_id || guildId,
          week_identifier: currentWeek,
          boss_name: `[OVERKILL] ${currentBoss.boss_name}`,
          boss_title: `${currentBoss.boss_title} (Unbound)`,
          lore: `EMERGENCY OVERDRIVE: ${currentBoss.boss_name} evolved into an unstoppable system threat! All players receive bonus points for extra damage!`,
          max_hp: overkillHp,
          current_hp: overkillHp,
          is_overkill: true,
          is_defeated: false,
          mom_buff: false,
          dad_debuff: false,
          custom_image_url: currentBoss.custom_image_url,
          last_action: '⚡ OVERKILL MODE ACTIVATED! Emergency Backup System online.',
        })
        .select()
        .single();

      if (okErr) {
        return NextResponse.json({ error: okErr.message }, { status: 500 });
      }

      const targetGuildId = overkillBoss.guild_id || guildId;
      await postBossCardToDiscord(targetGuildId, overkillBoss);

      return NextResponse.json({ success: true, action: 'overkill', boss: overkillBoss });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
