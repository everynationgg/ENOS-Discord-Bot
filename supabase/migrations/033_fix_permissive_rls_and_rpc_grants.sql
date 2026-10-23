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

-- 2. Revoke public execution on sensitive SECURITY DEFINER RPCs and grant only to service_role
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid 
    FROM pg_proc 
    WHERE proname IN (
      'increment_vault_coins',
      'increment_coins',
      'add_vault_coins',
      'increment_trivia_points',
      'prune_old_records',
      'prune_old_newsroom_posts',
      'apply_boss_attack_result'
    ) 
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.oid::regprocedure);
  END LOOP;
END $$;
