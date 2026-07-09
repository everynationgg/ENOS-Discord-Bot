-- ============================================================
-- ENOS Keyform Onboarding & Server Access Registration Schema
-- ============================================================

-- 1. Create keyform_configs table
CREATE TABLE IF NOT EXISTS keyform_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  game_key            TEXT NOT NULL,         -- e.g. 'palworld'
  game_name           TEXT NOT NULL,         -- e.g. 'Palworld'
  server_url          TEXT NOT NULL,
  server_password     TEXT NOT NULL,
  target_channel_id   TEXT NOT NULL,
  log_channel_id      TEXT NOT NULL,
  rules               JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, game_key)
);

CREATE INDEX IF NOT EXISTS idx_keyform_configs_guild ON keyform_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_keyform_configs_game ON keyform_configs(game_key);

-- 2. Create keyform_registrations table
CREATE TABLE IF NOT EXISTS keyform_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  discord_id          TEXT NOT NULL,
  discord_tag         TEXT NOT NULL,
  ign                 TEXT NOT NULL,
  game_key            TEXT NOT NULL,
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, discord_id, game_key)
);

CREATE INDEX IF NOT EXISTS idx_keyform_regs_guild ON keyform_registrations(guild_id);
CREATE INDEX IF NOT EXISTS idx_keyform_regs_discord ON keyform_registrations(discord_id);
CREATE INDEX IF NOT EXISTS idx_keyform_regs_game ON keyform_registrations(game_key);
