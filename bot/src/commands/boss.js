const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const {
  getOrCreateActiveBoss,
  getPlayerState,
  getUserProfile,
  setPlayerClass,
  allocateStatPoint,
  executeCombatAction,
  getWeekIdentifier,
} = require('../modules/gaming/boss');
const { renderBossImage } = require('../modules/gaming/bossCanvas');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

/**
 * Resolves an ibb.co share page link to a direct i.ibb.co image URL.
 * Direct links (i.ibb.co) are returned as-is.
 */
async function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('http')) return null;
  if (url.includes('i.ibb.co/') || /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) return url;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<img\s+src=["'](https:\/\/i\.ibb\.co\/[^"']+)["']/i) ||
                html.match(/(https:\/\/i\.ibb\.co\/[a-zA-Z0-9_\-\.\/]+)/i);
      if (m && m[1]) return m[1];
    }
  } catch (e) {}
  return url;
}

/**
 * Determines whether the Weekly Boss battle is officially concluded.
 * Victory Mode is ONLY displayed on/after Saturday 23:59 GMT+8 or if explicitly concluded.
 * Until then, Overkill Mode remains active allowing players to spend their AP.
 */
function isWeeklyBossConcluded(boss) {
  if (!boss) return false;
  if (boss.is_concluded) return true;

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt8 = new Date(utc + (3600000 * 8));
  const day = gmt8.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hour = gmt8.getHours();
  const min = gmt8.getMinutes();

  if (day === 0) return true;
  if (day === 6 && (hour > 23 || (hour === 23 && min >= 59))) return true;

  return false;
}

/**
 * Builds the Public Channel Server Overview Card.
 */
