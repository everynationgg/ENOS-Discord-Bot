const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../lib/logger');
const { supabase } = require('../../lib/supabase');
const { NEWSROOM_CATEGORIES, getCategoryDef } = require('./registry');
const { dispatchArticleToDiscord } = require('./dispatcher');

// Gemini AI Setup
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// In-Memory Caches to prevent duplicate posting even if database history table is missing
const inMemoryPostedGuids = new Set();
const inMemoryPostedTitles = new Set();
const categoryLastRunMap = new Map();

/**
 * Strips HTML tags and unescapes common HTML entities from RSS content.
 */
function cleanHtmlText(rawHtml) {
  if (!rawHtml) return '';
  return String(rawHtml)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts banner image URL from RSS item fields or enclosure tags.
 */
function extractImageUrl(itemStr) {
  // 1. Check media:content or media:thumbnail url
  const mediaMatch = itemStr.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];

  // 2. Check enclosure url
  const enclosureMatch = itemStr.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch && enclosureMatch[1].match(/\.(jpg|jpeg|png|webp|gif)/i)) {
    return enclosureMatch[1];
  }

  // 3. Check img src in description
  const imgMatch = itemStr.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

/**
 * Lightweight RSS/Atom Feed fetcher using native fetch with a 5-second timeout.
 */
async function fetchRssFeed(feedUrl, sourceName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Discord-Bot/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`[NEWSROOM RSS] Feed returned HTTP ${res.status}: ${feedUrl}`);
      return [];
    }

    const xmlText = await res.text();
    const items = [];

    // Parse RSS <item> tags
    const itemRegex = /<item[\s>](.*?)<\/item>/gs;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemBlock = match[1];

      const titleMatch = itemBlock.match(/<title>(.*?)<\/title>/s);
      const linkMatch = itemBlock.match(/<link>(.*?)<\/link>/s) || itemBlock.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/s);
      const guidMatch = itemBlock.match(/<guid[^>]*>(.*?)<\/guid>/s);
      const descMatch = itemBlock.match(/<description>(.*?)<\/description>/s) || itemBlock.match(/<content:encoded>(.*?)<\/content:encoded>/s);
      const dateMatch = itemBlock.match(/<pubDate>(.*?)<\/pubDate>/s) || itemBlock.match(/<dc:date>(.*?)<\/dc:date>/s);

      const title = cleanHtmlText(titleMatch ? titleMatch[1] : '');
      const url = (linkMatch ? cleanHtmlText(linkMatch[1]) : '').trim();
      const guid = (guidMatch ? cleanHtmlText(guidMatch[1]) : url).trim();
      const summary = cleanHtmlText(descMatch ? descMatch[1] : '');
      const publishedAt = dateMatch ? cleanHtmlText(dateMatch[1]) : null;
      const imageUrl = extractImageUrl(itemBlock);

      if (title && url) {
        items.push({
          guid: guid || url,
          title,
          url,
          summary: summary.substring(0, 400),
          published_at: publishedAt,
          image_url: imageUrl,
          source_name: sourceName,
        });
      }
    }

    return items;
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn(`[NEWSROOM RSS] Failed fetching feed ${sourceName} (${feedUrl}): ${err.message}`);
    return [];
  }
}

/**
 * Generates a 2-bullet TL;DR summary using Gemini 2.5 Flash with fallback to gemini-flash-latest.
 */
