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
