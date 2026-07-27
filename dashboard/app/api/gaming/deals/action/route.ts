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
    const res = await fetch(`https://www.cheapshark.com/api/1.0/deals?upperPrice=50&sortBy=Savings&desc=1&pageSize=20`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((d: any) => {
        const savings = parseFloat(d.savings || '0');
        return savings >= minDiscountPercent;
      })
      .map((d: any) => {
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
    return [];
  }
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
      const [csDeals, gpDeals] = await Promise.all([
        fetchCheapSharkDeals(minDiscount),
        fetchGamerPowerDeals(),
      ]);

      const dealMap = new Map();
      [...gpDeals, ...csDeals].forEach((d) => {
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

        if (newlyPosted >= 3) break; // Limit 3 deal alerts per manual trigger button push

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
