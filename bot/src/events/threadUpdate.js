const { Events } = require('discord.js');
const { closeAndReportHelpDeskSession } = require('../modules/moderation/helpdesk');
const logger = require('../lib/logger');

module.exports = {
  name: Events.ThreadUpdate,
  /**
   * @param {import('discord.js').ThreadChannel} oldThread
   * @param {import('discord.js').ThreadChannel} newThread
   */
  async execute(oldThread, newThread) {
    // If a helpdesk support thread was archived (e.g. by Discord inactivity or staff), auto-generate report
    if (!oldThread.archived && newThread.archived && newThread.name.startsWith('💬-')) {
      logger.info(`[HELPDESK] Support thread ${newThread.name} (${newThread.id}) was archived. Generating closing transcript report...`);
      try {
        // Unarchive momentarily if needed to read full messages and dispatch report cleanly
        await newThread.setArchived(false).catch(() => {});
        await closeAndReportHelpDeskSession(newThread, 'Auto-Archived by Inactivity');
      } catch (err) {
        logger.error(`[HELPDESK] Failed to handle archived thread report: ${err.message}`);
      }
    }
  },
};
