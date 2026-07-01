const { supabase } = require('../../lib/supabase');
const { handleGoLive, handleGoOffline } = require('./twitch');
const logger = require('../../lib/logger');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Fetches the active live broadcast for a YouTube channel ID.
 * @param {string} channelId - YouTube channel ID (UCxxxxxxxx)
 * @returns {Promise<{ isLive: boolean, title?: string, videoId?: string, thumbnailUrl?: string } | null>}
 */
async function checkYouTubeChannel(channelId) {
  if (!process.env.YOUTUBE_API_KEY) return null;

  try {
    const url = `${YT_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${process.env.YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];

    if (!item) return { isLive: false };

    const videoId = item.id?.videoId;
    return {
      isLive: true,
      title: item.snippet?.title,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url,
      videoId,
      gameName: 'YouTube Live',
      viewerCount: 0, // YouTube Search API doesn't return viewer count directly
      stream_url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch (err) {
    logger.error(`[YOUTUBE] Error checking channel ${channelId}:`, err.message);
    return null;
  }
}

/**
 * Polls all configured YouTube streamers and fires/updates live alerts.
 * @param {import('discord.js').Client} client
 */
async function checkYouTubeLive(client) {
  if (!process.env.YOUTUBE_API_KEY) return;

  const { data: streamers, error } = await supabase
    .from('live_alerts')
    .select('*')
    .eq('platform', 'youtube');

  if (error || !streamers?.length) return;

  for (const streamer of streamers) {
    try {
      const streamData = await checkYouTubeChannel(streamer.handle);
      if (!streamData) continue;

      // Update stream_url if live
      if (streamData.isLive && streamData.stream_url) {
        await supabase
          .from('live_alerts')
          .update({ stream_url: streamData.stream_url })
          .eq('id', streamer.id);
        streamer.stream_url = streamData.stream_url;
      }

      if (streamData.isLive && !streamer.is_live) {
        await handleGoLive(client, streamer, streamData, 'youtube');
      }

      if (!streamData.isLive && streamer.is_live) {
        await handleGoOffline(client, streamer);
      }

      await supabase
        .from('live_alerts')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', streamer.id);

    } catch (err) {
      logger.error(`[YOUTUBE] Error processing streamer ${streamer.handle}:`, err.message);
    }
  }
}

module.exports = { checkYouTubeLive };
