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
  const defaultStreamUrl = `https://www.tiktok.com/@${cleanHandle}/live`;

  // 1. Mobile Profile Rehydration State Parsing (Primary & Most Reliable)
  try {
    const res = await fetch(`https://www.tiktok.com/@${cleanHandle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const userObj = data['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.user;
        if (userObj) {
          const roomId = userObj.roomId || userObj.room_id;
          const isLive = Boolean(roomId && roomId !== '0' && roomId !== 0 && roomId !== '');
          const nickname = userObj.nickname || cleanHandle;
          const avatar = userObj.avatarMedium || userObj.avatarLarger || userObj.avatarThumb;
          const category = userObj.commerceUserInfo?.category;

          let title = isLive ? `${nickname} is LIVE on TikTok!` : undefined;
          let thumbnailUrl = avatar || undefined;
          let viewerCount = 0;

          if (isLive && roomId) {
            try {
              const roomRes = await fetch(`https://webcast.tiktok.com/webcast/room/info/?room_id=${roomId}&aid=1988`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                },
              });

              if (roomRes.ok) {
                const roomJson = await roomRes.json();
                const room = roomJson.data;
                if (room) {
                  if (room.title) title = room.title;
                  if (room.square_cover_img?.url_list?.[0]) {
                    thumbnailUrl = room.square_cover_img.url_list[0];
                  } else if (room.cover?.url_list?.[0]) {
                    thumbnailUrl = room.cover.url_list[0];
                  }
                  if (room.user_count) viewerCount = room.user_count;
                }
              }
            } catch (rErr) {
              logger.warn(`[TIKTOK] Room webcast details failed for @${cleanHandle}: ${rErr.message}`);
            }
          }

          return {
            isLive,
            title,
            thumbnailUrl,
            gameName: category || 'TikTok Live',
            viewerCount,
            stream_url: defaultStreamUrl,
          };
        }
      }
    }
  } catch (err) {
    logger.warn(`[TIKTOK] Mobile profile scrape failed for @${cleanHandle}: ${err.message}`);
  }

  // 2. Direct Web Scraping Fallback with Mobile User Agent
  try {
    const res = await fetch(defaultStreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (res.ok) {
      const html = await res.text();
      if (html.length > 2000) {
        const isLive = html.includes('"status":2') ||
          html.includes('"status": 2') ||
          (html.includes('"liveRoom"') && !html.includes('"liveRoom":{}')) ||
          html.includes('"liveRoomInfo":') ||
          (html.includes('roomId') && !html.includes('roomId:""'));

        if (isLive) {
          let title = `${cleanHandle} is LIVE on TikTok!`;
          const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/ \| TikTok$/i, '').trim();
          }

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
            stream_url: defaultStreamUrl,
          };
        }
      }
    }
  } catch (err) {
    logger.warn(`[TIKTOK] Direct scrape failed for @${cleanHandle}: ${err.message}`);
  }

  // 3. Tikwm Free API Fallback
  try {
    const apiRes = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${cleanHandle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.code === 0 && apiData.data?.user) {
        const user = apiData.data.user;
        const roomId = user.roomId || user.room_id;
        const isLive = Boolean(
          (roomId && roomId !== '0' && roomId !== 0 && roomId !== '') ||
          user.liveRoom ||
          user.is_live ||
          user.UserStoryStatus === 2
        );
        
        return {
          isLive,
          title: isLive ? `${user.nickname || cleanHandle} is LIVE on TikTok!` : undefined,
          thumbnailUrl: user.avatarMedium || user.avatarThumb || undefined,
          gameName: 'TikTok Live',
          viewerCount: 0,
          stream_url: defaultStreamUrl,
        };
      }
    }
  } catch (err) {
    logger.error(`[TIKTOK] API fallback failed for @${cleanHandle}: ${err.message}`);
  }

  return { isLive: false, stream_url: defaultStreamUrl };
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