async function generateAiSummary(title, summary) {
  if (!genAI) return null;

  const prompt = `Write a short 2-bullet point TL;DR summary for this news headline and excerpt:\nHeadline: ${title}\nExcerpt: ${summary}\nKeep it concise and punchy for Discord news alerts. Format with bullet points: • `;

  try {
    let model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    let result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    return text;
  } catch (err) {
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      try {
        let fallbackModel = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        let fallbackResult = await fallbackModel.generateContent(prompt);
        return fallbackResult.response.text().trim();
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Classifies an article as 'review' vs 'upcoming' based on title and summary keywords.
 */
function classifyArticleType(article) {
  const text = `${article.title} ${article.summary} ${article.source_name}`.toLowerCase();
  const reviewKeywords = [
    'review',
    'rating',
    'score',
    'verdict',
    'recap',
    'critique',
    'breakdown',
    'thoughts on',
    'worth watching',
    'worth playing',
    'rotten tomatoes',
  ];
  return reviewKeywords.some((k) => text.includes(k)) ? 'review' : 'upcoming';
}

/**
 * Processes a single newsroom category for a guild.
 */
async function processNewsroomCategory(client, guildId, categoryId) {
  try {
    const featureKey = `newsroom_${categoryId.toLowerCase()}`;
    const { data: configRow } = await supabase
      .from('guild_config')
      .select('*')
      .eq('guild_id', guildId)
      .eq('feature_key', featureKey)
      .maybeSingle();

    if (!configRow || !configRow.enabled) return;

    const config = configRow.config || {};
    if (!config.channel_id) return;

    // Check execution frequency interval according to setting (15m, 30m, 1h, 6h, 12h, 24h)
    const lastRunKey = `${guildId}_${categoryId.toLowerCase()}`;
    const lastRunTime = categoryLastRunMap.get(lastRunKey) || 0;
    const freqMinutesMap = { '15m': 15, '30m': 30, '1h': 60, '6h': 360, '12h': 720, '24h': 1440 };
    const requiredIntervalMs = (freqMinutesMap[config.posting_frequency || '12h'] || 720) * 60 * 1000;

    if (lastRunTime > 0 && Date.now() - lastRunTime < requiredIntervalMs) {
      return; // Skip — waiting for posting_frequency schedule
    }

    categoryLastRunMap.set(lastRunKey, Date.now());

    const categoryDef = getCategoryDef(categoryId);
    if (!categoryDef) return;

    // Build complete active source list
    const enabledSourceIds = config.enabled_sources || categoryDef.defaultSources.map((s) => s.id);
    const customSources = config.custom_sources || [];

    const activeSources = [];

    // Built-in sources
    categoryDef.defaultSources.forEach((ds) => {
      if (enabledSourceIds.includes(ds.id)) {
        activeSources.push({ id: ds.id, name: ds.name, feedUrl: ds.feedUrl });
      }
    });

    // Custom sources
    customSources.forEach((cs) => {
      if (cs.enabled && cs.feedUrl) {
        activeSources.push({ id: cs.id, name: cs.name, feedUrl: cs.feedUrl });
      }
    });

    if (!activeSources.length) return;

    // Fetch posted article history from Supabase
    const { data: postedRows } = await supabase
      .from('newsroom_posts')
      .select('article_guid, title')
      .eq('guild_id', guildId)
      .eq('category', categoryId.toLowerCase())
      .order('posted_at', { ascending: false })
      .limit(200);

    const postedGuids = new Set((postedRows || []).map((r) => r.article_guid));
    const postedTitles = (postedRows || []).map((r) => r.title.toLowerCase());

    // Fetch all active feeds concurrently
    const feedPromises = activeSources.map((source) => fetchRssFeed(source.feedUrl, source.name));
    const feedResults = await Promise.all(feedPromises);

    const allArticles = feedResults.flat();
    if (!allArticles.length) return;

    const maxPosts = config.max_posts_per_run || 2;
    const blacklist = config.keyword_blacklist || [];
    const whitelist = config.keyword_whitelist || [];

    let postedCount = 0;

    for (const article of allArticles) {
      if (postedCount >= maxPosts) break;

      // 1. Check if already posted by GUID/URL (Database + In-Memory protection)
      if (
        postedGuids.has(article.guid) ||
        postedGuids.has(article.url) ||
        inMemoryPostedGuids.has(article.guid) ||
        inMemoryPostedGuids.has(article.url)
      ) {
        continue;
      }

      // 2. Check title similarity to avoid duplicate breaking news spam
      const lowerTitle = article.title.toLowerCase();
      if (inMemoryPostedTitles.has(lowerTitle)) continue;

      const isDuplicateTitle = postedTitles.some((t) => {
        if (t === lowerTitle) return true;
        const wordsA = t.split(/\s+/).filter((w) => w.length > 3);
        const wordsB = lowerTitle.split(/\s+/).filter((w) => w.length > 3);
        if (wordsA.length < 3 || wordsB.length < 3) return false;
        const matches = wordsA.filter((w) => wordsB.includes(w));
        return matches.length >= Math.min(wordsA.length, wordsB.length) * 0.8;
      });

      if (isDuplicateTitle) continue;

      // 3. Apply Blacklist / Whitelist filters
      if (blacklist.length && blacklist.some((b) => lowerTitle.includes(b) || article.summary.toLowerCase().includes(b))) {
        continue;
      }
      if (whitelist.length && !whitelist.some((w) => lowerTitle.includes(w) || article.summary.toLowerCase().includes(w))) {
        continue;
      }

      // 4. Generate AI summary if configured
      let aiSummaryText = null;
      if (config.ai_summaries) {
        aiSummaryText = await generateAiSummary(article.title, article.summary);
      }

      const articleType = classifyArticleType(article);
      const targetChannelId = (articleType === 'review' && config.review_channel_id)
        ? config.review_channel_id
        : (config.upcoming_channel_id || config.channel_id);

      if (!targetChannelId) continue;

      const effectiveConfig = {
        ...config,
        channel_id: targetChannelId,
      };

      const fullArticlePayload = {
        ...article,
        category: categoryId.toLowerCase(),
        ai_summary: aiSummaryText,
        article_type: articleType,
      };

      // 5. Dispatch to Discord
      try {
        const dispatchRes = await dispatchArticleToDiscord(client, guildId, effectiveConfig, fullArticlePayload);

        // 6. Record in Supabase database (non-blocking fallback)
        try {
          await supabase
            .from('newsroom_posts')
            .insert({
              guild_id: guildId,
              category: categoryId.toLowerCase(),
              article_guid: article.guid,
              title: article.title,
              url: article.url,
              source_name: article.source_name,
              channel_id: dispatchRes.channel_id,
              thread_id: dispatchRes.thread_id,
              message_id: dispatchRes.message_id,
            });
        } catch (dbErr) {
          logger.warn(`[NEWSROOM ENGINE] DB record notice: ${dbErr.message}`);
        }

        postedGuids.add(article.guid);
        postedGuids.add(article.url);
        postedTitles.push(lowerTitle);

        inMemoryPostedGuids.add(article.guid);
        inMemoryPostedGuids.add(article.url);
        inMemoryPostedTitles.add(lowerTitle);
        postedCount++;

        // Stagger posts by 1.5s to prevent Discord API rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        logger.error(`[NEWSROOM ENGINE] Failed dispatching article "${article.title}":`, err.message || err);
      }
    }
  } catch (err) {
    logger.error(`[NEWSROOM ENGINE] Error processing category ${categoryId} for guild ${guildId}:`, err.message || err);
  }
}

/**
 * Master check and dispatch loop for all newsroom categories across active guilds.
 */
async function checkAndDispatchNewsroom(client) {
  try {
    const activeGuilds = client.guilds.cache.map((g) => g.id);

    for (const guildId of activeGuilds) {
      for (const cat of NEWSROOM_CATEGORIES) {
        await processNewsroomCategory(client, guildId, cat.id);
      }
    }
  } catch (err) {
    logger.error('[NEWSROOM ENGINE] Error in master newsroom worker loop:', err.message || err);
  }
}

module.exports = {
  checkAndDispatchNewsroom,
  processNewsroomCategory,
};
