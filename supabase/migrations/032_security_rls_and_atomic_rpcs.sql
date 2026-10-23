-- =============================================================================
-- Migration 032: Atomic Vault Coin RPC, RLS Policy Hardening & Index Optimization
-- Additive & Idempotent — Safe to run on production Supabase
-- =============================================================================

-- 1. Create atomic increment_coins RPC expected by bot/src/modules/gaming/vault.js
CREATE OR REPLACE FUNCTION public.increment_coins(
  p_discord_id TEXT,
  p_guild_id TEXT,
  p_delta NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  INSERT INTO public.vault_balances (discord_id, guild_id, coins, xp, tier, updated_at)
  VALUES (p_discord_id, p_guild_id, GREATEST(0, ROUND(p_delta, 2)), 0, 'starter', NOW())
  ON CONFLICT (discord_id, guild_id)
  DO UPDATE SET
    coins = GREATEST(0, ROUND(COALESCE(public.vault_balances.coins, 0) + p_delta, 2)),
    updated_at = NOW()
  RETURNING coins INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- 2. Enable Row-Level Security (RLS) on all tables that were missing it
ALTER TABLE IF EXISTS public.vault_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trivia_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guild_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_birthdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.birthday_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bot_temp_voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_lore_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_channel_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create service_role policies for newly RLS-enabled tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vault_transactions',
    'trivia_points',
    'guild_settings',
    'member_birthdays',
    'birthday_queue',
    'bot_temp_voice_channels',
    'npc_user_memories',
    'npc_lore_entries',
    'npc_channel_state',
    'npc_activity_logs'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %I" ON public.%I;', t, t);
      EXECUTE format(
        'CREATE POLICY "Service role full access on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. Restrict the 4 overly-permissive policies that omitted TO service_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'achievements') THEN
    DROP POLICY IF EXISTS "Allow all for service role" ON public.achievements;
    DROP POLICY IF EXISTS "Service role full access on achievements" ON public.achievements;
    CREATE POLICY "Service role full access on achievements"
      ON public.achievements FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_achievements') THEN
    DROP POLICY IF EXISTS "Allow all for service role" ON public.user_achievements;
    DROP POLICY IF EXISTS "Service role full access on user_achievements" ON public.user_achievements;
    CREATE POLICY "Service role full access on user_achievements"
      ON public.user_achievements FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsroom_posts') THEN
    DROP POLICY IF EXISTS "Service role full access on newsroom_posts" ON public.newsroom_posts;
    CREATE POLICY "Service role full access on newsroom_posts"
      ON public.newsroom_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'member_invites') THEN
    DROP POLICY IF EXISTS "Allow all for service role" ON public.member_invites;
    DROP POLICY IF EXISTS "Service role full access on member_invites" ON public.member_invites;
    CREATE POLICY "Service role full access on member_invites"
      ON public.member_invites FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- 5. Add missing performance indexes
CREATE INDEX IF NOT EXISTS idx_vault_transactions_guild_discord_created
  ON public.vault_transactions (guild_id, discord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_birthdays_guild_birth_date
  ON public.member_birthdays (guild_id, birth_date);

CREATE INDEX IF NOT EXISTS idx_birthday_queue_guild_target_sent
  ON public.birthday_queue (guild_id, is_sent, target_date);

CREATE INDEX IF NOT EXISTS idx_trivia_drops_guild_status_created
  ON public.trivia_drops (guild_id, status, created_at DESC);

-- 6. Expand prune_old_records() to clean up stale logs and expired sessions
CREATE OR REPLACE FUNCTION public.prune_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.bot_events WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.lfg_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
  DELETE FROM public.system_logs WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.npc_activity_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.newsroom_posts WHERE posted_at < NOW() - INTERVAL '60 days';
END;
$$;
