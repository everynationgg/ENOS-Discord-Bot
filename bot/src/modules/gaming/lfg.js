const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { supabase, getFeatureConfig, isFeatureEnabled, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const GAME_BRANCHES = [
  'Where Winds Meet', 'Palworld', 'Wuwa', 'Hoyoverse', 'Enfi',
  'POE', 'BG3', 'D4', 'Minecraft', 'Phasmo', 'REPO', 'PEAK',
  'Subnautica 2', 'Devour', 'Demonologist', 'Valorant', 'CS2',
  'COD', 'HoK', 'ML', 'LOL', 'Others',
];

// ─── Build LFG Embed ──────────────────────────────────────────────────────────
function buildLFGEmbed(session, voiceChannelMention) {
  const memberCount = session.current_members?.length || 0;
  const maxSize = session.max_size;
  const filledBars = Math.round((memberCount / maxSize) * 10);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

  const statusColor = session.status === 'open' ? 0x8B5CF6 : session.status === 'full' ? 0xFACC15 : 0x6B7280;
  const statusText = session.status === 'open' ? '🟢 Open' : session.status === 'full' ? '🟡 Full' : '🔴 Closed';

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`🎮 LFG — ${session.game}`)
    .setDescription(session.description || '*No description provided.*')
    .addFields(
      { name: '👑 Host', value: `<@${session.host_id}>`, inline: true },
      { name: '📊 Status', value: statusText, inline: true },
      { name: '🔊 Voice Channel', value: voiceChannelMention || 'Not set', inline: true },
      {
        name: `👥 Party [${memberCount}/${maxSize}]`,
        value: `\`${progressBar}\`\n${
          session.current_members?.length
            ? session.current_members.map(id => `<@${id}>`).join(' ')
            : '*Empty*'
        }`,
      }
    )
    .setFooter({ text: `Session ID: ${session.id.substring(0, 8)} • Every Nation LFG` })
    .setTimestamp(new Date(session.created_at));

  return embed;
}

