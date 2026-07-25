-- ENOS Showcase System Schema: Server Updates, Feature Showcases, Claim Rewards & Feedback

-- 1. Showcase Updates History Table
CREATE TABLE IF NOT EXISTS showcase_updates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  channel_id          TEXT NOT NULL,
  feedback_channel_id TEXT,
  preset_type         TEXT NOT NULL DEFAULT 'major', -- 'major', 'patch', 'showcase'
  title_size          TEXT NOT NULL DEFAULT 'h1',    -- 'h1', 'h2', 'h3'
  title               TEXT NOT NULL,
  body_size           TEXT NOT NULL DEFAULT 'normal',-- 'h2', 'h3', 'normal'
  summary             TEXT,
  body_markdown       TEXT NOT NULL,
  banner_url          TEXT,
  video_url           TEXT,
  reward_coins        INT NOT NULL DEFAULT 0,
  try_feature_channel TEXT,
  dropdown_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by          TEXT,
  message_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter table columns if table was created in prior run
ALTER TABLE showcase_updates ADD COLUMN IF NOT EXISTS feedback_channel_id TEXT;
ALTER TABLE showcase_updates ADD COLUMN IF NOT EXISTS title_size TEXT NOT NULL DEFAULT 'h1';
ALTER TABLE showcase_updates ADD COLUMN IF NOT EXISTS body_size TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE showcase_updates ADD COLUMN IF NOT EXISTS try_feature_channel TEXT;
ALTER TABLE showcase_updates ADD COLUMN IF NOT EXISTS dropdown_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_showcase_guild ON showcase_updates(guild_id);
CREATE INDEX IF NOT EXISTS idx_showcase_created ON showcase_updates(created_at);

-- 2. Showcase Reward Claims Table (Ensures 1 claim per user per showcase)
CREATE TABLE IF NOT EXISTS showcase_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id     UUID REFERENCES showcase_updates(id) ON DELETE CASCADE,
  guild_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  coins_awarded   INT NOT NULL DEFAULT 50,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (showcase_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_showcase_claims_user ON showcase_claims(guild_id, user_id);

-- 3. Showcase User Feedback Table
CREATE TABLE IF NOT EXISTS showcase_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id     UUID REFERENCES showcase_updates(id) ON DELETE CASCADE,
  guild_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  user_tag        TEXT,
  feedback_text   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showcase_fb_guild ON showcase_feedback(guild_id);
