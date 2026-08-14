-- ENOS Migration 023: Atomic RPG Boss Attack RPC Function
-- Prevents race conditions during concurrent boss attacks by atomically applying HP reduction, player AP deduction, weekly points, total damage, user level/XP updates, and transaction logging.

CREATE OR REPLACE FUNCTION apply_boss_attack_result(
  p_boss_id UUID,
  p_player_state_id UUID,
  p_profile_id UUID,
  p_damage BIGINT,
  p_mom_buff BOOLEAN,
  p_dad_debuff BOOLEAN,
  p_action_text TEXT,
  p_user_id TEXT,
  p_ap_deducted INT,
  p_ap_contrib_points BIGINT,
  p_new_level INT,
  p_new_xp BIGINT,
  p_new_unallocated INT,
  p_guild_id TEXT,
  p_week_identifier TEXT,
  p_action_type TEXT,
  p_class_key TEXT,
  p_skill_name TEXT,
  p_points_earned BIGINT,
  p_xp_earned BIGINT,
  p_is_synergy BOOLEAN,
  p_synergy_type TEXT,
  p_ap_conserved BOOLEAN
)
RETURNS TABLE (
  new_boss_hp BIGINT,
  new_player_ap INT,
  new_player_damage BIGINT,
  new_player_weekly_points BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_hp BIGINT;
  v_new_ap INT;
  v_new_total_dmg BIGINT;
  v_new_weekly_pts BIGINT;
BEGIN
  -- 1. Atomic Boss HP Update
  UPDATE boss_seasons
  SET
    current_hp = GREATEST(0, current_hp - p_damage),
    mom_buff = p_mom_buff,
    dad_debuff = p_dad_debuff,
    last_action = p_action_text,
    last_action_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_boss_id
  RETURNING current_hp INTO v_new_hp;

  -- 2. Atomic Player State Update
  UPDATE boss_player_states
  SET
    ap_remaining = GREATEST(0, ap_remaining - p_ap_deducted),
    is_locked = TRUE,
    total_damage = total_damage + p_damage,
    weekly_points = weekly_points + p_ap_contrib_points,
    updated_at = NOW()
  WHERE id = p_player_state_id
  RETURNING ap_remaining, total_damage, weekly_points INTO v_new_ap, v_new_total_dmg, v_new_weekly_pts;

  -- 3. Atomic User Profile Update
  UPDATE boss_user_profiles
  SET
    level = p_new_level,
    xp = p_new_xp,
    unallocated_stats = p_new_unallocated,
    updated_at = NOW()
  WHERE id = p_profile_id;

  -- 4. Atomic Transaction Logging
  INSERT INTO boss_transactions (
    guild_id,
    user_id,
    week_identifier,
    action_type,
    class_key,
    skill_name,
    damage_dealt,
    points_earned,
    xp_earned,
    is_synergy,
    synergy_type,
    ap_conserved,
    created_at
  ) VALUES (
    p_guild_id,
    p_user_id,
    p_week_identifier,
    p_action_type,
    p_class_key,
    p_skill_name,
    p_damage,
    p_points_earned,
    p_xp_earned,
    p_is_synergy,
    p_synergy_type,
    p_ap_conserved,
    NOW()
  );

  RETURN QUERY SELECT v_new_hp, v_new_ap, v_new_total_dmg, v_new_weekly_pts;
END;
$$;
