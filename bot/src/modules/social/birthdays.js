const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const tz = process.env.BOT_TIMEZONE || 'Asia/Manila';

/**
 * Gets the current date and time formatted for a specific offset in the bot timezone.
 * @param {number} daysAhead 
 * @returns {{ mmDd: string, yyyyMmDd: string, hour: number, minute: number }}
 */
function getTargetDates(daysAhead = 0) {
  let target = new Date();
  if (daysAhead !== 0) {
    target = new Date(Date.now() + daysAhead * 86400000);
  }
  const options = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(target);
  const map = parts.reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  return {
    mmDd: `${map.month}-${map.day}`,
    yyyyMmDd: `${map.year}-${map.month}-${map.day}`,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
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

    // 2. We look for birthdays matching MM-DD for Today (0d), Tomorrow (1d), 2d, and 3d ahead
    for (let daysAhead = 0; daysAhead <= 3; daysAhead++) {
      const { mmDd, yyyyMmDd } = getTargetDates(daysAhead);
      logger.info(`[BIRTHDAYS] Scanning member birthdays matching date: ${mmDd} (+${daysAhead}d) for queue target: ${yyyyMmDd}`);

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
          // Verify member is still in the Discord server
          const discordGuild = await client.guilds.fetch(guildId).catch(() => null);
          if (discordGuild) {
            let memberNotFound = false;
            try {
              const member = await discordGuild.members.fetch(bday.user_id);
              if (!member) memberNotFound = true;
            } catch (fetchErr) {
              // Only prune if Discord explicitly reports Unknown Member (Error 10007)
              if (fetchErr.code === 10007) {
                memberNotFound = true;
              }
            }

            if (memberNotFound) {
              logger.info(`[BIRTHDAYS] Member ${bday.user_id} has left guild ${guildId}. Pruning birthday record.`);
              await supabase.from('member_birthdays').delete().eq('guild_id', guildId).eq('user_id', bday.user_id);
              await supabase.from('birthday_queue').delete().eq('guild_id', guildId).eq('user_id', bday.user_id);
              continue;
            }
          }

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
              is_dismissed: false,
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
    }

    // Run upcoming admin alert checks
    await checkUpcomingBirthdayAlerts(client);
  } catch (err) {
    logger.error('[BIRTHDAYS] Queue Loader failed:', err);
  }
}

/**
 * Checks for upcoming birthdays and sends 1-day ahead reminders (and same-day catch-up) to admins.
 * Fully idempotent: Checks birthday_queue.admin_alert_sent and bot_event_logs before dispatching.
 * @param {import('discord.js').Client} client
 * @returns {Promise<{ alertsSent: number }>}
 */
