const { ChannelType } = require('discord.js');
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

  const contentTypeLabel = article.content_type || (article.article_type === 'review' ? 'Review' : 'News');
  const headerLine = `${emoji} **${article.title}** • *${contentTypeLabel}*`;

  let captionText = article.ai_caption || article.ai_summary || article.summary || '';
  if (captionText.length > 500) {
    captionText = captionText.substring(0, 497) + '...';
  }

  // Direct media link (YouTube/Vimeo) is preferred over article URL for native Discord video player rendering
  const primaryUrl = article.video_url || article.url;

  // Build clean standard text message
  const messageParts = [headerLine];
  if (captionText) {
    messageParts.push(captionText);
  }
  if (primaryUrl) {
    messageParts.push(primaryUrl);
  }

  const messageContent = messageParts.join('\n\n');

  // Check channel type
  const isThread = channel.isThread();
  const isForum = channel.type === ChannelType.GuildForum;

  if (isThread) {
    if (channel.archived) {
      await channel.setArchived(false).catch(() => {});
    }

    logger.info(`[NEWSROOM DISPATCHER] Sending message directly inside thread "${channel.name}"`);
    const msg = await channel.send({ content: messageContent });
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
      message: {
        content: messageContent,
      },
    });

    return {
      channel_id: channel.id,
      thread_id: thread.id,
      message_id: thread.lastMessageId || null,
    };
  } else {
    logger.info(`[NEWSROOM DISPATCHER] Sending native message to text channel ${channel.name}`);
    const msg = await channel.send({ content: messageContent });
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
