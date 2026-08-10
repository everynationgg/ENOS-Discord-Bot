-- Migration 022: Newsroom System Table & Auto-Pruning
CREATE TABLE IF NOT EXISTS public.newsroom_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,
  article_guid TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to prevent duplicate posts of the same article per category & guild
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsroom_posts_unique 
  ON public.newsroom_posts (guild_id, category, article_guid);

-- Fast lookup index for title deduplication within 24h
CREATE INDEX IF NOT EXISTS idx_newsroom_posts_guild_cat_time 
  ON public.newsroom_posts (guild_id, category, posted_at DESC);

-- Automated Pruning RPC Function to keep database size lightweight (< 60 days of history)
CREATE OR REPLACE FUNCTION public.prune_old_newsroom_posts()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.newsroom_posts
  WHERE posted_at < NOW() - INTERVAL '60 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
