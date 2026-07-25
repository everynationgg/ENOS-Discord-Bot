-- ENOS Announcebot Schema: Instant & Scheduled Bot Announcements

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
