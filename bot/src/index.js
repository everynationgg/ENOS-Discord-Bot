require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const { loadEvents } = require('./lib/loader');
const { loadCommands } = require('./lib/loader');
/**
 * ENOS Discord Bot Main Entrypoint
 * RPG 5-Stat Tree System v1.1.0
 */
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
    Partials.Reaction,
    Partials.User,
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

// ─── Initialize Cron Jobs, Voice Herald Sub-Bot & Realtime Listeners after ready ─
client.once(Events.ClientReady, async () => {
  initCrons(client);
  const { initVoiceBot } = require('./modules/social/tts');
  initVoiceBot(client);

  // Real-Time Supabase Listener: Automatically render full Arena Canvas Card when boss changes
  try {
    const { supabase } = require('./lib/supabase');
    const { spawnAndAnnounceWeeklyBoss } = require('./modules/gaming/boss');

    let lastBossRealtimeTrigger = 0;

    supabase
      .channel('realtime_boss_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boss_seasons' },
        async (payload) => {
          const now = Date.now();
          if (now - lastBossRealtimeTrigger < 5000) {
            logger.info('[REALTIME BOSS] Debouncing rapid realtime event...');
            return;
          }
          lastBossRealtimeTrigger = now;

          logger.info('[REALTIME BOSS] Detected boss season change:', payload.new?.boss_name);
          const guildId = payload.new?.guild_id || process.env.DISCORD_GUILD_ID;
          if (guildId) {
            await spawnAndAnnounceWeeklyBoss(client, guildId);
          }
        }
      )
      .subscribe();
    logger.info('[REALTIME BOSS] Subscribed to boss_seasons changes.');
    const { postMasterAchievementCard } = require('./modules/gaming/recruitment');

    supabase
      .channel('realtime_system_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_logs' },
        async (payload) => {
          if (payload.new?.event_type === 'achievement_dispatch_card') {
            logger.info('[REALTIME LOGS] Dispatching Master Achievement Card to channel:', payload.new.payload?.channel_id);
            const channelId = payload.new.payload?.channel_id;
            const guildId = process.env.DISCORD_GUILD_ID;
            if (channelId) {
              await postMasterAchievementCard(client, guildId, channelId).catch((err) =>
                logger.error('[REALTIME LOGS] Master card dispatch failed:', err)
              );
            }
          }
        }
      )
      .subscribe();
    logger.info('[REALTIME LOGS] Subscribed to system_logs dispatch events.');
  } catch (err) {
    logger.error('[REALTIME] Realtime subscription warning:', err.message);
  }

  logger.info(`[READY] Logged in as ${client.user.tag}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// ─── Global Error Handling & Safety ───────────────────────────────────────────
client.on('error', (err) => {
  logger.error('[DISCORD CLIENT ERROR]', err);
});

process.on('uncaughtException', (err) => {
  logger.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[UNHANDLED REJECTION] at:', promise, 'reason:', reason);
});

module.exports = client;
