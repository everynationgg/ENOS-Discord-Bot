-- =============================================================================
-- Migration 033: Fix Permissive RLS Policies & Restrict SECURITY DEFINER RPC Grants
-- Additive & Idempotent — Safe to run on production Supabase
-- =============================================================================

-- 1. Explicitly drop legacy TO PUBLIC policies and enforce service_role_all across all 6 tables
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'member_invites',
    'temp_voice_channels',
    'achievements',
    'user_achievements',
    'newsroom_posts',
    'feature_resource_metrics'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      -- Drop any legacy/public policies
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND (
            policyname ILIKE '%public%'
            OR policyname ILIKE '%allow%'
            OR policyname ILIKE '%service role%'
            OR policyname = 'service_role_all'
          )
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
      END LOOP;

      -- Enforce uniform service_role_all policy
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Explicit drops by name for complete backward compatibility
DROP POLICY IF EXISTS "Allow public read access on member_invites" ON public.member_invites;
DROP POLICY IF EXISTS "Allow service role full access on member_invites" ON public.member_invites;
DROP POLICY IF EXISTS "Allow public read on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "Service role full access on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "Allow service role full access on temp_voice_channels" ON public.temp_voice_channels;
DROP POLICY IF EXISTS "Allow public read access on achievements" ON public.achievements;
DROP POLICY IF EXISTS "Service Role Full Access Achievements" ON public.achievements;
DROP POLICY IF EXISTS "Allow service role full access on achievements" ON public.achievements;
DROP POLICY IF EXISTS "Allow public read access on user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Service Role Full Access User Achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Allow service role full access on user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Allow public read access on newsroom_posts" ON public.newsroom_posts;
DROP POLICY IF EXISTS "Service Role Full Access Newsroom Posts" ON public.newsroom_posts;
DROP POLICY IF EXISTS "Allow service role full access on newsroom_posts" ON public.newsroom_posts;
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
