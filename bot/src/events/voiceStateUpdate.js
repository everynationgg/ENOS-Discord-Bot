const { Events } = require('discord.js');
const { handleVoiceJoin, handleVoiceLeave } = require('../modules/gaming/vault');
const { isFeatureEnabled } = require('../lib/supabase');
const logger = require('../lib/logger');

// Track when each user joined a voice channel (for duration calculation)
const voiceJoinTimes = new Map();
let isHeartbeatRunning = false;

/**
 * Periodically flushes elapsed voice minutes to database every 1 minute
 * for all members currently sitting in voice channels.
 * @param {import('discord.js').Client} client
 */
function startVoiceHeartbeat(client) {
  if (isHeartbeatRunning) return;
  isHeartbeatRunning = true;

  setInterval(async () => {
    try {
      const now = Date.now();

      for (const guild of client.guilds.cache.values()) {
        const vaultEnabled = await isFeatureEnabled(guild.id, 'vault').catch(() => false);
        if (!vaultEnabled) continue;

        for (const channel of guild.channels.cache.values()) {
          if (!channel.isVoiceBased() || !channel.members) continue;

          for (const member of channel.members.values()) {
            if (member.user.bot) continue;

            const key = `${guild.id}:${member.id}`;
            const joinTime = voiceJoinTimes.get(key);

            if (!joinTime) {
              voiceJoinTimes.set(key, now);
              continue;
            }

            const elapsedMinutes = Math.floor((now - joinTime) / 60000);
            if (elapsedMinutes >= 1) {
              // Reset joinTime offset to now for next minute delta
              voiceJoinTimes.set(key, now);
              await handleVoiceLeave(member.id, guild.id, elapsedMinutes, guild).catch((err) => {
                logger.error(`[VOICE HEARTBEAT] Failed to credit ${elapsedMinutes} mins to user ${member.id}:`, err.message || err);
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error('[VOICE HEARTBEAT] Error in periodic voice ticker:', err.message || err);
    }
  }, 60000); // Run every 60 seconds
}

/**
 * Scans all active voice channels on bot startup to ensure connected members are tracked.
 * @param {import('discord.js').Client} client
 */
async function scanActiveVoiceChannels(client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    try {
      const channels = await guild.channels.fetch().catch(() => null);
      if (!channels) continue;

      for (const channel of channels.values()) {
        if (channel && channel.isVoiceBased() && channel.members) {
          for (const member of channel.members.values()) {
            if (!member.user.bot) {
              const key = `${guild.id}:${member.id}`;
              if (!voiceJoinTimes.has(key)) {
                voiceJoinTimes.set(key, now);
                await handleVoiceJoin(member.id, guild.id).catch(() => {});
              }
            }
          }
        }
      }
    } catch (e) {}
  }
}

/**
 * Initialize startup scanning and periodic voice heartbeat.
 * @param {import('discord.js').Client} client
 */
async function initVoiceTracking(client) {
  await scanActiveVoiceChannels(client);
  startVoiceHeartbeat(client);
}

module.exports = {
  name: Events.VoiceStateUpdate,
  voiceJoinTimes,
  initVoiceTracking,
  /**
   * @param {import('discord.js').VoiceState} oldState
   * @param {import('discord.js').VoiceState} newState
   * @param {import('discord.js').Client} client
   */
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const vaultEnabled = await isFeatureEnabled(guildId, 'vault');
    if (!vaultEnabled) return;

    const userId = member.id;
    const key = `${guildId}:${userId}`;

    // User joined voice for the first time
    if (!oldState.channelId && newState.channelId) {
      voiceJoinTimes.set(key, Date.now());
      await handleVoiceJoin(userId, guildId).catch(() => {});
    }

    // Voice status update detection (Quest 6: Voice Status Change)
    if (oldState.status !== newState.status && newState.status) {
      const { handleVoiceStatusQuest } = require('../modules/gaming/vault');
      await handleVoiceStatusQuest(userId, guildId, newState.guild).catch(() => {});
    }

    // User switched voice channels within the server (keep original start time)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (!voiceJoinTimes.has(key)) {
        voiceJoinTimes.set(key, Date.now());
      }
    }

    // User completely left voice channels
    if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceJoinTimes.get(key);
      if (joinTime) {
        const minutesSpent = Math.floor((Date.now() - joinTime) / 60000);
        voiceJoinTimes.delete(key);
        if (minutesSpent > 0) {
          await handleVoiceLeave(userId, guildId, minutesSpent, newState.guild).catch(() => {});
        }
      }
    }
  },
};
