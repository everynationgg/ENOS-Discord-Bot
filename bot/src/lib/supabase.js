const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('[SUPABASE] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Fetches a guild's feature config from Supabase.
 * @param {string} guildId
 * @param {string} featureKey
 * @returns {Promise<{ enabled: boolean, config: object } | null>}
 */
async function getFeatureConfig(guildId, featureKey) {
  const { data, error } = await supabase
    .from('guild_config')
    .select('enabled, config')
    .eq('guild_id', guildId)
    .eq('feature_key', featureKey)
    .maybeSingle();

  if (error) {
    logger.error(`[SUPABASE] getFeatureConfig error (${featureKey}):`, error.message);
    return null;
  }
  return data;
}

/**
 * Check if a feature is enabled for a guild.
 * @param {string} guildId
 * @param {string} featureKey
 * @returns {Promise<boolean>}
 */
async function isFeatureEnabled(guildId, featureKey) {
  const row = await getFeatureConfig(guildId, featureKey);
  return row?.enabled ?? false;
}

/**
 * Writes a bot event log entry.
 * @param {string} guildId
 * @param {string} eventType
 * @param {string|null} discordId
 * @param {object} details
 */
async function logBotEvent(guildId, eventType, discordId = null, details = {}) {
  const { error } = await supabase.from('bot_event_logs').insert({
    guild_id: guildId,
    event_type: eventType,
    discord_id: discordId,
    details,
  });
  if (error) logger.error('[SUPABASE] logBotEvent error:', error.message);
}

/**
 * Fetches a keyform server config.
 * @param {string} guildId
 * @param {string} gameKey
 * @returns {Promise<object|null>}
 */
async function getKeyformConfig(guildId, gameKey) {
  const { data, error } = await supabase
    .from('keyform_configs')
    .select('*')
    .eq('guild_id', guildId)
    .eq('game_key', gameKey)
    .maybeSingle();

  if (error) {
    logger.error(`[SUPABASE] getKeyformConfig error (${gameKey}):`, error.message);
    return null;
  }
  return data;
}

/**
 * Saves a keyform registration.
 * @param {string} guildId
 * @param {string} discordId
 * @param {string} discordTag
 * @param {string} ign
 * @param {string} gameKey
 * @returns {Promise<boolean>}
 */
async function addKeyformRegistration(guildId, discordId, discordTag, ign, gameKey) {
  const { error } = await supabase.from('keyform_registrations').upsert(
    {
      guild_id: guildId,
      discord_id: discordId,
      discord_tag: discordTag,
      ign,
      game_key: gameKey,
      registered_at: new Date().toISOString(),
    },
    { onConflict: 'guild_id,discord_id,game_key' }
  );

  if (error) {
    logger.error('[SUPABASE] addKeyformRegistration error:', error.message);
    return false;
  }
  return true;
}

module.exports = {
  supabase,
  getFeatureConfig,
  isFeatureEnabled,
  logBotEvent,
  getKeyformConfig,
  addKeyformRegistration,
};

