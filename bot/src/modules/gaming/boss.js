const { supabase, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Gets the current ISO week identifier string (e.g. "2026-W30").
 * @returns {string}
 */
function getWeekIdentifier(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns default boss data when no custom boss is specified.
 * @returns {Promise<{ bossName: string, bossTitle: string, lore: string }>}
 */
async function generateGlitchBossLore() {
  return {
    bossName: 'ERROR-MOD: Corrupted Anomaly',
    bossTitle: 'System Threat',
    lore: 'A space-time realm rift merged game data with ENOS core protocols. An entity has manifested in the server! Coordinate your triad skills to neutralize!',
  };
}

/**
 * Gets or initializes the active Weekly Boss for a guild.
 * @param {string} guildId
 * @returns {Promise<any>}
 */
async function getOrCreateActiveBoss(guildId) {
  const currentWeek = getWeekIdentifier();

  // Fetch active non-defeated or overkill boss for current week
  const { data: activeBoss } = await supabase
    .from('boss_seasons')
    .select('*')
    .eq('guild_id', guildId)
    .eq('week_identifier', currentWeek)
    .order('is_overkill', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeBoss) return activeBoss;

  // Calculate HP using Rolling Average of past 3 weeks active participants + 20% Busyness Buffer
  const pastWeeks = [];
  for (let i = 1; i <= 3; i++) {
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - (7 * i));
    pastWeeks.push(getWeekIdentifier(prevDate));
  }

  const { data: pastParticipants } = await supabase
    .from('boss_player_states')
    .select('user_id, week_identifier')
    .eq('guild_id', guildId)
    .in('week_identifier', pastWeeks);

  const participantCountsPerWeek = {};
  (pastParticipants || []).forEach(p => {
    participantCountsPerWeek[p.week_identifier] = (participantCountsPerWeek[p.week_identifier] || 0) + 1;
  });

  const countValues = Object.values(participantCountsPerWeek);
  const avgParticipants = countValues.length > 0
    ? countValues.reduce((a, b) => a + b, 0) / countValues.length
    : 5; // Default 5 expected players for first week

  const targetPlayers = Math.max(1, Math.ceil(avgParticipants * 0.80)); // 20% Churn Allowance

  // Scaling Math
  let bossHp = 150000 + (targetPlayers * 35000);
  if (targetPlayers < 5) {
    bossHp = 50000 + (targetPlayers * 35000);
  }

  // Generate Boss AI Lore
  const bossData = await generateGlitchBossLore();


  // Insert new weekly boss season in Supabase
  const { data: newBoss, error } = await supabase
    .from('boss_seasons')
    .insert({
      guild_id: guildId,
      week_identifier: currentWeek,
      boss_name: bossData.bossName,
      boss_title: bossData.bossTitle,
      lore: bossData.lore,
      max_hp: bossHp,
      current_hp: bossHp,
      is_overkill: false,
      is_defeated: false,
      mom_buff: false,
      dad_debuff: false,
      last_action: 'Weekly Boss Spawned! Pick your class to begin combat.',
    })
    .select()
    .single();

  if (error) {
    logger.error('[BOSS] Failed to create new weekly boss season:', error.message);
    return null;
  }

  return newBoss;
}

/**
 * Gets or initializes the player state for the current week.
 * Assigns 5 AP upon first interaction mid-week.
 */
async function getPlayerState(guildId, userId) {
  const currentWeek = getWeekIdentifier();

  const { data: existing } = await supabase
    .from('boss_player_states')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('week_identifier', currentWeek)
    .maybeSingle();

  if (existing) return existing;

  const { data: newPlayer, error } = await supabase
    .from('boss_player_states')
    .insert({
      guild_id: guildId,
      user_id: userId,
      week_identifier: currentWeek,
      ap_remaining: 5,
      is_locked: false,
      total_damage: 0,
      weekly_points: 0,
    })
    .select()
    .single();

  if (error) {
    logger.error('[BOSS] Failed to initialize player state:', error.message);
    return null;
  }

  return newPlayer;
}

/**
 * Gets or initializes persistent RPG User Profile (level, XP, stat allocation).
 */
async function getUserProfile(guildId, userId) {
  const { data: existing } = await supabase
    .from('boss_user_profiles')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: newProfile, error } = await supabase
    .from('boss_user_profiles')
    .insert({
      guild_id: guildId,
      user_id: userId,
      level: 1,
      xp: 0,
      unallocated_stats: 0,
      stat_dmg: 0,
      stat_ap_save: 0,
      stat_xp_boost: 0,
    })
    .select()
    .single();

  if (error) {
    logger.error('[BOSS] Failed to initialize user profile:', error.message);
    return null;
  }

  return newProfile;
}

/**
 * Updates player class selection (M.O.M., D.A.D., or K.I.D.).
 * Reusable until player spends first AP of the week.
 */
