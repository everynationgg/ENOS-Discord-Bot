const { SlashCommandBuilder } = require('discord.js');
const { handleLFGCreate } = require('../modules/gaming/lfg');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Looking For Group commands')
    .addSubcommand(sub =>
      sub.setName('create').setDescription('Create a new LFG party session')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      return handleLFGCreate(interaction);
    }
  },
};
