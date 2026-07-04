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
  const statusColor = session.status === 'open' ? 0x8B5CF6 : 0x6B7280;
  const statusText = session.status === 'open' ? '🟢 Active' : '🔴 Closed';

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`🎮 LFG — ${session.game}`)
    .setDescription(session.description || '*No description provided.*')
    .addFields(
      { name: '👑 Host', value: `<@${session.host_id}>`, inline: true },
      { name: '📊 Status', value: statusText, inline: true },
      { name: '🔊 Voice Channel', value: voiceChannelMention || 'Not set', inline: true },
      { name: '👥 Target Party Size', value: `${session.max_size} Players`, inline: true }
    )
    .setFooter({ text: `Session ID: ${session.id.substring(0, 8)} • Every Nation LFG` })
    .setTimestamp(new Date(session.created_at));

  return embed;
}

// ─── Build LFG Action Row ─────────────────────────────────────────────────────
function buildLFGButtons(guildId, voiceChannelId, inviteUrl = null, isClosed = false) {
  if (isClosed || !voiceChannelId) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('lfg_closed_btn')
        .setLabel('Session Closed')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  const targetUrl = inviteUrl || `https://discord.com/channels/${guildId}/${voiceChannelId}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Join Voice Channel')
      .setStyle(ButtonStyle.Link)
      .setURL(targetUrl)
      .setEmoji('🔊')
  );
}

/**
 * /lfg create — shows modal for session creation immediately
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleLFGCreate(interaction) {
  const enabled = await isFeatureEnabled(interaction.guild.id, 'lfg');
  if (!enabled) {
    return interaction.reply({ content: '❌ LFG system is not enabled on this server.', ephemeral: true });
  }

  // Block command usage if not in any voice channel
  const memberVoiceChannelId = interaction.member.voice?.channelId;
  if (!memberVoiceChannelId) {
    return interaction.reply({
      content: '❌ You must join a voice channel first before you can create an LFG party session.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`lfg_modal:create`)
    .setTitle('Create LFG Session');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_game')
        .setLabel('Game')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Valorant, POE, Minecraft...')
        .setRequired(true)
        .setMaxLength(50)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('e.g. Ranked, competitive, farming...')
        .setRequired(false)
        .setMaxLength(200)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_max_size')
        .setLabel('Max Party Size (2–10)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 4')
        .setValue('4')
        .setRequired(true)
        .setMaxLength(2)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_role')
        .setLabel('Allowed Ping Role (Name or ID)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Optional matching role name or ID to notify')
        .setRequired(false)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('lfg_invite')
        .setLabel('Invite Friends (Username or ID)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Optional friend to invite')
        .setRequired(false)
        .setMaxLength(100)
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

  const guildId = interaction.guild.id;
  const gameInput = interaction.fields.getTextInputValue('lfg_game').trim();
  const description = interaction.fields.getTextInputValue('lfg_description').trim() || null;
  const rawSize = parseInt(interaction.fields.getTextInputValue('lfg_max_size').trim(), 10);
  const maxSize = Math.min(Math.max(rawSize || 4, 2), 10);
  const roleInput = interaction.fields.getTextInputValue('lfg_role').trim();
  const inviteInput = interaction.fields.getTextInputValue('lfg_invite').trim();

  // 1. Game Name Fuzzy Resolution
  const normalizedInput = gameInput.toLowerCase();
  let matchedGame = GAME_BRANCHES.find(branch => 
    branch.toLowerCase() === normalizedInput ||
    branch.toLowerCase().replace(/\s+/g, '').includes(normalizedInput.replace(/\s+/g, '')) ||
    normalizedInput.replace(/\s+/g, '').includes(branch.toLowerCase().replace(/\s+/g, ''))
  );

  if (!matchedGame) {
    matchedGame = 'Others';
  }

  // Fetch config for voice channel mapping, LFG channel, and role mappings
  const featureConfig = await getFeatureConfig(guildId, 'lfg');
  const config = featureConfig?.config || {};
  const lfgChannelId = config.lfg_channel_id;
  const voiceMappings = config.voice_mappings || {};
  const roleMappings = config.role_mappings || {};
  const sessionTTLMinutes = config.session_ttl_minutes || 120;

  const voiceChannelId = voiceMappings[matchedGame] || voiceMappings['Others'] || null;
  const voiceChannelMention = voiceChannelId ? `<#${voiceChannelId}>` : 'Not configured';

  // 2. Role Resolution & Validation
  let resolvedRole = null;
  if (roleInput) {
    const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
    if (mentionMatch) {
      resolvedRole = interaction.guild.roles.cache.get(mentionMatch[1]);
    } else if (/^\d+$/.test(roleInput)) {
      resolvedRole = interaction.guild.roles.cache.get(roleInput);
    } else {
      const cleanRoleName = roleInput.startsWith('@') ? roleInput.slice(1) : roleInput;
      resolvedRole = interaction.guild.roles.cache.find(r => 
        r.name.toLowerCase() === cleanRoleName.toLowerCase() ||
        r.name.toLowerCase().includes(cleanRoleName.toLowerCase())
      );
    }

    if (!resolvedRole) {
      return interaction.editReply(`❌ Role **"${roleInput}"** not found on this server. Please enter a valid role name, role mention, or role ID.`);
    }

    // Check configured role mapping for this matched game
    const allowedRoleId = roleMappings[matchedGame];
    if (allowedRoleId) {
      if (resolvedRole.id !== allowedRoleId) {
        return interaction.editReply(`❌ You are not allowed to tag **${resolvedRole.name}** for **${matchedGame}**. The allowed tag role configured on the website is <@&${allowedRoleId}>.`);
      }
    } else {
      // If not configured, ensure the role contains the game name
      const isMatched = resolvedRole.name.toLowerCase().includes(matchedGame.toLowerCase()) || 
                        matchedGame.toLowerCase().includes(resolvedRole.name.toLowerCase()) ||
                        resolvedRole.name.toLowerCase() === 'everyone' || 
                        resolvedRole.name.toLowerCase() === 'here';
      if (!isMatched) {
        return interaction.editReply(`❌ You can only mention a role that matches the game **${matchedGame}** (the role name must contain **${matchedGame}**).`);
      }
    }
  }

  // 3. Friend Invitation Resolution
  let resolvedInvitedUser = null;
  if (inviteInput) {
    const userMentionMatch = inviteInput.match(/^<@!?(\d+)>$/);
    if (userMentionMatch) {
      resolvedInvitedUser = await interaction.guild.members.fetch(userMentionMatch[1]).catch(() => null);
    } else if (/^\d+$/.test(inviteInput)) {
      resolvedInvitedUser = await interaction.guild.members.fetch(inviteInput).catch(() => null);
    } else {
      const cleanUsername = inviteInput.startsWith('@') ? inviteInput.slice(1) : inviteInput;
      // Search by username or display name
      const searchRes = await interaction.guild.members.search({ query: cleanUsername, limit: 1 }).catch(() => null);
      if (searchRes && searchRes.size > 0) {
        resolvedInvitedUser = searchRes.first();
      }
    }

    if (!resolvedInvitedUser) {
      return interaction.editReply(`❌ User **"${inviteInput}"** not found on this server. Please enter a valid username, user mention, or user ID.`);
    }
  }

  const expiresAt = new Date(Date.now() + sessionTTLMinutes * 60 * 1000).toISOString();

  // Create session in Supabase
  const { data: session, error } = await supabase
    .from('lfg_sessions')
    .insert({
      guild_id: guildId,
      host_id: interaction.user.id,
      game: matchedGame,
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

  // Create auto-joining voice channel invite link
  const voiceChannel = voiceChannelId ? await interaction.guild.channels.fetch(voiceChannelId).catch(() => null) : null;
  let inviteUrl = null;
  if (voiceChannel) {
    const invite = await voiceChannel.createInvite({
      maxAge: 3600 * 2, // 2 hours
      maxUses: 0,
      unique: false,
      reason: 'LFG Voice Channel Link'
    }).catch(() => null);
    if (invite) {
      inviteUrl = invite.url;
    }
  }

  // Post embed
  const embed = buildLFGEmbed(session, voiceChannelMention);
  const buttons = buildLFGButtons(guildId, voiceChannelId, inviteUrl);

  let targetChannel = interaction.channel;
  if (lfgChannelId) {
    const ch = await interaction.guild.channels.fetch(lfgChannelId).catch(() => null);
    if (ch) targetChannel = ch;
  }

  // Build mentions
  const contentParts = [];
  if (resolvedRole) contentParts.push(`<@&${resolvedRole.id}>`);
  if (resolvedInvitedUser) contentParts.push(`<@${resolvedInvitedUser.id}>, you've been invited by <@${interaction.user.id}> to join this party!`);
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

  await logBotEvent(guildId, 'lfg_create', interaction.user.id, { game: matchedGame, sessionId: session.id });

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
 * Updates the LFG embed in Discord to reflect current session state.
 */
async function refreshLFGEmbed(guild, session) {
  if (!session.channel_id || !session.message_id) return;

  try {
    const channel = await guild.channels.fetch(session.channel_id);
    const message = await channel.messages.fetch(session.message_id);

    const voiceChannelId = session.voice_channel_id;
    const voiceChannelMention = voiceChannelId ? `<#${voiceChannelId}>` : 'Not configured';

    // Generate auto-joining voice channel invite link if not closed
    const voiceChannel = voiceChannelId ? await guild.channels.fetch(voiceChannelId).catch(() => null) : null;
    let inviteUrl = null;
    if (voiceChannel && session.status !== 'closed') {
      const invite = await voiceChannel.createInvite({
        maxAge: 3600 * 2,
        maxUses: 0,
        unique: false,
        reason: 'LFG Voice Channel Link'
      }).catch(() => null);
      if (invite) {
        inviteUrl = invite.url;
      }
    }

    const embed = buildLFGEmbed(session, voiceChannelMention);
    const buttons = buildLFGButtons(guild.id, voiceChannelId, inviteUrl, session.status === 'closed');

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
  handleLFGModalSubmit,
  expireOldLFGSessions,
};
