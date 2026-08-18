const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { forgetMember, getMemberStatus } = require('../modules/ai/npc');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enos')
    .setDescription('Interact with the ENOS AI Community Member')
    .addSubcommand(sub =>
      sub
        .setName('forget-me')
        .setDescription('🔒 Wipe all personal memories, facts, and relationship history ENOS has learned about you')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('💬 Check your familiarity tier and standing with ENOS')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;

    if (!guildId) {
      return interaction.reply({ content: '❌ This command can only be run inside a server.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'forget-me') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await forgetMember(guildId, userId);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00E5FF')
          .setTitle('🔒 Memory Wiped Clean')
          .setDescription(
            `All facts, relationship data, and conversation history stored about <@${userId}> have been permanently erased.\n\n` +
            `*As far as ENOS is concerned, you're a complete stranger again. Nice to meet you.*`
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({ content: '❌ Failed to wipe memory. Please try again later.' });
      }
    }

    if (sub === 'status') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const profile = await getMemberStatus(guildId, userId);

      const tierNames = ['Stranger', 'Acquaintance', 'Regular', 'Veteran'];
      const tierEmojis = ['👤', '🤝', '🎮', '👑'];
      const currentTier = profile.relationship.familiarity_tier || 0;
      const tierName = tierNames[currentTier] || 'Stranger';
      const tierEmoji = tierEmojis[currentTier] || '👤';

      const embed = new EmbedBuilder()
        .setColor('#7C3AED')
        .setTitle(`${tierEmoji} Your Standing with ENOS`)
        .setDescription(`ENOS knows you as a **${tierName}** (Tier ${currentTier}/3).`)
        .addFields(
          { name: 'Interactions', value: `${profile.relationship.interaction_count || 0} chats`, inline: true },
          { name: 'Known Since', value: profile.relationship.first_seen_at ? `<t:${Math.floor(new Date(profile.relationship.first_seen_at).getTime() / 1000)}:R>` : 'Recently', inline: true },
          {
            name: 'Learned Facts',
            value: profile.facts.length > 0 ? profile.facts.map(f => `• ${f}`).join('\n') : '*No specific facts recorded yet.*',
            inline: false,
          }
        )
        .setFooter({ text: 'Run /enos forget-me anytime to erase this data.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
