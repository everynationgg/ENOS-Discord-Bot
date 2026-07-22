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
    )
    .addSubcommand(sub =>
      sub.setName('drops')
        .setDescription('Configure or view daily trivia drops count (1-3) (Admin only)')
        .addIntegerOption(opt =>
          opt.setName('count')
            .setDescription('Number of drops per day (1 to 3)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(3)
        )
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

    if (sub === 'drops') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need the **Manage Server** permission to configure trivia settings.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const count = interaction.options.getInteger('count');

      // Fetch feature config
      const { data: featureRow } = await supabase
        .from('guild_config')
        .select('config')
        .eq('guild_id', interaction.guild.id)
        .eq('feature_key', 'trivia')
        .maybeSingle();

      const config = featureRow?.config || {};

      if (count !== null) {
        const drops = Math.min(3, Math.max(1, count));
        config.drops_per_day = drops;
        // Invalidate scheduled_drop_times to trigger recalculation for today
        delete config.scheduled_drop_times;

        const { error } = await supabase
          .from('guild_config')
          .upsert({
            guild_id: interaction.guild.id,
            feature_key: 'trivia',
            config,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'guild_id,feature_key' });

        if (error) {
          return interaction.editReply('❌ Failed to update trivia daily drops configuration.');
        }

        return interaction.editReply(`✅ Daily trivia drops configured to **${drops}** per day (max 3).`);
      } else {
        const current = Math.min(3, Math.max(1, parseInt(config.drops_per_day, 10) || 1));
        return interaction.editReply(`ℹ️ Server trivia is currently configured for **${current}** drop(s) per day (max 3).`);
      }
    }
  },
};
