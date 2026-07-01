const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildProfileEmbed, buildLeaderboardEmbed } = require('../modules/gaming/vault');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Vault Economy commands')
    .addSubcommand(sub =>
      sub.setName('profile').setDescription('View your Vault profile and coin balance')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('View the top 10 Vault earners')
    )
    .addSubcommand(sub =>
      sub
        .setName('give')
        .setDescription('Give coins to a member (Admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Target member').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('Amount of coins').setRequired(true).setMinValue(1)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the award').setRequired(false)
        )
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'profile') {
      await interaction.deferReply();
      const embed = await buildProfileEmbed(
        interaction.user.id,
        interaction.guild.id,
        interaction.guild
      );
      if (!embed) return interaction.editReply('❌ Could not load your Vault profile.');
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const embed = await buildLeaderboardEmbed(interaction.guild.id, interaction.guild);
      if (!embed) return interaction.editReply('❌ No Vault data found yet.');
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'give') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to award coins.', ephemeral: true });
      }

      await interaction.deferReply();
      const { awardCoins } = require('../modules/gaming/vault');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason') || 'admin_grant';

      await awardCoins(target.id, interaction.guild.id, amount, reason, interaction.guild);
      return interaction.editReply(`✅ Awarded **${amount.toLocaleString()} coins** to <@${target.id}>!`);
    }
  },
};
