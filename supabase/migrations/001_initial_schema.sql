-- ============================================================
-- ENOS "Every Nation" — Supabase PostgreSQL Initial Schema
-- ============================================================

-- Enable pg_cron for scheduled jobs (run in Supabase SQL editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. GUILD CONFIGURATION
-- Per-feature toggle state and JSON config for each guild
-- ============================================================
CREATE TABLE IF NOT EXISTS guild_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  feature_key     TEXT NOT NULL,         -- e.g. 'gatekeeper', 'lfg', 'vault'
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_guild_config_guild ON guild_config(guild_id);

-- ============================================================
-- 2. VERIFIED MEMBERS
-- Stores onboarding form submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS verified_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id      TEXT NOT NULL,
  guild_id        TEXT NOT NULL,
  indian_name     TEXT NOT NULL,
  discovery_source TEXT NOT NULL,        -- TikTok Content | Discord Server Discovery | etc.
  ign             TEXT,                  -- In-Game Name (optional)
  game_branch     TEXT NOT NULL,         -- Primary Game Branch
  birthday        TEXT,                  -- MM/DD/YYYY (optional)
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discord_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_verified_members_discord ON verified_members(discord_id);
CREATE INDEX IF NOT EXISTS idx_verified_members_guild ON verified_members(guild_id);

-- ============================================================
-- 3. LFG SESSIONS
-- Active Looking-For-Group party cards
-- ============================================================
CREATE TABLE IF NOT EXISTS lfg_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  host_id         TEXT NOT NULL,         -- Discord user ID
  game            TEXT NOT NULL,
  description     TEXT,
  voice_channel_id TEXT,                 -- Pre-existing voice channel reference
  max_size        INTEGER NOT NULL DEFAULT 4,
  current_members JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of Discord user IDs
  message_id      TEXT,                  -- Discord message ID of the embed
  channel_id      TEXT,                  -- Discord channel where embed was posted
  status          TEXT NOT NULL DEFAULT 'open',  -- open | full | closed
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lfg_sessions_guild ON lfg_sessions(guild_id);
CREATE INDEX IF NOT EXISTS idx_lfg_sessions_host ON lfg_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_lfg_sessions_status ON lfg_sessions(status);

-- LFG Join Cooldowns
CREATE TABLE IF NOT EXISTS lfg_cooldowns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  session_id      UUID REFERENCES lfg_sessions(id) ON DELETE CASCADE,
  cooldown_until  TIMESTAMPTZ NOT NULL,
  UNIQUE (discord_id, session_id)
);

-- ============================================================
-- 4. VAULT BALANCES
-- Per-user currency ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  coins           INTEGER NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'bronze',  -- bronze | gold | platinum
  voice_minutes   INTEGER NOT NULL DEFAULT 0,      -- total voice minutes (all-time)
  messages_today  INTEGER NOT NULL DEFAULT 0,      -- resets daily via cron
  quest_claimed   BOOLEAN NOT NULL DEFAULT FALSE,  -- daily quest claimed
  last_message_at TIMESTAMPTZ,                     -- rate limiting
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discord_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_balances_guild ON vault_balances(guild_id);
CREATE INDEX IF NOT EXISTS idx_vault_balances_coins ON vault_balances(coins DESC);

-- ============================================================
-- 5. VAULT TRANSACTIONS
-- Immutable coin event ledger — prunable after 30 days
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  delta           INTEGER NOT NULL,      -- positive = gain, negative = spend
  reason          TEXT NOT NULL,         -- 'message', 'voice', 'daily_quest', 'admin', etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_tx_discord ON vault_transactions(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_vault_tx_created ON vault_transactions(created_at);

-- ============================================================
-- 6. LIVE ALERTS
-- Social sync state ledger for Twitch/YouTube streamers
-- ============================================================
CREATE TABLE IF NOT EXISTS live_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  platform        TEXT NOT NULL,         -- 'twitch' | 'youtube'
  handle          TEXT NOT NULL,         -- channel name or ID
  display_name    TEXT NOT NULL,
  is_live         BOOLEAN NOT NULL DEFAULT FALSE,
  stream_title    TEXT,
  stream_url      TEXT,
  thumbnail_url   TEXT,
  last_message_id TEXT,                  -- Discord message to edit on end
  alert_channel_id TEXT,                 -- target Discord channel
  ping_role_id    TEXT,                  -- role to ping
  last_checked    TIMESTAMPTZ,
  went_live_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, platform, handle)
);

-- ============================================================
-- 7. DIGEST LOGS
-- Daily digest generation history — prunable after 30 days
-- ============================================================
CREATE TABLE IF NOT EXISTS digest_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  channel_id      TEXT NOT NULL,
  message_id      TEXT,
  summary_text    TEXT,
  posted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_logs_created ON digest_logs(posted_at);

-- ============================================================
-- 8. BOT EVENT LOGS
-- General bot activity log — prunable after 30 days
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_event_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,         -- 'verification', 'lfg_create', 'coin_award', 'live_alert', 'digest'
  discord_id      TEXT,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_logs_guild ON bot_event_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON bot_event_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bot_logs_type ON bot_event_logs(event_type);

-- ============================================================
-- 9. BOT HEALTH
-- Heartbeat / last seen tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_health (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL UNIQUE,
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bot_version     TEXT,
  uptime_start    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUTOMATED PRUNING FUNCTION
-- Deletes records older than 30 days from purgeable tables
-- Schedule this via pg_cron or external cron
-- ============================================================
CREATE OR REPLACE FUNCTION prune_old_records()
RETURNS void AS $$
BEGIN
  DELETE FROM vault_transactions WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM digest_logs WHERE posted_at < NOW() - INTERVAL '30 days';
  DELETE FROM bot_event_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM lfg_sessions WHERE status = 'closed' AND updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- To schedule with pg_cron (run once in Supabase SQL editor after enabling extension):
-- SELECT cron.schedule('prune-old-records', '0 3 * * *', 'SELECT prune_old_records()');
