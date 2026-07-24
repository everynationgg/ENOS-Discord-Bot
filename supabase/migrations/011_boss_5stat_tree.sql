-- Migration: 011_boss_5stat_tree.sql
-- Expand boss_user_profiles to support the 5-Attribute Skill Tree (stat_crit, stat_loot_boost)

ALTER TABLE boss_user_profiles
  ADD COLUMN IF NOT EXISTS stat_crit INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_loot_boost INT NOT NULL DEFAULT 0;

-- Cap any pre-existing stat_ap_save at 15 and stat_xp_boost at 10
UPDATE boss_user_profiles SET stat_ap_save = LEAST(stat_ap_save, 15);
UPDATE boss_user_profiles SET stat_xp_boost = LEAST(stat_xp_boost, 10);
UPDATE boss_user_profiles SET stat_dmg = LEAST(stat_dmg, 35);
