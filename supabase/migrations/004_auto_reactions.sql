-- ============================================================
-- ENOS Auto Reactions and Reaction Mirroring Feature Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS auto_reactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id          TEXT NOT NULL,
  trigger_word      TEXT NOT NULL,
  reaction_emoji    TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reactions_guild ON auto_reactions(guild_id);
