/**
 * ENOS Newsroom — One-Shot Test Runner
 * Fires exactly ONE post per category (games, anime, movies) through the real pipeline.
 * Bypasses the frequency interval guard so it runs immediately.
 *
 * Usage:
 *   cd bot
 *   node scripts/test-newsroom.js
 */
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { evaluateArticleWithAi, classifyArticleType } = require('../src/modules/newsroom/engine');
const { dispatchArticleToDiscord } = require('../src/modules/newsroom/dispatcher');
const { getCategoryDef, NEWSROOM_CATEGORIES } = require('../src/modules/newsroom/registry');
const { supabase } = require('../src/lib/supabase');

const TEST_CATEGORIES = ['games', 'anime', 'movies'];

// ─── Minimal RSS Fetcher ──────────────────────────────────────────────────────

function cleanHtml(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, ' ').trim();
}

function extractImage(block) {
  const m = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)
    || block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/i)
    || block.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchFeed(feedUrl, sourceName) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(feedUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ENOS-Test/1.0', Accept: 'application/rss+xml, application/atom+xml, */*' },
    });
    clearTimeout(t);
    if (!res.ok) { console.warn(`  ⚠ Feed ${sourceName} returned HTTP ${res.status}`); return []; }
    const xml = await res.text();
    const items = [];

    // RSS <item> parsing
    const re = /<item[\s>](.*?)<\/item>/gs;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const b = m[1];
      const title = cleanHtml((b.match(/<title>(.*?)<\/title>/s) || [])[1]);
      const url = cleanHtml(((b.match(/<link>(.*?)<\/link>/s) || b.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/s) || [])[1] || '')).trim();
      const guid = cleanHtml(((b.match(/<guid[^>]*>(.*?)<\/guid>/s) || [])[1] || url)).trim();
      const summary = cleanHtml(((b.match(/<description>(.*?)<\/description>/s) || b.match(/<content:encoded>(.*?)<\/content:encoded>/s) || [])[1] || '')).substring(0, 500);
      const pubDate = cleanHtml(((b.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || ''));
      if (title && url) items.push({ guid: guid || url, title, url, summary, published_at: pubDate, image_url: extractImage(b), source_name: sourceName, raw_item_block: b });
    }

    // Atom <entry> parsing (YouTube channel feeds)
    const re2 = /<entry[\s>](.*?)<\/entry>/gs;
    while ((m = re2.exec(xml)) !== null) {
      const b = m[1];
      const title = cleanHtml((b.match(/<title[^>]*>(.*?)<\/title>/s) || [])[1]);
      const ytId = ((b.match(/<yt:videoId>(.*?)<\/yt:videoId>/s) || [])[1] || '').trim();
      const url = ytId ? `https://www.youtube.com/watch?v=${ytId}`
        : cleanHtml(((b.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) || b.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || '')).trim();
      const guid = ytId ? `yt:video:${ytId}` : cleanHtml(((b.match(/<id>(.*?)<\/id>/s) || [])[1] || url)).trim();
      const summary = cleanHtml(((b.match(/<media:description>(.*?)<\/media:description>/s) || b.match(/<summary[^>]*>(.*?)<\/summary>/s) || [])[1] || '')).substring(0, 500);
      const pubDate = cleanHtml(((b.match(/<published>(.*?)<\/published>/s) || b.match(/<updated>(.*?)<\/updated>/s) || [])[1] || ''));
      if (title && url) items.push({ guid: guid || url, title, url, summary, published_at: pubDate, image_url: extractImage(b), source_name: sourceName, raw_item_block: b });
    }

    return items;
  } catch (e) {
    clearTimeout(t);
    console.warn(`  ⚠ Feed ${sourceName} error: ${e.message}`);
    return [];
  }
}


// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 ENOS Newsroom — Test Runner (1 post per category)\n');

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  console.log(`✅ Logged in as ${client.user.tag}\n`);

  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_GUILD_ID;
  if (!guildId) { console.error('❌ No guild found.'); process.exit(1); }
  console.log(`🏠 Guild: ${guildId}\n`);

  for (const categoryId of TEST_CATEGORIES) {
    const cat = getCategoryDef(categoryId);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${cat.emoji} Testing category: ${cat.name.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);

    // Load config from Supabase
    const { data: configRow } = await supabase
      .from('guild_config')
      .select('*')
      .eq('guild_id', guildId)
      .eq('feature_key', `newsroom_${categoryId}`)
      .maybeSingle();

    if (!configRow || !configRow.enabled) {
      console.log(`  ⏭  Category disabled or not configured — skipping.`);
      continue;
    }

    const config = configRow.config || {};
    if (!config.channel_id) {
      console.log(`  ⏭  No channel_id set — skipping.`);
      continue;
    }

    // Load posted history from config.posted_guids to avoid re-posting
    const configPostedGuids = Array.isArray(config.posted_guids) ? config.posted_guids : [];
    const postedGuids = new Set(configPostedGuids);
    const postedTitles = [];

    // Fetch feeds
    const enabledSourceIds = config.enabled_sources || cat.defaultSources.map(s => s.id);
    const activeSources = cat.defaultSources.filter(s => enabledSourceIds.includes(s.id) || s.id.startsWith('yt_'));
    console.log(`  📡 Sources: ${activeSources.map(s => s.name).join(', ')}`);

    const feedResults = await Promise.all(activeSources.map(s => fetchFeed(s.feedUrl, s.name)));
    const articles = feedResults.flat();
    console.log(`  📰 Total items fetched: ${articles.length}`);

    let posted = false;
    for (const article of articles) {
      if (posted) break;

      // Skip already posted
      if (postedGuids.has(article.guid) || postedGuids.has(article.url)) continue;
      const lowerTitle = article.title.toLowerCase();
      if (postedTitles.some(t => t === lowerTitle)) continue;

      console.log(`\n  🔍 Evaluating: "${article.title}"`);

      const aiEval = await evaluateArticleWithAi(article, categoryId);
      if (!aiEval || !aiEval.is_relevant) {
        console.log(`  ❌ Rejected: ${aiEval?.rejection_reason || 'AI filter'}`);
        continue;
      }

      console.log(`  ✅ Accepted  | type: ${aiEval.content_type} | video: ${aiEval.video_url || 'none'}`);

      const articleType = classifyArticleType(article);
      const isTrailerContentType = (aiEval.content_type || '').toLowerCase() === 'trailer' || Boolean(aiEval.video_url);
      const targetChannelId = (!isTrailerContentType && articleType === 'review' && config.review_channel_id)
        ? config.review_channel_id
        : (config.upcoming_channel_id || config.channel_id);

      const fullArticle = {
        ...article,
        category: categoryId,
        ai_caption: aiEval.caption,
        content_type: aiEval.content_type,
        video_url: aiEval.video_url,
        article_type: articleType,
      };

      try {
        const dispatchRes = await dispatchArticleToDiscord(client, guildId, { ...config, channel_id: targetChannelId }, fullArticle);
        console.log(`  📨 Dispatched! channel=${dispatchRes.channel_id} msg=${dispatchRes.message_id}`);

        postedGuids.add(article.guid);
        postedGuids.add(article.url);
        const updatedGuids = Array.from(postedGuids).slice(-200);
        const updatedConfig = { ...config, posted_guids: updatedGuids };
        try {
          await supabase
            .from('guild_config')
            .update({ config: updatedConfig })
            .eq('guild_id', guildId)
            .eq('feature_key', `newsroom_${categoryId}`);
        } catch (e) {
          console.warn('  ⚠ Config save notice:', e.message);
        }

        posted = true;
      } catch (err) {
        console.log(`  ⚠ Dispatch skipped: ${err.message}`);
        // Trailer with no video URL — try next article
        if (!err.message.startsWith('Skipping trailer')) break;
      }
    }

    if (!posted) {
      console.log(`  ℹ️  No new eligible articles found for ${cat.name} this run.`);
    }
  }

  console.log('\n\n✅ Test run complete.\n');
  await client.destroy();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
