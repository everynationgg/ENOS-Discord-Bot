const { EmbedBuilder, ChannelType } = require('discord.js');
const logger = require('../../lib/logger');
const { getCategoryDef } = require('./registry');

/**
 * Creates and dispatches a Newsroom article embed to a Discord text or forum channel.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {object} config - Category config from database
 * @param {object} article - Parsed article { guid, title, summary, url, source_name, image_url, category, ai_summary }
 */
async function dispatchArticleToDiscord(client, guildId, config, article) {
  if (!config.channel_id) {
    throw new Error('No output channel configured for category.');
  }

  const channel = await client.channels.fetch(config.channel_id).catch(() => null);
  if (!channel) {
    throw new Error(`Configured channel ID ${config.channel_id} not found or bot lacks permissions.`);
  }

  const categoryDef = getCategoryDef(article.category);
  const colorHex = categoryDef?.colorHex || 0x8b5cf6;
  const fallbackImg = categoryDef?.fallbackImage;

  // Build Embed
  const embed = new EmbedBuilder()
    .setTitle(article.title.length > 256 ? article.title.substring(0, 253) + '...' : article.title)
    .setURL(article.url)
    .setColor(colorHex)
    .setAuthor({
      name: `${categoryDef?.name || article.category.toUpperCase()} NEWSROOM • ${article.source_name}`,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTimestamp(article.published_at ? new Date(article.published_at) : new Date())
    .setFooter({
      text: `ENOS Newsroom • ${article.source_name}`,
    });

  // Description / Summary logic
  let descriptionText = article.ai_summary || article.summary || 'Read the full update on the official source website.';
  if (descriptionText.length > 2000) {
    descriptionText = descriptionText.substring(0, 1997) + '...';
  }
  embed.setDescription(descriptionText);

  // Set Banner Image
  const imageUrl = article.image_url || fallbackImg;
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  // Check if channel is a Discord Forum Channel (type 15)
  const isForum = channel.type === ChannelType.GuildForum;

  if (isForum) {
    // Create new Forum Thread
    const threadTitle = article.title.length > 100 ? article.title.substring(0, 97) + '...' : article.title;
    logger.info(`[NEWSROOM DISPATCHER] Creating forum thread "${threadTitle}" in channel ${channel.name}`);

    const thread = await channel.threads.create({
      name: threadTitle,
      autoArchiveDuration: 1440, // 24 hours default archive duration
      message: {
        embeds: [embed],
      },
    });

    return {
      channel_id: channel.id,
      thread_id: thread.id,
      message_id: thread.lastMessageId || null,
    };
  } else {
    // Post to standard Text/Announcement Channel
    logger.info(`[NEWSROOM DISPATCHER] Sending embed to text channel ${channel.name}`);
    const msg = await channel.send({ embeds: [embed] });
    return {
      channel_id: channel.id,
      thread_id: null,
      message_id: msg.id,
    };
  }
}

module.exports = {
  dispatchArticleToDiscord,
};
