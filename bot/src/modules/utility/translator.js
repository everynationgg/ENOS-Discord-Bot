const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../lib/logger');

// Initialize Gemini client (same model and setup as ready heartbeat and digest)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory spam cooldown tracker (Key: guildId-userId, Value: timestamp)
const cooldowns = new Map();

/**
 * Calls Google Gemini API to translate the source text.
 * @param {string} text - Source message text
 * @param {string} targetLanguage - Selected target language name (e.g. 'Chinese')
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLanguage) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the bot server.');
  }

  const prompt = `Translate the following text into ${targetLanguage}. Automatically detect the source language. Provide only the translated text as the result. Do not include any quotes, markdown headers, notes, explanations, or wrapper tags.

Text to translate:
"""
${text}
"""`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      if (responseText) return responseText.trim();
    } catch (err) {
      logger.warn(`[TRANSLATOR] Model ${modelName} failed or quota exceeded: ${err.message}. Trying fallback...`);
      lastError = err;
    }
  }

  return '⚠️ Gemini API limit reached. Please try again in a few seconds.';
}

/**
 * Handles target language select menu dropdown selections.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleTranslationSelection(interaction) {
  // 1. Defer the interaction immediately to prevent timeouts
  await interaction.deferUpdate();

  // Custom ID format: translate_select_<originalMessageId>
  const parts = interaction.customId.split('_');
  const originalMessageId = parts[2];
  const targetLang = interaction.values[0];
  const guildId = interaction.guildId;

  try {
    if (!originalMessageId) {
      return interaction.followUp({
        content: '❌ Could not resolve the original message context.',
        ephemeral: true,
      });
    }

    // 2. Fetch the target message
    const channel = interaction.channel;
    const message = await channel.messages.fetch(originalMessageId).catch(() => null);

    if (!message) {
      return interaction.followUp({
        content: '❌ Original message not found (it may have been deleted or is inaccessible).',
        ephemeral: true,
      });
    }

    const sourceText = message.content;
    if (!sourceText || !sourceText.trim()) {
      return interaction.followUp({
        content: '❌ Cannot translate a message with empty text content (e.g. attachment-only message).',
        ephemeral: true,
      });
    }

    // 3. Edit message to show translation in progress
    await interaction.editReply({
      content: `⚙️ Translating message to **${targetLang}**...`,
      components: [], // Remove select menu dropdown temporarily
    });

    // 4. Run translation
    const translation = await translateText(sourceText, targetLang);

    // 5. Cache the user's language preference in database
    const { getFeatureConfig } = require('../../lib/supabase');
    const featureConfig = await getFeatureConfig(guildId, 'translator');
    if (featureConfig) {
      const config = featureConfig.config || {};
      const userLanguages = config.user_languages || {};
      if (userLanguages[interaction.user.id] !== targetLang) {
        userLanguages[interaction.user.id] = targetLang;
        config.user_languages = userLanguages;

        const { supabase } = require('../../lib/supabase');
        await supabase
          .from('guild_config')
          .update({ config })
          .eq('guild_id', guildId)
          .eq('feature_key', 'translator');
      }
    }

    // 6. Build persistent select menu for changing language
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`translate_select_${originalMessageId}`)
      .setPlaceholder(`Change target language (current: ${targetLang})...`)
      .addOptions([
        { label: 'English 🇺🇸', value: 'English' },
        { label: 'Chinese 🇨🇳', value: 'Chinese' },
        { label: 'Indonesian 🇮🇩', value: 'Indonesian' },
        { label: 'Filipino 🇵🇭', value: 'Filipino' },
        { label: 'German 🇩🇪', value: 'German' },
        { label: 'Polish 🇵🇱', value: 'Polish' },
        { label: 'Thai 🇹🇭', value: 'Thai' },
        { label: 'Japanese 🇯🇵', value: 'Japanese' },
        { label: 'Malaysian 🇲🇾', value: 'Malaysian' },
        { label: 'Turkish 🇹🇷', value: 'Turkish' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // 7. Update user with final translation text and persistence menu
    await interaction.editReply({
      content: `**Translation to ${targetLang}:**\n${translation}`,
      components: [row],
    });
  } catch (err) {
    logger.error(`[TRANSLATOR] Translation failed:`, err.message);
    await interaction.editReply({
      content: `❌ Translation failed: ${err.message}`,
      components: [],
    }).catch(() => {});
  }
}

module.exports = {
  translateText,
  handleTranslationSelection,
  cooldowns,
};
