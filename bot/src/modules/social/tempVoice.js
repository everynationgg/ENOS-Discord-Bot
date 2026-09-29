const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  EmbedBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const { supabase, getFeatureConfig } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// In-memory registry of active temporary voice channels
// Map<channelId, { guildId: string, ownerId: string, createdAt: number }>
const activeTempChannels = new Map();

// Cooldown map to prevent duplicate rapid channel creation spam
const userJoinCooldowns = new Map();

/**
 * Checks if a given channel ID is a tracked temporary voice channel.
 * @param {string} channelId
 * @returns {boolean}
 */
function isTempChannel(channelId) {
  return activeTempChannels.has(channelId);
}

/**
 * Registers a temporary voice channel in memory and Supabase.
 * @param {string} channelId
 * @param {string} guildId
 * @param {string} ownerId
 */
async function registerTempChannel(channelId, guildId, ownerId) {
  activeTempChannels.set(channelId, { guildId, ownerId, createdAt: Date.now() });

  try {
    await supabase.from('temp_voice_channels').upsert({
      channel_id: channelId,
      guild_id: guildId,
      owner_id: ownerId,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Graceful fallback if table is not yet migrated
    logger.debug('[TEMP VOICE] Table upsert notice:', err.message);
  }
}

/**
 * Unregisters a temporary voice channel from memory and Supabase.
 * @param {string} channelId
 */
async function unregisterTempChannel(channelId) {
  activeTempChannels.delete(channelId);

  try {
    await supabase.from('temp_voice_channels').delete().eq('channel_id', channelId);
  } catch (err) {
    logger.debug('[TEMP VOICE] Table delete notice:', err.message);
  }
}

/**
 * Handles a member joining the starter "Join to Create" voice channel.
 * @param {import('discord.js').VoiceState} newState
 * @param {import('discord.js').Client} client
 */
async function handleVoiceJoinHub(newState, client) {
  const member = newState.member;
  if (!member || member.user.bot) return;

  const guild = newState.guild;
  if (!guild) return;

  // Retrieve temporary voice configuration for this guild
  const configRow = await getFeatureConfig(guild.id, 'temp_voice');
  if (!configRow || configRow.enabled === false) return;

  const hubChannelId = configRow.config?.hub_channel_id;
  if (!hubChannelId || newState.channelId !== hubChannelId) return;

  // Anti-spam debounce (3-second cooldown per user)
  const now = Date.now();
  const lastCreated = userJoinCooldowns.get(member.id) || 0;
  if (now - lastCreated < 3000) {
    return;
  }
  userJoinCooldowns.set(member.id, now);

  try {
    const hubChannel = guild.channels.cache.get(hubChannelId) || (await guild.channels.fetch(hubChannelId).catch(() => null));
    if (!hubChannel) return;

    // Use hub channel's parent category
    const parentId = hubChannel.parentId || null;

    // Determine initial room name
    const template = configRow.config?.default_name_template || '🎮 {username}\'s Room';
    const cleanUsername = member.displayName || member.user.username;
    const initialName = template.replace('{username}', cleanUsername).slice(0, 50);

    const defaultLimit = Number(configRow.config?.default_user_limit) || 0;

    // Create the temporary voice channel with dedicated creator permissions
    const newChannel = await guild.channels.create({
      name: initialName,
      type: ChannelType.GuildVoice,
      parent: parentId,
      userLimit: defaultLimit > 0 ? defaultLimit : 0,
      permissionOverwrites: [
        // @everyone permissions
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        // Creator gets in-channel kick, mute, deafen, and management powers
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,     // Kick / Disconnect users in channel
            PermissionFlagsBits.MuteMembers,     // Server-mute users in channel
            PermissionFlagsBits.DeafenMembers,   // Server-deafen users in channel
            PermissionFlagsBits.ManageChannels,  // Edit room settings
          ],
        },
        // ENOS Bot permissions
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
      reason: `ENOS Temporary Voice Channel created for ${member.user.tag}`,
    });

    // Register active temporary channel
    await registerTempChannel(newChannel.id, guild.id, member.id);

    // Immediately move member into their newly spawned room
    await member.voice.setChannel(newChannel).catch((err) => {
      logger.warn(`[TEMP VOICE] Could not move member ${member.id} into ${newChannel.id}:`, err.message);
    });

    // Send the rich room control panel in the room's integrated text chat with explicit creator mention
    const panelPayload = buildControlPanelPayload(newChannel, member.id);
    await newChannel.send({
      content: `👑 Welcome <@${member.id}>! Your personal voice channel is ready.\nUse the controls below to manage your room:`,
      ...panelPayload,
    }).catch((err) => {
      logger.warn(`[TEMP VOICE] Failed to send setup prompt in ${newChannel.id}:`, err.message);
    });

    logger.info(`[TEMP VOICE] Created room "${newChannel.name}" (${newChannel.id}) for user ${member.id}`);
  } catch (err) {
    logger.error('[TEMP VOICE] handleVoiceJoinHub error:', err.message || err);
  }
}

/**
 * Handles a member leaving a temporary voice channel. Deletes when empty.
 * @param {import('discord.js').VoiceState} oldState
 * @param {import('discord.js').Client} client
 */
async function handleVoiceLeaveTemp(oldState, client) {
  const channelId = oldState.channelId;
  if (!channelId) return;

  if (!isTempChannel(channelId)) return;

  try {
    const guild = oldState.guild;
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel) {
      await unregisterTempChannel(channelId);
      return;
    }

    // If channel is completely empty, delete immediately
    if (channel.members.size === 0) {
      await unregisterTempChannel(channelId);
      await channel.delete('ENOS Temporary Voice Channel is now empty.').catch(() => {});
      logger.info(`[TEMP VOICE] Auto-deleted empty room "${channel.name}" (${channelId})`);
    }
  } catch (err) {
    logger.error('[TEMP VOICE] handleVoiceLeaveTemp error:', err.message || err);
  }
}

