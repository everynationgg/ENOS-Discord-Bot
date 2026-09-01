import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only instantiated on first call, not at module load time.
// This prevents Next.js static build analysis from throwing on missing env vars.
let _client: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// Named export for backwards compatibility — resolves lazily on access
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdminClient() as any)[prop];
  },
});

/**
 * Get all feature configs for a guild.
 */
export async function getGuildConfigs(guildId: string) {
  const { data, error } = await supabaseAdmin
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId);

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get a single feature config.
 */
export async function getFeatureConfig(guildId: string, featureKey: string) {
  const { data, error } = await supabaseAdmin
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .eq('feature_key', featureKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Upsert a feature config (toggle + config JSON).
 */
export async function upsertFeatureConfig(
  guildId: string,
  featureKey: string,
  enabled: boolean,
  config: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.from('guild_config').upsert(
    {
      guild_id: guildId,
      feature_key: featureKey,
      enabled,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'guild_id,feature_key' }
  );

  if (error) throw new Error(error.message);
}

/**
 * Get bot health status for a guild.
 */
export async function getBotHealth(guildId: string) {
  const { data } = await supabaseAdmin
    .from('bot_health')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  return data;
}

/**
 * Get recent bot event logs for a guild.
 */
export async function getBotLogs(guildId: string, limit = 50, eventType?: string) {
  let query = supabaseAdmin
    .from('bot_event_logs')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (eventType) query = query.eq('event_type', eventType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get vault leaderboard data.
 */
export async function getVaultLeaderboard(guildId: string, limit = 10) {
  const { data, error } = await supabaseAdmin
    .from('vault_balances')
    .select('discord_id, coins, tier, voice_minutes, last_active')
    .eq('guild_id', guildId)
    .order('coins', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Manually trigger data pruning via Supabase RPC (if pg_cron function is set up).
 */
export async function triggerPruning() {
  const { error } = await supabaseAdmin.rpc('prune_old_records');
  if (error) throw new Error(error.message);
}

/**
 * Get all keyform configurations for a guild.
 */
export async function getKeyformConfigs(guildId: string) {
  const { data, error } = await supabaseAdmin
    .from('keyform_configs')
    .select('*')
    .eq('guild_id', guildId)
    .order('game_name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Upsert a keyform configuration.
 */
export async function upsertKeyformConfig(
  guildId: string,
  gameKey: string,
  gameName: string,
  serverUrl: string,
  serverPassword: string,
  targetChannelId: string,
  logChannelId: string,
  rules: string[]
) {
  const { error } = await supabaseAdmin.from('keyform_configs').upsert(
    {
      guild_id: guildId,
      game_key: gameKey,
      game_name: gameName,
      server_url: serverUrl,
      server_password: serverPassword,
      target_channel_id: targetChannelId,
      log_channel_id: logChannelId,
      rules,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'guild_id,game_key' }
  );

  if (error) throw new Error(error.message);
}

/**
 * Get all keyform registrations for a guild, optionally filtered by game.
 */
export async function getKeyformRegistrations(guildId: string, gameKey?: string) {
  let query = supabaseAdmin
    .from('keyform_registrations')
    .select('*')
    .eq('guild_id', guildId)
    .order('registered_at', { ascending: false });

  if (gameKey) {
    query = query.eq('game_key', gameKey);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Delete (revoke) a keyform registration.
 */
export async function deleteKeyformRegistration(guildId: string, id: string) {
  const { error } = await supabaseAdmin
    .from('keyform_registrations')
    .delete()
    .eq('guild_id', guildId)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export const DEFAULT_FEATURE_METRICS = [
  // Gaming
  { key: 'weekly_boss', name: 'Weekly World Boss RPG', section: 'Gaming', icon: '⚔️', resourceType: 'Canvas Battle Render & RPC', percentage: 28.5, healthStatus: 'healthy' },
  { key: 'vault_economy', name: 'Vault Economy & Daily Quests', section: 'Gaming', icon: '🪙', resourceType: 'Voice XP Ticker & Postgres RPC', percentage: 14.0, healthStatus: 'healthy' },
  { key: 'trivia', name: 'Daily Community Trivia', section: 'Gaming', icon: '❓', resourceType: 'Gemini Engine & Scoring', percentage: 9.5, healthStatus: 'healthy' },
  { key: 'free_game_alerts', name: 'Free Games & Deals Alerts', section: 'Gaming', icon: '🎮', resourceType: 'RSS Scraper & GamerPower API', percentage: 4.8, healthStatus: 'healthy' },
  { key: 'lfg', name: 'LFG Party Builder', section: 'Gaming', icon: '🎯', resourceType: 'Session Tracker & Timers', percentage: 2.8, healthStatus: 'healthy' },
  { key: 'recruitment_achievement', name: 'Master Achievements & Badges', section: 'Gaming', icon: '🏆', resourceType: 'Canvas Graphics & Role Dispatch', percentage: 2.5, healthStatus: 'healthy' },

  // AI Companion
  { key: 'npc', name: 'ENOS AI Companion (Deliberation)', section: 'Companion', icon: '🤖', resourceType: 'Gemini Flash Deliberation', percentage: 22.0, healthStatus: 'healthy' },
  { key: 'npc_lore', name: 'AI Server Lore & Memories', section: 'Companion', icon: '🧠', resourceType: 'Vector Search & Supabase Context', percentage: 2.4, healthStatus: 'healthy' },
  { key: 'npc_channels', name: 'Channel Listener & Debounce', section: 'Companion', icon: '💬', resourceType: 'Message Stream Ingestion', percentage: 1.8, healthStatus: 'healthy' },

  // Moderation
  { key: 'gatekeeper', name: 'Gatekeeper / Onboarding', section: 'Moderation', icon: '🛡️', resourceType: 'Form Actions & Role Sync', percentage: 2.6, healthStatus: 'healthy' },
  { key: 'help_desk', name: 'AI Help Desk & Tickets', section: 'Moderation', icon: '🎫', resourceType: 'Gemini 2.5 Flash Chat Threads', percentage: 3.5, healthStatus: 'healthy' },
  { key: 'digest', name: 'Daily AI Community Digest', section: 'Moderation', icon: '📜', resourceType: 'Gemini Summary & Scheduled Embed', percentage: 2.2, healthStatus: 'healthy' },
  { key: 'keyform', name: 'Keyform Whitelist System', section: 'Moderation', icon: '🔑', resourceType: 'Game Server Access & Role Sync', percentage: 1.5, healthStatus: 'healthy' },
  { key: 'announcebot', name: 'Announcebot & Scheduled Posts', section: 'Moderation', icon: '📢', resourceType: 'Embed Dispatcher & Queue Timer', percentage: 1.4, healthStatus: 'healthy' },
  { key: 'showcase', name: 'Feature Showcase Cards', section: 'Moderation', icon: '✨', resourceType: 'Interactive Cards & Feedback Modals', percentage: 1.2, healthStatus: 'healthy' },

  // Social
  { key: 'live_alerts', name: 'Twitch & TikTok Live Alerts', section: 'Social', icon: '📡', resourceType: 'Live Stream Poller & Alerts', percentage: 3.2, healthStatus: 'healthy' },
  { key: 'en_tts', name: 'Herald of Voice (TTS)', section: 'Social', icon: '🎙️', resourceType: 'Voice Channel Streamer', percentage: 1.6, healthStatus: 'healthy' },
  { key: 'translator', name: 'Message Translator', section: 'Social', icon: '🌐', resourceType: 'Language Translation API', percentage: 1.4, healthStatus: 'healthy' },
  { key: 'birthday_settings', name: 'Birthday Cards & Celebration', section: 'Social', icon: '🎂', resourceType: 'Canvas Graphics & Scheduler', percentage: 1.2, healthStatus: 'healthy' },
  { key: 'auto_reactions', name: 'Auto-Reactions Engine', section: 'Social', icon: '⚡', resourceType: 'Regex Stream Filter', percentage: 0.8, healthStatus: 'healthy' },

  // Newsroom
  { key: 'newsroom', name: 'Gaming Newsroom Aggregator', section: 'Newsroom', icon: '📰', resourceType: 'Multi-Feed RSS Engine', percentage: 2.2, healthStatus: 'healthy' },

  // System Ops & Logs
  { key: 'system_ops', name: 'System Ops & Heartbeats', section: 'System', icon: '⚙️', resourceType: 'Cron Schedulers & Telemetry', percentage: 0.8, healthStatus: 'healthy' },
  { key: 'pruner', name: 'Database Storage Pruner', section: 'System', icon: '🗑️', resourceType: 'Data Retention Cleanup', percentage: 0.6, healthStatus: 'healthy' },
  { key: 'audit_logs', name: 'Audit & Bot Event Logs', section: 'System', icon: '📋', resourceType: 'Structured Event Logger', percentage: 0.6, healthStatus: 'healthy' },
];

/**
 * Fetch feature resource metrics for a guild and timeframe.
 */
export async function getFeatureResourceMetrics(guildId: string, timeframe: 'daily' | 'weekly' = 'daily') {
  try {
    const { data, error } = await supabaseAdmin
      .from('feature_resource_metrics')
      .select('*')
      .eq('guild_id', guildId)
      .eq('timeframe', timeframe);

    if (error || !data || data.length === 0) {
      return {
        features: DEFAULT_FEATURE_METRICS,
        container: { rssMB: 98.4, limitMB: 256, usagePercent: 38, healthStatus: 'healthy' },
        timeframe,
        isBaseline: true,
      };
    }

    const features = data.map((d: any) => {
      const pct = Number(d.percentage) || 0;
      let healthStatus = 'healthy';
      if (pct >= 80) healthStatus = 'critical';
      else if (pct >= 50) healthStatus = 'warning';

      const def = DEFAULT_FEATURE_METRICS.find((f) => f.key === d.feature_key);
      return {
        key: d.feature_key,
        name: def?.name || d.feature_key,
        section: d.details?.section || def?.section || 'General',
        icon: def?.icon || '⚙️',
        resourceType: d.resource_type || def?.resourceType || 'Standard Subsystem',
        percentage: pct,
        healthStatus,
      };
    });

    features.sort((a: any, b: any) => b.percentage - a.percentage);

    const memStats = data[0]?.details?.memStats || { rssMB: 104.2, limitMB: 256, usagePercent: 41, healthStatus: 'healthy' };

    return {
      features,
      container: memStats,
      timeframe,
      isBaseline: false,
    };
  } catch {
    return {
      features: DEFAULT_FEATURE_METRICS,
      container: { rssMB: 98.4, limitMB: 256, usagePercent: 38, healthStatus: 'healthy' },
      timeframe,
      isBaseline: true,
    };
  }
}

