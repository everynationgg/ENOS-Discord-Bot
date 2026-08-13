const { ChannelType, MessageFlags } = require('discord.js');
const logger = require('../../lib/logger');
const { getCategoryDef } = require('./registry');

/**
 * Creates and dispatches a Newsroom article message to a Discord text or forum channel.
 * Uses standard Discord text messages to allow native media player unfurls (e.g. YouTube trailers).
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {object} config - Category config from database
 * @param {object} article - Parsed article { guid, title, summary, url, source_name, category, ai_caption, content_type, video_url }
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
  const emoji = categoryDef?.emoji || '📰';

  const isTrailer = (article.content_type || '').toLowerCase() === 'trailer' || Boolean(article.video_url);
  const isReview = article.article_type === 'review' && !isTrailer;

  // Trailers MUST have a direct playable video URL (YouTube/Vimeo). Skip if none found.
  if (isTrailer && !article.video_url) {
    throw new Error(`Skipping trailer "${article.title}" — no direct playable video URL found.`);
  }

  const contentTypeLabel = article.content_type || (isReview ? 'Review' : 'News');
  const headerLine = `${emoji} **${article.title}** • *${contentTypeLabel}*`;

  let captionText = article.ai_caption || article.ai_summary || article.summary || '';
  if (captionText.length > 500) {
    captionText = captionText.substring(0, 497) + '...';
  }

  // Build message parts:
  // - Reviews: title + caption + "Reviewed by [source]" — NO external link
  // - Everything else: title + caption + direct video URL (preferred) or article URL
  const messageParts = [headerLine];
  if (captionText) {
    messageParts.push(captionText);
  }

  if (isReview && !isTrailer) {
    // Reviews (non-trailer): title + caption + source credit — no external link
    messageParts.push(`*Reviewed by* **${article.source_name}**`);
  } else {
    // Everything else (including trailers): always include the direct video URL or article URL
    const primaryUrl = article.video_url || article.url;
    if (primaryUrl) {
      messageParts.push(primaryUrl);
    }
  }

  const messageContent = messageParts.join('\n\n');

  // Suppress Discord's automatic link-preview card for non-video posts.
  // When video_url exists (YouTube/Vimeo), we want the native inline player — no flag.
  // For article links, SuppressEmbeds prevents the external preview card.
  const messageOptions = { content: messageContent };
  if (!article.video_url) {
    messageOptions.flags = MessageFlags.SuppressEmbeds;
  }

  // Check channel type
  const isThread = channel.isThread();
  const isForum = channel.type === ChannelType.GuildForum;

  if (isThread) {
    if (channel.archived) {
      await channel.setArchived(false).catch(() => {});
    }

    logger.info(`[NEWSROOM DISPATCHER] Sending message directly inside thread "${channel.name}"`);
    const msg = await channel.send(messageOptions);
    return {
      channel_id: channel.parentId || channel.id,
      thread_id: channel.id,
      message_id: msg.id,
    };
  } else if (isForum) {
    const threadTitle = article.title.length > 100 ? article.title.substring(0, 97) + '...' : article.title;
    logger.info(`[NEWSROOM DISPATCHER] Creating forum thread "${threadTitle}" in channel ${channel.name}`);

    const thread = await channel.threads.create({
      name: threadTitle,
      autoArchiveDuration: 1440,
      message: messageOptions,
    });

    return {
      channel_id: channel.id,
      thread_id: thread.id,
      message_id: thread.lastMessageId || null,
    };
  } else {
    logger.info(`[NEWSROOM DISPATCHER] Sending native message to text channel ${channel.name}`);
    const msg = await channel.send(messageOptions);
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
