require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./lib/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    logger.info(`[DEPLOY] Queued: /${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;
    const deployGlobal = process.env.DEPLOY_GLOBAL === 'true';

    if (deployGlobal) {
      logger.info(`[DEPLOY] Registering ${commands.length} slash command(s) GLOBALLY...`);
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    } else {
      logger.info(`[DEPLOY] Registering ${commands.length} slash command(s) to guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    }

    logger.info('[DEPLOY] ✅ Slash commands registered successfully!');
  } catch (err) {
    logger.error('[DEPLOY] ❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
