-- ============================================================
-- ENOS Daily Community Trivia Drop Schema
-- ============================================================

-- 1. Lifetime Points Table (Never Purged)
CREATE TABLE IF NOT EXISTS trivia_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  points          INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, discord_id)
);

CREATE INDEX IF NOT EXISTS idx_trivia_points_guild ON trivia_points(guild_id);
CREATE INDEX IF NOT EXISTS idx_trivia_points_user ON trivia_points(discord_id);
CREATE INDEX IF NOT EXISTS idx_trivia_points_total ON trivia_points(points DESC);

-- 2. Daily Drops Table (Purged after 30 days)
CREATE TABLE IF NOT EXISTS trivia_drops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  channel_id      TEXT NOT NULL,
  message_id      TEXT,
  question        TEXT NOT NULL,
  correct_answer  TEXT NOT NULL,
  shuffled_answers JSONB NOT NULL,        -- The 4 options (array of strings)
  winners         JSONB NOT NULL DEFAULT '[]'::jsonb, -- Top 3 winners: [{ "user_id": "...", "tag": "...", "speed_ms": 1234.567, "points": 5 }]
  status          TEXT NOT NULL DEFAULT 'active', -- active | completed | skipped
  close_time      TEXT NOT NULL,          -- e.g. "22:00"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trivia_drops_guild ON trivia_drops(guild_id);
CREATE INDEX IF NOT EXISTS idx_trivia_drops_status ON trivia_drops(status);
CREATE INDEX IF NOT EXISTS idx_trivia_drops_created ON trivia_drops(created_at);

-- 3. Individual Responses Table (Purged after 30 days)
CREATE TABLE IF NOT EXISTS trivia_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id         UUID REFERENCES trivia_drops(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,   -- Timestamp when ephemeral prompt opened
  started_at_ms   DOUBLE PRECISION NOT NULL, -- Epoch milliseconds with sub-millisecond precision
  answered_at     TIMESTAMPTZ,            -- Timestamp when answer button clicked
  speed_ms        DOUBLE PRECISION,       -- Speed in milliseconds (microsecond precision)
  is_correct      BOOLEAN DEFAULT FALSE,
  shuffled_options JSONB NOT NULL,        -- Shuffled options array to verify answer key stateless/securely
  UNIQUE (drop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trivia_parts_drop ON trivia_participants(drop_id);
CREATE INDEX IF NOT EXISTS idx_trivia_parts_user ON trivia_participants(user_id);

-- 4. Transactions Audit Table (Purged after 30 days)
CREATE TABLE IF NOT EXISTS trivia_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  reason          TEXT NOT NULL,          -- '1st_place', '2nd_place', '3rd_place', 'admin_adjustment'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trivia_tx_user ON trivia_transactions(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_trivia_tx_created ON trivia_transactions(created_at);

-- 5. Extend Data Pruning Function to cover Trivia tables
CREATE OR REPLACE FUNCTION prune_old_records()
RETURNS void AS $$
BEGIN
  -- Vault & Logs (from initial schema)
  DELETE FROM vault_transactions WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM digest_logs WHERE posted_at < NOW() - INTERVAL '30 days';
  DELETE FROM bot_event_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM lfg_sessions WHERE status = 'closed' AND updated_at < NOW() - INTERVAL '7 days';

  -- Trivia History (cascades to trivia_participants)
  DELETE FROM trivia_drops WHERE (status = 'completed' OR status = 'skipped') AND created_at < NOW() - INTERVAL '30 days';
  DELETE FROM trivia_transactions WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
