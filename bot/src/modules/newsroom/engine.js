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
          summary: summary.substring(0, 500),
          published_at: publishedAt,
          image_url: imageUrl,
          source_name: sourceName,
          raw_item_block: itemBlock,
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
 * Extracts direct YouTube / Vimeo video URLs from RSS XML item blocks, title, or summary.
 */
function extractVideoUrl(itemBlock = '', title = '', summary = '') {
  const combinedStr = `${itemBlock} ${title} ${summary}`;

  // 1. YouTube watch or share URL
  const ytWatchMatch = combinedStr.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i);
  if (ytWatchMatch) return `https://www.youtube.com/watch?v=${ytWatchMatch[1]}`;

  const ytShortMatch = combinedStr.match(/https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (ytShortMatch) return `https://www.youtube.com/watch?v=${ytShortMatch[1]}`;

  const ytEmbedMatch = combinedStr.match(/https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (ytEmbedMatch) return `https://www.youtube.com/watch?v=${ytEmbedMatch[1]}`;

  // 2. Vimeo video URL
  const vimeoMatch = combinedStr.match(/https?:\/\/(?:www\.)?vimeo\.com\/([0-9]+)/i);
  if (vimeoMatch) return `https://vimeo.com/${vimeoMatch[1]}`;

  return null;
}

/**
 * Heuristic fallback check if AI fails or API key is unconfigured.
 */
function heuristicRelevanceCheck(article, categoryId, videoUrl) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  const hardwareTerms = [
    'keyboard', 'mouse', 'gpu', 'graphics card', 'rtx 50', 'rtx 40', 'rx 7', 'headset',
    'gaming pc', 'monitor', 'pc build', 'affiliate', 'deal on', 'best price', 'discount code',
    'laptop deal', 'prebuilt', 'motherboard', 'ram deal', 'ssd deal', 'hardware review'
  ];

  const hasHardware = hardwareTerms.some((t) => text.includes(t));
  if (hasHardware && categoryId.toLowerCase() === 'games') {
    return {
      is_relevant: false,
      rejection_reason: 'Hardware or shopping ad detected in Games category',
      content_type: 'Ad',
      caption: article.summary,
      video_url: videoUrl,
    };
  }

  return {
    is_relevant: true,
    rejection_reason: null,
    content_type: classifyArticleType(article) === 'review' ? 'Review' : 'News',
    caption: article.summary,
    video_url: videoUrl,
  };
}

/**
 * Uses Gemini AI as a Content Bouncer & Enricher:
 * 1. Validates relevance to category (rejecting ads, hardware, keyboards, mice, GPUs, shopping deals).
 * 2. Classifies content type (Trailer, Patch Notes, Release, Announcement, Review, Dev Blog, etc.).
 * 3. Generates concise summary caption without repeating headline title.
 * 4. Extracts or verifies direct video URL.
 */
