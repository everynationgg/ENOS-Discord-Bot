const cron = require('node-cron');
const logger = require('./logger');
const { supabase } = require('./supabase');

// ─── Import Feature Modules ────────────────────────────────────────────────────
const { runDailyDigest } = require('../modules/ai/digest');
const { checkTikTokLive } = require('../modules/social/tiktok');
const { checkTwitchLive } = require('../modules/social/twitch');
const { pruneOldRecords } = require('../modules/system/pruner');
const { resetDailyQuests } = require('../modules/gaming/vault');
const { expireOldLFGSessions } = require('../modules/gaming/lfg');
const { loadBirthdayQueue, dispatchBirthdays } = require('../modules/social/birthdays');
const { checkAndProcessTrivia } = require('../modules/gaming/trivia');
const { checkAndDispatchDeals, cleanExpiredDeals } = require('../modules/gaming/freeDeals');

/**
 * Initializes all scheduled cron jobs.
 * @param {import('discord.js').Client} client
 */
function initCrons(client) {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Manila';

  // ─── Free Game & Deal Alerts: Every 30 minutes ────────────────────────────────
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { data: configs } = await supabase
        .from('guild_config')
        .select('guild_id')
        .eq('feature_key', 'free_game_alerts')
        .eq('enabled', true);

      for (const c of configs || []) {
        await checkAndDispatchDeals(client, c.guild_id);
      }
    } catch (err) {
      logger.error('[CRON] Free Game Alerts check failed:', err.message);
    }
  });

  // ─── Expired Deal Message Cleaner: Every 15 minutes ───────────────────────────
  cron.schedule('*/15 * * * *', async () => {
    try {
      await cleanExpiredDeals(client);
    } catch (err) {
      logger.error('[CRON] Expired deal message cleanup failed:', err.message);
    }
  });

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

  // ─── Twitch Live Check: Every 5 minutes ───────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkTwitchLive(client);
    } catch (err) {
      logger.error('[CRON] Twitch check failed:', err.message);
    }
  });

  // ─── TikTok Live Check: Every 5 minutes ───────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkTikTokLive(client);
    } catch (err) {
      logger.error('[CRON] TikTok check failed:', err.message);
    }
  });

  // ─── Initial Live Alert, Free Game Deal & Boss Canvas Checks on Startup ──────
  checkTwitchLive(client).catch((err) => logger.error('[CRON] Initial Twitch check failed:', err.message));
  checkTikTokLive(client).catch((err) => logger.error('[CRON] Initial TikTok check failed:', err.message));
  (async () => {
    try {
      const { data: configs } = await supabase
        .from('guild_config')
        .select('guild_id')
        .eq('feature_key', 'free_game_alerts')
        .eq('enabled', true);
      for (const c of configs || []) {
        await checkAndDispatchDeals(client, c.guild_id);
      }
    } catch (err) {
      logger.error('[CRON] Initial deals check failed:', err.message);
    }
  })();
  (async () => {
    try {
      const { spawnAndAnnounceWeeklyBoss } = require('../modules/gaming/boss');
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        await spawnAndAnnounceWeeklyBoss(client, guildId);
      }
    } catch (err) {
      logger.error('[CRON] Initial boss canvas sync failed:', err.message);
    }
  })();

  // ─── Daily Quest Reset: Every day at midnight ─────────────────────────────────
  cron.schedule(
    '0 0 * * *',
    async () => {
      logger.info('[CRON] Resetting daily quests and respawning Daily Quest Hub launchers...');
      try {
        await resetDailyQuests(client);
      } catch (err) {
        logger.error('[CRON] Quest reset failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── Saturday 23:59 GMT+8: Weekly Boss Conclude & Victory Banner Cron ──────
  cron.schedule(
    '59 23 * * 6',
    async () => {
      logger.info('[CRON] Concluding Weekly Boss battle & updating Victory/Final card for week...');
      try {
        const { concludeWeeklyBossBattle } = require('../modules/gaming/boss');
        const { data: configs } = await supabase
          .from('guild_config')
          .select('guild_id')
          .eq('enabled', true);

        for (const c of configs || []) {
          try {
            await concludeWeeklyBossBattle(c.guild_id, client);
          } catch (err) {
            logger.error(`[CRON] Weekly Boss conclude failed for guild ${c.guild_id}:`, err.message);
          }
        }
      } catch (err) {
        logger.error('[CRON] Weekly Boss conclude cron failed:', err.message);
      }
    },
    { timezone: tz }
  );

  // ─── Weekly Boss Reset & AI Lore Generation: Every Monday at 00:00 ─────────────
  cron.schedule(
    '0 0 * * 1',
    async () => {
      logger.info('[CRON] Resetting Weekly Boss & posting new week card...');
      try {
        const { spawnAndAnnounceWeeklyBoss } = require('../modules/gaming/boss');
        const { data: configs } = await supabase
          .from('guild_config')
          .select('guild_id')
          .eq('feature_key', 'weekly_boss')
          .eq('enabled', true);

        const guildIds = (configs || []).map(c => c.guild_id);
        if (guildIds.length === 0 && process.env.DISCORD_GUILD_ID) {
          guildIds.push(process.env.DISCORD_GUILD_ID);
        }

        for (const gId of guildIds) {
          try {
            await spawnAndAnnounceWeeklyBoss(client, gId, { forceNewPost: true });
          } catch (err) {
            logger.error(`[CRON] Weekly Boss spawn failed for guild ${gId}:`, err.message);
          }
        }
      } catch (err) {
        logger.error('[CRON] Weekly Boss cron failed:', err.message);
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

  // ─── Trivia Scheduler: Every minute ──────────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      await checkAndProcessTrivia(client);
    } catch (err) {
      logger.error('[CRON] Trivia check failed:', err.message);
    }
  });

  // ─── Pending Invite Maturity Check: Every day at 03:05 AM ─────────────────────
  cron.schedule(
    '5 3 * * *',
    async () => {
      try {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data: maturedInvites } = await supabase
          .from('member_invites')
          .select('id, inviter_id')
          .eq('status', 'pending')
          .lte('invited_account_created_at', oneYearAgo);

        if (maturedInvites && maturedInvites.length > 0) {
          const maturedIds = maturedInvites.map(i => i.id);
          await supabase
            .from('member_invites')
            .update({ status: 'valid' })
            .in('id', maturedIds);

          logger.info(`[CRON] Upgraded ${maturedIds.length} pending invites to valid!`);

          // Upgrade tiers for affected inviters across guilds
          const affectedInviters = [...new Set(maturedInvites.map(i => i.inviter_id))];
          for (const inviterId of affectedInviters) {
            for (const guild of client.guilds.cache.values()) {
              const { checkAndUpgradeUserTiers } = require('../modules/gaming/recruitment');
              await checkAndUpgradeUserTiers(guild, inviterId).catch(() => null);
            }
          }
        }
      } catch (err) {
        logger.error('[CRON] Pending invite maturity check failed:', err.message);
      }
    },
    { timezone: tz }
  );

  logger.info('[CRON] All scheduled jobs initialized.');
}

module.exports = { initCrons };