async function setPlayerClass(guildId, userId, classKey) {
  const currentWeek = getWeekIdentifier();
  const playerState = await getPlayerState(guildId, userId);

  if (!playerState) return { success: false, message: 'Failed to fetch player record.' };
  if (playerState.is_locked) {
    return { success: false, message: '❌ Your class is locked for this week because you have already spent AP!' };
  }

  const validClasses = ['mom', 'dad', 'kid'];
  if (!validClasses.includes(classKey)) {
    return { success: false, message: 'Invalid class selection.' };
  }

  const { error } = await supabase
    .from('boss_player_states')
    .update({ class_key: classKey, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('week_identifier', currentWeek);

  if (error) {
    return { success: false, message: 'Failed to update class selection.' };
  }

  const names = { mom: '🛡️ M.O.M. (Buff Support)', dad: '🔨 D.A.D. (Debuff Setup)', kid: '⚡ K.I.D. (Nuke Combo)' };
  return { success: true, message: `✅ Selected **${names[classKey]}**! You can change class until your first AP attack.` };
}

/**
 * Allocates stat points into RPG user profile attributes.
 */
async function allocateStatPoint(guildId, userId, statType) {
  const profile = await getUserProfile(guildId, userId);
  if (!profile) return { success: false, message: 'Profile not found.' };

  if (profile.unallocated_stats <= 0) {
    return { success: false, message: '❌ You have no unallocated stat points available. Level up to earn more!' };
  }

  const updates = { unallocated_stats: profile.unallocated_stats - 1, updated_at: new Date().toISOString() };

  if (statType === 'dmg') {
    updates.stat_dmg = profile.stat_dmg + 1;
  } else if (statType === 'ap_save') {
    if (profile.stat_ap_save >= 4) {
      return { success: false, message: '❌ AP Conservation is capped at 4 points (20% maximum chance).' };
    }
    updates.stat_ap_save = profile.stat_ap_save + 1;
  } else if (statType === 'xp_boost') {
    updates.stat_xp_boost = profile.stat_xp_boost + 1;
  } else {
    return { success: false, message: 'Invalid stat type.' };
  }

  const { error } = await supabase
    .from('boss_user_profiles')
    .update(updates)
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, message: 'Failed to allocate stat point.' };
  }

  return { success: true, message: `✅ Allocated 1 point into **${statType.toUpperCase()}**!` };
}

/**
 * Executes a player combat move (Basic Attack 1 AP or Skill 3 AP).
 */