async function buildPublicBossEmbedPayload(guildId) {
  const boss = await getOrCreateActiveBoss(guildId);
  if (!boss) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('⚔️ Weekly Boss Bounty — Offline')
      .setDescription('*No active boss season found.*');
    return { embeds: [embed], components: [] };
  }
  const currentWeek = getWeekIdentifier();

  // Fetch Class Distribution
  const { data: allPlayers } = await supabase
    .from('boss_player_states')
    .select('class_key')
    .eq('guild_id', guildId)
    .eq('week_identifier', currentWeek);

  const classCounts = { mom: 0, dad: 0, kid: 0 };
  (allPlayers || []).forEach((p) => {
    if (p.class_key && classCounts[p.class_key] !== undefined) {
      classCounts[p.class_key]++;
    }
  });

  const totalParticipants = classCounts.mom + classCounts.dad + classCounts.kid;

  const { data: featureRow } = await supabase
    .from('guild_config')
    .select('config')
    .eq('guild_id', guildId)
    .eq('feature_key', 'weekly_boss')
    .maybeSingle();

  const [momUrl, dadUrl, kidUrl, victoryUrl, bgUrl, mainImgUrl] = await Promise.all([
    resolveImageUrl(featureRow?.config?.mom_image_url || null),
    resolveImageUrl(featureRow?.config?.dad_image_url || null),
    resolveImageUrl(featureRow?.config?.kid_image_url || null),
    resolveImageUrl(featureRow?.config?.victory_image_url || null),
    resolveImageUrl(boss.custom_bg_url || featureRow?.config?.custom_bg_url || null),
    resolveImageUrl(boss.custom_image_url || featureRow?.config?.custom_image_url || null),
  ]);
  const classImageUrls = { mom: momUrl, dad: dadUrl, kid: kidUrl };

  const isVictorious = isWeeklyBossConcluded(boss);

  const buffer = await renderBossImage({
    bossName: boss.boss_name,
    bossTitle: boss.boss_title,
    customImageUrl: mainImgUrl,
    customBgUrl: bgUrl,
    victoryImageUrl: victoryUrl,
    classImageUrls,
    currentHp: Number(boss.current_hp),
    maxHp: Number(boss.max_hp),
    isOverkill: boss.is_overkill,
    viewMode: isVictorious ? 'victory' : 'spawn',
    momBuff: boss.mom_buff,
    dadDebuff: boss.dad_debuff,
    lastAction: boss.last_action,
    classCounts,
  });

  const filename = `boss_public_${Date.now()}.png`;
  const attachment = new AttachmentBuilder(buffer, { name: filename });

  const hpPct = Math.max(0, Math.round((Number(boss.current_hp) / Number(boss.max_hp)) * 100));
  const filledBlocks = Math.round(hpPct / 10);
  const hpBar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(10 - filledBlocks);

  const displayTitle = boss.boss_title ? ` [${boss.boss_title}]` : '';
  const embed = new EmbedBuilder()
    .setColor(isVictorious ? 0xfacc15 : (boss.is_overkill ? 0xef4444 : 0x6366f1))
    .setTitle(isVictorious ? `🏆 VICTORY! WEEKLY BOSS CLEARED — ${boss.boss_name}${displayTitle}` : `${boss.is_overkill ? '🔥 OVERKILL MODE' : '⚔️ Weekly Boss Bounty'} — ${boss.boss_name}${displayTitle}`)
    .setDescription(
      isVictorious
        ? `🎉 **CONGRATULATIONS! Server Threat Neutralized!**\n\n` +
          `All active combatants earned **1.5x Overkill Bonus Points & Vault Coins**!\n\n` +
          `❤️ **Final HP Status**: ${hpBar} **0%** (\`0 / ${Number(boss.max_hp).toLocaleString()} HP\`)\n` +
          `⚡ **Final Killing Blow**: ${boss.last_action || 'Boss Slay'}\n` +
          `👥 **Total Combatants**: 🛡️ \`${classCounts.mom}\` M.O.M. | 🔨 \`${classCounts.dad}\` D.A.D. | ⚡ \`${classCounts.kid}\` K.I.D. (*${totalParticipants} Total Combatants*)\n\n` +
          `⏱️ *The next Weekly Boss bounty will spawn on Monday at 00:00 GMT+8.*`
        : `**Lore**: ${boss.lore}\n\n` +
          `❤️ **HP Status**: ${hpBar} **${hpPct}%** (\`${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()} HP\`)\n` +
          `⚡ **Last Action**: ${boss.last_action || 'None'}\n` +
          `🛡️ **M.O.M. Buff**: ${boss.mom_buff ? '✅ **ACTIVE** (Ready for Nuke)' : '❌ Inactive'}\n` +
          `🔨 **D.A.D. Debuff**: ${boss.dad_debuff ? '✅ **ACTIVE** (Ready for Nuke)' : '❌ Inactive'}\n\n` +
          `👥 **Class Distribution**: 🛡️ \`${classCounts.mom}\` M.O.M. | 🔨 \`${classCounts.dad}\` D.A.D. | ⚡ \`${classCounts.kid}\` K.I.D. (*${totalParticipants} Active Combatants*)\n\n` +
          `*Click a button below to join a class or engage the boss in your personal private combat panel!*`
    )
    .setImage(`attachment://${filename}`)
    .setFooter({ text: `ENOS Weekly RPG System • Week ${currentWeek}` })
    .setTimestamp();

  const publicRow = new ActionRowBuilder();
  if (isVictorious) {
    publicRow.addComponents(
      new ButtonBuilder().setCustomId('boss_leaderboard').setLabel('View Final Leaderboard').setStyle(ButtonStyle.Success).setEmoji('🏆')
    );
  } else {
    publicRow.addComponents(
      new ButtonBuilder().setCustomId('boss_join:mom').setLabel('Join M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('boss_join:dad').setLabel('Join D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
      new ButtonBuilder().setCustomId('boss_join:kid').setLabel('Join K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
      new ButtonBuilder().setCustomId('boss_leaderboard').setLabel('Leaderboard').setStyle(ButtonStyle.Secondary).setEmoji('📊')
    );
  }

  return { embeds: [embed], files: [attachment], components: [publicRow] };

  return { embeds: [embed], files: [attachment], components: [publicRow] };
}

/**
 * Builds a Player's Personal Ephemeral Combat View Payload.
 */
async function buildPersonalCombatPayload(guildId, userId, combatResult = null) {
  const boss = await getOrCreateActiveBoss(guildId);
  let playerState = await getPlayerState(guildId, userId);
  const currentWeek = getWeekIdentifier();

  if (!boss) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Boss Arena Offline')
      .setDescription('No active Weekly Boss was found for this server. An admin can spawn one using `/boss spawn` or via the web dashboard.');
    return { embeds: [embed], components: [] };
  }

  if (!playerState) {
    playerState = { ap_remaining: 5, is_locked: false, class_key: 'mom', total_damage: 0, weekly_points: 0 };
  }

  const { data: featureRow } = await supabase
    .from('guild_config')
    .select('config')
    .eq('guild_id', guildId)
    .eq('feature_key', 'weekly_boss')
    .maybeSingle();

  const [momUrl2, dadUrl2, kidUrl2, bgUrl2, mainImgUrl2] = await Promise.all([
    resolveImageUrl(featureRow?.config?.mom_image_url || null),
    resolveImageUrl(featureRow?.config?.dad_image_url || null),
    resolveImageUrl(featureRow?.config?.kid_image_url || null),
    resolveImageUrl(boss.custom_bg_url || featureRow?.config?.custom_bg_url || null),
    resolveImageUrl(boss.custom_image_url || featureRow?.config?.custom_image_url || null),
  ]);
  const classImageUrls = { mom: momUrl2, dad: dadUrl2, kid: kidUrl2 };

  const activeClass = playerState?.class_key || 'mom';

  const buffer = await renderBossImage({
    bossName: boss.boss_name,
    bossTitle: boss.boss_title,
    customImageUrl: mainImgUrl2,
    customBgUrl: bgUrl2,
    userClassKey: activeClass,
    classImageUrls,
    currentHp: Number(boss.current_hp),
    maxHp: Number(boss.max_hp),
    isOverkill: boss.is_overkill,
    viewMode: 'combat',
    momBuff: boss.mom_buff,
    dadDebuff: boss.dad_debuff,
    lastAction: boss.last_action,
  });

  const filename = `boss_combat_${userId}_${Date.now()}.png`;
  const attachment = new AttachmentBuilder(buffer, { name: filename });

  const moveNames = {
    mom: { basic: 'Slipper Throw (1 AP)', skill: 'Guilt Trip (3 AP)' },
    dad: { basic: 'Dad Slap (1 AP)', skill: 'Dad Joke (3 AP)' },
    kid: { basic: 'iPad Throw (1 AP)', skill: 'Grocery Meltdown (3 AP)' },
  };

  const moves = moveNames[activeClass] || { basic: 'Basic Attack (1 AP)', skill: 'Class Skill (3 AP)' };

  const classTitles = { mom: '🛡️ M.O.M. (Buff Support)', dad: '🔨 D.A.D. (Debuff Setup)', kid: '⚡ K.I.D. (Nuke Combo)' };

  const hpPct = Math.max(0, Math.round((Number(boss.current_hp) / Number(boss.max_hp)) * 100));
  const filledBlocks = Math.round(hpPct / 10);
  const hpBar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(10 - filledBlocks);

  let levelUpBanner = '';
  if (combatResult?.leveledUp) {
    levelUpBanner = `🎉 **LEVEL UP! You reached Level ${combatResult.newLevel}!** (+1 Stat Point earned! Click **My Stats** to allocate it)\n\n`;
  }

  const apUsed = Math.max(0, 5 - (playerState.ap_remaining || 0));
  const maxSlayPoints = boss.is_overkill ? 15 : 10;
  const projectedPoints = Math.round((apUsed / 5) * maxSlayPoints);

  const embed = new EmbedBuilder()
    .setColor(combatResult?.leveledUp ? 0xfacc15 : (boss.is_overkill ? 0xef4444 : 0x38bdf8))
    .setTitle(`🗡️ Personal Arena — ${classTitles[activeClass]}`)
    .setDescription(
      levelUpBanner +
      `🎯 **Target**: **${boss.boss_name}**\n` +
      `❤️ **HP Status**: ${hpBar} **${hpPct}%** (\`${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()} HP\`)\n` +
      `🛡️ **M.O.M. Buff**: ${boss.mom_buff ? '✅ **ACTIVE** (Ready for Nuke)' : '❌ Inactive'} | 🔨 **D.A.D. Debuff**: ${boss.dad_debuff ? '✅ **ACTIVE**' : '❌ Inactive'}\n` +
      `⚔️ **Last Action**: ${boss.last_action || 'None'}\n\n` +
      `⚡ **Your AP Remaining**: \`${playerState.ap_remaining}/5 AP\` ${playerState.is_locked ? '*(Class locked for week)*' : '*(Can swap class)*'}\n` +
      `📊 **Projected Slay Reward**: \`${projectedPoints} / ${maxSlayPoints} Points (₱${projectedPoints})\` *(Spend 5 AP for full reward!)*\n\n` +
      `⏱️ *Note: This combat view will stay active for 60 seconds after your last action.*`
    )
    .setImage(`attachment://${filename}`)
    .setFooter({ text: `ENOS Personal Combat Panel • ${currentWeek}` });

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('boss_act:basic').setLabel(moves.basic).setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('boss_act:skill').setLabel(moves.skill).setStyle(ButtonStyle.Danger).setEmoji('🔥'),
    new ButtonBuilder().setCustomId('boss_profile').setLabel('My Stats').setStyle(ButtonStyle.Secondary).setEmoji('👤')
  );

  if (!playerState.is_locked) {
    actionRow.addComponents(
      new ButtonBuilder().setCustomId('boss_swap_class').setLabel('Change Class').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );
  }

  actionRow.addComponents(
    new ButtonBuilder().setCustomId('boss_close_ephemeral').setLabel('Close').setStyle(ButtonStyle.Secondary).setEmoji('❌')
  );

  return { embeds: [embed], files: [attachment], components: [actionRow] };
}

