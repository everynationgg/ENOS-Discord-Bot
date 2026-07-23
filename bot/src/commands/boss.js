const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getOrCreateActiveBoss, getPlayerState, getUserProfile, setPlayerClass, allocateStatPoint, executeCombatAction, getWeekIdentifier } = require('../modules/gaming/boss');
const { renderBossImage } = require('../modules/gaming/bossCanvas');
const { supabase } = require('../lib/supabase');

/**
 * Builds the interactive Discord ActionRow buttons based on player state.
 */
async function buildBossActionRows(guildId, userId) {
  const playerState = await getPlayerState(guildId, userId);
  const classKey = playerState?.class_key;
  const isLocked = playerState?.is_locked;

  const rows = [];
  const primaryRow = new ActionRowBuilder();
  const secondaryRow = new ActionRowBuilder();

  if (!classKey) {
    // Unregistered Player View
    primaryRow.addComponents(
      new ButtonBuilder().setCustomId('boss_pick:mom').setLabel('Pick M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('boss_pick:dad').setLabel('Pick D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
      new ButtonBuilder().setCustomId('boss_pick:kid').setLabel('Pick K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
      new ButtonBuilder().setCustomId('boss_info').setLabel('Skills Info').setStyle(ButtonStyle.Secondary).setEmoji('📖')
    );
    rows.push(primaryRow);
  } else {
    // Registered Player View
    const moveNames = {
      mom: { basic: 'Slipper Throw (1 AP)', skill: 'Guilt Trip (3 AP)' },
      dad: { basic: 'Dad Slap (1 AP)', skill: 'Dad Joke (3 AP)' },
      kid: { basic: 'iPad Throw (1 AP)', skill: 'Grocery Meltdown (3 AP)' },
    };

    const moves = moveNames[classKey] || { basic: 'Basic Attack (1 AP)', skill: 'Class Skill (3 AP)' };

    primaryRow.addComponents(
      new ButtonBuilder().setCustomId('boss_act:basic').setLabel(moves.basic).setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
      new ButtonBuilder().setCustomId('boss_act:skill').setLabel(moves.skill).setStyle(ButtonStyle.Danger).setEmoji('🔥'),
      new ButtonBuilder().setCustomId('boss_profile').setLabel('My Stats').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
      new ButtonBuilder().setCustomId('boss_leaderboard').setLabel('Leaderboard').setStyle(ButtonStyle.Secondary).setEmoji('📊')
    );

    if (!isLocked) {
      primaryRow.addComponents(
        new ButtonBuilder().setCustomId('boss_swap_class').setLabel('Change Class').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
      );
    }

    rows.push(primaryRow);
  }

  return rows;
}

/**
 * Builds the Boss Embed and Canvas Image attachment.
 */
async function buildBossEmbedPayload(guildId, userId) {
  const boss = await getOrCreateActiveBoss(guildId);
  const playerState = await getPlayerState(guildId, userId);

  // Fetch Class Distribution
  const currentWeek = getWeekIdentifier();
  const { data: allPlayers } = await supabase
    .from('boss_player_states')
    .select('class_key')
    .eq('guild_id', guildId)
    .eq('week_identifier', currentWeek);

  const classCounts = { mom: 0, dad: 0, kid: 0 };
  (allPlayers || []).forEach(p => {
    if (p.class_key && classCounts[p.class_key] !== undefined) {
      classCounts[p.class_key]++;
    }
  });

  // Render Canvas Buffer
  const isFreshSpawn = !playerState?.class_key && (boss.last_action?.includes('Spawned') || boss.last_action?.includes('spawned'));
  const viewMode = isFreshSpawn ? 'spawn' : 'combat';

  const buffer = await renderBossImage({
    bossName: boss.boss_name,
    bossTitle: boss.boss_title,
    customImageUrl: boss.custom_image_url,
    currentHp: Number(boss.current_hp),
    maxHp: Number(boss.max_hp),
    isOverkill: boss.is_overkill,
    viewMode,
    momBuff: boss.mom_buff,
    dadDebuff: boss.dad_debuff,
    lastAction: boss.last_action,
    classCounts,
  });

  const attachment = new AttachmentBuilder(buffer, { name: 'weekly_boss_arena.png' });

  // Class Names & Descriptions
  const classNames = { mom: '🛡️ M.O.M. (Buff Support)', dad: '🔨 D.A.D. (Debuff Setup)', kid: '⚡ K.I.D. (Nuke Combo)' };
  const userClassStr = playerState?.class_key ? classNames[playerState.class_key] : '*No class selected (Click button below to join)*';

  const embed = new EmbedBuilder()
    .setColor(boss.is_overkill ? 0xEF4444 : 0x6366F1)
    .setTitle(`🎮 Weekly Boss Bounty — ${boss.boss_name}`)
    .setDescription(
      `**Lore**: ${boss.lore}\n\n` +
      `⚔️ **Last Action**: ${boss.last_action}\n` +
      `🛡️ **M.O.M. Buff**: ${boss.mom_buff ? '✅ **ACTIVE** (Ready for Nuke)' : '❌ Inactive'}\n` +
      `🔨 **D.A.D. Debuff**: ${boss.dad_debuff ? '✅ **ACTIVE** (Ready for Nuke)' : '❌ Inactive'}\n\n` +
      `👤 **Your Status**: ${userClassStr} | **AP Remaining**: \`${playerState?.ap_remaining ?? 5}/5 AP\` ${playerState?.is_locked ? '*(Locked for week)*' : '*(Can swap class)*'}`
    )
    .setImage('attachment://weekly_boss_arena.png')
    .setFooter({ text: `ENOS Weekly RPG System • Week ${currentWeek}` })
    .setTimestamp();

  const components = await buildBossActionRows(guildId, userId);

  return { embeds: [embed], files: [attachment], components };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boss')
    .setDescription('Weekly Boss Bounty RPG commands')
    .addSubcommand(sub =>
      sub.setName('status').setDescription('View the live Weekly Boss Arena & Combat Controls')
    )
    .addSubcommand(sub =>
      sub.setName('stats').setDescription('View your RPG user profile, level, and allocate stat points')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('View the top Weekly Boss damage dealers')
    )
    .addSubcommand(sub =>
      sub.setName('spawn').setDescription('Force spawn/refresh the weekly boss (Admin only)')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'status' || sub === 'spawn') {
      if (sub === 'spawn' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to force spawn a boss.', ephemeral: true });
      }

      await interaction.deferReply();
      const payload = await buildBossEmbedPayload(interaction.guild.id, interaction.user.id);
      return interaction.editReply(payload);
    }

    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });
      const profile = await getUserProfile(interaction.guild.id, interaction.user.id);
      const playerState = await getPlayerState(interaction.guild.id, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x38BDF8)
        .setTitle(`👤 ${interaction.user.username}'s RPG Profile`)
        .setDescription(
          `**Level**: \`${profile.level}\` | **XP**: \`${profile.xp}/${profile.level * 500}\`\n` +
          `**Unallocated Stat Points**: \`${profile.unallocated_stats}\`\n\n` +
          `**Attributes & Perks**:\n` +
          `• ⚔️ **Damage Bonus**: \`+${profile.stat_dmg * 2}%\` (${profile.stat_dmg} pts)\n` +
          `• ⚡ **AP Conservation**: \`+${profile.stat_ap_save * 5}%\` (${profile.stat_ap_save}/4 pts max - 0 AP chance)\n` +
          `• 📈 **XP Rate Boost**: \`+${profile.stat_xp_boost * 5}%\` (${profile.stat_xp_boost} pts)\n\n` +
          `**Active Week Status**: AP \`${playerState.ap_remaining}/5\` | Damage: \`${playerState.total_damage.toLocaleString()} DMG\``
        )
        .setFooter({ text: 'ENOS RPG Progression System' });

      const row = new ActionRowBuilder();
      if (profile.unallocated_stats > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('boss_stat_add:dmg').setLabel('+2% DMG').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('boss_stat_add:ap_save').setLabel('+5% AP Save').setStyle(ButtonStyle.Success).setEmoji('⚡'),
          new ButtonBuilder().setCustomId('boss_stat_add:xp_boost').setLabel('+5% XP Rate').setStyle(ButtonStyle.Secondary).setEmoji('📈')
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      return interaction.editReply({ embeds: [embed] });
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
        .setColor(0xFACC15)
        .setTitle(`🏆 Weekly Boss Leaderboard (${currentWeek})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ENOS RPG Ranking System' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },

  /**
   * Button Interaction Handler for Weekly Boss Buttons
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  async handleBossButton(interaction) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (customId === 'boss_info') {
      const embed = new EmbedBuilder()
        .setColor(0x38BDF8)
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
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId.startsWith('boss_pick:')) {
      const classKey = customId.split(':')[1];
      await interaction.deferUpdate();
      const res = await setPlayerClass(guildId, userId, classKey);
      if (!res.success) {
        const msg = await interaction.followUp({ content: res.message, ephemeral: true });
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
      }

      const payload = await buildBossEmbedPayload(guildId, userId);
      return interaction.editReply(payload);
    }

    if (customId === 'boss_swap_class') {
      // Re-open class selection
      await interaction.deferUpdate();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('boss_pick:mom').setLabel('Pick M.O.M.').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('boss_pick:dad').setLabel('Pick D.A.D.').setStyle(ButtonStyle.Success).setEmoji('🔨'),
        new ButtonBuilder().setCustomId('boss_pick:kid').setLabel('Pick K.I.D.').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
        new ButtonBuilder().setCustomId('boss_info').setLabel('Skills Info').setStyle(ButtonStyle.Secondary).setEmoji('📖')
      );
      const payload = await buildBossEmbedPayload(guildId, userId);
      payload.components = [row];
      return interaction.editReply(payload);
    }

    if (customId.startsWith('boss_act:')) {
      const actionType = customId.split(':')[1];
      await interaction.deferUpdate();

      const res = await executeCombatAction(guildId, userId, actionType);
      if (!res.success) {
        await interaction.followUp({ content: res.message, ephemeral: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        return;
      }

      const payload = await buildBossEmbedPayload(guildId, userId);
      await interaction.editReply(payload);
      return;
    }

    if (customId.startsWith('boss_stat_add:')) {
      const statType = customId.split(':')[1];
      await interaction.deferUpdate();
      const res = await allocateStatPoint(guildId, userId, statType);
      const msg = await interaction.followUp({ content: res.message, ephemeral: true });
      setTimeout(() => msg.delete().catch(() => {}), 5000);
      return;
    }

    if (customId === 'boss_profile') {
      const profile = await getUserProfile(guildId, userId);
      const playerState = await getPlayerState(guildId, userId);

      const embed = new EmbedBuilder()
        .setColor(0x38BDF8)
        .setTitle(`👤 ${interaction.user.username}'s RPG Profile`)
        .setDescription(
          `**Level**: \`${profile.level}\` | **XP**: \`${profile.xp}/${profile.level * 500}\`\n` +
          `**Unallocated Stat Points**: \`${profile.unallocated_stats}\`\n\n` +
          `**Attributes & Perks**:\n` +
          `• ⚔️ **Damage Bonus**: \`+${profile.stat_dmg * 2}%\` (${profile.stat_dmg} pts)\n` +
          `• ⚡ **AP Conservation**: \`+${profile.stat_ap_save * 5}%\` (${profile.stat_ap_save}/4 pts max - 0 AP chance)\n` +
          `• 📈 **XP Rate Boost**: \`+${profile.stat_xp_boost * 5}%\` (${profile.stat_xp_boost} pts)\n\n` +
          `**Active Week Status**: AP \`${playerState.ap_remaining}/5\` | Damage: \`${playerState.total_damage.toLocaleString()} DMG\``
        );

      const row = new ActionRowBuilder();
      if (profile.unallocated_stats > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('boss_stat_add:dmg').setLabel('+2% DMG').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('boss_stat_add:ap_save').setLabel('+5% AP Save').setStyle(ButtonStyle.Success).setEmoji('⚡'),
          new ButtonBuilder().setCustomId('boss_stat_add:xp_boost').setLabel('+5% XP Rate').setStyle(ButtonStyle.Secondary).setEmoji('📈')
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'boss_leaderboard') {
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
        .setColor(0xFACC15)
        .setTitle(`🏆 Weekly Boss Leaderboard (${currentWeek})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ENOS RPG Ranking System' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
