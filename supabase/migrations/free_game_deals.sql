-- Create free_game_deals table to track posted deal alerts and auto-delete expired messages
CREATE TABLE IF NOT EXISTS free_game_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  store_name TEXT NOT NULL,
  normal_price NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  savings_percent NUMERIC DEFAULT 0,
  deal_url TEXT NOT NULL,
  image_url TEXT,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_free_game_deals_expires ON free_game_deals(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_game_deals_guild ON free_game_deals(guild_id);
