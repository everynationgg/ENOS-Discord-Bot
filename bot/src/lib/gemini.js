'use strict';

/**
 * Centralized Gemini Client with Dynamic Model Discovery & Fallback
 *
 * Prevents deprecation lock-in by querying Google's live catalog on startup,
 * ranking active Flash models, and failing over automatically if a model
 * returns 404 (retired), 429 (rate limit), or 503 (temporary capacity).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Static safety net if the models endpoint is down or unreachable
const DEFAULT_FLASH_MODELS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

// In-memory cache of model names, refreshed periodically
let cachedModels = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Fetches the live list of active models supporting generateContent from Google,
 * filters to text/Flash models, and ranks them:
 * 1. gemini-flash-latest (evergreen alias)
 * 2. Stable numbered flash models (newest first, e.g. 3.8 > 3.7 > 2.5)
 * 3. Lite / specialized flash models
 *
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<string[]>}
 */
async function getAvailableFlashModels(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedModels && cachedModels.length > 0 && now - lastFetchedAt < CACHE_TTL_MS) {
    return [...cachedModels];
  }

  if (!apiKey) {
    logger.warn('[GEMINI] GEMINI_API_KEY not configured. Using fallback roster.');
    cachedModels = DEFAULT_FLASH_MODELS;
    lastFetchedAt = now;
    return [...cachedModels];
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Catalog API responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawModels = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter(
        (name) =>
          name.includes('flash') &&
          !name.includes('image') &&
          !name.includes('tts') &&
          !name.includes('preview-tts') &&
          !name.includes('computer-use')
      );

    if (rawModels.length === 0) {
      throw new Error('No compatible Flash models returned by catalog');
    }

    // Intelligent sort:
    // 1. Evergreen alias 'gemini-flash-latest' first
    // 2. Standard Flash models next (higher version first)
    // 3. Experimental / Omni / preview models lower
    // 4. Lite models last
    const sorted = rawModels.sort((a, b) => {
      if (a === 'gemini-flash-latest') return -1;
      if (b === 'gemini-flash-latest') return 1;

      const aIsOmni = a.includes('omni');
      const bIsOmni = b.includes('omni');
      if (!aIsOmni && bIsOmni) return -1;
      if (aIsOmni && !bIsOmni) return 1;

      const aIsPreview = a.includes('preview');
      const bIsPreview = b.includes('preview');
      if (!aIsPreview && bIsPreview) return -1;
      if (aIsPreview && !bIsPreview) return 1;

      const aIsLite = a.includes('lite');
      const bIsLite = b.includes('lite');
      if (!aIsLite && bIsLite) return -1;
      if (aIsLite && !bIsLite) return 1;

      return b.localeCompare(a, undefined, { numeric: true });
    });

    cachedModels = sorted;
    lastFetchedAt = now;
    logger.info(`[GEMINI] Discovered ${sorted.length} active Flash models. Primary: "${sorted[0]}"`);
    return [...cachedModels];
  } catch (err) {
    logger.warn(`[GEMINI] Failed to fetch live model catalog (${err.message}). Using fallback roster.`);
    cachedModels = cachedModels && cachedModels.length > 0 ? cachedModels : DEFAULT_FLASH_MODELS;
    lastFetchedAt = now;
    return [...cachedModels];
  }
}

/**
 * Removes a defunct or deprecated model from the in-memory cache.
 * Triggers a fresh catalog discovery if the cache becomes empty.
 *
 * @param {string} modelName
 */
function invalidateModel(modelName) {
  if (!cachedModels) return;
  const idx = cachedModels.indexOf(modelName);
  if (idx !== -1) {
    cachedModels.splice(idx, 1);
    logger.warn(`[GEMINI] Model "${modelName}" evicted from active cache. Remaining candidates: ${cachedModels.length}`);
  }
  if (cachedModels.length === 0) {
    getAvailableFlashModels(true).catch(() => {});
  }
}

/**
 * Executes content generation across dynamically discovered models with automatic
 * failover on 404 (model deprecated) or 429 (rate limit exceeded).
 *
 * @param {string|object} prompt
 * @param {object} [options={}]
 * @param {object} [options.modelParams] Extra parameters passed to genAI.getGenerativeModel
 * @param {boolean} [options.throwOnError=false] If true, throws when all models fail
 * @returns {Promise<string|null>} The generated text, or null if all models failed
 */
async function generateContentWithFallback(prompt, options = {}) {
  const models = await getAvailableFlashModels();
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, ...(options.modelParams || {}) });
      const result = await model.generateContent(prompt);
      const text = result?.response?.text();
      if (text) {
        return text.trim();
      }
    } catch (err) {
      lastError = err;
      const errMsg = err.message || '';
      const isRetiredOrNotFound =
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('not supported for generateContent');

      if (isRetiredOrNotFound) {
        logger.warn(`[GEMINI] Model "${modelName}" is unavailable/retired (${errMsg}). Evicting and falling back...`);
        invalidateModel(modelName);
      } else {
        logger.warn(`[GEMINI] Model "${modelName}" failed (${errMsg}). Trying next candidate...`);
      }
    }
  }

  logger.error(`[GEMINI] All available Flash models failed. Last error: ${lastError?.message}`);
  if (options.throwOnError && lastError) {
    throw lastError;
  }
  return null;
}

module.exports = {
  genAI,
  getAvailableFlashModels,
  invalidateModel,
  generateContentWithFallback,
};
