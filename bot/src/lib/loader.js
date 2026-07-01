const path = require('path');
const fs = require('fs');
const { Collection } = require('discord.js');
const logger = require('./logger');

/**
 * Loads all event handler files from src/events/ and registers them on the client.
 * @param {import('discord.js').Client} client
 */
async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (!event.name || typeof event.execute !== 'function') {
      logger.warn(`[LOADER] Skipping invalid event file: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    logger.info(`[LOADER] Loaded event: ${event.name}`);
  }
}

/**
 * Loads all command files from src/commands/ and registers them into client.commands.
 * @param {import('discord.js').Client} client
 */
async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || typeof command.execute !== 'function') {
      logger.warn(`[LOADER] Skipping invalid command file: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);
    logger.info(`[LOADER] Loaded command: /${command.data.name}`);
  }
}

module.exports = { loadEvents, loadCommands };
