const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supabase, getFeatureConfig, isFeatureEnabled, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// Store Mapping ID for CheapShark
const STORE_NAMES = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'GreenManGaming',
  '7': 'GOG',
  '11': 'Humble Store',
  '15': 'Fanatical',
  '25': 'Epic Games Store',
};

/**
 * Normalizes game titles to prevent duplicate postings across different platforms & formats.
 * e.g. "Amnesia: The Dark Descent (Free on Steam)" -> "amnesiathedarkdescent"
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\(.*\)/g, '')
    .replace(/\[.*\]/g, '')
    .replace(/\b(giveaway|free|on|steam|epic|games|gog|store|key|dlc|loot|pack|edition)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

const USER_AGENT = 'ENOS-Discord-Bot/1.0 (https://github.com/everynationgg/ENOS-Discord-Bot)';

/**
 * Fetches deals from CheapShark REST API filtered by minimum savings percentage.
 */
async function fetchCheapSharkDeals(minDiscountPercent = 50) {
  try {
    const storeIds = '1,2,7,11,15,25'; // Steam, GamersGate, GOG, Humble, Fanatical, Epic
    const [resAll, resSteam] = await Promise.all([
      fetch(`https://www.cheapshark.com/api/1.0/deals?upperPrice=50&sortBy=Savings&desc=1&pageSize=60&storeID=${storeIds}`, {
        headers: { 'User-Agent': USER_AGENT },
      }),
      fetch(`https://www.cheapshark.com/api/1.0/deals?upperPrice=50&sortBy=Deal%20Rating&desc=1&pageSize=60&storeID=1`, {
        headers: { 'User-Agent': USER_AGENT },
      }),
    ]);

    const dataAll = resAll.ok ? await resAll.json() : [];
    const dataSteam = resSteam.ok ? await resSteam.json() : [];

    const combined = [
      ...(Array.isArray(dataAll) ? dataAll : []),
      ...(Array.isArray(dataSteam) ? dataSteam : []),
    ];

    const seen = new Set();
    const results = [];

    for (const d of combined) {
      if (!d || !d.dealID || seen.has(d.dealID)) continue;
      seen.add(d.dealID);

      const savings = Math.round(parseFloat(d.savings || '0'));
      if (savings < minDiscountPercent) continue;

      const normal = parseFloat(d.normalPrice || '0');
      const sale = parseFloat(d.salePrice || '0');
      const storeName = STORE_NAMES[d.storeID] || `Store #${d.storeID}`;
      const isFree = sale === 0 || savings === 100;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      results.push({
        dealId: `cs_${d.dealID}`,
        title: d.title,
        storeName,
        normalPrice: normal,
        salePrice: sale,
        savingsPercent: savings,
        isFree,
        dealUrl: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
        imageUrl: d.thumb ? d.thumb.replace('capsule_sm_120', 'header').replace('capsule_231x87', 'header') : null,
        expiresAt,
      });
    }

    return results;
  } catch (err) {
    logger.error('[FREE DEALS] Error fetching CheapShark deals:', err.message);
    return [];
  }
}

/**
 * Fetches discounted/free games directly from Steam's Featured Categories API and Store Specials search.
 */
async function fetchSteamFeaturedDeals(minDiscountPercent = 50) {
  const deals = [];
  const seenAppIds = new Set();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // 1. Scrape Steam Specials Storefront Search Pages 1..4 (captures Franchise Sales, Event Hubs like REAL-WORLD MAPS, 911/112 Operator, King's Orders)
  for (let page = 1; page <= 4; page++) {
    try {
      const searchRes = await fetch(`https://store.steampowered.com/search/?specials=1&cc=US&l=english&page=${page}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (searchRes.ok) {
        const html = await searchRes.text();
        const rowRegex = /<a href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/([^/?"']+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
          const appId = match[1];
          if (seenAppIds.has(appId)) continue;

          const titleSlug = decodeURIComponent(match[2]).replace(/_/g, ' ');
          const innerHtml = match[3];

          const titleMatch = /<span class="title">([^<]+)<\/span>/.exec(innerHtml);
          const title = titleMatch ? titleMatch[1].trim() : titleSlug;

          const discountMatch = /discount_pct">([^<]+)</.exec(innerHtml);
          const discountText = discountMatch ? discountMatch[1].replace(/[-%\s]/g, '') : '0';
          const savingsPercent = parseInt(discountText, 10) || 0;

          if (savingsPercent < minDiscountPercent) continue;
          seenAppIds.add(appId);

          const origMatch = /discount_original_price">([^<]+)</.exec(innerHtml);
          const normalPrice = origMatch ? parseFloat(origMatch[1].replace(/[^0-9.]/g, '')) || 0 : 0;

          const finalMatch = /discount_final_price">([^<]+)</.exec(innerHtml);
          const salePrice = finalMatch ? parseFloat(finalMatch[1].replace(/[^0-9.]/g, '')) || 0 : 0;
          const isFree = salePrice === 0 || savingsPercent >= 100;

          deals.push({
            dealId: `steam_${appId}`,
            title,
            storeName: 'Steam',
            normalPrice,
            salePrice,
            savingsPercent,
            isFree,
            dealUrl: `https://store.steampowered.com/app/${appId}`,
            imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
            expiresAt,
          });
        }
      }
    } catch (err) {
      logger.warn('[FREE DEALS] Steam Specials HTML scrape warning:', err.message);
    }
  }

  // 2. Fetch Featured Categories API as secondary fallback
  try {
    const res = await fetch('https://store.steampowered.com/api/featuredcategories/?cc=US&l=en', {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const rawItems = [];
        for (const key in data) {
          const category = data[key];
          if (category && Array.isArray(category.items)) {
            rawItems.push(...category.items);
          }
        }

        for (const d of rawItems) {
          const appId = d.id;
          if (!appId || !d.name || seenAppIds.has(String(appId))) continue;

          const discountPct = d.discount_percent || 0;
          if (discountPct < minDiscountPercent) continue;
          seenAppIds.add(String(appId));

          const normal = (d.original_price || 0) / 100;
          const sale = (d.final_price || 0) / 100;
          const isFree = sale === 0 || discountPct >= 100;

          deals.push({
            dealId: `steam_${appId}`,
            title: d.name,
            storeName: 'Steam',
            normalPrice: normal,
            salePrice: sale,
            savingsPercent: discountPct,
            isFree,
            dealUrl: `https://store.steampowered.com/app/${appId}`,
            imageUrl: d.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
            expiresAt,
          });
        }
      }
    }
  } catch (err) {
    logger.warn('[FREE DEALS] Steam featured API warning:', err.message);
  }

  return deals;
}

