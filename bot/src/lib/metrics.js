/**
 * ENOS System Telemetry & Feature Resource Metrics
 * Zero-cost in-memory resource weight tracker for Fly.io worker.
 * Covers all features across every dashboard sidebar section.
 */

const logger = require('./logger');

const ALL_FEATURES = [
  // Gaming
  { key: 'weekly_boss', name: 'Weekly World Boss RPG', section: 'Gaming', icon: '⚔️', resourceType: 'Canvas Battle Render & RPC', defaultWeight: 32 },
  { key: 'vault_economy', name: 'Vault Economy & Daily Quests', section: 'Gaming', icon: '🪙', resourceType: 'Voice XP Ticker & Postgres RPC', defaultWeight: 14 },
  { key: 'trivia', name: 'Daily Community Trivia', section: 'Gaming', icon: '❓', resourceType: 'Gemini Engine & Scoring', defaultWeight: 10 },
  { key: 'free_game_alerts', name: 'Free Games & Deals Alerts', section: 'Gaming', icon: '🎮', resourceType: 'RSS Scraper & GamerPower API', defaultWeight: 5 },
  { key: 'lfg', name: 'LFG Party Builder', section: 'Gaming', icon: '🎯', resourceType: 'Session Tracker & Timers', defaultWeight: 3 },
  { key: 'recruitment_achievement', name: 'Master Achievements & Badges', section: 'Gaming', icon: '🏆', resourceType: 'Canvas Graphics & Role Dispatch', defaultWeight: 3 },

  // AI Companion
  { key: 'npc', name: 'ENOS AI Companion (Deliberation)', section: 'Companion', icon: '🤖', resourceType: 'Gemini Flash Deliberation', defaultWeight: 24 },
  { key: 'npc_lore', name: 'AI Server Lore & Memories', section: 'Companion', icon: '🧠', resourceType: 'Vector Search & Supabase Context', defaultWeight: 3 },
  { key: 'npc_channels', name: 'Channel Listener & Debounce', section: 'Companion', icon: '💬', resourceType: 'Message Stream Ingestion', defaultWeight: 2 },

  // Moderation
  { key: 'gatekeeper', name: 'Gatekeeper / Onboarding', section: 'Moderation', icon: '🛡️', resourceType: 'Form Actions & Role Sync', defaultWeight: 3 },
  { key: 'help_desk', name: 'AI Help Desk & Tickets', section: 'Moderation', icon: '🎫', resourceType: 'Gemini 2.5 Flash Chat Threads', defaultWeight: 4 },
  { key: 'digest', name: 'Daily AI Community Digest', section: 'Moderation', icon: '📜', resourceType: 'Gemini Summary & Scheduled Embed', defaultWeight: 3 },
  { key: 'keyform', name: 'Keyform Whitelist System', section: 'Moderation', icon: '🔑', resourceType: 'Game Server Access & Role Sync', defaultWeight: 2 },
  { key: 'announcebot', name: 'Announcebot & Scheduled Posts', section: 'Moderation', icon: '📢', resourceType: 'Embed Dispatcher & Queue Timer', defaultWeight: 2 },
  { key: 'showcase', name: 'Feature Showcase Cards', section: 'Moderation', icon: '✨', resourceType: 'Interactive Cards & Feedback Modals', defaultWeight: 2 },

  // Social
  { key: 'live_alerts', name: 'Twitch & TikTok Live Alerts', section: 'Social', icon: '📡', resourceType: 'Live Stream Poller & Alerts', defaultWeight: 4 },
  { key: 'en_tts', name: 'Herald of Voice (TTS)', section: 'Social', icon: '🎙️', resourceType: 'Voice Channel Streamer', defaultWeight: 2 },
  { key: 'translator', name: 'Message Translator', section: 'Social', icon: '🌐', resourceType: 'Language Translation API', defaultWeight: 2 },
  { key: 'birthday_settings', name: 'Birthday Cards & Celebration', section: 'Social', icon: '🎂', resourceType: 'Canvas Graphics & Scheduler', defaultWeight: 2 },
  { key: 'auto_reactions', name: 'Auto-Reactions Engine', section: 'Social', icon: '⚡', resourceType: 'Regex Stream Filter', defaultWeight: 1 },

  // Newsroom
  { key: 'newsroom', name: 'Gaming Newsroom Aggregator', section: 'Newsroom', icon: '📰', resourceType: 'Multi-Feed RSS Engine', defaultWeight: 3 },

  // System Ops & Logs
  { key: 'system_ops', name: 'System Ops & Heartbeats', section: 'System', icon: '⚙️', resourceType: 'Cron Schedulers & Telemetry', defaultWeight: 1 },
  { key: 'pruner', name: 'Database Storage Pruner', section: 'System', icon: '🗑️', resourceType: 'Data Retention Cleanup', defaultWeight: 1 },
  { key: 'audit_logs', name: 'Audit & Bot Event Logs', section: 'System', icon: '📋', resourceType: 'Structured Event Logger', defaultWeight: 1 },
];

