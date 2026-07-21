const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { triggerTriviaDrop, forceCloseDrop } = require('../modules/gaming/trivia');
const { supabase, getFeatureConfig } = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Community Trivia Drop commands')
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('View the top 5 trivia point earners')
    )
    .addSubcommand(sub =>
      sub.setName('trigger').setDescription('Force-trigger a trivia drop immediately (Admin only)')
    )
    .addSubcommand(sub =>
      sub.setName('skip').setDescription('Skip/Close the currently active trivia session (Admin only)')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      
      const { data: topPoints, error } = await supabase
        .from('trivia_points')
        .select('discord_id, points')
        .eq('guild_id', interaction.guild.id)
        .order('points', { ascending: false })
        .limit(5);

      if (error || !topPoints) {
        return interaction.editReply('❌ Failed to fetch leaderboard data.');
      }

      const lines = topPoints.map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        return `${medal} <@${entry.discord_id}> — **${entry.points.toLocaleString()}** points`;
      });

      if (lines.length === 0) {
        lines.push('*No points earned yet. Play trivia to show up here!*');
      }

      const embed = new EmbedBuilder()
        .setColor(0xFACC15)
        .setTitle('🏆 Server Trivia Leaderboard (Top 5)')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Every Nation Trivia System' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'trigger') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to trigger a trivia drop.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const success = await triggerTriviaDrop(interaction.client, interaction.guild.id);
      
      if (success) {
        return interaction.editReply('✅ Trivia drop triggered successfully!');
      } else {
        return interaction.editReply('❌ Failed to trigger trivia drop. Ensure the feature is enabled and allowed channels are configured.');
      }
    }

    if (sub === 'skip') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to skip a trivia session.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      // Find the active drop
      const { data: activeDrop } = await supabase
        .from('trivia_drops')
        .select('id')
        .eq('guild_id', interaction.guild.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!activeDrop) {
        return interaction.editReply('❌ There is no active trivia drop session to skip.');
      }

      await forceCloseDrop(interaction.client, interaction.guild.id, activeDrop.id, 'skipped');
      return interaction.editReply('✅ The active trivia session has been skipped and closed.');
    }
  },
};
