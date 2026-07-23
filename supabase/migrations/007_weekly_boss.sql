-- ENOS Weekly Boss RPG System Schema

-- 1. Weekly Boss Seasons Table
CREATE TABLE IF NOT EXISTS boss_seasons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  week_identifier     TEXT NOT NULL,          -- e.g. "2026-W30"
  boss_name           TEXT NOT NULL,
  boss_title          TEXT,
  lore                TEXT,
  custom_image_url    TEXT,                   -- Optional custom PNG uploaded via Dashboard
  max_hp              BIGINT NOT NULL DEFAULT 150000,
  current_hp          BIGINT NOT NULL DEFAULT 150000,
  is_overkill         BOOLEAN NOT NULL DEFAULT FALSE,
  is_defeated         BOOLEAN NOT NULL DEFAULT FALSE,
  mom_buff            BOOLEAN NOT NULL DEFAULT FALSE,
  dad_debuff          BOOLEAN NOT NULL DEFAULT FALSE,
  last_action         TEXT,                   -- e.g. "M.O.M. used Guilt Trip"
  last_action_by      TEXT,                   -- Discord User ID of last action
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, week_identifier, is_overkill)
);

CREATE INDEX IF NOT EXISTS idx_boss_seasons_guild ON boss_seasons(guild_id);
CREATE INDEX IF NOT EXISTS idx_boss_seasons_week ON boss_seasons(week_identifier);

-- 2. Weekly Boss Player States (Per-Week AP & Class Lock)
CREATE TABLE IF NOT EXISTS boss_player_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  week_identifier     TEXT NOT NULL,
  class_key           TEXT,                   -- 'mom', 'dad', 'kid'
  ap_remaining        INT NOT NULL DEFAULT 5,
  is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  total_damage        BIGINT NOT NULL DEFAULT 0,
  weekly_points       BIGINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id, week_identifier)
);

CREATE INDEX IF NOT EXISTS idx_boss_player_states_guild ON boss_player_states(guild_id);
CREATE INDEX IF NOT EXISTS idx_boss_player_states_user ON boss_player_states(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_player_states_week ON boss_player_states(week_identifier);

-- 3. Persistent User RPG Account Profiles (Leveling & Stat Points)
CREATE TABLE IF NOT EXISTS boss_user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  level               INT NOT NULL DEFAULT 1,
  xp                  BIGINT NOT NULL DEFAULT 0,
  unallocated_stats   INT NOT NULL DEFAULT 0,
  stat_dmg            INT NOT NULL DEFAULT 0,  -- +2% flat DMG / pt
  stat_ap_save        INT NOT NULL DEFAULT 0,  -- +5% 0-AP chance / pt (capped strictly at 4 pts = 20%)
  stat_xp_boost       INT NOT NULL DEFAULT 0,  -- +5% XP rate / pt
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boss_user_profiles_guild ON boss_user_profiles(guild_id);
CREATE INDEX IF NOT EXISTS idx_boss_user_profiles_user ON boss_user_profiles(user_id);

-- 4. Weekly Boss Damage Logs / Transactions
CREATE TABLE IF NOT EXISTS boss_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  week_identifier     TEXT NOT NULL,
  action_type         TEXT NOT NULL,          -- 'basic', 'skill'
  class_key           TEXT NOT NULL,          -- 'mom', 'dad', 'kid'
  skill_name          TEXT NOT NULL,
  damage_dealt        BIGINT NOT NULL,
  points_earned       BIGINT NOT NULL,
  xp_earned           BIGINT NOT NULL,
  is_synergy          BOOLEAN NOT NULL DEFAULT FALSE,
  synergy_type        TEXT,                   -- 'partial', 'full'
  ap_conserved        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boss_tx_guild ON boss_transactions(guild_id);
CREATE INDEX IF NOT EXISTS idx_boss_tx_user ON boss_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_tx_week ON boss_transactions(week_identifier);
