-- Add custom_bg_url column to boss_seasons table if not already present
ALTER TABLE boss_seasons ADD COLUMN IF NOT EXISTS custom_bg_url TEXT;
