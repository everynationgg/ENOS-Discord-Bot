const { SlashCommandBuilder } = require('discord.js');
const { handleLFGCreate } = require('../modules/gaming/lfg');

const GAME_CHOICES = [
  { name: 'Where Winds Meet', value: 'Where Winds Meet' },
  { name: 'Palworld', value: 'Palworld' },
  { name: 'Wuwa', value: 'Wuwa' },
  { name: 'Hoyoverse', value: 'Hoyoverse' },
  { name: 'Enfi', value: 'Enfi' },
  { name: 'POE', value: 'POE' },
  { name: 'BG3', value: 'BG3' },
  { name: 'D4', value: 'D4' },
  { name: 'Minecraft', value: 'Minecraft' },
  { name: 'Phasmo', value: 'Phasmo' },
  { name: 'REPO', value: 'REPO' },
  { name: 'PEAK', value: 'PEAK' },
  { name: 'Subnautica 2', value: 'Subnautica 2' },
  { name: 'Devour', value: 'Devour' },
  { name: 'Demonologist', value: 'Demonologist' },
  { name: 'Valorant', value: 'Valorant' },
  { name: 'CS2', value: 'CS2' },
  { name: 'COD', value: 'COD' },
  { name: 'HoK', value: 'HoK' },
  { name: 'ML', value: 'ML' },
  { name: 'LOL', value: 'LOL' },
  { name: 'Others', value: 'Others' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Looking For Group commands')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new LFG party session')
        .addStringOption(opt =>
          opt
            .setName('game')
            .setDescription('Select the game for this session')
            .setRequired(true)
            .addChoices(...GAME_CHOICES)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Short description / requirements for this session')
            .setRequired(false)
            .setMaxLength(200)
        )
        .addIntegerOption(opt =>
          opt
            .setName('max_size')
            .setDescription('Max party size (2-10, default 4)')
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(10)
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Optional: Role matching the game to mention')
            .setRequired(false)
        )
        .addUserOption(opt =>
          opt
            .setName('invite')
            .setDescription('Optional: Mention a friend to invite them to join')
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