async function evaluateArticleWithAi(article, categoryId) {
  const extractedVideo = extractVideoUrl(article.raw_item_block, article.title, article.summary);

  if (!genAI) {
    return heuristicRelevanceCheck(article, categoryId, extractedVideo);
  }

  const prompt = `You are the ENOS Newsroom Content Quality Bouncer & Curator for category "${categoryId}".
Analyze this news item:
Title: "${article.title}"
Source: "${article.source_name}"
Excerpt: "${article.summary}"

Quality Rules for "${categoryId}":
- "games": Must be genuine video game news, announcements, patch notes, DLC, release dates, gameplay trailers, dev blogs, or official store free games (e.g. Epic Games Free Games). REJECT ALL hardware (keyboards, mice, headsets, GPUs, PCs, monitors, hardware reviews, PC builds), merchandise, store ads, sponsored shopping content, affiliate deals, or buying guides.
- "anime": Must be anime news, episode releases, manga announcements, or animation trailers. REJECT hardware, tech sales, and shopping ads.
- "movies": Must be film/movie news, trailers, casting, release dates, or movie reviews. REJECT TV show listicles/guides, television series news, tech ads, and hardware sales.
- "music": Must be music news, album drops, music videos, artist announcements, or tour dates. REJECT audio equipment buying guides and hardware.

Respond ONLY with a JSON object in this exact format (no markdown tags):
{
  "is_relevant": true,
  "rejection_reason": null,
  "content_type": "Trailer",
  "caption": "Concise 1-2 sentence summary caption without repeating headline title unnecessarily.",
  "video_url": null
}`;

  try {
    let model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    let result = await model.generateContent(prompt);
    let rawText = result.response.text().trim();

    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      is_relevant: Boolean(parsed.is_relevant),
      rejection_reason: parsed.rejection_reason || null,
      content_type: parsed.content_type || 'News',
      caption: parsed.caption || article.summary,
      video_url: parsed.video_url || extractedVideo,
    };
  } catch (err) {
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      try {
        let fallbackModel = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        let fallbackResult = await fallbackModel.generateContent(prompt);
        let rawText = fallbackResult.response.text().trim();
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          is_relevant: Boolean(parsed.is_relevant),
          rejection_reason: parsed.rejection_reason || null,
          content_type: parsed.content_type || 'News',
          caption: parsed.caption || article.summary,
          video_url: parsed.video_url || extractedVideo,
        };
      } catch (e) {
        return heuristicRelevanceCheck(article, categoryId, extractedVideo);
      }
    }
    return heuristicRelevanceCheck(article, categoryId, extractedVideo);
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
    const now = Date.now();

    if (!categoryLastRunMap.has(lastRunKey)) {
      // First check on process start: initialize to NOW so it does not fire immediately on boot
      categoryLastRunMap.set(lastRunKey, now);
      return;
    }

    const lastRunTime = categoryLastRunMap.get(lastRunKey);
    const freqMinutesMap = { '15m': 15, '30m': 30, '1h': 60, '6h': 360, '12h': 720, '24h': 1440 };
    const requiredIntervalMs = (freqMinutesMap[config.posting_frequency || '12h'] || 720) * 60 * 1000;

    if (now - lastRunTime < requiredIntervalMs) {
      return; // Skip — waiting for posting_frequency schedule
    }

    categoryLastRunMap.set(lastRunKey, now);

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

    // Fetch posted article history from Supabase (or fallback to persistent config.posted_guids)
    const { data: postedRows } = await supabase
      .from('newsroom_posts')
      .select('article_guid, title')
      .eq('guild_id', guildId)
      .eq('category', categoryId.toLowerCase())
      .order('posted_at', { ascending: false })
      .limit(200);

    const configPostedGuids = Array.isArray(config.posted_guids) ? config.posted_guids : [];
    const postedGuids = new Set([
      ...configPostedGuids,
      ...inMemoryPostedGuids,
      ...(postedRows || []).map((r) => r.article_guid),
    ]);
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

      // 4. AI Quality Bouncer & Content Enrichment
      const aiEval = await evaluateArticleWithAi(article, categoryId);
      if (!aiEval || !aiEval.is_relevant) {
        logger.info(`[NEWSROOM BOUNCER] Filtered out non-relevant content: "${article.title}" (${aiEval?.rejection_reason || 'Filtered by AI'})`);
        continue;
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
        ai_caption: aiEval.caption,
        content_type: aiEval.content_type,
        video_url: aiEval.video_url,
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

        // Persist updated posted_guids back to guild_config in Supabase (keeps last 200 items permanently)
        const updatedGuids = Array.from(postedGuids).slice(-200);
        const updatedConfig = { ...config, posted_guids: updatedGuids };
        await supabase
          .from('guild_config')
          .update({ config: updatedConfig })
          .eq('guild_id', guildId)
          .eq('feature_key', featureKey)
          .catch(() => {});

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
  evaluateArticleWithAi,
  extractVideoUrl,
  classifyArticleType,
};
