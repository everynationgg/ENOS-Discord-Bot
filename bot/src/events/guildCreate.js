const { Events } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');
const { registerCommandsForGuild } = require('../lib/deployHelper');

module.exports = {
  name: Events.GuildCreate,
  /**
   * @param {import('discord.js').Guild} guild
   * @param {import('discord.js').Client} client
   */
  async execute(guild, client) {
    logger.info(`[GUILD_CREATE] ENOS joined new server: ${guild.name} (${guild.id})`);
    
    // 1. Insert default server configuration row
    const { error } = await supabase.from('guild_settings').upsert(
      {
        guild_id: guild.id,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id' }
    );

    if (error) {
      logger.error(`[GUILD_CREATE] Failed to initialize settings for guild ${guild.id}:`, error.message);
    } else {
      logger.info(`[GUILD_CREATE] Successfully initialized default settings for guild ${guild.id}`);
    }

    // 2. Register slash commands & Apps context menu ("Translate Message") instantly for new guild
    if (client) {
      await registerCommandsForGuild(client, guild.id);
    }
  },
};
