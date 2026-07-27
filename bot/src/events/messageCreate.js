const { Events } = require('discord.js');
const { awardMessageCoins } = require('../modules/gaming/vault');
const { isFeatureEnabled, getFeatureConfig } = require('../lib/supabase');
const { handleMessageAutoReactions } = require('../modules/social/autoReaction');
const { handleHelpDeskChatMessage } = require('../modules/moderation/helpdesk');
const logger = require('../lib/logger');

module.exports = {
  name: Events.MessageCreate,
  /**
   * @param {import('discord.js').Message} message
   * @param {import('discord.js').Client} client
   */
  async execute(message, client) {
    // Ignore bots, DMs, system messages
    if (message.author.bot || !message.guild || message.system) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    logger.info(`[VAULT] messageCreate fired: user=${userId} guild=${guildId} content="${message.content.substring(0, 30)}"`);

    // AI Support Help Desk: process support thread conversations
    if (message.channel.isThread()) {
      const helpDeskEnabled = await isFeatureEnabled(guildId, 'help_desk');
      if (helpDeskEnabled) {
        const config = await getFeatureConfig(guildId, 'help_desk');
        const launcherChannelId = config?.config?.launcher_channel_id;

        if (launcherChannelId && message.channel.parentId === launcherChannelId) {
          const { handleAIChatQuest } = require('../modules/gaming/vault');
          await handleAIChatQuest(message.author.id, guildId, message.guild).catch(() => {});
          await handleHelpDeskChatMessage(message).catch(() => {});
          return; // Skip vault coins and other message listeners in support rooms
        }
      }
    }

    // AI Bot Mention Check (Quest 7: AI Chat)
    if (client.user && message.mentions.has(client.user.id)) {
      const { handleAIChatQuest } = require('../modules/gaming/vault');
      await handleAIChatQuest(message.author.id, guildId, message.guild).catch(() => {});
    }

    // Vault Economy: award coins for messages
    const vaultEnabled = await isFeatureEnabled(guildId, 'vault');
    logger.info(`[VAULT] vault feature enabled=${vaultEnabled} for guild=${guildId}`);
    if (vaultEnabled) {
      await awardMessageCoins(message.author.id, guildId, message.guild).catch((err) => {
        logger.error(`[VAULT] awardMessageCoins error: ${err.message}`);
      });
    }

    // Auto-Reactions: react to trigger words
    const reactionsEnabled = await isFeatureEnabled(guildId, 'auto_reactions');
    if (reactionsEnabled) {
      await handleMessageAutoReactions(message).catch(() => {});
    }

    // EN TTS: Queue text message for voice playback if active in VC text chat
    const { queueTextMessage } = require('../modules/social/tts');
    queueTextMessage(guildId, message.channel.id, message.content);
  },
};
