-- ============================================================
-- ENOS Migration 014: Vault Quest Start & Daily Cap Tracking
-- ============================================================

ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_started BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS coins_earned_today NUMERIC NOT NULL DEFAULT 0;