/**
 * Tracks and clears active ephemeral timers per user to restart countdowns on interactive clicks.
 */
const activeEphemeralTimers = new Map();

function scheduleEphemeralExpiry(interaction, ms = 60000) {
  const key = `${interaction.guildId || interaction.guild?.id || 'dm'}:${interaction.user.id}`;
  if (activeEphemeralTimers.has(key)) {
    clearTimeout(activeEphemeralTimers.get(key));
    activeEphemeralTimers.delete(key);
  }

  const timerId = setTimeout(() => {
    activeEphemeralTimers.delete(key);
    interaction.deleteReply().catch(() => {});
  }, ms);

  activeEphemeralTimers.set(key, timerId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boss')
    .setDescription('Weekly Boss Bounty RPG commands')
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('View the live Weekly Boss Server Overview')
    )
    .addSubcommand((sub) =>
      sub.setName('stats').setDescription('View your RPG user profile, level, and allocate stat points')
    )
    .addSubcommand((sub) =>
      sub.setName('leaderboard').setDescription('View the top Weekly Boss damage dealers')
    )
    .addSubcommand((sub) =>
      sub.setName('spawn').setDescription('Force spawn/refresh the weekly boss (Admin only)')
    ),

  /**
   * Slash Command Handler
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'status' || sub === 'spawn') {
      if (sub === 'spawn' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to force spawn a boss.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();
      const payload = await buildPublicBossEmbedPayload(interaction.guild.id);
      const replyMsg = await interaction.editReply(payload);

      // Save public card message location for real-time live updates
      try {
        const { data: featureRow } = await supabase
          .from('guild_config')
          .select('config')
          .eq('guild_id', interaction.guild.id)
          .eq('feature_key', 'weekly_boss')
          .maybeSingle();

        const updatedConfig = {
          ...(featureRow?.config || {}),
          last_channel_id: interaction.channelId,
          last_message_id: replyMsg.id,
        };

        await supabase
          .from('guild_config')
          .upsert({
            guild_id: interaction.guild.id,
            feature_key: 'weekly_boss',
            config: updatedConfig,
            updated_at: new Date().toISOString(),
          });
      } catch (e) {}

      return;
    }

    if (sub === 'stats') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const profile = await getUserProfile(interaction.guild.id, interaction.user.id);
      const playerState = await getPlayerState(interaction.guild.id, interaction.user.id);
      const xpNeeded = Math.round(150 + 25 * profile.level + 7 * Math.pow(profile.level, 1.35));

      const embed = new EmbedBuilder()
        .setColor(0x38bdf8)
        .setTitle(`👤 ${interaction.user.username}'s RPG Profile`)
        .setDescription(
          `**Level**: \`${profile.level}/100\` | **XP**: \`${profile.xp}/${xpNeeded}\`\n` +
          `**Unallocated Stat Points**: \`${profile.unallocated_stats}\`\n\n` +
          `**Attributes & Perks**:\n` +
          `• ⚔️ **Damage Bonus**: \`+${profile.stat_dmg || 0}%\` (${profile.stat_dmg || 0}/35 pts)\n` +
          `• 💥 **Critical Strike**: \`+${profile.stat_crit || 0}%\` (${profile.stat_crit || 0}/35 pts max - 2x DMG chance)\n` +
          `• ⚡ **AP Conservation**: \`+${profile.stat_ap_save || 0}%\` (${profile.stat_ap_save || 0}/15 pts max - 0 AP chance)\n` +
          `• 📈 **XP Rate Boost**: \`+${profile.stat_xp_boost || 0}%\` (${profile.stat_xp_boost || 0}/10 pts)\n` +
          `• 💰 **Loot Multiplier**: \`+${profile.stat_loot_boost || 0}%\` (${profile.stat_loot_boost || 0}/10 pts)\n\n` +
          `**Active Week Status**: AP \`${playerState.ap_remaining}/5\` | Damage: \`${playerState.total_damage.toLocaleString()} DMG\``
        )
        .setFooter({ text: 'ENOS RPG Progression System' });

      const row = new ActionRowBuilder();
      if (profile.unallocated_stats > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('boss_stat_add:dmg').setLabel('+1% DMG').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('boss_stat_add:crit').setLabel('+1% Crit').setStyle(ButtonStyle.Danger).setEmoji('💥'),
          new ButtonBuilder().setCustomId('boss_stat_add:ap_save').setLabel('+1% AP Save').setStyle(ButtonStyle.Success).setEmoji('⚡'),
          new ButtonBuilder().setCustomId('boss_stat_add:xp_boost').setLabel('+1% XP').setStyle(ButtonStyle.Secondary).setEmoji('📈'),
          new ButtonBuilder().setCustomId('boss_stat_add:loot_boost').setLabel('+1% Loot').setStyle(ButtonStyle.Secondary).setEmoji('💰')
        );
        const reply = await interaction.editReply({ embeds: [embed], components: [row] });
        scheduleEphemeralExpiry(interaction, 60000);
        return reply;
      }

      const reply = await interaction.editReply({ embeds: [embed], components: [] });
      scheduleEphemeralExpiry(interaction, 10000);
      return reply;
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const currentWeek = getWeekIdentifier();

      const { data: topPlayers } = await supabase
        .from('boss_player_states')
        .select('user_id, total_damage, weekly_points, class_key')
        .eq('guild_id', interaction.guild.id)
        .eq('week_identifier', currentWeek)
        .order('weekly_points', { ascending: false })
        .limit(10);

      const lines = (topPlayers || []).map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const clsIcon = entry.class_key === 'mom' ? '🛡️' : entry.class_key === 'dad' ? '🔨' : entry.class_key === 'kid' ? '⚡' : '👤';
        return `${medal} ${clsIcon} <@${entry.user_id}> — **${entry.weekly_points.toLocaleString()} pts** (${entry.total_damage.toLocaleString()} DMG)`;
      });

      if (lines.length === 0) {
        lines.push('*No damage recorded yet this week. Be the first to attack!*');
      }

      const embed = new EmbedBuilder()
        .setColor(0xfacc15)
        .setTitle(`🏆 Weekly Boss Leaderboard (${currentWeek})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ENOS RPG Ranking System' });

      return interaction.editReply({ embeds: [embed] });
    }
  },

  /**
   * Button Interaction Handler for Weekly Boss Buttons
   */
  async handleBossButton(interaction) {
    let customId = interaction.customId;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    logger.info(`[BOSS BUTTON] Received: customId="${customId}" user=${userId} guild=${guildId}`);

    // ─── Backward compat: remap old boss_pick: → boss_join: ─────────────────
    if (customId.startsWith('boss_pick:')) {
      customId = customId.replace('boss_pick:', 'boss_join:');
      logger.info(`[BOSS BUTTON] Remapped old boss_pick to: ${customId}`);
    }

    if (customId === 'boss_close_ephemeral') {
      await interaction.deferUpdate().catch(() => {});
      return interaction.deleteReply().catch(() => {});
    }

    if (customId === 'boss_info') {
      const embed = new EmbedBuilder()
        .setColor(0x38bdf8)
        .setTitle('📖 Weekly Boss Skill & Synergy Guide')
        .setDescription(
          `**Combat Triad Classes & Moves**:\n` +
          `• 🛡️ **M.O.M.**: Basic \`Slipper Throw\` (1 AP) | Skill \`Guilt Trip\` (3 AP) ➔ Applies **M.O.M. Buff**\n` +
          `• 🔨 **D.A.D.**: Basic \`Dad Slap\` (1 AP) | Skill \`Dad Joke\` (3 AP) ➔ Applies **D.A.D. Debuff**\n` +
          `• ⚡ **K.I.D.**: Basic \`iPad Throw\` (1 AP) | Skill \`Grocery Meltdown\` (3 AP) ➔ Consumes Setups\n\n` +
          `**Damage Scaling Math**:\n` +
          `• ⚔️ **Basic Attack (1 AP)**: 4,000 DMG flat\n` +
          `• 🔥 **Solo Skill (3 AP)**: 15,000 DMG + applies state\n` +
          `• 💥 **2-Class Combo (3 AP + 1 State)**: 30,000 DMG\n` +
          `• ⚡ **Full Triad Meltdown (3 AP + Both States)**: 60,000 DMG!\n\n` +
          `*Note: Defeating the main boss unlocks Overkill Mode with 1.5x bonus points & XP!*`
        );
      const replyMsg = await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, fetchReply: true });
      setTimeout(() => replyMsg.delete().catch(() => {}), 10000);
      return;
    }

    // ─── 1. JOIN CLASS / ENGAGE BOSS (Launches Personal Ephemeral Combat View) ───
    if (customId.startsWith('boss_join:') || customId === 'boss_engage') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (customId.startsWith('boss_join:')) {
        const targetClass = customId.split(':')[1];
        const res = await setPlayerClass(guildId, userId, targetClass);
        if (!res.success) {
          await interaction.editReply({ content: res.message });
          scheduleEphemeralExpiry(interaction);
          return;
        }
      }

      const playerState = await getPlayerState(guildId, userId);
      if (!playerState?.class_key && customId === 'boss_engage') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('boss_join:mom').setLabel('Join M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
          new ButtonBuilder().setCustomId('boss_join:dad').setLabel('Join D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
          new ButtonBuilder().setCustomId('boss_join:kid').setLabel('Join K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡')
        );
        await interaction.editReply({
          content: '❌ **Please select a combat class first to enter the battle arena:**',
          components: [row],
        });
        scheduleEphemeralExpiry(interaction);
        return;
      }

      const payload = await buildPersonalCombatPayload(guildId, userId);
      await interaction.editReply(payload);
      scheduleEphemeralExpiry(interaction);
      return;
    }

    // ─── 2. SWAP CLASS (Inside Ephemeral View) ──────────────────────────────
    if (customId === 'boss_swap_class') {
      await interaction.deferUpdate();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('boss_join:mom').setLabel('Pick M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('boss_join:dad').setLabel('Pick D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
        new ButtonBuilder().setCustomId('boss_join:kid').setLabel('Pick K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡')
      );
      await interaction.editReply({ content: 'Select your new combat class:', components: [row] });
      return;
    }

    // ─── 3. COMBAT ATTACK ACTIONS (Inside Ephemeral View) ───────────────────
    if (customId.startsWith('boss_act:')) {
      const actionType = customId.split(':')[1];
      await interaction.deferUpdate();

      const res = await executeCombatAction(guildId, userId, actionType);
      if (!res.success) {
        const followMsg = await interaction.followUp({ content: res.message, flags: MessageFlags.Ephemeral, fetchReply: true });
        setTimeout(() => followMsg.delete().catch(() => {}), 5000);
        return;
      }

      // Re-render ephemeral combat view (with levelUp state merged inside embed)
      const payload = await buildPersonalCombatPayload(guildId, userId, res);
      await interaction.editReply(payload);

      // Update Public Channel Card asynchronously in real-time
      try {
        const { data: featureRow } = await supabase
          .from('guild_config')
          .select('config')
          .eq('guild_id', guildId)
          .eq('feature_key', 'weekly_boss')
          .maybeSingle();

        const channelId = featureRow?.config?.last_channel_id || featureRow?.config?.channel_id;
        const messageId = featureRow?.config?.last_message_id;

        if (channelId && interaction.client) {
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (channel) {
            let publicMsg = null;
            if (messageId) {
              publicMsg = await channel.messages.fetch(messageId).catch(() => null);
            }
            // Fallback: search recent 15 messages in the channel for the bot's boss card
            if (!publicMsg) {
              const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
              if (recent) {
                publicMsg = recent.find(
                  (m) =>
                    m.author.id === interaction.client.user.id &&
                    m.embeds.some(
                      (e) =>
                        e.title?.includes('Weekly Boss') ||
                        e.title?.includes('OVERKILL') ||
                        e.title?.includes('VICTORY')
                    )
                );
              }
            }

            if (publicMsg) {
              const publicPayload = await buildPublicBossEmbedPayload(guildId);
              await publicMsg.edit(publicPayload).catch(() => {});

              // Save the found messageId so subsequent updates are instant
              if (!messageId && publicMsg.id) {
                await supabase.from('guild_config').upsert({
                  guild_id: guildId,
                  feature_key: 'weekly_boss',
                  config: { ...(featureRow?.config || {}), last_message_id: publicMsg.id, last_channel_id: channelId },
                  updated_at: new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (e) {
        logger.error('[BOSS UPDATE] Error updating public card:', e);
      }

      return;
    }

    // ─── 4. STAT ALLOCATION (Inside Ephemeral View / Profile) ────────────────
    if (customId.startsWith('boss_stat_add:')) {
      const statType = customId.split(':')[1];
      await interaction.deferUpdate();
      const res = await allocateStatPoint(guildId, userId, statType);

      // Re-fetch profile and player state to edit the profile embed directly in-place
      const profile = await getUserProfile(guildId, userId);
      const playerState = await getPlayerState(guildId, userId);
      const xpNeeded = Math.round(150 + 25 * profile.level + 7 * Math.pow(profile.level, 1.35));

      const embed = new EmbedBuilder()
        .setColor(0x38bdf8)
        .setTitle(`👤 ${interaction.user.username}'s RPG Profile`)
        .setDescription(
          `**Level**: \`${profile.level}/100\` | **XP**: \`${profile.xp}/${xpNeeded}\`\n` +
          `**Unallocated Stat Points**: \`${profile.unallocated_stats}\`\n\n` +
          `**Attributes & Perks**:\n` +
          `• ⚔️ **Damage Bonus**: \`+${profile.stat_dmg || 0}%\` (${profile.stat_dmg || 0}/35 pts)\n` +
          `• 💥 **Critical Strike**: \`+${profile.stat_crit || 0}%\` (${profile.stat_crit || 0}/35 pts max - 2x DMG chance)\n` +
          `• ⚡ **AP Conservation**: \`+${profile.stat_ap_save || 0}%\` (${profile.stat_ap_save || 0}/15 pts max - 0 AP chance)\n` +
          `• 📈 **XP Rate Boost**: \`+${profile.stat_xp_boost || 0}%\` (${profile.stat_xp_boost || 0}/10 pts)\n` +
          `• 💰 **Loot Multiplier**: \`+${profile.stat_loot_boost || 0}%\` (${profile.stat_loot_boost || 0}/10 pts)\n\n` +
          `**Active Week Status**: AP \`${playerState.ap_remaining}/5\` | Damage: \`${playerState.total_damage.toLocaleString()} DMG\``
        );

      const row = new ActionRowBuilder();
      if (profile.unallocated_stats > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('boss_stat_add:dmg').setLabel('+1% DMG').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('boss_stat_add:crit').setLabel('+1% Crit').setStyle(ButtonStyle.Danger).setEmoji('💥'),
          new ButtonBuilder().setCustomId('boss_stat_add:ap_save').setLabel('+1% AP Save').setStyle(ButtonStyle.Success).setEmoji('⚡'),
          new ButtonBuilder().setCustomId('boss_stat_add:xp_boost').setLabel('+1% XP').setStyle(ButtonStyle.Secondary).setEmoji('📈'),
          new ButtonBuilder().setCustomId('boss_stat_add:loot_boost').setLabel('+1% Loot').setStyle(ButtonStyle.Secondary).setEmoji('💰')
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
        scheduleEphemeralExpiry(interaction, 60000);
      } else {
        await interaction.editReply({ embeds: [embed], components: [] });
        scheduleEphemeralExpiry(interaction, 10000);
      }
      return;
    }

    // ─── 5. MY STATS PROFILE ────────────────────────────────────────────────
    if (customId === 'boss_profile') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const profile = await getUserProfile(guildId, userId);
      const playerState = await getPlayerState(guildId, userId);
      const xpNeeded = Math.round(150 + 25 * profile.level + 7 * Math.pow(profile.level, 1.35));

      const embed = new EmbedBuilder()
        .setColor(0x38bdf8)
        .setTitle(`👤 ${interaction.user.username}'s RPG Profile`)
        .setDescription(
          `**Level**: \`${profile.level}/100\` | **XP**: \`${profile.xp}/${xpNeeded}\`\n` +
          `**Unallocated Stat Points**: \`${profile.unallocated_stats}\`\n\n` +
          `**Attributes & Perks**:\n` +
          `• ⚔️ **Damage Bonus**: \`+${profile.stat_dmg || 0}%\` (${profile.stat_dmg || 0}/35 pts)\n` +
          `• 💥 **Critical Strike**: \`+${profile.stat_crit || 0}%\` (${profile.stat_crit || 0}/35 pts max - 2x DMG chance)\n` +
          `• ⚡ **AP Conservation**: \`+${profile.stat_ap_save || 0}%\` (${profile.stat_ap_save || 0}/15 pts max - 0 AP chance)\n` +
          `• 📈 **XP Rate Boost**: \`+${profile.stat_xp_boost || 0}%\` (${profile.stat_xp_boost || 0}/10 pts)\n` +
          `• 💰 **Loot Multiplier**: \`+${profile.stat_loot_boost || 0}%\` (${profile.stat_loot_boost || 0}/10 pts)\n\n` +
          `**Active Week Status**: AP \`${playerState.ap_remaining}/5\` | Damage: \`${playerState.total_damage.toLocaleString()} DMG\``
        );

      const row = new ActionRowBuilder();
      const timeoutMs = profile.unallocated_stats > 0 ? 60000 : 10000;

      if (profile.unallocated_stats > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('boss_stat_add:dmg').setLabel('+1% DMG').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('boss_stat_add:crit').setLabel('+1% Crit').setStyle(ButtonStyle.Danger).setEmoji('💥'),
          new ButtonBuilder().setCustomId('boss_stat_add:ap_save').setLabel('+1% AP Save').setStyle(ButtonStyle.Success).setEmoji('⚡'),
          new ButtonBuilder().setCustomId('boss_stat_add:xp_boost').setLabel('+1% XP').setStyle(ButtonStyle.Secondary).setEmoji('📈'),
          new ButtonBuilder().setCustomId('boss_stat_add:loot_boost').setLabel('+1% Loot').setStyle(ButtonStyle.Secondary).setEmoji('💰')
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        await interaction.editReply({ embeds: [embed], components: [] });
      }
      scheduleEphemeralExpiry(interaction, timeoutMs);
      return;
    }

    // ─── 6. LEADERBOARD ─────────────────────────────────────────────────────
    if (customId === 'boss_leaderboard') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const currentWeek = getWeekIdentifier();
      const { data: topPlayers } = await supabase
        .from('boss_player_states')
        .select('user_id, total_damage, weekly_points, class_key')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .order('weekly_points', { ascending: false })
        .limit(10);

      const lines = (topPlayers || []).map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const clsIcon = entry.class_key === 'mom' ? '🛡️' : entry.class_key === 'dad' ? '🔨' : entry.class_key === 'kid' ? '⚡' : '👤';
        return `${medal} ${clsIcon} <@${entry.user_id}> — **${entry.weekly_points.toLocaleString()} pts** (${entry.total_damage.toLocaleString()} DMG)`;
      });

      if (lines.length === 0) {
        lines.push('*No damage recorded yet this week. Be the first to attack!*');
      }

      const embed = new EmbedBuilder()
        .setColor(0xfacc15)
        .setTitle(`🏆 Weekly Boss Leaderboard (${currentWeek})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ENOS RPG Ranking System' });

      await interaction.editReply({ embeds: [embed] });
      scheduleEphemeralExpiry(interaction, 10000);
      return;
    }
  },
  buildPublicBossEmbedPayload,
};
