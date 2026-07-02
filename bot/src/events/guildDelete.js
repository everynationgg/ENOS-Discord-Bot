const { Events } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildDelete,
  /**
   * @param {import('discord.js').Guild} guild
   */
  async execute(guild) {
    logger.info(`[GUILD_DELETE] Left/Kicked from guild: ${guild.name} (${guild.id})`);
    
    // Toggle active status to false
    const { error } = await supabase
      .from('guild_settings')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guild.id);

    if (error) {
      logger.error(`[GUILD_DELETE] Failed to update status for guild ${guild.id}:`, error.message);
    } else {
      logger.info(`[GUILD_DELETE] Marked guild ${guild.id} as inactive in settings`);
    }
  },
};
