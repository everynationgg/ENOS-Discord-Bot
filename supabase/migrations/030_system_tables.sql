-- ENOS Migration 030: Missing System Tables Consolidation
-- Fixes missing database tables: free_game_deals, scheduled_announcements, and system_logs

-- 1. Free Game Deals Table
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
  is_expired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_free_game_deals_expires ON free_game_deals(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_game_deals_guild ON free_game_deals(guild_id);

-- 2. Scheduled Announcements Table (Announcebot)
CREATE TABLE IF NOT EXISTS scheduled_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  channel_id      TEXT NOT NULL,
  message         TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sch_ann_guild ON scheduled_announcements(guild_id);
CREATE INDEX IF NOT EXISTS idx_sch_ann_status ON scheduled_announcements(status);
CREATE INDEX IF NOT EXISTS idx_sch_ann_time ON scheduled_announcements(scheduled_at);

-- 3. System Logs Table (Realtime Event Dispatching for Achievements & Leaderboards)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_guild ON system_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);

-- Enable Realtime publication for system_logs so the bot receives dispatch events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_logs;
  END IF;
END $$;

-- 4. Sync Streamers from guild_config into live_alerts table
INSERT INTO live_alerts (guild_id, platform, handle, display_name, alert_channel_id, is_live)
VALUES 
  ('1111851611099254815', 'twitch', 'novatail_va', 'Novatail', '1148233610206400643', false),
  ('1111851611099254815', 'tiktok', 'carldavemusni', 'Daevara', '1148233610206400643', false)
ON CONFLICT (guild_id, platform, handle) DO NOTHING;