/**
 * Displays the room configuration modal to the channel owner.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function showTempVoiceModal(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const tempRecord = activeTempChannels.get(channelId);

  // Authorization check: Only the room owner (or guild administrator) can configure it
  const isOwner = tempRecord && tempRecord.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Only the creator of this voice channel can configure room settings.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  const currentName = channel ? channel.name : 'Gaming Room';
  const currentLimit = channel && channel.userLimit > 0 ? String(channel.userLimit) : '';

  const modal = new ModalBuilder()
    .setCustomId(`tempvoice_modal:${channelId}`)
    .setTitle('Configure Voice Room');

  const nameInput = new TextInputBuilder()
    .setCustomId('room_name')
    .setLabel('Room Name')
    .setStyle(TextInputStyle.Short)
    .setValue(currentName)
    .setPlaceholder('e.g. Baldur\'s Gate 3 Squad')
    .setMaxLength(50)
    .setRequired(true);

  const privacyInput = new TextInputBuilder()
    .setCustomId('privacy')
    .setLabel('Privacy (public or private)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('public or private (default: public)')
    .setMaxLength(15)
    .setRequired(false);

  const limitInput = new TextInputBuilder()
    .setCustomId('player_limit')
    .setLabel('Player Limit (Number or blank for unlimited)')
    .setStyle(TextInputStyle.Short)
    .setValue(currentLimit)
    .setPlaceholder('e.g. 4 or leave blank')
    .setMaxLength(2)
    .setRequired(false);

  const allowedMembersInput = new TextInputBuilder()
    .setCustomId('allowed_members')
    .setLabel('Invite Members (Mentions or User IDs)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('@friend1, @friend2 (grants access if room is private)')
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(privacyInput),
    new ActionRowBuilder().addComponents(limitInput),
    new ActionRowBuilder().addComponents(allowedMembersInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handles submission of the room configuration modal.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTempVoiceModalSubmit(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    return interaction.reply({
      content: '❌ This voice channel no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const roomName = interaction.fields.getTextInputValue('room_name')?.trim() || channel.name;
  const privacyVal = (interaction.fields.getTextInputValue('privacy') || '').trim().toLowerCase();
  const limitVal = (interaction.fields.getTextInputValue('player_limit') || '').trim();
  const allowedMembersVal = (interaction.fields.getTextInputValue('allowed_members') || '').trim();

  // Parse capacity limit
  let userLimit = 0;
  if (limitVal && !isNaN(Number(limitVal))) {
    const num = parseInt(limitVal, 10);
    if (num > 0 && num <= 99) {
      userLimit = num;
    }
  }

  const isPrivate = privacyVal === 'private' || privacyVal === 'lock' || privacyVal === 'locked';

  // Extract mentioned user IDs from allowed_members input
  const mentionedIds = allowedMembersVal ? (allowedMembersVal.match(/\d{17,20}/g) || []) : [];

  try {
    // Update channel metadata (name, user limit)
    await channel.edit({
      name: roomName,
      userLimit,
    });

    // Update permission overwrites
    // 1. @everyone: if private, deny Connect; if public, allow Connect
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: true,
      Connect: !isPrivate,
    });

    // 2. Creator retains complete control
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      MoveMembers: true,
      MuteMembers: true,
      DeafenMembers: true,
      ManageChannels: true,
    });

    // 3. Whitelisted members get explicit Connect permission
    for (const userId of mentionedIds) {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        Connect: true,
      }).catch(() => {});
    }

    const summaryLines = [
      '✅ **Voice Room Updated Successfully!**',
      `• **Name:** \`${roomName}\``,
      `• **Access:** ${isPrivate ? '🔒 **Private** (Invite-Only)' : '🌐 **Public** (Anyone can join)'}`,
      `• **Capacity:** ${userLimit > 0 ? `\`${userLimit} members\`` : '`Unlimited`'}`,
    ];

    if (isPrivate && mentionedIds.length > 0) {
      summaryLines.push(`• **Allowed Friends:** ${mentionedIds.map((id) => `<@${id}>`).join(', ')}`);
    }

    await interaction.editReply({ content: summaryLines.join('\n') });
    logger.info(`[TEMP VOICE] Configured channel ${channelId}: name="${roomName}" private=${isPrivate} limit=${userLimit}`);
  } catch (err) {
    logger.error(`[TEMP VOICE] Failed to configure channel ${channelId}:`, err.message || err);
    await interaction.editReply({ content: '❌ Failed to apply room settings. Please ensure bot permissions are intact.' });
  }
}

/**
 * Generates the rich interactive control panel payload for a temporary voice channel.
 * @param {import('discord.js').VoiceChannel} channel
 * @param {string} ownerId
 * @param {boolean|null} [overrideLocked=null]
 */
