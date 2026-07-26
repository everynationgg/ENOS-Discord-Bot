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
      sub.setName('quest').setDescription('🎯 View your Vault daily quest progress and start it')
    )
    .addSubcommand(sub =>
      sub.setName('start-quest').setDescription('▶️ Explicitly start today\'s daily quest to begin message tracking')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('View the top 10 Vault earners')
    )
    .addSubcommand(sub =>
      sub
        .setName('setup-quest-channel')
        .setDescription('Deploy the persistent Daily Quest Hub card into a channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Target channel for the Daily Quest Hub').setRequired(true)
        )
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
      const profileData = await buildProfileEmbed(
        interaction.user.id,
        interaction.guild.id,
        interaction.guild
      );
      if (!profileData || !profileData.embed) return interaction.editReply('❌ Could not load your Vault profile.');
      return interaction.editReply({ embeds: [profileData.embed], components: profileData.components || [] });
    }

    if (sub === 'quest') {
      await interaction.deferReply();
      const { buildQuestEmbed } = require('../modules/gaming/vault');
      const questData = await buildQuestEmbed(
        interaction.user.id,
        interaction.guild.id,
        interaction.guild
      );
      return interaction.editReply({ embeds: [questData.embed], components: questData.components || [] });
    }

    if (sub === 'start-quest') {
      await interaction.deferReply({ ephemeral: true });
      const { handleStartQuest } = require('../modules/gaming/vault');
      const res = await handleStartQuest(interaction.user.id, interaction.guild.id);
      return interaction.editReply(res.message);
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const embed = await buildLeaderboardEmbed(interaction.guild.id, interaction.guild);
      if (!embed) return interaction.editReply('❌ No Vault data found yet.');
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'setup-quest-channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to setup the quest channel.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const targetChannel = interaction.options.getChannel('channel');
      const { postOrUpdateQuestLauncherChannel } = require('../modules/gaming/vault');
      const ok = await postOrUpdateQuestLauncherChannel(interaction.client, interaction.guild.id, targetChannel.id);
      if (!ok) return interaction.editReply('❌ Failed to deploy Quest Hub card. Ensure the channel is text-based and the bot has Send Messages permission.');

      return interaction.editReply(`✅ **Daily Quest Hub deployed!** Permanent quest launcher card posted in <#${targetChannel.id}>.`);
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
