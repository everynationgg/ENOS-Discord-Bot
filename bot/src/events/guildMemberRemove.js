const { Events } = require('discord.js');
const { supabase, logBotEvent } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  /**
   * @param {import('discord.js').GuildMember} member
   * @param {import('discord.js').Client} client
   */
  async execute(member, client) {
    if (member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.user.id;

    try {
      // Delete the verified member record if it exists
      const { data, error } = await supabase
        .from('verified_members')
        .delete()
        .eq('discord_id', userId)
        .eq('guild_id', guildId)
        .select();

      if (error) {
        logger.error(`[GATEKEEPER] Failed to delete verified member record for leaving member ${member.user.tag}:`, error.message);
      } else if (data && data.length > 0) {
        logger.info(`[GATEKEEPER] Deleted verification record for leaving member ${member.user.tag}`);
        await logBotEvent(guildId, 'unverify_on_leave', userId, { tag: member.user.tag });
      }
    } catch (err) {
      logger.error(`[GATEKEEPER] Error deleting verification record for leaving member ${member.user.tag}:`, err.message);
    }
  },
};
