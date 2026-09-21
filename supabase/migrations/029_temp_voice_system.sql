-- ============================================================
-- ENOS Migration 029: Dynamic Temporary Voice Channel Tracking
-- Tracks active temporary voice channels to ensure clean
-- lifecycle management and cleanup across bot restarts.
-- ============================================================

CREATE TABLE IF NOT EXISTS temp_voice_channels (
  channel_id  TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_voice_guild
  ON temp_voice_channels(guild_id);

-- Enable Row-Level Security
ALTER TABLE temp_voice_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on temp_voice_channels"
  ON temp_voice_channels FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on temp_voice_channels"
  ON temp_voice_channels FOR ALL
  TO service_role
  USING (true);
