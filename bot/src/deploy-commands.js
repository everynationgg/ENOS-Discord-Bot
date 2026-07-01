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
    logger.info(`[DEPLOY] Registering ${commands.length} slash command(s) to guild ${process.env.DISCORD_GUILD_ID}...`);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );

    logger.info('[DEPLOY] ✅ Slash commands registered successfully!');
  } catch (err) {
    logger.error('[DEPLOY] ❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
