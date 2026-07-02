-- ============================================================
-- ENOS Birthday System — Supabase PostgreSQL Migration
-- ============================================================

-- 1. Server Configuration Table
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id          TEXT PRIMARY KEY,
  birthday_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  birthday_channel_id TEXT,
  log_channel_id    TEXT,
  announcement_time TEXT NOT NULL DEFAULT '09:00',
  ai_prompt_formula TEXT NOT NULL DEFAULT 'You are an enthusiastic gaming community bot. Write a short, fun, 2-sentence birthday wish. Keep it gaming-themed.',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default server configuration for Every Nation server
INSERT INTO guild_settings (guild_id, birthday_enabled)
VALUES ('1111851611099254815', FALSE)
ON CONFLICT (guild_id) DO NOTHING;

-- 2. Member Birthdays Table
CREATE TABLE IF NOT EXISTS member_birthdays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  ign             TEXT,
  birth_date      TEXT NOT NULL, -- Stored as 'MM-DD'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_birthdays_date ON member_birthdays(birth_date);
CREATE INDEX IF NOT EXISTS idx_member_birthdays_guild ON member_birthdays(guild_id);

-- 3. Birthday Queue Table
CREATE TABLE IF NOT EXISTS birthday_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  ign             TEXT,
  target_date     DATE NOT NULL,
  scratchpad_text TEXT,
  is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
  is_sent         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_birthday_queue_date ON birthday_queue(target_date);
CREATE INDEX IF NOT EXISTS idx_birthday_queue_sent ON birthday_queue(is_sent, is_approved);

-- 4. Sync existing verified members with valid birthdays
INSERT INTO member_birthdays (guild_id, user_id, ign, birth_date)
SELECT 
  guild_id, 
  discord_id, 
  ign, 
  SUBSTRING(REPLACE(birthday, '/', '-'), 1, 5)
FROM verified_members
WHERE birthday IS NOT NULL 
  AND birthday ~ '^(0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])'
ON CONFLICT (guild_id, user_id) DO NOTHING;
