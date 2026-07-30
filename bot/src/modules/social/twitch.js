const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

let twitchAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Gets or refreshes the Twitch app access token.
 */
async function getTwitchToken() {
  if (twitchAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return twitchAccessToken;
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  const res = await fetch(`${TWITCH_TOKEN_URL}?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token error: ${res.statusText}`);

  const data = await res.json();
  twitchAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return twitchAccessToken;
}

async function checkTwitchStreamGql(login) {
  const cleanLogin = login.replace(/^@/, '').trim();
  const query = [
    {
      operationName: 'StreamMetadata',
      variables: { channelLogin: cleanLogin },
      query: `query StreamMetadata($channelLogin: String!) {
        user(login: $channelLogin) {
          id
          login
          displayName
          profileImageURL(width: 300)
          stream {
            id
            title
            type
            viewersCount
            previewImageURL(width: 1280, height: 720)
            game {
              name
            }
          }
        }
      }`
    }
  ];

  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.[0]?.data?.user;
    if (!user) return { isLive: false };

    const stream = user.stream;
    const isLive = Boolean(stream && stream.type === 'live');

    return {
      isLive,
      title: stream?.title || `${user.displayName || cleanLogin} is LIVE on Twitch!`,
      thumbnailUrl: stream?.previewImageURL || user.profileImageURL || undefined,
      viewerCount: stream?.viewersCount || 0,
      gameName: stream?.game?.name || 'Twitch Stream',
    };
  } catch (err) {
    logger.warn(`[TWITCH] GQL query failed for @${cleanLogin}: ${err.message}`);
    return null;
  }
}

/**
 * Checks Twitch stream status for a given login name.
 * @returns {Promise<{ isLive: boolean, title?: string, thumbnailUrl?: string, gameName?: string, viewerCount?: number } | null>}
 */
async function checkTwitchStream(login) {
  const cleanLogin = login.replace(/^@/, '').trim();
  if (!cleanLogin) return null;

  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    try {
      const token = await getTwitchToken();
      const res = await fetch(`${TWITCH_API_BASE}/streams?user_login=${cleanLogin}`, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const stream = data.data?.[0];
        if (stream) {
          return {
            isLive: true,
            title: stream.title,
            thumbnailUrl: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
            viewerCount: stream.viewer_count,
            gameName: stream.game_name,
          };
        } else {
          return { isLive: false };
        }
      }
    } catch (err) {
      logger.warn(`[TWITCH] Helix API check failed for ${cleanLogin}: ${err.message}`);
    }
  }

  // Fallback to GQL query (no API keys required)
  return checkTwitchStreamGql(cleanLogin);
}

/**
 * Builds a live alert embed.
 */
function buildLiveEmbed(streamer, streamData, platform, guildName) {
  const platformColor = platform === 'twitch' ? 0x9146FF : 0xFF0000;
  const platformEmoji = platform === 'twitch' ? '👾' : '▶️';
  const watchUrl = platform === 'twitch'
    ? `https://twitch.tv/${streamer.handle}`
    : (streamer.stream_url || streamData.stream_url || `https://www.tiktok.com/@${streamer.handle?.replace(/^@/, '')}/live`);

  const displayName = streamer.display_name || streamer.handle || 'Streamer';

  return new EmbedBuilder()
    .setColor(platformColor)
    .setTitle(`${platformEmoji} ${displayName} is LIVE!`)
    .setDescription(`**${streamData.title || 'No title'}**`)
    .setImage(streamData.thumbnailUrl || null)
    .addFields(
      { name: '🎮 Playing', value: streamData.gameName || 'Unknown', inline: true },
      { name: '👁️ Viewers', value: (streamData.viewerCount || 0).toLocaleString(), inline: true },
      { name: '📺 Platform', value: platform.charAt(0).toUpperCase() + platform.slice(1), inline: true }
    )
    .setFooter({ text: `${guildName || 'Every Nation'} Social Sync` })
    .setTimestamp();
}

/**
 * Builds a "Stream Ended" static embed.
 */
