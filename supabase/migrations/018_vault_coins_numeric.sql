-- ============================================================
-- ENOS Migration 018: Alter Vault Coins & Delta columns to NUMERIC
-- Fixes integer rounding truncation of decimal coin earnings (+0.10, +0.15, +0.02)
-- ============================================================

ALTER TABLE vault_balances ALTER COLUMN coins TYPE NUMERIC USING coins::NUMERIC;
ALTER TABLE vault_transactions ALTER COLUMN delta TYPE NUMERIC USING delta::NUMERIC;
