const { Events } = require('discord.js');
const { postLandingMessage } = require('../modules/moderation/gatekeeper');
const { getFeatureConfig } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  /**
   * @param {import('discord.js').GuildMember} member
   * @param {import('discord.js').Client} client
   */
  async execute(member, client) {
    if (member.user.bot) return;

    const guildId = member.guild.id;
    const featureConfig = await getFeatureConfig(guildId, 'gatekeeper');

    if (!featureConfig?.enabled) return;

    const { config } = featureConfig;
    const entryRoleId = config?.entry_role_id;

    // Assign the restricted entry role
    if (entryRoleId) {
      try {
        await member.roles.add(entryRoleId);
        logger.info(`[GATEKEEPER] Assigned entry role to ${member.user.tag}`);
      } catch (err) {
        logger.error(`[GATEKEEPER] Failed to assign entry role to ${member.user.tag}:`, err.message);
      }
    }
  },
};
