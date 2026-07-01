const { EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase, getFeatureConfig } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Runs the daily digest: scrapes configured channels, passes to Gemini, posts summary.
 * @param {import('discord.js').Client} client
 */
async function runDailyDigest(client) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return;

  const featureConfig = await getFeatureConfig(guildId, 'digest');
  if (!featureConfig?.enabled) return;

  const config = featureConfig.config || {};
  const sourceChannelIds = config.source_channel_ids || [];
  const digestChannelId = config.digest_channel_id;

  if (!digestChannelId || !sourceChannelIds.length) {
    logger.warn('[DIGEST] Missing source channels or digest channel config.');
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.error('[DIGEST] GEMINI_API_KEY not set.');
    return;
  }

  // ─── 1. Collect messages from the last 24 hours ───────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const collectedMessages = [];

  for (const channelId of sourceChannelIds) {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      const messages = await channel.messages.fetch({ limit: 100 });
      const filtered = messages.filter(
        m => !m.author.bot && m.createdAt > since && m.content.trim().length > 5
      );

      for (const [, msg] of filtered) {
        collectedMessages.push({
          channelName: channel.name,
          channelId: channel.id,
          messageId: msg.id,
          author: msg.member?.displayName || msg.author.username,
          content: msg.content.substring(0, 300),
          timestamp: msg.createdAt.toISOString(),
        });
      }
    } catch (err) {
      logger.error(`[DIGEST] Error fetching from channel ${channelId}:`, err.message);
    }
  }

  if (!collectedMessages.length) {
    logger.info('[DIGEST] No messages in the last 24h — skipping digest.');
    return;
  }

  // ─── 2. Format for Gemini ─────────────────────────────────────────────────
  const rawText = collectedMessages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(m => `[#${m.channelName}] ${m.author}: ${m.content}`)
    .join('\n');

  const prompt = `
You are a community digest assistant for "Every Nation," a Filipino/multilingual Discord gaming server.
Analyze the following messages from the past 24 hours and generate a concise, well-structured daily digest in English.
Handle Taglish (Tagalog-English mixed), Filipino slang, and gaming jargon naturally — translate or explain as needed.

Format your response EXACTLY as follows (use these exact section headers):
📰 **GENERAL NEWS & ANNOUNCEMENTS**
• [bullet points]

🎮 **GAME DISCUSSION HIGHLIGHTS**  
• [bullet points — mention game names and key topics]

📅 **UPCOMING EVENTS & PLANS**
• [bullet points — only if clearly mentioned]

Rules:
- Be concise — maximum 3 bullets per section
- If a section has nothing relevant, write "• Nothing notable today."
- Do NOT make up events or information not present in the messages
- Keep each bullet under 100 characters
- Be friendly and community-oriented in tone

MESSAGES:
${rawText.substring(0, 8000)}
`.trim();

  // ─── 3. Call Gemini ───────────────────────────────────────────────────────
  let summaryText = '';
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    summaryText = result.response.text().trim();
  } catch (err) {
    logger.error('[DIGEST] Gemini API error:', err.message);
    return;
  }

  // ─── 4. Build jump-links for top discussed channels ───────────────────────
  const channelCounts = {};
  for (const m of collectedMessages) {
    channelCounts[m.channelId] = (channelCounts[m.channelId] || 0) + 1;
  }
  const topChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => `<#${id}> (${count} msgs)`);

  // ─── 5. Post to digest channel ────────────────────────────────────────────
  const digestChannel = await client.channels.fetch(digestChannelId).catch(() => null);
  if (!digestChannel) {
    logger.error(`[DIGEST] Digest channel ${digestChannelId} not found.`);
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: process.env.BOT_TIMEZONE || 'Asia/Manila',
  });

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle(`📋 Daily Digest — ${dateStr}`)
    .setDescription(summaryText)
    .addFields({
      name: '🔥 Most Active Channels',
      value: topChannels.join('\n') || '*No activity tracked.*',
    })
    .setFooter({
      text: `Powered by Gemini 1.5 Flash • ${collectedMessages.length} messages analyzed • Every Nation ENOS`,
    })
    .setTimestamp();

  const sentMessage = await digestChannel.send({ embeds: [embed] });

  // ─── 6. Log to Supabase ───────────────────────────────────────────────────
  await supabase.from('digest_logs').insert({
    guild_id: guildId,
    channel_id: digestChannelId,
    message_id: sentMessage.id,
    summary_text: summaryText,
  });

  logger.info(`[DIGEST] Daily digest posted. Analyzed ${collectedMessages.length} messages.`);
}

module.exports = { runDailyDigest };
