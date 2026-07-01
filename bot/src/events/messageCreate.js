const { Events } = require('discord.js');
const { awardMessageCoins } = require('../modules/gaming/vault');
const { isFeatureEnabled } = require('../lib/supabase');

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

    // Vault Economy: award coins for messages
    const vaultEnabled = await isFeatureEnabled(guildId, 'vault');
    if (vaultEnabled) {
      await awardMessageCoins(message.author.id, guildId, message.guild).catch(() => {});
    }
  },
};
