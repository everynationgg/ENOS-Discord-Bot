-- Add is_concluded column to boss_seasons table to track Saturday 23:59 GMT+8 official battle conclusion
ALTER TABLE boss_seasons ADD COLUMN IF NOT EXISTS is_concluded BOOLEAN NOT NULL DEFAULT FALSE;
