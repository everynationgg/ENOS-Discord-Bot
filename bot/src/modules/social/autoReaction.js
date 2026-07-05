const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// Cache structure: Key = guildId, Value = { triggers: [{ trigger_word, reaction_emoji }], lastFetched: timestamp }
const triggerCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds cache TTL

/**
 * Fetches and caches auto reaction triggers for a guild.
 * @param {string} guildId
 * @returns {Promise<Array<{ trigger_word: string, reaction_emoji: string }>>}
 */
async function getAutoReactions(guildId) {
  const cached = triggerCache.get(guildId);
  if (cached && (Date.now() - cached.lastFetched < CACHE_TTL)) {
    return cached.triggers;
  }

  try {
    const { data, error } = await supabase
      .from('auto_reactions')
      .select('trigger_word, reaction_emoji')
      .eq('guild_id', guildId);

    if (error) throw error;

    const triggers = data || [];
    triggerCache.set(guildId, { triggers, lastFetched: Date.now() });
    return triggers;
  } catch (err) {
    logger.error(`[AUTO-REACTIONS] Failed to fetch triggers for guild ${guildId}:`, err.message);
    return cached ? cached.triggers : []; // Fallback to stale cache if database query fails
  }
}

/**
 * Handles incoming messages to check for auto-reaction triggers.
 * @param {import('discord.js').Message} message
 */
async function handleMessageAutoReactions(message) {
  const guildId = message.guild.id;
  const content = message.content.toLowerCase();

  const triggers = await getAutoReactions(guildId);
  if (!triggers.length) return;

  for (const trigger of triggers) {
    const word = trigger.trigger_word.toLowerCase();
    
    // Check if the message contains the trigger word/phrase (case-insensitive)
    if (content.includes(word)) {
      try {
        await message.react(trigger.reaction_emoji);
      } catch (err) {
        // Silently catch invalid emojis (both DiscordAPIError/HTTPExceptions)
        if (err.name === 'DiscordAPIError' || err.code === 50035 || err.message.includes('Emoji')) {
          continue;
        }
        logger.error(`[AUTO-REACTIONS] Failed to add reaction ${trigger.reaction_emoji}:`, err.message);
      }
    }
  }
}

module.exports = {
  handleMessageAutoReactions,
  triggerCache,
};
