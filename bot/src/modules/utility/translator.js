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

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Translate the following text into ${targetLanguage}. Automatically detect the source language. Provide only the translated text as the result. Do not include any quotes, markdown headers, notes, explanations, or wrapper tags.

Text to translate:
"""
${text}
"""`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  return responseText ? responseText.trim() : '⚠️ No translation response was generated.';
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
      components: [], // Remove select menu dropdown
    });

    // 4. Run translation
    const translation = await translateText(sourceText, targetLang);

    // 5. Update user with final translation text
    await interaction.editReply({
      content: `**Translation to ${targetLang}:**\n${translation}`,
      components: [],
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
