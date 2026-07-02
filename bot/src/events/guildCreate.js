const { Events } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildCreate,
  /**
   * @param {import('discord.js').Guild} guild
   */
  async execute(guild) {
    logger.info(`[GUILD_CREATE] Joined new guild: ${guild.name} (${guild.id})`);
    
    // Insert default server configuration row to satisfy references and initialize settings
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
  },
};
