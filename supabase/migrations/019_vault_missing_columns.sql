-- ============================================================
-- ENOS Migration 019: Vault Missing Quest Columns (Catchup)
-- Adds all columns referenced in vault.js that were never
-- applied to the live Supabase instance.
-- ============================================================

ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_started BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS coins_earned_today NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_chat_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_trivia_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS assigned_quests JSONB DEFAULT '["chat", "voice", "trivia"]'::jsonb;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_reactions_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_status_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_ai_chat_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_boss_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS voice_minutes_today INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_claimed_reaction BOOLEAN NOT NULL DEFAULT FALSE;
