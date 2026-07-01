require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadEvents } = require('./lib/loader');
const { loadCommands } = require('./lib/loader');
const { initCrons } = require('./lib/cron');
const logger = require('./lib/logger');

// ─── Client Setup ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
  ],
});

// ─── Command & Event Collections ──────────────────────────────────────────────
client.commands = new Collection();
client.cooldowns = new Collection();

// ─── Load Events & Commands ───────────────────────────────────────────────────
(async () => {
  try {
    await loadCommands(client);
    await loadEvents(client);
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Bot login sequence initiated.');
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
})();

// ─── Initialize Cron Jobs after ready ─────────────────────────────────────────
client.once('ready', async () => {
  initCrons(client);
  logger.info(`[READY] Logged in as ${client.user.tag}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = client;
