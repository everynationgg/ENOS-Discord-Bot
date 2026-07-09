const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getKeyformConfig, addKeyformRegistration, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

/**
 * Handles the "Request Server Access" button click.
 * Opens the registration modal.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleKeyformButton(interaction) {
  try {
    // Extract game key from the customId (format: "join_game_server:game_key")
    const parts = interaction.customId.split(':');
    const gameKey = parts[1] || 'palworld';

    const guildId = interaction.guildId;
    const config = await getKeyformConfig(guildId, gameKey);

    if (!config) {
      return interaction.reply({
        content: `❌ **Server configuration for "${gameKey}" not found.** Please contact an administrator.`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`game_registration_modal:${gameKey}`)
      .setTitle(`${config.game_name} Registration`);

    const ignInput = new TextInputBuilder()
      .setCustomId('game_ign')
      .setLabel('In-Game Name (IGN) you intend to use')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter your character name');

    const agreementInput = new TextInputBuilder()
      .setCustomId('game_agreement')
      .setLabel("Type 'I AGREE' to confirm active status")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('I AGREE');

    const row1 = new ActionRowBuilder().addComponents(ignInput);
    const row2 = new ActionRowBuilder().addComponents(agreementInput);

    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
  } catch (err) {
    logger.error('[KEYFORM BUTTON]', err);
    await interaction.reply({
      content: '❌ An error occurred while opening the registration form.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * Handles the registration modal submission.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleKeyformModalSubmit(interaction) {
  try {
    // Extract game key from the customId (format: "game_registration_modal:game_key")
    const parts = interaction.customId.split(':');
    const gameKey = parts[1] || 'palworld';

    const ign = interaction.fields.getTextInputValue('game_ign').trim();
    const agreement = interaction.fields.getTextInputValue('game_agreement').trim();

    // Check agreement
    if (agreement.toUpperCase() !== 'I AGREE') {
      return interaction.reply({
        content: '❌ Registration denied. You must agree to the rules to get access.',
        ephemeral: true
      });
    }

    // Defer reply because we will touch Supabase and Discord logs
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const config = await getKeyformConfig(guildId, gameKey);

    if (!config) {
      return interaction.editReply(`❌ **Server configuration for "${gameKey}" not found.** Please contact an administrator.`);
    }

    // Add registration to database
    const success = await addKeyformRegistration(
      guildId,
      interaction.user.id,
      interaction.user.tag,
      ign,
      gameKey
    );

    if (!success) {
      return interaction.editReply('❌ **Database error.** Failed to save registration. Please try again later.');
    }

    // Reply with server credentials
    await interaction.editReply(
      `🎉 **Welcome to the Server!**\n\n` +
      `Here are the connection details for **${config.game_name}**:\n` +
      `• 🔗 **Server IP/URL:** \`${config.server_url}\`\n` +
      `• 🔑 **Password:** \`${config.server_password}\`\n\n` +
      `*Please make sure you follow the rules and remain active!*`
    );

    // Send log to logging channel
    const logChannelId = config.log_channel_id;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);

    const logEmbed = new EmbedBuilder()
      .setTitle(`🔑 Server Access Granted: ${config.game_name}`)
      .setColor(0x10B981) // Green
      .addFields(
        { name: 'Discord Player', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: 'In-Game Name (IGN)', value: `\`${ign}\``, inline: true },
        { name: 'Game Server', value: config.game_name, inline: true }
      )
      .setTimestamp();

    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({ embeds: [logEmbed] }).catch((e) => {
        logger.error(`[KEYFORM LOG CHANNEL SEND ERROR]`, e);
      });
    } else {
      logger.info(`[KEYFORM LOG] User ${interaction.user.tag} joined ${config.game_name} with IGN: ${ign} (Logged to console: log channel ${logChannelId} invalid or missing)`);
    }

    // Record internal bot audit event log
    await logBotEvent(guildId, 'keyform_join', interaction.user.id, {
      game_key: gameKey,
      ign,
      discord_tag: interaction.user.tag
    });

  } catch (err) {
    logger.error('[KEYFORM MODAL SUBMIT]', err);
    return interaction.editReply('❌ An error occurred while processing your registration. Please try again.').catch(() => {});
  }
}

module.exports = {
  handleKeyformButton,
  handleKeyformModalSubmit
};
