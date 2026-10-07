-- Migration 031: Consolidated Achievements, User Achievements, Newsroom Posts, and Vault Coins Helper
-- Safe, idempotent additive migration to complete missing tables and functions.

-- ============================================================================
-- 1. ACHIEVEMENTS CATALOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,                  -- 'boss', 'trivia', 'vault', 'lfg', 'social'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  
  -- Tier 1 Definition (Bronze / Enis)
  tier1_title TEXT NOT NULL,
  tier1_goal INT NOT NULL,
  tier1_reward_coins INT DEFAULT 250,
  
  -- Tier 2 Definition (Silver / Enara)
  tier2_title TEXT NOT NULL,
  tier2_goal INT NOT NULL,
  tier2_reward_coins INT DEFAULT 500,
  
  -- Tier 3 Definition (Gold / Exclusive Crown / Enorium)
  tier3_title TEXT NOT NULL,
  tier3_goal INT NOT NULL,
  tier3_reward_coins INT DEFAULT 1250,
  tier3_reward_role_name TEXT,
  is_tier3_exclusive BOOLEAN DEFAULT true, -- Only 1 player can hold Tier 3 at a time
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial 5 master achievements if not already present
INSERT INTO public.achievements (
  id, category, title, description, icon_emoji,
  tier1_title, tier1_goal, tier1_reward_coins,
  tier2_title, tier2_goal, tier2_reward_coins,
  tier3_title, tier3_goal, tier3_reward_coins, tier3_reward_role_name, is_tier3_exclusive
) VALUES 
(
  'boss_warlord', 'boss', 'Weekly Boss Bounty Warlord',
  'Participate in Weekly Boss RPG bounties and deal massive damage to corrupted glitch bosses.', '🐉',
  'Boss Hunter', 50000, 250,
  'Boss Slayer', 250000, 500,
  'Reigning Boss Overlord', 1000000, 2500, 'Reigning Boss Overlord', true
),
(
  'trivia_scholar', 'trivia', 'Daily Trivia Scholar',
  'Answer daily community trivia drops correctly and build streak momentum.', '🧠',
  'Trivia Student', 7, 250,
  'Trivia Master', 30, 500,
  'Reigning Trivia Grandmaster', 100, 2500, 'Reigning Trivia Grandmaster', true
),
(
  'vault_tycoon', 'vault', 'Vault Economy Tycoon',
  'Earn and hoard Vault Coins through games, events, and community bounties.', '💰',
  'Coin Collector', 5000, 250,
  'Vault Merchant', 25000, 500,
  'Reigning Wealth Leader', 100000, 2500, 'Reigning Wealth Leader', true
),
(
  'lfg_vanguard', 'lfg', 'LFG Party Vanguard',
  'Organize and join gaming parties using the ENOS LFG Party Builder system.', '🎮',
  'Party Recruit', 5, 250,
  'Squad Leader', 25, 500,
  'Reigning Party Vanguard', 100, 2500, 'Reigning Party Vanguard', true
),
(
  'social_luminary', 'social', 'Community Social Luminary',
  'Engage in server chat activity, voice channels, and birthday celebrations.', '🗣️',
  'Chatter', 100, 250,
  'Community Spark', 1000, 500,
  'Reigning Server Luminary', 5000, 2500, 'Reigning Server Luminary', true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. USER ACHIEVEMENTS TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT,
  user_id TEXT NOT NULL,
  achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE,
  achievement_key TEXT,
  tier_key TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Progress tracking for tiered achievements
  current_progress INT DEFAULT 0,
  tier1_unlocked BOOLEAN DEFAULT false,
  tier1_unlocked_at TIMESTAMPTZ,
  tier2_unlocked BOOLEAN DEFAULT false,
  tier2_unlocked_at TIMESTAMPTZ,
  tier3_unlocked BOOLEAN DEFAULT false,
  tier3_unlocked_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query lookup & leaderboards
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_key_tier ON public.user_achievements(achievement_key, tier_key);
CREATE INDEX IF NOT EXISTS idx_user_achievements_guild_user ON public.user_achievements(guild_id, user_id);

-- RLS for achievements and user_achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on achievements" ON public.achievements;
CREATE POLICY "Allow public read access on achievements"
  ON public.achievements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access on achievements" ON public.achievements;
CREATE POLICY "Allow service role full access on achievements"
  ON public.achievements FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on user_achievements" ON public.user_achievements;
CREATE POLICY "Allow public read access on user_achievements"
  ON public.user_achievements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access on user_achievements" ON public.user_achievements;
CREATE POLICY "Allow service role full access on user_achievements"
  ON public.user_achievements FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. NEWSROOM POSTS TABLE & AUTO-PRUNING
-- ============================================================================
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

-- Unique index to prevent duplicate posts per article & category
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsroom_posts_unique 
  ON public.newsroom_posts (guild_id, category, article_guid);

-- Fast lookup index for title deduplication within 24h
CREATE INDEX IF NOT EXISTS idx_newsroom_posts_guild_cat_time 
  ON public.newsroom_posts (guild_id, category, posted_at DESC);

-- RLS for newsroom_posts
ALTER TABLE public.newsroom_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on newsroom_posts" ON public.newsroom_posts;
CREATE POLICY "Allow public read access on newsroom_posts"
  ON public.newsroom_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access on newsroom_posts" ON public.newsroom_posts;
CREATE POLICY "Allow service role full access on newsroom_posts"
  ON public.newsroom_posts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Automated Pruning RPC Function (< 60 days of history to preserve database storage)
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

-- ============================================================================
-- 4. ATOMIC VAULT COINS RPC HELPER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_vault_coins(
  p_user_id TEXT,
  p_guild_id TEXT,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT 'Vault Coin Award'
) RETURNS NUMERIC AS $$
DECLARE
  v_new_coins NUMERIC;
BEGIN
  INSERT INTO public.vault_balances (guild_id, discord_id, coins)
  VALUES (p_guild_id, p_user_id, p_amount)
  ON CONFLICT (guild_id, discord_id)
  DO UPDATE SET 
    coins = public.vault_balances.coins + EXCLUDED.coins,
    updated_at = NOW()
  RETURNING coins INTO v_new_coins;

  INSERT INTO public.vault_transactions (guild_id, discord_id, delta, reason)
  VALUES (p_guild_id, p_user_id, p_amount, p_reason);

  RETURN v_new_coins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