/**
 * Fetches free giveaways from GamerPower REST API (Steam, Epic, GOG).
 */
async function fetchGamerPowerDeals() {
  try {
    const res = await fetch('https://www.gamerpower.com/api/giveaways');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 10).map((d) => {
      const normal = parseFloat((d.worth || '0').replace('$', '').trim()) || 19.99;
      let expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      if (d.end_date && d.end_date !== 'N/A') {
        const parsed = new Date(d.end_date);
        if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
          expiresAt = parsed.toISOString();
        }
      }

      return {
        dealId: `gp_${d.id}`,
        title: d.title,
        storeName: d.platforms || 'PC / Gaming Store',
        normalPrice: normal,
        salePrice: 0,
        savingsPercent: 100,
        isFree: true,
        dealUrl: d.open_giveaway_url || d.gamerpower_url,
        imageUrl: d.image || d.thumbnail,
        expiresAt,
      };
    });
  } catch (err) {
    logger.error('[FREE DEALS] Error fetching GamerPower deals:', err.message);
    return [];
  }
}

/**
 * Scrapes and aggregates deals from multiple platforms with title normalization.
 */
async function fetchAllDeals(minDiscountPercent = 50) {
  const [csDeals, gpDeals, steamDeals] = await Promise.all([
    fetchCheapSharkDeals(minDiscountPercent),
    fetchGamerPowerDeals(),
    fetchSteamFeaturedDeals(minDiscountPercent),
  ]);

  const dealMap = new Map();
  [...gpDeals, ...steamDeals, ...csDeals].forEach((d) => {
    const normKey = normalizeTitle(d.title);
    if (normKey && !dealMap.has(normKey) && !dealMap.has(d.dealId)) {
      dealMap.set(normKey, d);
    }
  });

  return Array.from(dealMap.values());
}

/**
 * Dispatches deal alert cards to Discord channel.
 */
