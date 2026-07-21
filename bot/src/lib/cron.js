const cron = require('node-cron');
const logger = require('./logger');
const { supabase } = require('./supabase');

// ─── Import Feature Modules ────────────────────────────────────────────────────
const { runDailyDigest } = require('../modules/ai/digest');
const { checkYouTubeLive } = require('../modules/social/youtube');
const { pruneOldRecords } = require('../modules/system/pruner');
const { resetDailyQuests } = require('../modules/gaming/vault');
const { expireOldLFGSessions } = require('../modules/gaming/lfg');
const { loadBirthdayQueue, dispatchBirthdays } = require('../modules/social/birthdays');
const { checkAndProcessTrivia } = require('../modules/gaming/trivia');

/**
 * Initializes all scheduled cron jobs.
 * @param {import('discord.js').Client} client
 */
function initCrons(client) {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Manila';

  // ─── Daily Digest: Every day at configured time (default 08:00) ─────────────
  const [digestHour, digestMin] = (process.env.DIGEST_POST_TIME || '08:00').split(':');
  cron.schedule(
    `${digestMin} ${digestHour} * * *`,
    async () => {
      logger.info('[CRON] Running Daily Digest...');
      try {
        const { data: configs } = await supabase
          .from('guild_config')
          .select('guild_id')
          .eq('feature_key', 'digest')
          .eq('enabled', true);

        const guildIds = (configs || []).map(c => c.guild_id);
        if (guildIds.length === 0 && process.env.DISCORD_GUILD_ID) {
          guildIds.push(process.env.DISCORD_GUILD_ID);
        }

        for (const gId of guildIds) {
          try {
            await runDailyDigest(client, gId);
          } catch (err) {
            logger.error(`[CRON] Daily Digest failed for guild ${gId}:`, err.message);
          }
        }
      } catch (err) {
        logger.error('[CRON] Daily Digest scheduling failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── YouTube Live Check: Every 5 minutes ─────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkYouTubeLive(client);
    } catch (err) {
      logger.error('[CRON] YouTube check failed:', err.message);
    }
  });

  // ─── Daily Quest Reset: Every day at midnight ─────────────────────────────────
  cron.schedule(
    '0 0 * * *',
    async () => {
      logger.info('[CRON] Resetting daily quests...');
      try {
        await resetDailyQuests();
      } catch (err) {
        logger.error('[CRON] Quest reset failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── LFG Session Expiry: Every 10 minutes ─────────────────────────────────────
  cron.schedule('*/10 * * * *', async () => {
    try {
      await expireOldLFGSessions(client);
    } catch (err) {
      logger.error('[CRON] LFG expiry failed:', err.message);
    }
  });

  // ─── Data Pruning: Every day at 03:00 AM ─────────────────────────────────────
  cron.schedule(
    '0 3 * * *',
    async () => {
      logger.info('[CRON] Pruning old records...');
      try {
        await pruneOldRecords();
      } catch (err) {
        logger.error('[CRON] Pruning failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── Bot Health Heartbeat: Every 5 minutes ────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const guilds = client.guilds.cache.map(g => g.id);
      if (guilds.length === 0 && process.env.DISCORD_GUILD_ID) {
        guilds.push(process.env.DISCORD_GUILD_ID);
      }
      for (const guildId of guilds) {
        await supabase.from('bot_health').upsert(
          { guild_id: guildId, last_seen: new Date().toISOString() },
          { onConflict: 'guild_id' }
        );
      }
    } catch (err) {
      logger.error('[CRON] Health heartbeat failed:', err.message);
    }
  });

  // ─── Birthday Queue Loader: Every day at midnight ─────────────────────────
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await loadBirthdayQueue(client);
      } catch (err) {
        logger.error('[CRON] Birthday queue loading failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── Birthday Announcement Dispatcher: Every 5 minutes ────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await dispatchBirthdays(client);
    } catch (err) {
      logger.error('[CRON] Birthday dispatcher failed:', err.message);
    }
  });

  // ─── Trivia Scheduler: Every 5 minutes ──────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndProcessTrivia(client);
    } catch (err) {
      logger.error('[CRON] Trivia check failed:', err.message);
    }
  });

  logger.info('[CRON] All scheduled jobs initialized.');
}

module.exports = { initCrons };