async function checkUpcomingBirthdayAlerts(client) {
  let alertsSent = 0;
  try {
    const { data: activeGuilds, error: guildError } = await supabase
      .from('guild_settings')
      .select('guild_id, birthday_channel_id, log_channel_id')
      .eq('birthday_enabled', true);

    if (guildError || !activeGuilds || activeGuilds.length === 0) return { alertsSent: 0 };

    const { EmbedBuilder } = require('discord.js');

    // Check tomorrow (offset 1) for standard 1-day ahead reminder, and today (offset 0) for catch-up
    for (const offset of [1, 0]) {
      const { mmDd, yyyyMmDd: targetDate } = getTargetDates(offset);

      for (const guild of activeGuilds) {
        const guildId = guild.guild_id;

        const { data: bdays, error: bdayErr } = await supabase
          .from('member_birthdays')
          .select('user_id, ign')
          .eq('guild_id', guildId)
          .eq('birth_date', mmDd);

        if (bdayErr || !bdays || bdays.length === 0) continue;

        const { data: gConfig } = await supabase
          .from('guild_config')
          .select('config')
          .eq('guild_id', guildId)
          .eq('feature_key', 'birthday')
          .maybeSingle();

        const adminChannelId = gConfig?.config?.admin_channel_id
          || gConfig?.config?.notification_channel_id
          || guild.log_channel_id
          || guild.birthday_channel_id;

        if (!adminChannelId) continue;

        const discordGuild = await client.guilds.fetch(guildId).catch(() => null);
        if (!discordGuild) continue;

        const adminChan = await discordGuild.channels.fetch(adminChannelId).catch(() => null);
        if (!adminChan || !adminChan.isTextBased()) continue;

        for (const bday of bdays) {
          // Check birthday_queue item
          const { data: queueItem } = await supabase
            .from('birthday_queue')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', bday.user_id)
            .eq('target_date', targetDate)
            .maybeSingle();

          // Skip if dismissed or already sent publicly
          if (queueItem?.is_dismissed || queueItem?.is_sent) continue;

          // Check if admin alert was already sent via column
          if (queueItem?.admin_alert_sent) continue;

          // Also check bot_event_logs for permanent idempotency
          const { data: existingLog } = await supabase
            .from('bot_event_logs')
            .select('id')
            .eq('guild_id', guildId)
            .eq('event_type', 'birthday_admin_alert')
            .filter('details->>target_date', 'eq', targetDate)
            .filter('details->>user_id', 'eq', bday.user_id)
            .limit(1);

          if (existingLog && existingLog.length > 0) {
            // Already alerted in logs; backfill queueItem if needed
            if (queueItem?.id && !queueItem.admin_alert_sent) {
              try {
                await supabase.from('birthday_queue').update({ admin_alert_sent: true }).eq('id', queueItem.id);
              } catch {}
            }
            continue;
          }

          const isApproved = queueItem?.is_approved ?? false;
          const hasCustomNotes = Boolean(queueItem?.scratchpad_text?.trim());

          const statusText = isApproved
            ? '✅ **Approved & Scheduled** (Ready to release on birthday)'
            : hasCustomNotes
            ? '📝 **Draft Ready** (Needs final approval on Dashboard)'
            : '⚠️ **Needs Review** (Visit Dashboard to customize greeting)';

          const title = offset === 1 ? '🎂 Upcoming Birthday Tomorrow!' : '🎂 Community Birthday Today!';
          const timingDesc = offset === 1
            ? `🎉 **Tomorrow (${targetDate})** is <@${bday.user_id}>'s birthday!`
            : `🎉 **Today (${targetDate})** is <@${bday.user_id}>'s birthday!`;

          const alertEmbed = new EmbedBuilder()
            .setColor(isApproved ? 0x10B981 : 0xF43F5E)
            .setTitle(title)
            .setDescription(
              `${timingDesc}\n\n` +
              `• **Status**: ${statusText}\n` +
              (bday.ign ? `• **IGN**: \`${bday.ign}\`\n` : '') +
              (hasCustomNotes ? `• **Greeting Preview**:\n> *${queueItem.scratchpad_text.slice(0, 150)}${queueItem.scratchpad_text.length > 150 ? '...' : ''}*\n\n` : '\n') +
              `Please review, transform with AI, or authorize greetings on the **ENOS Dashboard** under Social ➜ Birthday Queue.`
            )
            .setFooter({ text: 'ENOS Birthday System • Admin Alert' })
            .setTimestamp();

          await adminChan.send({ embeds: [alertEmbed] }).catch((e) =>
            logger.error(`[BIRTHDAYS] Failed to send admin birthday alert: ${e.message}`)
          );
          logger.info(`[BIRTHDAYS] Sent upcoming admin birthday alert for ${bday.user_id} in channel ${adminChannelId}`);
          alertsSent++;

          // Mark as sent in birthday_queue (defensive catch in case migration 027 isn't applied yet)
          if (queueItem?.id) {
            try {
              await supabase
                .from('birthday_queue')
                .update({ admin_alert_sent: true })
                .eq('id', queueItem.id);
            } catch (queueUpdateErr) {
              logger.debug(`[BIRTHDAYS] Note: Could not update admin_alert_sent on birthday_queue: ${queueUpdateErr.message}`);
            }
          }

          // Always log to bot_event_logs for permanent idempotency
          try {
            await supabase
              .from('bot_event_logs')
              .insert({
                guild_id: guildId,
                event_type: 'birthday_admin_alert',
                discord_id: bday.user_id,
                details: {
                  user_id: bday.user_id,
                  ign: bday.ign || null,
                  target_date: targetDate,
                  offset,
                  is_approved: isApproved,
                  channel_id: adminChannelId,
                },
              });
          } catch (logErr) {
            logger.warn(`[BIRTHDAYS] Could not log birthday_admin_alert: ${logErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    logger.error('[BIRTHDAYS] checkUpcomingBirthdayAlerts failed:', err);
  }
  return { alertsSent };
}

/**
 * Cron Job 2: Discord Dispatcher
 * Runs hourly/frequently. Checks if current time is past announcement_time
 * and dispatches approved, unsent greetings for today.
 */
async function dispatchBirthdays(client) {
  try {
    const { yyyyMmDd, hour: currentHour, minute: currentMin } = getTargetDates(0); // Today's target date and current time

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

      // Query approved, unsent, active queue items for today
      const { data: queueItems, error: queueError } = await supabase
        .from('birthday_queue')
        .select('*')
        .eq('guild_id', guildId)
        .eq('target_date', yyyyMmDd)
        .or('is_dismissed.is.null,is_dismissed.eq.false')
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
  checkUpcomingBirthdayAlerts,
  dispatchBirthdays,
};