// ─── Build LFG Action Row ─────────────────────────────────────────────────────
function buildLFGButtons(sessionId, isClosed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lfg_join:${sessionId}`)
      .setLabel('Join Session')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮')
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`lfg_leave:${sessionId}`)
      .setLabel('Leave Session')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪')
      .setDisabled(isClosed)
  );
}

/**
 * /lfg create — sends a select menu of games to start the creation flow
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleLFGCreate(interaction) {
  const enabled = await isFeatureEnabled(interaction.guild.id, 'lfg');
  if (!enabled) {
    return interaction.reply({ content: '❌ LFG system is not enabled on this server.', ephemeral: true });
  }

  const role = interaction.options.getRole('role');
  const invite = interaction.options.getUser('invite');

  const roleId = role ? role.id : 'none';
  const inviteId = invite ? invite.id : 'none';

  // Build the game selection dropdown menu options
  const selectMenuOptions = GAME_BRANCHES.map(gameName => 
    new StringSelectMenuOptionBuilder()
      .setLabel(gameName)
      .setValue(gameName)
      .setDescription(`Host a party for ${gameName}`)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`lfg_game_select:${roleId}:${inviteId}`)
    .setPlaceholder('🎮 Choose a game from the dropdown...')
    .addOptions(selectMenuOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '🎮 **Select the game you want to host:**',
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handles the game select menu interaction to open the creation modal.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleLFGGameSelect(interaction) {
  const customIdParts = interaction.customId.split(':');
  const roleId = customIdParts[1];
  const inviteId = customIdParts[2];
  const game = interaction.values[0];

  // If a role was selected, check if it matches the selected game
  if (roleId && roleId !== 'none') {
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      const isMatched = role.name.toLowerCase().includes(game.toLowerCase()) || 
                        game.toLowerCase().includes(role.name.toLowerCase()) ||
                        role.name.toLowerCase() === 'everyone' || 
                        role.name.toLowerCase() === 'here';
      if (!isMatched) {
        return interaction.reply({
          content: `❌ You can only select a role that matches the game **${game}** (the role name must contain **${game}**). Please run \`/lfg create\` again and select a matching role.`,
          ephemeral: true
        });
      }
    }
  }

  // Open the modal for the remaining details
  const modal = new ModalBuilder()
    .setCustomId(`lfg_modal:${game}:${roleId}:${inviteId}`)
    .setTitle(`Create LFG — ${game}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_description')
        .setLabel('Description / Requirements')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('What are you doing? Casual? Ranked? Any requirements?')
        .setRequired(false)
        .setMaxLength(200)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_max_size')
        .setLabel('Max Party Size (2–10)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 4')
        .setRequired(true)
        .setValue('4')
        .setMaxLength(2)
    )
  );

  await interaction.showModal(modal);
}

/**
 * Modal submit handler for LFG session creation
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleLFGModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const customIdParts = interaction.customId.split(':');
  const game = customIdParts[1];
  const roleId = customIdParts[2];
  const inviteId = customIdParts[3];

  const description = interaction.fields.getTextInputValue('lfg_description').trim() || null;
  const rawSize = parseInt(interaction.fields.getTextInputValue('lfg_max_size').trim(), 10);
  const maxSize = Math.min(Math.max(rawSize || 4, 2), 10);

  const guildId = interaction.guild.id;

  // Fetch config for voice channel mapping and LFG channel
  const featureConfig = await getFeatureConfig(guildId, 'lfg');
  const config = featureConfig?.config || {};
  const lfgChannelId = config.lfg_channel_id;
  const voiceMappings = config.voice_mappings || {};
  const sessionTTLMinutes = config.session_ttl_minutes || 120;

  const voiceChannelId = voiceMappings[game] || voiceMappings['Others'] || null;
  const voiceChannelMention = voiceChannelId ? `<#${voiceChannelId}>` : 'Not configured';

  const expiresAt = new Date(Date.now() + sessionTTLMinutes * 60 * 1000).toISOString();

  // Create session in Supabase
  const { data: session, error } = await supabase
    .from('lfg_sessions')
    .insert({
      guild_id: guildId,
      host_id: interaction.user.id,
      game,
      description,
      voice_channel_id: voiceChannelId,
      max_size: maxSize,
      current_members: [interaction.user.id],
      status: 'open',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    logger.error('[LFG] Failed to create session:', error.message);
    return interaction.editReply('❌ Failed to create LFG session. Please try again.');
  }

  // Post embed
  const embed = buildLFGEmbed(session, voiceChannelMention);
  const buttons = buildLFGButtons(session.id);

  let targetChannel = interaction.channel;
  if (lfgChannelId) {
    const ch = await interaction.guild.channels.fetch(lfgChannelId).catch(() => null);
    if (ch) targetChannel = ch;
  }

  // Build mentions
  const contentParts = [];
  if (roleId && roleId !== 'none') contentParts.push(`<@&${roleId}>`);
  if (inviteId && inviteId !== 'none') contentParts.push(`<@${inviteId}>, you've been invited by <@${interaction.user.id}> to join this party!`);
  const mentionContent = contentParts.length > 0 ? contentParts.join(' ') : undefined;

  const sentMessage = await targetChannel.send({
    content: mentionContent,
    embeds: [embed],
    components: [buttons]
  });

  // Store message reference
  await supabase
    .from('lfg_sessions')
    .update({ message_id: sentMessage.id, channel_id: targetChannel.id })
    .eq('id', session.id);

  await logBotEvent(guildId, 'lfg_create', interaction.user.id, { game, sessionId: session.id });

  // Try to automatically move host to voice channel
  const voiceMoved = await tryMoveToVoiceChannel(interaction.member, voiceChannelId);

  let replyText = `✅ LFG session posted in <#${targetChannel.id}>!`;
  if (voiceChannelId) {
    if (voiceMoved) {
      replyText += `\n🔊 Automatically transferred you to <#${voiceChannelId}>.`;
    } else {
      replyText += `\n⚠️ Connect to a voice channel first to enable auto-transfer.`;
    }
  }

  await interaction.editReply(replyText);
}

/**
 * Button: Join LFG session
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleLFGJoin(interaction) {
  const sessionId = interaction.customId.split(':')[1];
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  await interaction.deferReply({ ephemeral: true });

  // Fetch session
  const { data: session, error } = await supabase
    .from('lfg_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || error) {
    return interaction.editReply('❌ Session not found.');
  }

  if (session.status !== 'open') {
    return interaction.editReply('❌ This session is no longer open.');
  }

  const members = session.current_members || [];

  if (members.includes(userId)) {
    return interaction.editReply('⚠️ You are already in this session.');
  }

  // Check cooldown
  const featureConfig = await getFeatureConfig(guildId, 'lfg');
  const cooldownMinutes = featureConfig?.config?.cooldown_minutes || 5;

  const { data: cooldown } = await supabase
    .from('lfg_cooldowns')
    .select('cooldown_until')
    .eq('discord_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (cooldown && new Date(cooldown.cooldown_until) > new Date()) {
    const remaining = Math.ceil((new Date(cooldown.cooldown_until) - new Date()) / 60000);
    return interaction.editReply(`⏳ Cooldown active. Try again in **${remaining} minute(s)**.`);
  }

  // Check max size
  if (members.length >= session.max_size) {
    return interaction.editReply('❌ This session is full.');
  }

  const newMembers = [...members, userId];
  const newStatus = newMembers.length >= session.max_size ? 'full' : 'open';

  // Update session
  await supabase
    .from('lfg_sessions')
    .update({ current_members: newMembers, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  // Set/reset cooldown
  await supabase.from('lfg_cooldowns').upsert(
    {
      guild_id: guildId,
      discord_id: userId,
      session_id: sessionId,
      cooldown_until: new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString(),
    },
    { onConflict: 'discord_id,session_id' }
  );

  // Update embed
  await refreshLFGEmbed(interaction.guild, { ...session, current_members: newMembers, status: newStatus });

  const voiceMoved = await tryMoveToVoiceChannel(interaction.member, session.voice_channel_id);

  let replyText = `✅ You've joined the **${session.game}** session!`;
  if (session.voice_channel_id) {
    if (voiceMoved) {
      replyText += `\n🔊 Automatically transferred you to <#${session.voice_channel_id}>.`;
    } else {
      replyText += `\n⚠️ Connect to a voice channel first to enable auto-transfer.`;
    }
  }

  await interaction.editReply(replyText);
}

/**
 * Button: Leave LFG session
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleLFGLeave(interaction) {
  const sessionId = interaction.customId.split(':')[1];
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const { data: session } = await supabase
    .from('lfg_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return interaction.editReply('❌ Session not found.');

  const members = (session.current_members || []).filter(id => id !== userId);

  await supabase
    .from('lfg_sessions')
    .update({ current_members: members, status: 'open', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  await refreshLFGEmbed(interaction.guild, { ...session, current_members: members, status: 'open' });
  await interaction.editReply(`✅ You've left the **${session.game}** session.`);
}

/**
 * Updates the LFG embed in Discord to reflect current session state.
 */
async function refreshLFGEmbed(guild, session) {
  if (!session.channel_id || !session.message_id) return;

  try {
    const channel = await guild.channels.fetch(session.channel_id);
    const message = await channel.messages.fetch(session.message_id);

    const featureConfig = await getFeatureConfig(guild.id, 'lfg');
    const voiceMappings = featureConfig?.config?.voice_mappings || {};
    const voiceChannelId = session.voice_channel_id;
    const voiceChannelMention = voiceChannelId ? `<#${voiceChannelId}>` : 'Not configured';

    const embed = buildLFGEmbed(session, voiceChannelMention);
    const buttons = buildLFGButtons(session.id, session.status === 'closed');

    await message.edit({ embeds: [embed], components: [buttons] });
  } catch (err) {
    logger.error('[LFG] Failed to refresh embed:', err.message);
  }
}

/**
 * Cron: Expire old LFG sessions
 * @param {import('discord.js').Client} client
 */
async function expireOldLFGSessions(client) {
  const { data: expiredSessions } = await supabase
    .from('lfg_sessions')
    .select('*')
    .eq('status', 'open')
    .lt('expires_at', new Date().toISOString());

  if (!expiredSessions?.length) return;

  for (const session of expiredSessions) {
    await supabase
      .from('lfg_sessions')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', session.id);

    const guild = client.guilds.cache.get(session.guild_id);
    if (guild) {
      await refreshLFGEmbed(guild, { ...session, status: 'closed' });
    }
  }

  logger.info(`[LFG] Expired ${expiredSessions.length} session(s).`);
}

/**
 * Helper to dynamically move a member to the configured LFG Voice Channel.
 * Requires the user to be connected to any voice channel in the guild first.
 * @param {import('discord.js').GuildMember} member
 * @param {string|null} voiceChannelId
 */
async function tryMoveToVoiceChannel(member, voiceChannelId) {
  if (!voiceChannelId || !member) return false;
  
  const currentVoiceState = member.voice;
  if (!currentVoiceState?.channelId) {
    return false;
  }

  if (currentVoiceState.channelId === voiceChannelId) {
    return true;
  }

  try {
    await currentVoiceState.setChannel(voiceChannelId, 'Joined LFG Session');
    return true;
  } catch (err) {
    logger.error(`[LFG] Failed to move member ${member.id} to voice ${voiceChannelId}:`, err.message);
    return false;
  }
}

module.exports = {
  handleLFGCreate,
  handleLFGJoin,
  handleLFGLeave,
  expireOldLFGSessions,
};
