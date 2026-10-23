-- =============================================================================
-- Migration 033: Fix Permissive RLS Policies & Restrict SECURITY DEFINER RPC Grants
-- Additive & Idempotent — Safe to run on production Supabase
-- =============================================================================

-- 1. Explicitly drop legacy TO PUBLIC policies that survived migration 032
-- Member Invites
DROP POLICY IF EXISTS "Allow public read access on member_invites" ON public.member_invites;
DROP POLICY IF EXISTS "Allow service role full access on member_invites" ON public.member_invites;

-- Temp Voice Channels
DROP POLICY IF EXISTS "Allow public read on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "Service role full access on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "Allow service role full access on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "service_role_all" ON public.temp_voice_channels;

CREATE POLICY "service_role_all"
  ON public.temp_voice_channels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Achievements
DROP POLICY IF EXISTS "Allow public read access on achievements" ON public.achievements;
DROP POLICY IF EXISTS "Service Role Full Access Achievements" ON public.achievements;
DROP POLICY IF EXISTS "Allow service role full access on achievements" ON public.achievements;

-- User Achievements
DROP POLICY IF EXISTS "Allow public read access on user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Service Role Full Access User Achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Allow service role full access on user_achievements" ON public.user_achievements;

-- Newsroom Posts
DROP POLICY IF EXISTS "Allow public read access on newsroom_posts" ON public.newsroom_posts;
DROP POLICY IF EXISTS "Service Role Full Access Newsroom Posts" ON public.newsroom_posts;
DROP POLICY IF EXISTS "Allow service role full access on newsroom_posts" ON public.newsroom_posts;

-- Feature Resource Metrics
DROP POLICY IF EXISTS "Allow public read on feature_resource_metrics" ON public.feature_resource_metrics;

-- Storage Objects: Drop public upload/update policies and recreate with TO service_role
DROP POLICY IF EXISTS "Service role can upload boss images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update boss images" ON storage.objects;

CREATE POLICY "Service role can upload boss images"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'boss-images');

CREATE POLICY "Service role can update boss images"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'boss-images');

-- 2. Define standard RPC signatures if not already present
CREATE OR REPLACE FUNCTION public.increment_vault_coins(
  p_guild_id TEXT,
  p_discord_id TEXT,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT 'Vault Transaction',
  p_type TEXT DEFAULT 'credit',
  p_xp_delta INT DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.increment_coins(p_discord_id, p_guild_id, p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_trivia_points(
  p_guild_id TEXT,
  p_discord_id TEXT,
  p_delta INT,
  p_is_correct BOOLEAN DEFAULT TRUE,
  p_reason TEXT DEFAULT 'Trivia Drop'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.increment_trivia_points(p_guild_id, p_discord_id, p_delta);
END;
$$;

-- 3. Revoke public execution on SECURITY DEFINER RPCs and grant only to service_role
REVOKE EXECUTE ON FUNCTION public.increment_vault_coins(TEXT, TEXT, NUMERIC, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_vault_coins(TEXT, TEXT, NUMERIC, TEXT, TEXT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_trivia_points(TEXT, TEXT, INT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_trivia_points(TEXT, TEXT, INT, BOOLEAN, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_coins(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coins(TEXT, TEXT, NUMERIC) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_trivia_points(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_trivia_points(TEXT, TEXT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.prune_old_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_records() TO service_role;

REVOKE EXECUTE ON FUNCTION public.prune_old_newsroom_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_newsroom_posts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_vault_coins(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_vault_coins(TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- Revoke and grant on all overloads of apply_boss_attack_result
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE proname = 'apply_boss_attack_result' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.oid::regprocedure);
  END LOOP;
END $$;
