const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { postLandingMessage } = require('../modules/moderation/gatekeeper');
const { pruneOldRecords } = require('../modules/system/pruner');
const { runDailyDigest } = require('../modules/ai/digest');
const { loadBirthdayQueue } = require('../modules/social/birthdays');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin-only ENOS management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup-landing').setDescription('Post or refresh the landing/verification message')
    )
    .addSubcommand(sub =>
      sub.setName('run-digest').setDescription('Manually trigger the daily digest now')
    )
    .addSubcommand(sub =>
      sub.setName('prune-now').setDescription('Manually run the 30-day data pruning job')
    )
    .addSubcommand(sub =>
      sub.setName('run-birthday-scan').setDescription('Manually trigger the birthday queue scan')
    )
    .addSubcommand(sub =>
      sub.setName('run-newsroom').setDescription('Manually trigger newsroom feed check & dispatch now')
    )
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Check bot and system health status')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup-landing') {
      await interaction.deferReply({ ephemeral: true });
      await postLandingMessage(client, interaction.guild.id);
      return interaction.editReply('✅ Landing message posted/refreshed.');
    }

    if (sub === 'run-newsroom') {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply('⏳ Fetching and processing newsroom feeds...');
      const { checkAndDispatchNewsroom } = require('../modules/newsroom/engine');
      await checkAndDispatchNewsroom(client, { forceRun: true });
      return interaction.editReply('✅ Newsroom check completed and latest articles dispatched.');
    }

    if (sub === 'run-digest') {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply('⏳ Running digest... this may take a few seconds.');
      await runDailyDigest(client, interaction.guild.id);
      return interaction.editReply('✅ Daily digest generated and posted.');
    }

    if (sub === 'run-birthday-scan') {
      await interaction.deferReply({ ephemeral: true });
      await loadBirthdayQueue(client);
      return interaction.editReply('✅ Birthday queue scan complete. Check the social tab in the dashboard!');
    }

    if (sub === 'prune-now') {
      await interaction.deferReply({ ephemeral: true });
      const results = await pruneOldRecords();
      const lines = Object.entries(results)
        .map(([table, count]) => `• \`${table}\`: ${count === 'error' ? '❌ Error' : `${count} rows deleted`}`)
        .join('\n');
      return interaction.editReply(`✅ Pruning complete:\n${lines}`);
    }

    if (sub === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const { supabase } = require('../lib/supabase');
      const { data: health } = await supabase
        .from('bot_health')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .maybeSingle();

      const uptime = process.uptime();
      const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

      return interaction.editReply(
        `**🤖 ENOS Bot Status**\n` +
        `• Uptime: \`${uptimeStr}\`\n` +
        `• Last Heartbeat: \`${health?.last_seen ? new Date(health.last_seen).toLocaleString() : 'N/A'}\`\n` +
        `• Guilds: \`${client.guilds.cache.size}\`\n` +
        `• Ping: \`${client.ws.ping}ms\``
      );
    }
  },
};
