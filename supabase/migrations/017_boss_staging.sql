-- ============================================================
-- ENOS Migration 017: Weekly Boss Next Week Staging Config
-- ============================================================

-- Ensure staged_boss_config is supported in guild_config
COMMENT ON COLUMN guild_config.config IS 'Contains feature configuration including optional staged_boss_config for weekly boss';