async function checkAndDispatchDeals(client, guildId) {
  // Clean up expired deal messages from Discord on every cycle
  await cleanExpiredDeals(client).catch((e) => logger.warn('[FREE DEALS] cleanExpiredDeals error:', e.message));

  const featureConfig = await getFeatureConfig(guildId, 'free_game_alerts');
  if (!featureConfig?.enabled) return { count: 0 };

  const cfg = featureConfig.config || {};
  const channelId = cfg.channel_id;
  if (!channelId) return { count: 0 };

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { count: 0 };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return { count: 0 };

  const minDiscount = Number(cfg.min_discount_percent) || 50;
  const deals = await fetchAllDeals(minDiscount);
  if (!deals.length) return { count: 0 };

  // Fetch ALL historical posted deal IDs and titles from free_game_deals
  const { data: postedRows } = await supabase
    .from('free_game_deals')
    .select('deal_id, title')
    .eq('guild_id', guildId);

  // Fetch ALL historical posted titles from bot_event_logs as bulletproof secondary memory
  const { data: logRows } = await supabase
    .from('bot_event_logs')
    .select('details')
    .eq('guild_id', guildId)
    .eq('event_type', 'free_game_alert_posted');

  const postedSet = new Set([
    ...(postedRows || []).map((r) => r.deal_id),
    ...(logRows || []).map((r) => r.details?.deal_id).filter(Boolean),
  ]);

  const postedNormSet = new Set([
    ...(postedRows || []).map((r) => normalizeTitle(r.title)),
    ...(logRows || []).map((r) => normalizeTitle(r.details?.title)).filter(Boolean),
  ]);

  let newlyPosted = 0;

  for (const deal of deals) {
    const normTitle = normalizeTitle(deal.title);
    if (postedSet.has(deal.dealId) || (normTitle && postedNormSet.has(normTitle))) {
      continue;
    }

    if (newlyPosted >= 20) break; // Cap at 20 new deal alerts per batch run (Discord anti-spam safe)

    // 1.2s delay between posts to strictly comply with Discord's rate limit (5 msg / 5s)
    if (newlyPosted > 0) {
      await new Promise((r) => setTimeout(r, 1200));
    }

    const is100Free = deal.isFree || deal.savingsPercent >= 100;
    const titleHeader = is100Free
      ? `🎁 FREE GAME ALERT — ${deal.title}`
      : `🏷️ ${deal.savingsPercent}% OFF DEAL — ${deal.title}`;

    const embedColor = is100Free ? 0x10B981 : 0xF59E0B; // Emerald for FREE, Amber for Discount

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(titleHeader)
      .setURL(deal.dealUrl)
      .setDescription(
        `A high-value game offer is live on **${deal.storeName}**!\n\n` +
        `💰 **Original Price**: ~~$${deal.normalPrice.toFixed(2)} USD~~\n` +
        `🔥 **Current Price**: **${is100Free ? 'FREE (100% OFF)' : `$${deal.salePrice.toFixed(2)} USD`}**\n` +
        `📉 **Discount**: **-${deal.savingsPercent}% OFF**\n` +
        `⏰ **Expires**: <t:${Math.floor(new Date(deal.expiresAt).getTime() / 1000)}:R>`
      )
      .setFooter({ text: `ENOS Free Game Alerts • ${deal.storeName}` })
      .setTimestamp();

    if (deal.imageUrl) {
      embed.setImage(deal.imageUrl);
    }

    const buttonLabel = is100Free ? '🎁 Claim Free Game' : `🛒 Claim ${deal.savingsPercent}% OFF Deal`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(deal.dealUrl)
        .setEmoji(is100Free ? '🎁' : '🛒')
    );

    const sentMessage = await channel.send({ embeds: [embed], components: [row] }).catch((e) => {
      logger.error(`[FREE DEALS] Failed to send deal embed for ${deal.title}:`, e.message);
      return null;
    });

    if (sentMessage?.id) {
      newlyPosted++;

      // Write to free_game_deals with error logging
      const { error: dbErr } = await supabase.from('free_game_deals').upsert(
        {
          guild_id: guildId,
          deal_id: deal.dealId,
          title: deal.title,
          store_name: deal.storeName,
          normal_price: deal.normalPrice,
          sale_price: deal.salePrice,
          savings_percent: deal.savingsPercent,
          deal_url: deal.dealUrl,
          image_url: deal.imageUrl,
          channel_id: channelId,
          message_id: sentMessage.id,
          expires_at: deal.expiresAt,
        },
        { onConflict: 'guild_id,deal_id' }
      );

      if (dbErr) {
        logger.error(`[FREE DEALS] DB Upsert error for ${deal.title}: ${dbErr.message}`);
      }

      await logBotEvent(guildId, 'free_game_alert_posted', null, {
        deal_id: deal.dealId,
        title: deal.title,
        store: deal.storeName,
        message_id: sentMessage.id,
      });

      // Add to local sets so within this loop iteration duplicates are caught
      postedSet.add(deal.dealId);
      if (normTitle) postedNormSet.add(normTitle);
    }
  }

  return { count: newlyPosted };
}

/**
 * Worker: Auto-deletes Discord messages for expired deals while preserving database history.
 */
async function cleanExpiredDeals(client) {
  try {
    const nowIso = new Date().toISOString();
    const { data: expiredDeals } = await supabase
      .from('free_game_deals')
      .select('*')
      .lte('expires_at', nowIso);

    if (!expiredDeals || !expiredDeals.length) return;

    logger.info(`[FREE DEALS CLEANER] Found ${expiredDeals.length} expired deals to delete from Discord.`);

    for (const deal of expiredDeals) {
      try {
        const channel = await client.channels.fetch(deal.channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(deal.message_id).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
            logger.info(`[FREE DEALS CLEANER] Deleted expired deal message ${deal.message_id} (${deal.title}).`);
          }
        }
      } catch (e) {
        logger.warn(`[FREE DEALS CLEANER] Failed deleting message ${deal.message_id}:`, e.message);
      }

      // Move expires_at to 2099 so cleanExpiredDeals won't run on it again, but DB row stays permanently!
      await supabase
        .from('free_game_deals')
        .update({ expires_at: '2099-01-01T00:00:00.000Z' })
        .eq('id', deal.id);
    }
  } catch (err) {
    logger.error('[FREE DEALS CLEANER] Error in cleanExpiredDeals worker:', err.message);
  }
}

module.exports = {
  normalizeTitle,
  fetchCheapSharkDeals,
  fetchGamerPowerDeals,
  fetchSteamFeaturedDeals,
  fetchAllDeals,
  checkAndDispatchDeals,
  cleanExpiredDeals,
};
