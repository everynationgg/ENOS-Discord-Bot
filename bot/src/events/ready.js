const { Events } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * @param {import('discord.js').Client} client
   */
  async execute(client) {
    logger.info(`[READY] Bot online as ${client.user.tag} (${client.user.id})`);
    logger.info(`[READY] Serving ${client.guilds.cache.size} guild(s)`);

    // Update health heartbeat on startup
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      await supabase.from('bot_health').upsert(
        {
          guild_id: guildId,
          last_seen: new Date().toISOString(),
          uptime_start: new Date().toISOString(),
          bot_version: require('../../package.json').version,
        },
        { onConflict: 'guild_id' }
      );
    }

    // Set rich presence
    client.user.setPresence({
      activities: [{ name: 'Every Nation 🏰', type: 0 }],
      status: 'online',
    });
  },
};
