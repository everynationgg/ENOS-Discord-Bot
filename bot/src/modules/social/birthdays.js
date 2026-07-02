const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const tz = process.env.BOT_TIMEZONE || 'Asia/Manila';

/**
 * Gets the current date formatted for a specific offset in the bot timezone.
 * @param {number} daysAhead 
 * @returns {{ mmDd: string, yyyyMmDd: string }}
 */
function getTargetDates(daysAhead = 0) {
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  date.setDate(date.getDate() + daysAhead);
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  return {
    mmDd: `${mm}-${dd}`,
    yyyyMmDd: `${yyyy}-${mm}-${dd}`
  };
}

/**
 * Cron Job 1: Queue Loader
 * Runs daily at 12:00 AM (midnight) or manual trigger.
 * Scans member_birthdays for birthdays in 3 days, loads into queue.
 */
async function loadBirthdayQueue(client) {
  logger.info('[BIRTHDAYS] Running Queue Loader...');
  try {
    // 1. Fetch active servers where birthday is enabled
    const { data: activeGuilds, error: guildError } = await supabase
      .from('guild_settings')
      .select('guild_id')
      .eq('birthday_enabled', true);

    if (guildError) throw new Error(guildError.message);
    if (!activeGuilds || activeGuilds.length === 0) {
      logger.info('[BIRTHDAYS] No active guilds with birthday system enabled.');
      return;
    }

    // 2. We look for birthdays matching MM-DD of 3 days from now
    const { mmDd, yyyyMmDd } = getTargetDates(3);
    logger.info(`[BIRTHDAYS] Scanning member birthdays matching date: ${mmDd} for queue target: ${yyyyMmDd}`);

    for (const guild of activeGuilds) {
      const guildId = guild.guild_id;

      // Scan birthdays for this server
      const { data: birthdays, error: bdayError } = await supabase
        .from('member_birthdays')
        .select('user_id, ign')
        .eq('guild_id', guildId)
        .eq('birth_date', mmDd);

      if (bdayError) {
        logger.error(`[BIRTHDAYS] Error fetching birthdays for guild ${guildId}:`, bdayError.message);
        continue;
      }

      if (!birthdays || birthdays.length === 0) continue;

      for (const bday of birthdays) {
        // Insert into birthday_queue if not already exists
        const { error: insertError } = await supabase
          .from('birthday_queue')
          .insert({
            guild_id: guildId,
            user_id: bday.user_id,
            ign: bday.ign || null,
            target_date: yyyyMmDd,
            scratchpad_text: '', // Start empty
            is_approved: false,
            is_sent: false,
          });

        if (insertError) {
          // If duplicate key error (UNIQUE constraint violated), just ignore
          if (insertError.code === '23505') {
            logger.debug(`[BIRTHDAYS] Queue item already exists for user ${bday.user_id} in guild ${guildId}`);
          } else {
            logger.error(`[BIRTHDAYS] Error queuing birthday for user ${bday.user_id}:`, insertError.message);
          }
        } else {
          logger.info(`[BIRTHDAYS] Queued upcoming birthday for user ${bday.user_id} in guild ${guildId} on ${yyyyMmDd}`);
        }
      }
    }
  } catch (err) {
    logger.error('[BIRTHDAYS] Queue Loader failed:', err);
  }
}

/**
 * Cron Job 2: Discord Dispatcher
 * Runs hourly/frequently. Checks if current time is past announcement_time
 * and dispatches approved, unsent greetings for today.
 */
async function dispatchBirthdays(client) {
  try {
    const { mmDd, yyyyMmDd } = getTargetDates(0); // Today's target date in YYYY-MM-DD
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    // 1. Fetch active servers with configuration
    const { data: guilds, error: guildError } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('birthday_enabled', true);

    if (guildError) throw guildError;
    if (!guilds || guilds.length === 0) return;

    for (const guild of guilds) {
      const guildId = guild.guild_id;
      const channelId = guild.birthday_channel_id;
      const timeStr = guild.announcement_time || '09:00';

      if (!channelId) {
        logger.warn(`[BIRTHDAYS] Birthday channel is not configured for guild ${guildId}. Skipping.`);
        continue;
      }

      // Check if current time is >= announcement_time
      const [postHour, postMin] = timeStr.split(':').map(Number);
      const isPastReleaseTime = currentHour > postHour || (currentHour === postHour && currentMin >= postMin);

      if (!isPastReleaseTime) {
        continue;
      }

      // Query approved, unsent queue items for today
      const { data: queueItems, error: queueError } = await supabase
        .from('birthday_queue')
        .select('*')
        .eq('guild_id', guildId)
        .eq('target_date', yyyyMmDd)
        .eq('is_approved', true)
        .eq('is_sent', false);

      if (queueError) {
        logger.error(`[BIRTHDAYS] Error fetching approved birthdays for guild ${guildId}:`, queueError.message);
        continue;
      }

      if (!queueItems || queueItems.length === 0) continue;

      // Try fetching target Discord channel
      const discordGuild = await client.guilds.fetch(guildId).catch(() => null);
      if (!discordGuild) {
        logger.error(`[BIRTHDAYS] Guild ${guildId} not found in client cache.`);
        continue;
      }

      const channel = await discordGuild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        logger.error(`[BIRTHDAYS] Text channel ${channelId} not found or is invalid in guild ${guildId}`);
        continue;
      }

      for (const item of queueItems) {
        const text = item.scratchpad_text?.trim();
        if (!text) {
          logger.warn(`[BIRTHDAYS] Approved greeting for ${item.user_id} is empty. Skipping dispatch.`);
          continue;
        }

        try {
          // Send message to public announcement channel
          await channel.send({ content: text });
          logger.info(`[BIRTHDAYS] Sent birthday greeting for user ${item.user_id} to channel ${channelId}`);

          // Mark as sent in database
          await supabase
            .from('birthday_queue')
            .update({ is_sent: true })
            .eq('id', item.id);

        } catch (sendErr) {
          logger.error(`[BIRTHDAYS] Failed to send birthday message for user ${item.user_id}:`, sendErr.message);
        }
      }
    }
  } catch (err) {
    logger.error('[BIRTHDAYS] Dispatcher failed:', err);
  }
}

module.exports = {
  loadBirthdayQueue,
  dispatchBirthdays,
};
