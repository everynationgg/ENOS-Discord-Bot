const { Events } = require('discord.js');
const { getFeatureConfig } = require('../lib/supabase');
const logger = require('../lib/logger');

module.exports = {
  name: Events.MessageReactionAdd,
  /**
   * @param {import('discord.js').MessageReaction} reaction
   * @param {import('discord.js').User} user
   * @param {import('discord.js').Client} client
   */
  async execute(reaction, user, client) {
    // Rule 1 (Loop Shield): If the user who added the reaction is the bot itself, instantly return and do nothing.
    if (!user || !user.id) {
      logger.warn('[REACTION] MessageReactionAdd event emitted with undefined user/id.');
      return;
    }
    if (client.user && user.id === client.user.id) return;

    // Check if the reaction is partial (e.g. from an uncached message) and fetch it
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        logger.error('[REACTION] Failed to fetch partial reaction:', err.message);
        return;
      }
    }

    const message = reaction.message;
    // Fetch partial message if needed to make sure it's fully cached before reacting
    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        logger.error('[REACTION] Failed to fetch partial message:', err.message);
        return;
      }
    }

    const guild = message.guild;
    if (!guild) return; // DMs are ignored

    logger.info(`[REACTION] Event received: emoji=${reaction.emoji.name}, user=${user.tag || user.id}, msgId=${message.id}`);

    // Trigger Reaction Daily Quest in Vault
    try {
      const { handleReactionQuest } = require('../modules/gaming/vault');
      await handleReactionQuest(user.id, guild.id, guild).catch(() => {});
    } catch (e) {}

    // Flag Emoji Auto-Translation
    const FLAG_LANG_MAP = {
      '🇺🇸': 'English', '🇬🇧': 'English', '🇨🇦': 'English', '🇦🇺': 'English',
      '🇨🇳': 'Chinese', '🇹🇼': 'Chinese', '🇭🇰': 'Chinese',
      '🇮🇩': 'Indonesian', '🇵🇭': 'Filipino', '🇩🇪': 'German',
      '🇵🇱': 'Polish', '🇹🇭': 'Thai', '🇯🇵': 'Japanese',
      '🇲🇾': 'Malaysian', '🇹🇷': 'Turkish', '🇪🇸': 'Spanish',
      '🇫🇷': 'French', '🇰🇷': 'Korean', '🇷🇺': 'Russian',
      '🇮🇹': 'Italian', '🇻🇳': 'Vietnamese',
    };

    const targetLanguage = FLAG_LANG_MAP[reaction.emoji.name];
    if (targetLanguage && message.content && message.content.trim()) {
      try {
        const translatorFeature = await getFeatureConfig(guild.id, 'translator');
        if (translatorFeature?.enabled) {
          const config = translatorFeature.config || {};
          const { translateText, cooldowns } = require('../modules/utility/translator');

          // 1. Check allowed role restriction if configured
          const allowedRoleId = config.allowed_role_id;
          if (allowedRoleId) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member || !member.roles.cache.has(allowedRoleId)) {
              return;
            }
          }

          // 2. Enforce per-user cooldown
          const cooldownSeconds = Number(config.cooldown_seconds) || 10;
          const now = Date.now();
          const lastUsed = cooldowns.get(user.id) || 0;
          if (now - lastUsed < cooldownSeconds * 1000) {
            return;
          }
          cooldowns.set(user.id, now);

          // 3. Enforce character limit
          const charLimit = Number(config.character_limit) || 1000;
          const sourceText = message.content.trim().slice(0, charLimit);
          const translated = await translateText(sourceText, targetLanguage);
          const safeTranslated = String(translated || '').slice(0, 1800);

          // Send translation DM to user who reacted (or fallback to channel reply if DMs are closed)
          await user.send(`🌐 **Translation to ${targetLanguage}:**\n${safeTranslated}\n\n*Source message in #${message.channel.name || 'channel'}*`).catch(async () => {
            await message.reply({ content: `🌐 **Translation to ${targetLanguage}** (for <@${user.id}>):\n${safeTranslated}`, allowedMentions: { users: [user.id] } }).catch(() => {});
          });
        }
      } catch (e) {
        logger.error('[FLAG TRANSLATION ERROR]:', e.message);
      }
    }

    try {
      // Rule 2 (Database Check): Check if 'reaction_mirroring' is set to True for that server. If False, return.
      const featureConfig = await getFeatureConfig(guild.id, 'auto_reactions');
      const isEnabled = featureConfig?.enabled || false;
      const isMirroringEnabled = featureConfig?.config?.reaction_mirroring || false;

      if (!isEnabled || !isMirroringEnabled) return;

      // Rule 3 (Execution & Safety): Add the exact same reaction to the message.
      const emojiReact = reaction.emoji.id || reaction.emoji.name;
      if (emojiReact) {
        await message.react(emojiReact);
      }
    } catch (err) {
      // Silently pass/ignore external custom Nitro emojis or other API HTTP errors
      if (err.name === 'DiscordAPIError' || err.code === 50035 || err.message.includes('Emoji')) {
        return;
      }
      logger.error('[REACTION] Reaction mirroring error:', err.message);
    }
  },
};
