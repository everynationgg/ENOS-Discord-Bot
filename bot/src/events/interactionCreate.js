const { Events } = require('discord.js');
const logger = require('../lib/logger');
const {
  handleVerifyButton,
  handleDiscoverySelect,
  handleGameBranchSelect,
  handleBirthMonthSelect,
  handleBirthDayGroupSelect,
  handleBirthDaySelect,
  handleBirthdayConfirm,
  handleBirthdaySkip,
  handleIGNAddClick,
  handleIGNModalSubmit,
  handleIGNNext,
} = require('../modules/moderation/verification');
const { handleLFGJoin, handleLFGLeave } = require('../modules/gaming/lfg');

module.exports = {
  name: Events.InteractionCreate,
  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      // ─── Slash Commands ──────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`[INTERACTION] Unknown command: ${interaction.commandName}`);
          return;
        }
        await command.execute(interaction, client);
        return;
      }

      // ─── Button Interactions ──────────────────────────────────────────────────
      if (interaction.isButton()) {
        if (interaction.customId === 'verify_here') {
          return handleVerifyButton(interaction);
        }
        if (interaction.customId === 'verify_ign_add') {
          return handleIGNAddClick(interaction);
        }
        if (interaction.customId === 'verify_ign_next') {
          return handleIGNNext(interaction);
        }
        if (interaction.customId === 'verify_birthday_confirm') {
          return handleBirthdayConfirm(interaction);
        }
        if (interaction.customId === 'verify_birthday_skip') {
          return handleBirthdaySkip(interaction);
        }
        if (interaction.customId.startsWith('lfg_join:')) {
          return handleLFGJoin(interaction);
        }
        if (interaction.customId.startsWith('lfg_leave:')) {
          return handleLFGLeave(interaction);
        }
        return;
      }

      // ─── Modal Submissions ────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'verify_modal') {
          const { handleVerifyModalSubmit } = require('../modules/moderation/verification');
          return handleVerifyModalSubmit(interaction);
        }
        if (interaction.customId === 'verify_ign_modal') {
          return handleIGNModalSubmit(interaction);
        }
        if (interaction.customId.startsWith('lfg_modal:')) {
          const { handleLFGModalSubmit } = require('../modules/gaming/lfg');
          return handleLFGModalSubmit(interaction);
        }
        return;
      }

      // ─── String Select Menus ──────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'verify_birth_month') {
          return handleBirthMonthSelect(interaction);
        }
        if (interaction.customId === 'verify_birth_day_group') {
          return handleBirthDayGroupSelect(interaction);
        }
        if (interaction.customId === 'verify_birth_day') {
          return handleBirthDaySelect(interaction);
        }
        if (interaction.customId === 'verify_discovery') {
          return handleDiscoverySelect(interaction);
        }
        if (interaction.customId === 'verify_game_branch') {
          return handleGameBranchSelect(interaction);
        }
        return;
      }
    } catch (err) {
      logger.error('[INTERACTION] Handler error:', err);
      const content = '❌ An error occurred while processing this interaction.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  },
};
