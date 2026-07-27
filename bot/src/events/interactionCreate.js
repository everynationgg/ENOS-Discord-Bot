const { Events, MessageFlags } = require('discord.js');
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

const userButtonCooldowns = new Map();

module.exports = {
  name: Events.InteractionCreate,
  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      // ─── Slash Commands ──────────────────────────────────────────────────────
      if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`[INTERACTION] Unknown command: ${interaction.commandName}`);
          return;
        }
        await command.execute(interaction, client);
        return;
      }

      // ─── Autocomplete Interactions ───────────────────────────────────────────
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command && command.autocomplete) {
          await command.autocomplete(interaction);
        }
        return;
      }

      // ─── Button Interactions ──────────────────────────────────────────────────
      if (interaction.isButton()) {
        const cooldownKey = `${interaction.user.id}:${interaction.customId}`;
        const now = Date.now();
        const lastClick = userButtonCooldowns.get(cooldownKey) || 0;
        if (now - lastClick < 1200) {
          return interaction.reply({ content: '⏱️ Please wait a moment before clicking again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        userButtonCooldowns.set(cooldownKey, now);
        if (userButtonCooldowns.size > 500) {
          for (const [k, t] of userButtonCooldowns.entries()) {
            if (now - t > 60000) userButtonCooldowns.delete(k);
          }
        }

        logger.info(`[INTERACTION] Button click: customId="${interaction.customId}" user=${interaction.user.id}`);
        if (interaction.customId === 'vault_get_daily_quests') {
          try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const { handleStartQuest, build3QuestsEphemeralEmbed } = require('../modules/gaming/vault');
            const targetGuildId = interaction.guildId || interaction.guild?.id;
            await handleStartQuest(interaction.user.id, targetGuildId);
            const embed = await build3QuestsEphemeralEmbed(interaction.user.id, targetGuildId, interaction.guild);

            const replyMsg = await interaction.editReply({ embeds: [embed] });
            if (replyMsg) {
              setTimeout(() => {
                interaction.deleteReply().catch(() => {});
              }, 120000);
            }
          } catch (err) {
            logger.error('[INTERACTION] Error in vault_get_daily_quests:', err.message || err);
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content: '❌ Failed to load daily quests. Please try again.' }).catch(() => {});
            } else {
              await interaction.followUp({ content: '❌ Failed to load daily quests. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
          }
          return;
        }
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
        if (interaction.customId === 'helpdesk_start') {
          const { handleHelpDeskStart } = require('../modules/moderation/helpdesk');
          return handleHelpDeskStart(interaction);
        }
        if (interaction.customId === 'helpdesk_close') {
          const { handleHelpDeskClose } = require('../modules/moderation/helpdesk');
          return handleHelpDeskClose(interaction);
        }
        if (interaction.customId.startsWith('join_game_server:')) {
          const { handleKeyformButton } = require('../modules/moderation/keyform');
          return handleKeyformButton(interaction);
        }
        if (interaction.customId === 'trivia_leaderboard') {
          const { handleTriviaLeaderboardButton } = require('../modules/gaming/trivia');
          return handleTriviaLeaderboardButton(interaction);
        }
        if (interaction.customId.startsWith('trivia_start:')) {
          const { handleTriviaStartClick } = require('../modules/gaming/trivia');
          return handleTriviaStartClick(interaction);
        }
        if (interaction.customId.startsWith('trivia_answer:')) {
          const { handleTriviaAnswerClick } = require('../modules/gaming/trivia');
          return handleTriviaAnswerClick(interaction);
        }
        if (interaction.customId.startsWith('boss_')) {
          const { handleBossButton } = require('../commands/boss');
          return handleBossButton(interaction);
        }
        if (interaction.customId === 'vault_start_quest') {
          if (!interaction.deferred && !interaction.replied) {
            try {
              await interaction.deferReply({ ephemeral: true });
            } catch (e) {
              logger.warn(`[INTERACTION] deferReply notice for vault_start_quest: ${e.message}`);
            }
          }

          try {
            const { handleStartQuest } = require('../modules/gaming/vault');
            const res = await handleStartQuest(interaction.user.id, interaction.guild.id);
            const content = res.message || '▶️ **Daily Quests Activated!**';
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content }).catch(() => {});
            } else {
              await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            }
          } catch (err) {
            logger.error('[INTERACTION] Error in vault_start_quest:', err.message || err);
          }
          return;
        }
        if (interaction.customId.startsWith('showcase_claim_')) {
          const { handleShowcaseClaim } = require('../modules/moderation/showcase');
          return handleShowcaseClaim(interaction);
        }
        if (interaction.customId.startsWith('showcase_feedback_')) {
          const { handleShowcaseFeedbackButton } = require('../modules/moderation/showcase');
          return handleShowcaseFeedbackButton(interaction);
        }
        if (interaction.customId.startsWith('tts_')) {
          const { handleTtsComponent } = require('../commands/tts');
          return handleTtsComponent(interaction);
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
        if (interaction.customId.startsWith('showcase_feedback_modal:')) {
          const { handleShowcaseFeedbackSubmit } = require('../modules/moderation/showcase');
          return handleShowcaseFeedbackSubmit(interaction);
        }
        if (interaction.customId.startsWith('lfg_modal:')) {
          const { handleLFGModalSubmit } = require('../modules/gaming/lfg');
          return handleLFGModalSubmit(interaction);
        }
        if (interaction.customId.startsWith('game_registration_modal:')) {
          const { handleKeyformModalSubmit } = require('../modules/moderation/keyform');
          return handleKeyformModalSubmit(interaction);
        }
        return;
      }

      // ─── String Select Menus ──────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('showcase_select_')) {
          const { handleShowcaseSelectMenu } = require('../modules/moderation/showcase');
          return handleShowcaseSelectMenu(interaction);
        }
        if (interaction.customId.startsWith('translate_select_')) {
          const { handleTranslationSelection } = require('../modules/utility/translator');
          return handleTranslationSelection(interaction);
        }
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
        if (interaction.customId.startsWith('tts_select:')) {
          const { handleTtsComponent } = require('../commands/tts');
          return handleTtsComponent(interaction);
        }
        return;
      }
    } catch (err) {
      logger.error('[INTERACTION] Handler error:', err);
      const content = '❌ An error occurred while processing this interaction.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
