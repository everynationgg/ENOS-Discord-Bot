const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getKeyformConfig, supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-keyform')
    .setDescription('Deploy a Game Server Access request embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('game')
        .setDescription('The game server to set up (e.g. palworld)')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  /**
   * @param {import('discord.js').AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      
      // Fetch available keyform configs from Supabase
      const { data: configs } = await supabase
        .from('keyform_configs')
        .select('game_key, game_name')
        .eq('guild_id', interaction.guildId);

      if (!configs) return interaction.respond([]);

      const filtered = configs
        .filter(c => c.game_name.toLowerCase().includes(focusedValue) || c.game_key.toLowerCase().includes(focusedValue))
        .slice(0, 25);

      await interaction.respond(
        filtered.map(c => ({ name: `${c.game_name} (${c.game_key})`, value: c.game_key }))
      );
    } catch (err) {
      logger.error('[KEYFORM AUTOCOMPLETE]', err);
    }
  },

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const gameKey = interaction.options.getString('game').toLowerCase().trim();
      const config = await getKeyformConfig(guildId, gameKey);

      if (!config) {
        return interaction.editReply(
          `❌ **Configuration for game "${gameKey}" not found.**\n` +
          'Please set up the server details and rules in the dashboard first!'
        );
      }

      const targetChannel = interaction.guild.channels.cache.get(config.target_channel_id) || interaction.channel;
      if (!targetChannel || !targetChannel.isTextBased()) {
        return interaction.editReply('❌ **Target channel is invalid or not a text-based channel.**');
      }

      // Format rules
      const rulesContent = Array.isArray(config.rules) && config.rules.length > 0
        ? config.rules.map(r => `• ${r}`).join('\n')
        : '• Please follow server guidelines.';

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
        .setCustomId(`join_game_server:${config.game_key}`)
        .setLabel('Request Server Access')
        .setStyle(ButtonStyle.Success); // Green

      const row = new ActionRowBuilder().addComponents(button);

      await targetChannel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.editReply(`✅ Setup complete. Embed sent to <#${targetChannel.id}>.`);
    } catch (err) {
      logger.error('[KEYFORM SETUP]', err);
      return interaction.editReply('❌ An error occurred during setup. Check bot logs.');
    }
  }
};
