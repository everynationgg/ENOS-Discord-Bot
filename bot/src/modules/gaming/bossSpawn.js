const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');
const { getOrCreateActiveBoss, getWeekIdentifier, generateGlitchBossLore, generateBossImage, forceCreateBoss } = require('./boss');
const { renderBossImage } = require('./bossCanvas');

/**
 * Builds the initial class-pick action rows for a freshly spawned boss.
 */
function buildSpawnActionRows() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('boss_pick:mom').setLabel('Pick M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('boss_pick:dad').setLabel('Pick D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
    new ButtonBuilder().setCustomId('boss_pick:kid').setLabel('Pick K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
    new ButtonBuilder().setCustomId('boss_info').setLabel('Skills Info').setStyle(ButtonStyle.Secondary).setEmoji('📖'),
  );
  return [row];
}

/**
 * Full spawn flow: generate lore + image, insert boss, post Discord card.
 * Runs entirely on Fly.io — no timeout issues.
 */
async function spawnBossForGuild(client, guildId, opts = {}) {
  const { customName = null, customHp = null } = opts;
  const currentWeek = getWeekIdentifier();

  try {
    // 1. Resolve boss name + lore
    let bossName, bossTitle, lore;
    if (customName) {
      bossName = customName.trim();
      bossTitle = 'Glitched System Threat';
      lore = 'System anomaly detected in the gaming realm. Coordinate your triad skills to neutralize!';
    } else {
      const aiData = await generateGlitchBossLore();
      bossName = aiData.bossName;
      bossTitle = aiData.bossTitle;
      lore = aiData.lore;
    }

    logger.info(`[BOSS SPAWN] Lore generated: ${bossName}`);

    // 2. Generate AI boss artwork image (runs on Fly.io — no timeout)
    const customImageUrl = await generateBossImage(bossName);
    logger.info(`[BOSS SPAWN] Image URL: ${customImageUrl || 'null (fallback to canvas)'}`);

    // 3. HP scaling
    const hp = customHp || 150000;

    // 4. Delete existing non-overkill boss for this week
    await supabase
      .from('boss_seasons')
      .delete()
      .eq('guild_id', guildId)
      .eq('week_identifier', currentWeek)
      .eq('is_overkill', false);

    // 5. Insert new boss season
    const { data: boss, error } = await supabase
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
        custom_image_url: customImageUrl,
        last_action: 'Admin force spawned a new Weekly Boss!',
      })
      .select()
      .single();

    if (error) {
      logger.error('[BOSS SPAWN] DB insert error:', error.message);
      return { success: false, error: error.message };
    }

    logger.info(`[BOSS SPAWN] Boss season created: ${boss.id}`);

    // 6. Post Discord card
    await postBossCard(client, guildId, boss);

    return { success: true, boss };
  } catch (e) {
    logger.error('[BOSS SPAWN] Fatal error:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Renders the boss card canvas and posts it to the configured Discord channel.
 */
async function postBossCard(client, guildId, boss) {
  const { data: featureRow } = await supabase
    .from('guild_config')
    .select('config')
    .eq('guild_id', guildId)
    .eq('feature_key', 'weekly_boss')
    .maybeSingle();

  const channelId = featureRow?.config?.channel_id;
  if (!channelId) {
    logger.warn('[BOSS SPAWN] No weekly_boss channel configured for guild:', guildId);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn('[BOSS SPAWN] Could not fetch channel:', channelId);
    return;
  }

  // Render canvas image
  let attachment = null;
  try {
    const buffer = await renderBossImage({
      bossName: boss.boss_name,
      bossTitle: boss.boss_title,
      customImageUrl: boss.custom_image_url,
      currentHp: Number(boss.current_hp),
      maxHp: Number(boss.max_hp),
      isOverkill: boss.is_overkill,
      viewMode: 'spawn',
      lastAction: boss.last_action,
    });
    attachment = new AttachmentBuilder(buffer, { name: 'weekly_boss_arena.png' });
  } catch (e) {
    logger.error('[BOSS SPAWN] Canvas render failed:', e.message);
  }

  const hpPct = Math.round((Number(boss.current_hp) / Number(boss.max_hp)) * 100);
  const hpBar = buildHpBar(hpPct);

  const embed = new EmbedBuilder()
    .setTitle(`${boss.is_overkill ? '💀 OVERKILL MODE' : '⚔️ Weekly Boss Bounty'} — ${boss.boss_name}`)
    .setDescription(
      `**Lore**: ${boss.lore}\n\n` +
      `**Last Action**: ${boss.last_action || 'None'}\n` +
      `**M.O.M. Buff**: ${boss.mom_buff ? '✅ Active' : '❌ Inactive'}\n` +
      `**D.A.D. Debuff**: ${boss.dad_debuff ? '✅ Active' : '❌ Inactive'}\n\n` +
      `HP: **${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()}** (${hpPct}%)\n` +
      `${hpBar}\n` +
      `*Click a button below to pick your class and join the battle!*`
    )
    .setColor(boss.is_overkill ? 0xdc2626 : 0x6d28d9)
    .setFooter({ text: `ENOS Weekly RPG System • Week ${boss.week_identifier} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` });

  if (attachment) {
    embed.setImage('attachment://weekly_boss_arena.png');
  }

  const rows = buildSpawnActionRows();

  const payload = { embeds: [embed], components: rows };
  if (attachment) payload.files = [attachment];

  await channel.send(payload);
  logger.info(`[BOSS SPAWN] Boss card posted to channel ${channelId}`);
}

function buildHpBar(pct) {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '🟩'.repeat(filled) + '⬛'.repeat(empty);
}

module.exports = { spawnBossForGuild, postBossCard };
