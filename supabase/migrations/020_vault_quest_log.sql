-- ============================================================
-- ENOS Migration 020: Vault Quest Activity Log
-- Tracks every "Get Daily Quests" button click and quest
-- progress snapshots for debugging purposes.
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_quest_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  discord_id      TEXT NOT NULL,
  action          TEXT NOT NULL DEFAULT 'view_quests', -- view_quests | quest_complete
  quest_key       TEXT,                               -- chat | voice | trivia | boss | reactions | ai_chat | voice_status
  snapshot        JSONB,                              -- snapshot of quest progress at time of action
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vql_guild_user ON vault_quest_log(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_vql_created ON vault_quest_log(created_at DESC);
