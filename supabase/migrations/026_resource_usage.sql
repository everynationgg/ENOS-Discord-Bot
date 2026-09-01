-- ============================================================
-- 026_RESOURCE_USAGE.SQL
-- ENOS System Ops: Feature Resource & Telemetry Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_resource_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id        TEXT NOT NULL,
  feature_key     TEXT NOT NULL,
  timeframe       TEXT NOT NULL DEFAULT 'daily', -- 'daily' or 'weekly'
  weight_score    NUMERIC NOT NULL DEFAULT 0,
  percentage      NUMERIC NOT NULL DEFAULT 0,
  resource_type   TEXT NOT NULL DEFAULT 'standard',
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, feature_key, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_feature_metrics_lookup 
  ON feature_resource_metrics(guild_id, timeframe);

-- Enable RLS
ALTER TABLE feature_resource_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on feature_resource_metrics"
  ON feature_resource_metrics FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on feature_resource_metrics"
  ON feature_resource_metrics FOR ALL
  TO service_role
  USING (true);
