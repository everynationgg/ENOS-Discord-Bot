const { SlashCommandBuilder } = require('discord.js');
const { handleLFGCreate } = require('../modules/gaming/lfg');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Looking For Group commands')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new LFG party session')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Optional: Role to ping/mention')
            .setRequired(false)
        )
        .addUserOption(opt =>
          opt
            .setName('invite')
            .setDescription('Optional: Friend to invite')
            .setRequired(false)
        )
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
