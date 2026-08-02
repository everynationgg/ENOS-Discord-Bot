-- Migration 010: Achievements System with 3-Tier Structure and Exclusive Tier 3 Crown Tracking

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,                  -- 'boss', 'trivia', 'vault', 'lfg', 'social'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  
  -- Tier 1 Definition (Bronze)
  tier1_title TEXT NOT NULL,
  tier1_goal INT NOT NULL,
  tier1_reward_coins INT DEFAULT 250,
  
  -- Tier 2 Definition (Silver)
  tier2_title TEXT NOT NULL,
  tier2_goal INT NOT NULL,
  tier2_reward_coins INT DEFAULT 500,
  
  -- Tier 3 Definition (Gold / Exclusive Crown)
  tier3_title TEXT NOT NULL,
  tier3_goal INT NOT NULL,
  tier3_reward_coins INT DEFAULT 1250,
  tier3_reward_role_name TEXT,
  is_tier3_exclusive BOOLEAN DEFAULT true, -- Only 1 player can hold Tier 3 at a time!
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE,
  
  current_progress INT DEFAULT 0,
  tier1_unlocked BOOLEAN DEFAULT false,
  tier1_unlocked_at TIMESTAMPTZ,
  
  tier2_unlocked BOOLEAN DEFAULT false,
  tier2_unlocked_at TIMESTAMPTZ,
  
  tier3_unlocked BOOLEAN DEFAULT false,
  tier3_unlocked_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id, achievement_id)
);

-- Index for fast user queries and leaderboard ranking
CREATE INDEX IF NOT EXISTS idx_user_achievements_lookup ON public.user_achievements(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_progress ON public.user_achievements(guild_id, achievement_id, current_progress DESC);

-- Seed initial 5 achievements
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
