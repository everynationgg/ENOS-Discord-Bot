import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// STORE NAME HELPER
const STORE_NAMES: Record<string, string> = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'GreenManGaming',
  '7': 'GOG',
  '11': 'Humble Store',
  '15': 'Fanatical',
  '25': 'Epic Games Store',
};

const USER_AGENT = 'ENOS-Discord-Bot/1.0 (https://github.com/everynationgg/ENOS-Discord-Bot)';

function normalizeTitle(title: string) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\(.*\)/g, '')
    .replace(/\[.*\]/g, '')
    .replace(/\b(giveaway|free|on|steam|epic|games|gog|store|key|dlc|loot|pack|edition)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchCheapSharkDeals(minDiscountPercent = 50) {
  try {
    const storeIds = '1,2,7,11,15,25';
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
    return [];
  }
}

async function fetchSteamFeaturedDeals(minDiscountPercent = 50) {
  const deals: any[] = [];
  const seenAppIds = new Set<string>();
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
      // ignore
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
        const rawItems: any[] = [];
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
    // ignore
  }

  return deals;
}

async function fetchGamerPowerDeals() {
  try {
    const res = await fetch('https://www.gamerpower.com/api/giveaways');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 10).map((d: any) => {
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
    return [];
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;
    const guildId = getGuildId(req, body);

    if (action === 'trigger') {
      const { data: featureConfig } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'free_game_alerts')
        .maybeSingle();

      const cfg = featureConfig?.config || {};
      const channelId = body.channel_id || cfg.channel_id;

      if (!channelId || typeof channelId !== 'string' || !channelId.trim()) {
        return NextResponse.json({ error: 'Target Channel ID is required in Vault / Free Game settings.' }, { status: 400 });
      }

      if (!DISCORD_TOKEN) {
        return NextResponse.json({ error: 'DISCORD_TOKEN is missing on server.' }, { status: 500 });
      }

      const minDiscount = Number(cfg.min_discount_percent) || 50;
      const [csDeals, gpDeals, steamDeals] = await Promise.all([
        fetchCheapSharkDeals(minDiscount),
        fetchGamerPowerDeals(),
        fetchSteamFeaturedDeals(minDiscount),
      ]);

      const dealMap = new Map();
      [...gpDeals, ...steamDeals, ...csDeals].forEach((d) => {
        const normKey = normalizeTitle(d.title);
        if (normKey && !dealMap.has(normKey) && !dealMap.has(d.dealId)) {
          dealMap.set(normKey, d);
        }
      });
      const deals = Array.from(dealMap.values());

      if (!deals.length) {
        return NextResponse.json({ success: true, count: 0, message: 'No qualifying deals found matching discount threshold.' });
      }

      // Fetch ALL historical posted deal IDs and titles from free_game_deals
      const { data: postedRows } = await supabaseAdmin
        .from('free_game_deals')
        .select('deal_id, title')
        .eq('guild_id', guildId);

      // Fetch ALL historical posted titles from bot_event_logs as bulletproof secondary memory
      const { data: logRows } = await supabaseAdmin
        .from('bot_event_logs')
        .select('details')
        .eq('guild_id', guildId)
        .eq('event_type', 'free_game_alert_posted');

      const postedSet = new Set([
        ...(postedRows || []).map((r: any) => r.deal_id),
        ...(logRows || []).map((r: any) => r.details?.deal_id).filter(Boolean),
      ]);

      const postedNormSet = new Set([
        ...(postedRows || []).map((r: any) => normalizeTitle(r.title)),
        ...(logRows || []).map((r: any) => normalizeTitle(r.details?.title)).filter(Boolean),
      ]);

      let newlyPosted = 0;

      for (const deal of deals) {
        const normTitle = normalizeTitle(deal.title);
        if (postedSet.has(deal.dealId) || (normTitle && postedNormSet.has(normTitle))) {
          continue;
        }

        if (newlyPosted >= 20) break; // Allow up to 20 deal alerts per trigger (Discord anti-spam safe)

        // 1.2s delay between posts to strictly comply with Discord's rate limit (5 msg / 5s)
        if (newlyPosted > 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }

        const is100Free = deal.isFree || deal.savingsPercent >= 100;
        const titleHeader = is100Free
          ? `🎁 FREE GAME ALERT — ${deal.title}`
          : `🏷️ ${deal.savingsPercent}% OFF DEAL — ${deal.title}`;

        const embedColor = is100Free ? 0x10B981 : 0xF59E0B;

        const embed: any = {
          title: titleHeader,
          url: deal.dealUrl,
          description:
            `A high-value game offer is live on **${deal.storeName}**!\n\n` +
            `💰 **Original Price**: ~~$${deal.normalPrice.toFixed(2)} USD~~\n` +
            `🔥 **Current Price**: **${is100Free ? 'FREE (100% OFF)' : `$${deal.salePrice.toFixed(2)} USD`}**\n` +
            `📉 **Discount**: **-${deal.savingsPercent}% OFF**\n` +
            `⏰ **Expires**: <t:${Math.floor(new Date(deal.expiresAt).getTime() / 1000)}:R>`,
          color: embedColor,
          footer: { text: `ENOS Free Game Alerts • ${deal.storeName}` },
          timestamp: new Date().toISOString(),
        };

        if (deal.imageUrl) embed.image = { url: deal.imageUrl };

        const buttonLabel = is100Free ? '🎁 Claim Free Game' : `🛒 Claim ${deal.savingsPercent}% OFF Deal`;
        const components = [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5, // LINK BUTTON
                label: buttonLabel,
                url: deal.dealUrl,
                emoji: { name: is100Free ? '🎁' : '🛒' },
              },
            ],
          },
        ];

        const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${DISCORD_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed], components }),
        });

        if (discordRes.ok) {
          const sentMsg = await discordRes.json();
          newlyPosted++;

          await supabaseAdmin.from('free_game_deals').upsert(
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
              channel_id: channelId.trim(),
              message_id: sentMsg.id,
              expires_at: deal.expiresAt,
            },
            { onConflict: 'guild_id,deal_id' }
          );

          await supabaseAdmin.from('bot_event_logs').insert({
            guild_id: guildId,
            event_type: 'free_game_alert_posted',
            details: {
              deal_id: deal.dealId,
              title: deal.title,
              store: deal.storeName,
              message_id: sentMsg.id,
            },
          });

          postedSet.add(deal.dealId);
          if (normTitle) postedNormSet.add(normTitle);
        }
      }

      return NextResponse.json({
        success: true,
        count: newlyPosted,
        message: newlyPosted > 0 ? `Successfully posted ${newlyPosted} new deal alert cards to Discord!` : 'All current deals have already been posted.',
      });
    }

    if (action === 'prune') {
      const nowIso = new Date().toISOString();
      const { data: expiredDeals } = await supabaseAdmin
        .from('free_game_deals')
        .select('*')
        .eq('guild_id', guildId)
        .lte('expires_at', nowIso);

      let deletedCount = 0;
      if (expiredDeals && expiredDeals.length > 0) {
        for (const deal of expiredDeals) {
          if (DISCORD_TOKEN) {
            await fetch(`https://discord.com/api/v10/channels/${deal.channel_id}/messages/${deal.message_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
            }).catch(() => {});
          }
          await supabaseAdmin
            .from('free_game_deals')
            .update({ expires_at: '2099-01-01T00:00:00.000Z' })
            .eq('id', deal.id);
          deletedCount++;
        }
      }

      return NextResponse.json({ success: true, count: deletedCount, message: `Cleaned ${deletedCount} expired deal posts.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
