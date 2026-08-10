const { REST, Routes } = require('discord.js');
const logger = require('./logger');

/**
 * Registers application commands globally and clears old guild-level command overrides to prevent duplicates.
 * @param {import('discord.js').Client} client
 */
async function registerCommandsOnStartup(client) {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user.id;
    if (!token || !clientId) return;

    const rest = new REST({ version: '10' }).setToken(token);
    const commandData = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());

    if (commandData.length === 0) {
      logger.warn('[AUTO-DEPLOY] No loaded commands found to register.');
      return;
    }

    // 1. Global Registration (makes commands available in ALL invited servers cleanly without duplicates)
    logger.info(`[AUTO-DEPLOY] Registering ${commandData.length} command(s) GLOBALLY...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    logger.info('[AUTO-DEPLOY] ✅ Global application commands registered successfully.');

    // 2. Clear old guild-level overrides for all currently joined guilds so Discord doesn't show duplicate commands in Apps context menu
    const guilds = await client.guilds.fetch().catch(() => null);
    if (guilds) {
      for (const [gId] of guilds) {
        await rest.put(Routes.applicationGuildCommands(clientId, gId), { body: [] }).catch((err) => {
          logger.warn(`[AUTO-DEPLOY] Could not clear guild command overrides for ${gId}: ${err.message}`);
        });
      }
      logger.info(`[AUTO-DEPLOY] ✅ Cleared old guild command overrides across ${guilds.size} server(s) to eliminate duplicates.`);
    }
  } catch (err) {
    logger.error('[AUTO-DEPLOY] ❌ Startup command registration error:', err.message);
  }
}

/**
 * Ensures global registration is active and clears guild-level command overrides for a newly joined guild.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
async function registerCommandsForGuild(client, guildId) {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user.id;
    if (!token || !clientId || !guildId) return;

    const rest = new REST({ version: '10' }).setToken(token);
    logger.info(`[AUTO-DEPLOY] Clearing guild-level command overrides for newly joined guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    logger.info(`[AUTO-DEPLOY] ✅ Clean global commands enabled for new guild ${guildId}!`);
  } catch (err) {
    logger.error(`[AUTO-DEPLOY] ❌ Failed to clear guild command overrides for new guild ${guildId}:`, err.message);
  }
}

module.exports = {
  registerCommandsOnStartup,
  registerCommandsForGuild,
};
