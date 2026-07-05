const { Events } = require('discord.js');
const { awardMessageCoins } = require('../modules/gaming/vault');
const { isFeatureEnabled, getFeatureConfig } = require('../lib/supabase');
const { handleMessageAutoReactions } = require('../modules/social/autoReaction');
const { handleHelpDeskChatMessage } = require('../modules/moderation/helpdesk');

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

    // AI Support Help Desk: process support thread conversations
    if (message.channel.isThread()) {
      const helpDeskEnabled = await isFeatureEnabled(guildId, 'help_desk');
      if (helpDeskEnabled) {
        const config = await getFeatureConfig(guildId, 'help_desk');
        const launcherChannelId = config?.config?.launcher_channel_id;

        if (launcherChannelId && message.channel.parentId === launcherChannelId) {
          await handleHelpDeskChatMessage(message).catch(() => {});
          return; // Skip vault coins and other message listeners in support rooms
        }
      }
    }

    // Vault Economy: award coins for messages
    const vaultEnabled = await isFeatureEnabled(guildId, 'vault');
    if (vaultEnabled) {
      await awardMessageCoins(message.author.id, guildId, message.guild).catch(() => {});
    }

    // Auto-Reactions: react to trigger words
    const reactionsEnabled = await isFeatureEnabled(guildId, 'auto_reactions');
    if (reactionsEnabled) {
      await handleMessageAutoReactions(message).catch(() => {});
    }
  },
};
