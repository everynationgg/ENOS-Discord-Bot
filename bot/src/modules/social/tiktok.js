const { supabase } = require('../../lib/supabase');
const { handleGoLive, handleGoOffline } = require('./twitch');
const logger = require('../../lib/logger');

/**
 * Fetches the live status for a TikTok username handle.
 * @param {string} handle - TikTok username handle (with or without @)
 * @returns {Promise<{ isLive: boolean, title?: string, stream_url?: string, thumbnailUrl?: string, gameName?: string, viewerCount?: number } | null>}
 */
async function checkTikTokChannel(handle) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  if (!cleanHandle) return null;

  try {
    const url = `https://www.tiktok.com/@${cleanHandle}/live`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) return { isLive: false };

    const html = await res.text();
    // TikTok embeds SIGI_STATE or __UNIVERSAL_DATA_FOR_REHYDRATION__ in page HTML
    const isLive = html.includes('"status":2') || (html.includes('"liveRoom"') && !html.includes('"liveRoom":{}'));

    if (!isLive) return { isLive: false };

    // Extract title if available from og:title or title tag
    let title = `${cleanHandle} is LIVE on TikTok!`;
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/ \| TikTok$/i, '').trim();
    }

    // Extract thumbnail/avatar from og:image
    let thumbnailUrl = null;
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
    if (imgMatch && imgMatch[1]) {
      thumbnailUrl = imgMatch[1];
    }

    return {
      isLive: true,
      title,
      thumbnailUrl: thumbnailUrl || undefined,
      gameName: 'TikTok Live',
      viewerCount: 0,
      stream_url: `https://www.tiktok.com/@${cleanHandle}/live`,
    };
  } catch (err) {
    logger.error(`[TIKTOK] Error checking channel @${cleanHandle}:`, err.message);
    return null;
  }
}

/**
 * Polls all configured TikTok streamers and fires/updates live alerts.
 * @param {import('discord.js').Client} client
 */
async function checkTikTokLive(client) {
  const { data: streamers, error } = await supabase
    .from('live_alerts')
    .select('*')
    .eq('platform', 'tiktok');

  if (error || !streamers?.length) return;

  for (const streamer of streamers) {
    try {
      const streamData = await checkTikTokChannel(streamer.handle);
      if (!streamData) continue;

      if (streamData.isLive && streamData.stream_url) {
        await supabase
          .from('live_alerts')
          .update({ stream_url: streamData.stream_url })
          .eq('id', streamer.id);
        streamer.stream_url = streamData.stream_url;
      }

      if (streamData.isLive && !streamer.is_live) {
        await handleGoLive(client, streamer, streamData, 'tiktok');
      }

      if (!streamData.isLive && streamer.is_live) {
        await handleGoOffline(client, streamer);
      }

      await supabase
        .from('live_alerts')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', streamer.id);

    } catch (err) {
      logger.error(`[TIKTOK] Error processing streamer ${streamer.handle}:`, err.message);
    }
  }
}

module.exports = { checkTikTokLive, checkTikTokChannel };
