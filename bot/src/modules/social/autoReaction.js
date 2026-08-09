const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// Cache structure: Key = guildId, Value = { triggers: [{ trigger_word, reaction_emoji }], lastFetched: timestamp }
const triggerCache = new Map();
const CACHE_TTL = 5 * 1000; // 5 seconds TTL for fast dashboard updates

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
    return cached ? cached.triggers : [];
  }
}

/**
 * Resolves raw emoji string (e.g. ":ENtrophy:", "ENtrophy", "<:ENtrophy:1234>", "🎉") to a valid Discord reaction target.
 * @param {import('discord.js').Guild} guild
 * @param {string} rawEmoji
 * @returns {Promise<import('discord.js').GuildEmoji|string|null>}
 */
async function resolveReactionEmoji(guild, rawEmoji) {
  if (!rawEmoji || typeof rawEmoji !== 'string') return null;

  const trimmed = rawEmoji.trim();

  // 1. Custom Emoji Mention format: <:emoji_name:123456789012345678> or <a:emoji_name:123456789012345678>
  const mentionMatch = trimmed.match(/<a?:(\w+):(\d+)>/);
  if (mentionMatch) {
    const emojiId = mentionMatch[2];
    if (guild?.emojis) {
      const found = guild.emojis.cache.get(emojiId);
      if (found) return found;
    }
    return `${mentionMatch[1]}:${emojiId}`;
  }

  // 2. Strip surrounding colons if present: ":ENtrophy:" -> "ENtrophy"
  const cleanName = trimmed.replace(/^:|:$/g, '');

  // 3. Search guild custom emojis by ID or name
  if (guild?.emojis) {
    if (guild.emojis.cache.size === 0) {
      await guild.emojis.fetch().catch(() => null);
    }

    const guildEmoji = guild.emojis.cache.find(
      (e) => e.id === cleanName || e.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (guildEmoji) return guildEmoji;
  }

  // 4. Raw numeric ID alone
  if (/^\d+$/.test(cleanName) && guild?.emojis) {
    const byId = guild.emojis.cache.get(cleanName);
    if (byId) return byId;
  }

  // 5. Standard Unicode Emoji (e.g. 🎉, 🏆) or raw fallback
  return cleanName;
}

/**
 * Checks if incoming content matches a trigger word/phrase.
 * @param {string} content
 * @param {string} triggerWord
 * @returns {boolean}
 */
function isTriggerMatched(content, triggerWord) {
  const word = triggerWord.toLowerCase().trim();
  if (!word || !content) return false;

  // Single word / short token (e.g. "g", "gg") -> match exact word boundary
  if (word.length <= 2) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|[^a-zA-Z0-9])${escaped}(?:$|\\s|[^a-zA-Z0-9])`, 'i');
    return regex.test(content);
  }

  // Phrase or multi-word trigger (e.g. "Happy Birthday!", "congrats") -> phrase includes check
  return content.includes(word);
}

/**
 * Handles incoming messages to check for auto-reaction triggers.
 * @param {import('discord.js').Message} message
 */
async function handleMessageAutoReactions(message) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const content = message.content.toLowerCase();

  const triggers = await getAutoReactions(guildId);
  if (!triggers.length) return;

  for (const trigger of triggers) {
    if (isTriggerMatched(content, trigger.trigger_word)) {
      const emojiTarget = await resolveReactionEmoji(message.guild, trigger.reaction_emoji);
      if (!emojiTarget) continue;

      try {
        await message.react(emojiTarget);
      } catch (err) {
        logger.error(`[AUTO-REACTIONS] Failed to add reaction ${trigger.reaction_emoji} (${emojiTarget}):`, err.message);
      }
    }
  }
}

module.exports = {
  handleMessageAutoReactions,
  triggerCache,
};