function buildControlPanelPayload(channel, ownerId, overrideLocked = null) {
  const guild = channel.guild;
  const everyonePerm = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
  const isLocked = overrideLocked !== null
    ? overrideLocked
    : (everyonePerm ? everyonePerm.deny.has(PermissionFlagsBits.Connect) : false);

  const currentLimit = channel.userLimit || 0;

  const embed = new EmbedBuilder()
    .setColor(isLocked ? 0xef4444 : 0x38bdf8)
    .setTitle('🎮 Voice Room Control Panel')
    .setDescription(
      `👑 **Owner:** <@${ownerId}>\n` +
      `Use the buttons below to lock/unlock, rename, or adjust player capacity. Use the dropdown to invite friends!`
    )
    .addFields(
      {
        name: '🔒 Privacy',
        value: isLocked ? '🔒 **Private (Locked)**\n*Only whitelisted members can join*' : '🌐 **Public (Unlocked)**\n*Anyone in the server can join*',
        inline: true,
      },
      {
        name: '👥 Player Limit',
        value: currentLimit > 0 ? `\`${currentLimit} Members\`` : '`Unlimited`',
        inline: true,
      }
    )
    .setFooter({ text: 'ENOS Dynamic Voice • Auto-deletes when empty' });

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tempvoice_lock:${channel.id}`)
      .setLabel(isLocked ? 'Unlock Room' : 'Lock Room')
      .setEmoji(isLocked ? '🔓' : '🔒')
      .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`tempvoice_rename:${channel.id}`)
      .setLabel('Rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`tempvoice_limit:${channel.id}`)
      .setLabel('Limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary)
  );

  const inviteRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`tempvoice_invite:${channel.id}`)
      .setPlaceholder('➕ Select friends to invite / whitelist...')
      .setMinValues(1)
      .setMaxValues(10)
  );

  return {
    embeds: [embed],
    components: [buttonRow, inviteRow],
  };
}

/**
 * Toggles a temporary voice room between Public and Private via button click.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTempVoiceLockToggle(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  if (!guild) return;

  const tempRecord = activeTempChannels.get(channelId);
  const isOwner = tempRecord && tempRecord.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Only the creator of this voice channel can configure room settings.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    return interaction.reply({ content: '❌ This voice channel no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const everyonePerm = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
  const isCurrentlyLocked = everyonePerm ? everyonePerm.deny.has(PermissionFlagsBits.Connect) : false;
  const willBeLocked = !isCurrentlyLocked;

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: true,
      Connect: !willBeLocked,
    });

    const ownerId = tempRecord?.ownerId || interaction.user.id;
    const payload = buildControlPanelPayload(channel, ownerId, willBeLocked);

    await interaction.update(payload);
    await interaction.followUp({
      content: willBeLocked
        ? '🔒 **Room is now Private (Locked)!** Non-whitelisted members can no longer join.'
        : '🌐 **Room is now Public (Unlocked)!** Anyone in the server can join.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error('[TEMP VOICE] Failed to toggle lock:', err.message || err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Failed to change room privacy.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

/**
 * Displays a quick rename modal to the room creator.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function showTempVoiceRenameModal(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const tempRecord = activeTempChannels.get(channelId);
  const isOwner = tempRecord && tempRecord.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Only the creator of this voice channel can rename the room.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  const currentName = channel ? channel.name : 'Gaming Room';

  const modal = new ModalBuilder()
    .setCustomId(`tempvoice_rename_modal:${channelId}`)
    .setTitle('Rename Voice Room');

  const nameInput = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('New Room Name')
    .setStyle(TextInputStyle.Short)
    .setValue(currentName)
    .setMaxLength(50)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  await interaction.showModal(modal);
}

/**
 * Handles submission of room rename modal.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTempVoiceRenameSubmit(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    return interaction.reply({ content: '❌ This voice channel no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const newName = interaction.fields.getTextInputValue('new_name')?.trim();
  if (!newName) {
    return interaction.reply({ content: '❌ Room name cannot be empty.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await channel.setName(newName);
    await interaction.editReply({ content: `✅ Renamed room to **${newName}**!` });
  } catch (err) {
    logger.error('[TEMP VOICE] Failed to rename channel:', err.message || err);
    await interaction.editReply({ content: '❌ Discord rate limits room renames to 2 per 10 minutes. Please try again shortly.' });
  }
}

/**
 * Displays a player capacity limit modal to the room creator.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function showTempVoiceLimitModal(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const tempRecord = activeTempChannels.get(channelId);
  const isOwner = tempRecord && tempRecord.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Only the creator of this voice channel can set player limits.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  const currentLimit = channel && channel.userLimit > 0 ? String(channel.userLimit) : '';

  const modal = new ModalBuilder()
    .setCustomId(`tempvoice_limit_modal:${channelId}`)
    .setTitle('Set Room Player Limit');

  const limitInput = new TextInputBuilder()
    .setCustomId('new_limit')
    .setLabel('Player Limit (0 for unlimited, max 99)')
    .setStyle(TextInputStyle.Short)
    .setValue(currentLimit)
    .setPlaceholder('e.g. 4 or 0 for unlimited')
    .setMaxLength(2)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
  await interaction.showModal(modal);
}

/**
 * Handles submission of player limit modal.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTempVoiceLimitSubmit(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    return interaction.reply({ content: '❌ This voice channel no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const limitRaw = interaction.fields.getTextInputValue('new_limit')?.trim();
  const limitNum = parseInt(limitRaw, 10);
  const safeLimit = !isNaN(limitNum) && limitNum >= 0 && limitNum <= 99 ? limitNum : 0;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await channel.setUserLimit(safeLimit);
    await interaction.editReply({
      content: safeLimit > 0
        ? `👥 Room capacity set to **${safeLimit} members**.`
        : '👥 Room capacity set to **Unlimited**.',
    });
  } catch (err) {
    logger.error('[TEMP VOICE] Failed to set limit:', err.message || err);
    await interaction.editReply({ content: '❌ Failed to update player limit.' });
  }
}

/**
 * Handles member selection from the Discord UserSelectMenu to whitelist friends.
 * @param {import('discord.js').UserSelectMenuInteraction} interaction
 */
async function handleTempVoiceInviteSelect(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  if (!guild) return;

  const tempRecord = activeTempChannels.get(channelId);
  const isOwner = tempRecord && tempRecord.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Only the creator of this voice channel can invite members.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    return interaction.reply({ content: '❌ This voice channel no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const selectedUserIds = interaction.values || [];
  if (selectedUserIds.length === 0) {
    return interaction.reply({ content: '❌ No members selected.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    for (const userId of selectedUserIds) {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      }).catch((err) => logger.warn(`[TEMP VOICE] Overwrite notice for user ${userId}:`, err.message));
    }

    const mentions = selectedUserIds.map((id) => `<@${id}>`).join(', ');
    await interaction.editReply({
      content: `✅ Successfully whitelisted ${mentions}!\nThey can now connect to your room even when it is locked.`,
    });

    // Post friendly notice in channel chat
    await channel.send({
      content: `👋 <@${interaction.user.id}> invited ${mentions} to join the room!`,
    }).catch(() => {});
  } catch (err) {
    logger.error('[TEMP VOICE] Failed to invite users:', err.message || err);
    await interaction.editReply({ content: '❌ Failed to whitelist selected members.' });
  }
}

/**
 * Scans for and purges any abandoned empty temporary voice channels on startup.
 * @param {import('discord.js').Client} client
 */
async function initTempVoiceCleanup(client) {
  try {
    // 1. Fetch tracked channels from Supabase
    const { data: storedChannels } = await supabase.from('temp_voice_channels').select('*');

    const trackedIds = new Set((storedChannels || []).map((r) => r.channel_id));

    for (const row of storedChannels || []) {
      activeTempChannels.set(row.channel_id, {
        guildId: row.guild_id,
        ownerId: row.owner_id,
        createdAt: new Date(row.created_at).getTime(),
      });
    }

    // 2. Scan all guilds and delete empty tracked channels
    for (const guild of client.guilds.cache.values()) {
      for (const channelId of trackedIds) {
        const channel = guild.channels.cache.get(channelId);
        if (channel && channel.isVoiceBased() && channel.members.size === 0) {
          await channel.delete('ENOS startup cleanup of empty temporary voice channel.').catch(() => {});
          await unregisterTempChannel(channelId);
          logger.info(`[TEMP VOICE] Startup cleanup: Deleted empty room ${channelId}`);
        }
      }
    }

    logger.info(`[TEMP VOICE] System initialized. Tracking ${activeTempChannels.size} active temporary channels.`);
  } catch (err) {
    logger.warn('[TEMP VOICE] Startup cleanup warning:', err.message || err);
  }
}

module.exports = {
  activeTempChannels,
  isTempChannel,
  registerTempChannel,
  unregisterTempChannel,
  handleVoiceJoinHub,
  handleVoiceLeaveTemp,
  buildControlPanelPayload,
  handleTempVoiceLockToggle,
  showTempVoiceRenameModal,
  handleTempVoiceRenameSubmit,
  showTempVoiceLimitModal,
  handleTempVoiceLimitSubmit,
  handleTempVoiceInviteSelect,
  showTempVoiceModal,
  handleTempVoiceModalSubmit,
  initTempVoiceCleanup,
};
