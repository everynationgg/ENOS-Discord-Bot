-- ============================================================
-- ENOS Migration 016: Vault 7-Quest Pool & Event Tracking
-- ============================================================

ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS assigned_quests JSONB DEFAULT '["chat", "voice", "trivia"]'::jsonb;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_reactions_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_status_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_ai_chat_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_boss_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS voice_minutes_today INTEGER NOT NULL DEFAULT 0;
