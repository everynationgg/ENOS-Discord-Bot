const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getKeyformConfig } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-palworld')
    .setDescription('Deploy the Palworld Server Access request embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const config = await getKeyformConfig(guildId, 'palworld');

      if (!config) {
        return interaction.editReply(
          '❌ **Configuration for Palworld not found.**\n' +
          'Please set up the Palworld server details and rules in the dashboard first!'
        );
      }

      const targetChannel = interaction.guild.channels.cache.get(config.target_channel_id) || interaction.channel;
      if (!targetChannel || !targetChannel.isTextBased()) {
        return interaction.editReply('❌ **Target channel is invalid or not a text-based channel.**');
      }

      // Format rules
      const rulesContent = Array.isArray(config.rules) && config.rules.length > 0
        ? config.rules.map(r => `• ${r}`).join('\n')
        : '• Prevent server lag.\n• No "build and dash" playstyles.\n• Respect server guidelines.';

      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${config.game_name} Dedicated Server Access`)
        .setDescription(
          `Welcome to the dedicated server for **${config.game_name}**!\n\n` +
          `### 📜 Server Rules\n${rulesContent}\n\n` +
          `Click the button below to request access details. You will need to agree to remain active.`
        )
        .setColor(0x10B981) // Green
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('join_palworld_server')
        .setLabel('Request Server Access')
        .setStyle(ButtonStyle.Success); // Green

      const row = new ActionRowBuilder().addComponents(button);

      await targetChannel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.editReply(`✅ Setup complete. Embed sent to <#${targetChannel.id}>.`);
    } catch (err) {
      logger.error('[PALWORLD SETUP]', err);
      return interaction.editReply('❌ An error occurred during Palworld setup. Check bot logs.');
    }
  }
};