const dailyCounters = new Map();
const weeklyCounters = new Map();

// Initialize baseline counts
ALL_FEATURES.forEach(f => {
  dailyCounters.set(f.key, f.defaultWeight);
  weeklyCounters.set(f.key, f.defaultWeight * 7);
});

/**
 * Record resource consumption weight for a feature.
 * @param {string} featureKey
 * @param {number} weight
 */
function recordActivity(featureKey, weight = 1) {
  if (!dailyCounters.has(featureKey)) return;
  dailyCounters.set(featureKey, (dailyCounters.get(featureKey) || 0) + weight);
  weeklyCounters.set(featureKey, (weeklyCounters.get(featureKey) || 0) + weight);
}

/**
 * Get container memory load relative to Fly.io 256MB limit.
 */
function getContainerMemoryStats() {
  const mem = process.memoryUsage();
  const rssMB = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
  const heapUsedMB = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const limitMB = 256;
  const usagePercent = Math.min(100, Math.round((rssMB / limitMB) * 100));

  let healthStatus = 'healthy'; // 0 - 50%
  if (usagePercent > 80) healthStatus = 'critical';
  else if (usagePercent > 50) healthStatus = 'warning';

  return {
    rssMB,
    heapUsedMB,
    limitMB,
    usagePercent,
    healthStatus,
  };
}

/**
 * Compute 0-100% normalized resource distributions.
 * @param {'daily'|'weekly'} timeframe
 */
function calculateFeaturePercentages(timeframe = 'daily') {
  const counterMap = timeframe === 'weekly' ? weeklyCounters : dailyCounters;
  let totalScore = 0;

  for (const f of ALL_FEATURES) {
    totalScore += (counterMap.get(f.key) || 0);
  }

  if (totalScore === 0) totalScore = 1;

  const results = ALL_FEATURES.map(f => {
    const rawScore = counterMap.get(f.key) || 0;
    const pct = Math.round((rawScore / totalScore) * 1000) / 10; // e.g. 24.5%

    let healthStatus = 'healthy';
    if (pct >= 80) healthStatus = 'critical';
    else if (pct >= 50) healthStatus = 'warning';

    return {
      key: f.key,
      name: f.name,
      section: f.section,
      icon: f.icon,
      resourceType: f.resourceType,
      percentage: pct,
      healthStatus,
    };
  });

  // Sort descending by percentage
  results.sort((a, b) => b.percentage - a.percentage);
  return results;
}

/**
 * Flush telemetry metrics snapshot to Supabase during heartbeats.
 * @param {string} guildId
 * @param {any} supabaseClient
 */
async function syncTelemetry(guildId, supabaseClient) {
  if (!guildId || !supabaseClient) return;

  try {
    const memStats = getContainerMemoryStats();
    const daily = calculateFeaturePercentages('daily');
    const weekly = calculateFeaturePercentages('weekly');

    const records = [
      ...daily.map(item => ({
        guild_id: guildId,
        feature_key: item.key,
        timeframe: 'daily',
        weight_score: dailyCounters.get(item.key) || 0,
        percentage: item.percentage,
        resource_type: item.resourceType,
        details: { memStats, section: item.section },
        recorded_at: new Date().toISOString(),
      })),
      ...weekly.map(item => ({
        guild_id: guildId,
        feature_key: item.key,
        timeframe: 'weekly',
        weight_score: weeklyCounters.get(item.key) || 0,
        percentage: item.percentage,
        resource_type: item.resourceType,
        details: { memStats, section: item.section },
        recorded_at: new Date().toISOString(),
      })),
    ];

    await supabaseClient
      .from('feature_resource_metrics')
      .upsert(records, { onConflict: 'guild_id,feature_key,timeframe' });
  } catch (err) {
    logger.warn(`[METRICS] Telemetry sync warning: ${err.message}`);
  }
}

module.exports = {
  ALL_FEATURES,
  recordActivity,
  getContainerMemoryStats,
  calculateFeaturePercentages,
  syncTelemetry,
};
