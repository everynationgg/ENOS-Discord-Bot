const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getFeatureConfig } = require('../../lib/supabase');
const logger = require('../../lib/logger');

/**
 * Posts (or refreshes) the welcome landing embed in the configured landing channel.
 * Called by the /admin setup-landing command.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
async function postLandingMessage(client, guildId) {
  const featureConfig = await getFeatureConfig(guildId, 'gatekeeper');
  if (!featureConfig?.enabled) return;

  const { config } = featureConfig;
  const landingChannelId = config?.landing_channel_id;
  const welcomeText = config?.welcome_text || DEFAULT_WELCOME_TEXT;

  if (!landingChannelId) {
    logger.warn('[GATEKEEPER] No landing channel configured.');
    return;
  }

  const channel = await client.channels.fetch(landingChannelId).catch(() => null);
  if (!channel) {
    logger.warn(`[GATEKEEPER] Landing channel ${landingChannelId} not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle('🏰 Welcome to Every Nation')
    .setDescription(welcomeText)
    .addFields(
      {
        name: '📋 Before You Begin',
        value:
          'To gain full access to the server, please click the **Verify Here** button below and complete a short registration form.\n\nThis takes less than a minute!',
      },
      {
        name: '🔒 What Happens After Verification?',
        value:
          '• Your restricted role is removed\n• You gain access to all server channels\n• Your nickname is synced to your handle\n• You join the Every Nation roster!',
      }
    )
    .setFooter({
      text: 'Every Nation — Powered by ENOS',
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_here')
      .setLabel('✅  Verify Here')
      .setStyle(ButtonStyle.Primary)
  );

  // Delete old pinned landing messages to avoid duplicates
  const messages = await channel.messages.fetch({ limit: 10 });
  const oldBotMessages = messages.filter(
    m => m.author.id === client.user.id && m.embeds.length > 0
  );
  for (const [, msg] of oldBotMessages) {
    await msg.delete().catch(() => {});
  }

  await channel.send({ embeds: [embed], components: [row] });
  logger.info(`[GATEKEEPER] Landing message posted in #${channel.name}`);
}

const DEFAULT_WELCOME_TEXT = `
**Welcome to Every Nation!** 🎮

We are a passionate community of gamers united across multiple game branches, from casual explorers to competitive veterans.

Please take a moment to verify your membership below. Your information helps us personalize your experience and keep our community organized.

*By verifying, you acknowledge that AI-powered features (such as our daily digest) may process non-identifiable aggregated chat content.*
`.trim();

module.exports = { postLandingMessage, DEFAULT_WELCOME_TEXT };
