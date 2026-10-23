-- =============================================================================
-- Migration 032: Atomic Vault Coin RPC, NUMERIC Columns, RLS Hardening & Indexes
-- Additive & Idempotent — Safe to run on production Supabase
-- =============================================================================

-- 0. Ensure Vault & Boss coin/point columns are NUMERIC (prevents integer truncation/22P02 errors on decimal awards like 0.5 or 1.5)
ALTER TABLE IF EXISTS public.vault_balances ALTER COLUMN coins TYPE NUMERIC USING coins::NUMERIC;
ALTER TABLE IF EXISTS public.vault_transactions ALTER COLUMN delta TYPE NUMERIC USING delta::NUMERIC;
ALTER TABLE IF EXISTS public.boss_player_states ALTER COLUMN weekly_points TYPE NUMERIC USING weekly_points::NUMERIC;
ALTER TABLE IF EXISTS public.boss_transactions ALTER COLUMN points_earned TYPE NUMERIC USING points_earned::NUMERIC;

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
  INSERT INTO public.vault_balances (discord_id, guild_id, coins, xp, tier, updated_at, last_active)
  VALUES (p_discord_id, p_guild_id, GREATEST(0, ROUND(p_delta, 2)), 0, 'starter', NOW(), NOW())
  ON CONFLICT (discord_id, guild_id)
  DO UPDATE SET
    coins = GREATEST(0, ROUND(COALESCE(public.vault_balances.coins, 0) + p_delta, 2)),
    updated_at = NOW(),
    last_active = NOW()
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
ALTER TABLE IF EXISTS public.temp_voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bot_temp_voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_member_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_server_lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npc_deliberation_logs ENABLE ROW LEVEL SECURITY;
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
    'temp_voice_channels',
    'bot_temp_voice_channels',
    'npc_relationships',
    'npc_member_memories',
    'npc_server_lore',
    'npc_deliberation_logs',
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

-- 6. Expand prune_old_records() to clean up stale logs and expired sessions safely
CREATE OR REPLACE FUNCTION public.prune_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bot_event_logs') THEN
    DELETE FROM public.bot_event_logs WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lfg_sessions') THEN
    DELETE FROM public.lfg_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_logs') THEN
    DELETE FROM public.system_logs WHERE created_at < NOW() - INTERVAL '7 days';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'npc_deliberation_logs') THEN
    DELETE FROM public.npc_deliberation_logs WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsroom_posts') THEN
    DELETE FROM public.newsroom_posts WHERE posted_at < NOW() - INTERVAL '60 days';
  END IF;
END;
$$;
