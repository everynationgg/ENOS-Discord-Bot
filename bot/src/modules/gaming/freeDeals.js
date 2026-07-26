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

/**
 * Fetches deals from CheapShark REST API filtered by minimum savings percentage.
 */
async function fetchCheapSharkDeals(minDiscountPercent = 50) {
  try {
    const res = await fetch(`https://www.cheapshark.com/api/1.0/deals?upperPrice=50&sortBy=Savings&desc=1&pageSize=20`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((d) => {
        const savings = parseFloat(d.savings || '0');
        return savings >= minDiscountPercent;
      })
      .map((d) => {
        const normal = parseFloat(d.normalPrice || '0');
        const sale = parseFloat(d.salePrice || '0');
        const savings = Math.round(parseFloat(d.savings || '0'));
        const storeName = STORE_NAMES[d.storeID] || `Store #${d.storeID}`;
        const isFree = sale === 0 || savings === 100;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        return {
          dealId: `cs_${d.dealID}`,
          title: d.title,
          storeName,
          normalPrice: normal,
          salePrice: sale,
          savingsPercent: savings,
          isFree,
          dealUrl: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
          imageUrl: d.thumb ? d.thumb.replace('capsule_sm_120', 'header') : null,
          expiresAt,
        };
      });
  } catch (err) {
    logger.error('[FREE DEALS] Error fetching CheapShark deals:', err.message);
    return [];
  }
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
  const [csDeals, gpDeals] = await Promise.all([
    fetchCheapSharkDeals(minDiscountPercent),
    fetchGamerPowerDeals(),
  ]);

  const dealMap = new Map();
  [...gpDeals, ...csDeals].forEach((d) => {
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

    if (newlyPosted >= 5) break; // Cap at 5 new deal alerts per batch run to avoid spam

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
  fetchAllDeals,
  checkAndDispatchDeals,
  cleanExpiredDeals,
};