async function executeCombatAction(guildId, userId, actionType) {
  const boss = await getOrCreateActiveBoss(guildId);
  const playerState = await getPlayerState(guildId, userId);
  const profile = await getUserProfile(guildId, userId);

  if (!boss || !playerState || !profile) {
    return { success: false, message: 'Failed to load combat records.' };
  }

  if (!playerState.class_key) {
    return { success: false, message: '❌ You must pick a class before performing an attack!' };
  }

  const apCost = actionType === 'skill' ? 3 : 1;

  if (playerState.ap_remaining < apCost) {
    return {
      success: false,
      message: `❌ You do not have enough AP! Action costs **${apCost} AP**, but you only have **${playerState.ap_remaining} AP** remaining this week.`,
    };
  }

  // Option B: AP Conservation Roll (+5% chance per stat_ap_save point, max 20%)
  const apSaveChance = Math.min(0.20, profile.stat_ap_save * 0.05);
  const apConserved = Math.random() < apSaveChance;
  const actualApDeducted = apConserved ? 0 : apCost;

  // Base Damage Math
  let baseDmg = 4000;
  let skillName = 'Basic Attack';
  let isSynergy = false;
  let synergyType = null;
  let newMomBuff = boss.mom_buff;
  let newDadDebuff = boss.dad_debuff;

  const classKey = playerState.class_key;

  if (actionType === 'basic') {
    if (classKey === 'mom') skillName = 'Slipper Throw';
    else if (classKey === 'dad') skillName = 'Dad Slap';
    else skillName = 'iPad Throw';
    baseDmg = 4000;
  } else {
    // 3 AP Skill
    if (classKey === 'mom') {
      skillName = 'Guilt Trip';
      baseDmg = 15000;
      newMomBuff = true;
    } else if (classKey === 'dad') {
      skillName = 'Dad Joke';
      baseDmg = 15000;
      newDadDebuff = true;
    } else if (classKey === 'kid') {
      skillName = 'Grocery Meltdown';
      if (boss.mom_buff && boss.dad_debuff) {
        // Full Triad Meltdown Combo
        baseDmg = 60000;
        isSynergy = true;
        synergyType = 'full';
        newMomBuff = false;
        newDadDebuff = false;
      } else if (boss.mom_buff || boss.dad_debuff) {
        // 2-Class Partial Combo
        baseDmg = 30000;
        isSynergy = true;
        synergyType = 'partial';
        if (boss.mom_buff) newMomBuff = false;
        if (boss.dad_debuff) newDadDebuff = false;
      } else {
        // Solo Skill
        baseDmg = 15000;
      }
    }
  }

  // Stat Dmg Bonus (+2% per stat_dmg point)
  const dmgMultiplier = 1 + (profile.stat_dmg * 0.02);
  let totalDmg = Math.round(baseDmg * dmgMultiplier);

  // Overkill Mode 1.5x Bonus Multiplier
  const pointsMultiplier = boss.is_overkill ? 1.5 : 1.0;
  let pointsEarned = Math.round(totalDmg * pointsMultiplier);

  // XP Math: 100 XP per AP spent + stat_xp_boost (+5% per point)
  const xpMultiplier = 1 + (profile.stat_xp_boost * 0.05);
  const baseXp = apCost * 100;
  const xpEarned = Math.round(baseXp * xpMultiplier * pointsMultiplier);

  // Atomic Update Boss HP & Synergy State in Supabase
  const newHp = Math.max(0, boss.current_hp - totalDmg);
  let actionText = `${classKey.toUpperCase()} used ${skillName} dealt ${totalDmg.toLocaleString()} DMG`;
  if (apConserved) actionText += ' ⚡ (0 AP SPENT!)';
  if (isSynergy) actionText += ` 🔥 (${synergyType.toUpperCase()} COMBO!)`;
  if (newLevel > profile.level) actionText += ` 🎉 (LEVEL UP to Lv.${newLevel}!)`;

  const { data: updatedBoss, error: bossErr } = await supabase
    .from('boss_seasons')
    .update({
      current_hp: newHp,
      mom_buff: newMomBuff,
      dad_debuff: newDadDebuff,
      last_action: actionText,
      last_action_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boss.id)
    .select()
    .single();

  if (bossErr) {
    logger.error('[BOSS] Failed to update boss HP:', bossErr.message);
    return { success: false, message: 'Failed to process attack.' };
  }

  // Update Player AP & Points
  const newAp = playerState.ap_remaining - actualApDeducted;
  await supabase
    .from('boss_player_states')
    .update({
      ap_remaining: newAp,
      is_locked: true,
      total_damage: playerState.total_damage + totalDmg,
      weekly_points: playerState.weekly_points + pointsEarned,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playerState.id);

  // Update User Account XP & Check Level Up
  const newXp = profile.xp + xpEarned;
  const xpPerLevel = profile.level * 500;
  let newLevel = profile.level;
  let newUnallocated = profile.unallocated_stats;

  if (newXp >= xpPerLevel) {
    newLevel += 1;
    newUnallocated += 1; // 1 Stat Point per level
  }

  await supabase
    .from('boss_user_profiles')
    .update({
      level: newLevel,
      xp: newXp,
      unallocated_stats: newUnallocated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  // Log Transaction
  await supabase.from('boss_transactions').insert({
    guild_id: guildId,
    user_id: userId,
    week_identifier: boss.week_identifier,
    action_type: actionType,
    class_key: classKey,
    skill_name: skillName,
    damage_dealt: totalDmg,
    points_earned: pointsEarned,
    xp_earned: xpEarned,
    is_synergy: isSynergy,
    synergy_type: synergyType,
    ap_conserved: apConserved,
  });

  // Check Boss Defeat & Spawn Overkill Mode
  if (newHp <= 0 && !boss.is_overkill) {
    await triggerOverkillRevival(guildId, boss);
  }

  return {
    success: true,
    damageDealt: totalDmg,
    pointsEarned,
    xpEarned,
    apRemaining: newAp,
    apConserved,
    leveledUp: newLevel > profile.level,
    newLevel,
    isSynergy,
    synergyType,
    skillName,
  };
}

/**
 * Triggers Overkill Mode when the main boss HP reaches 0 before Sunday.
 */
async function triggerOverkillRevival(guildId, boss) {
  // Mark main boss as defeated
  await supabase
    .from('boss_seasons')
    .update({ is_defeated: true })
    .eq('id', boss.id);

  // Delete existing overkill boss season for this week before inserting new overkill spawn
  await supabase
    .from('boss_seasons')
    .delete()
    .eq('guild_id', guildId)
    .eq('week_identifier', boss.week_identifier)
    .eq('is_overkill', true);

  // Spawn Overkill Boss with refreshed HP
  const overkillName = `ERROR-MOD: Backup System Activated! (${boss.boss_name.replace(/^ERROR-MOD: Corrupted /, '')})`;
  await supabase
    .from('boss_seasons')
    .insert({
      guild_id: guildId,
      week_identifier: boss.week_identifier,
      boss_name: overkillName,
      boss_title: '🔥 OVERKILL RECOVERY PHASE (1.5x BONUS XP & POINTS)',
      lore: 'Emergency backup matrix online! Defeat the Overkill Boss to earn 1.5x bonus points and XP for your server!',
      max_hp: boss.max_hp,
      current_hp: boss.max_hp,
      is_overkill: true,
      is_defeated: false,
      mom_buff: false,
      dad_debuff: false,
      last_action: '⚡ OVERKILL MODE ACTIVATED! Emergency Backup System online.',
    });

  await logBotEvent(guildId, 'boss_overkill_spawn', null, { week: boss.week_identifier });
}

module.exports = {
  getWeekIdentifier,
  getOrCreateActiveBoss,
  getPlayerState,
  getUserProfile,
  setPlayerClass,
  allocateStatPoint,
  executeCombatAction,
  generateGlitchBossLore,
};
