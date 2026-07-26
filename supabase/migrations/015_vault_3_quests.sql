-- ============================================================
-- ENOS Migration 015: Vault 3 Daily Quests Tracking
-- ============================================================

ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_chat_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_trivia_completed BOOLEAN NOT NULL DEFAULT FALSE;