function buildStreamEndedEmbed(streamer, platform, guildName) {
  const displayName = streamer.display_name || streamer.handle || 'Streamer';
  return new EmbedBuilder()
    .setColor(0x6B7280)
    .setTitle(`⬛ ${displayName} — Stream Ended`)
    .setDescription('Thanks for watching! The stream has ended.')
    .setFooter({ text: `${guildName || 'Every Nation'} Social Sync` })
    .setTimestamp();
}

/**
 * Polls all configured Twitch streamers and fires/updates live alerts.
 * @param {import('discord.js').Client} client
 */
async function checkTwitchLive(client) {
  const { data: streamers, error } = await supabase
    .from('live_alerts')
    .select('*')
    .eq('platform', 'twitch');

  if (error || !streamers?.length) return;

  for (const streamer of streamers) {
    try {
      const streamData = await checkTwitchStream(streamer.handle);
      if (!streamData) continue;

      // WENT LIVE
      if (streamData.isLive && !streamer.is_live) {
        await handleGoLive(client, streamer, streamData, 'twitch');
      }

      // WENT OFFLINE
      if (!streamData.isLive && streamer.is_live) {
        await handleGoOffline(client, streamer);
      }

      // Update last_checked
      await supabase
        .from('live_alerts')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', streamer.id);

    } catch (err) {
      logger.error(`[TWITCH] Error processing streamer ${streamer.handle}:`, err.message);
    }
  }
}

/**
 * Posts a live alert embed and stores the message ID for later editing.
 */
async function handleGoLive(client, streamer, streamData, platform) {
  const guild = client.guilds.cache.get(streamer.guild_id) || await client.guilds.fetch(streamer.guild_id).catch(() => null);
  if (!guild) return;

  const targetChannelId = streamer.alert_channel_id || streamer.channel_id;
  if (!targetChannelId) return;

  const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!channel) return;

  const embed = buildLiveEmbed(streamer, streamData, platform, guild.name);
  const watchUrl = platform === 'twitch'
    ? `https://twitch.tv/${streamer.handle}`
    : (streamer.stream_url || streamData.stream_url || `https://www.tiktok.com/@${streamer.handle?.replace(/^@/, '')}/live`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🎮 Watch Now')
      .setStyle(ButtonStyle.Link)
      .setURL(watchUrl)
  );

  const pingContent = streamer.ping_role_id ? `<@&${streamer.ping_role_id}>` : '';
  const message = await channel.send({
    content: pingContent || undefined,
    embeds: [embed],
    components: [row],
  });

  await supabase
    .from('live_alerts')
    .update({
      is_live: true,
      stream_title: streamData.title,
      thumbnail_url: streamData.thumbnailUrl,
      last_message_id: message.id,
      went_live_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', streamer.id);

  logger.info(`[SOCIAL] ${streamer.display_name || streamer.handle} went live on ${platform}`);
}

/**
 * Edits the live embed to a "Stream Ended" state.
 */
async function handleGoOffline(client, streamer) {
  const guild = client.guilds.cache.get(streamer.guild_id) || await client.guilds.fetch(streamer.guild_id).catch(() => null);
  if (!guild) return;

  const targetChannelId = streamer.alert_channel_id || streamer.channel_id;
  if (targetChannelId && streamer.last_message_id) {
    try {
      const channel = await guild.channels.fetch(targetChannelId);
      const message = await channel.messages.fetch(streamer.last_message_id);
      const endedEmbed = buildStreamEndedEmbed(streamer, streamer.platform, guild.name);
      await message.edit({ embeds: [endedEmbed], components: [] });
    } catch (err) {
      logger.warn(`[SOCIAL] Could not edit ended stream message: ${err.message}`);
    }
  }

  await supabase
    .from('live_alerts')
    .update({
      is_live: false,
      last_message_id: null,
      went_live_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', streamer.id);

  logger.info(`[SOCIAL] ${streamer.display_name || streamer.handle} went offline.`);
}

module.exports = { checkTwitchLive, handleGoLive, handleGoOffline };
