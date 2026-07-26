const { Events } = require('discord.js');
const { handleVoiceJoin, handleVoiceLeave } = require('../modules/gaming/vault');
const { isFeatureEnabled } = require('../lib/supabase');

// Track when each user joined a voice channel (for duration calculation)
const voiceJoinTimes = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
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
