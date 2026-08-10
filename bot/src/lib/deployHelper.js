const { REST, Routes } = require('discord.js');
const logger = require('./logger');

/**
 * Registers application commands globally and for all currently joined guilds.
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

    // 1. Global Registration (makes commands available in ALL invited servers)
    logger.info(`[AUTO-DEPLOY] Registering ${commandData.length} command(s) GLOBALLY...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    logger.info('[AUTO-DEPLOY] ✅ Global application commands registered successfully.');

    // 2. Immediate Guild Registration for all currently joined guilds
    const guilds = await client.guilds.fetch().catch(() => null);
    if (guilds) {
      for (const [gId] of guilds) {
        await rest.put(Routes.applicationGuildCommands(clientId, gId), { body: commandData }).catch((err) => {
          logger.warn(`[AUTO-DEPLOY] Could not register guild commands for ${gId}: ${err.message}`);
        });
      }
      logger.info(`[AUTO-DEPLOY] ✅ Instant guild commands registered across ${guilds.size} server(s).`);
    }
  } catch (err) {
    logger.error('[AUTO-DEPLOY] ❌ Startup command registration error:', err.message);
  }
}

/**
 * Registers application commands instantly for a newly joined guild.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
async function registerCommandsForGuild(client, guildId) {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user.id;
    if (!token || !clientId || !guildId) return;

    const rest = new REST({ version: '10' }).setToken(token);
    const commandData = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());

    if (commandData.length === 0) return;

    logger.info(`[AUTO-DEPLOY] Registering ${commandData.length} command(s) for newly joined guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
    logger.info(`[AUTO-DEPLOY] ✅ Instant commands registered for new guild ${guildId}!`);
  } catch (err) {
    logger.error(`[AUTO-DEPLOY] ❌ Failed to register commands for new guild ${guildId}:`, err.message);
  }
}

module.exports = {
  registerCommandsOnStartup,
  registerCommandsForGuild,
};
