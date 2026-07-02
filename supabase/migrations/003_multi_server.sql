-- ============================================================
-- ENOS Multi-Server Architecture Upgrade
-- ============================================================

-- 1. Add server activity columns to guild_settings
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
