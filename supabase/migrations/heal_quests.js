/**
 * ENOS Retroactive Quest Healer
 * Automatically patches quest progress for all guild members based on existing DB data.
 * Run this once to fix all users whose quests didn't count during the schema-missing period.
 *
 * Usage: node supabase/migrations/heal_quests.js
 */

require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GUILD_ID = '1111851611099254815';
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

async function healAllQuests() {
  console.log('🔧 ENOS Retroactive Quest Healer — Starting...\n');

  // 1. Get all vault balances for the guild
  const { data: balances, error: balErr } = await db
    .from('vault_balances')
    .select('*')
    .eq('guild_id', GUILD_ID);

  if (balErr || !balances?.length) {
    console.error('❌ Could not fetch vault balances:', balErr?.message);
    return;
  }
  console.log(`📋 Found ${balances.length} users in vault_balances\n`);

  // 2. Get trivia results for today
  const { data: triviaResults } = await db
    .from('trivia_results')
    .select('user_id, correct, created_at')
    .eq('guild_id', GUILD_ID)
    .gte('created_at', `${TODAY}T00:00:00Z`);

  const triviaWinners = new Set(
    (triviaResults || []).filter(r => r.correct).map(r => r.user_id)
  );
  const triviaParticipants = new Set(
    (triviaResults || []).map(r => r.user_id)
  );
  console.log(`🎯 Trivia participants today: ${triviaParticipants.size}, winners: ${triviaWinners.size}`);

  // 3. Get boss attack data for current week (W31)
  const { data: bossStates } = await db
    .from('boss_player_states')
    .select('user_id, ap_remaining, total_damage, weekly_points')
    .eq('guild_id', GUILD_ID)
    .eq('week_identifier', '2026-W31');

  const bossAttackers = new Map();
  for (const b of bossStates || []) {
    bossAttackers.set(b.user_id, b);
  }
  console.log(`⚔️  Boss attackers this week: ${bossAttackers.size}`);

  // Fix Calcifer's corrupted weekly_points (reset to correct AP-scaled value)
  for (const [userId, state] of bossAttackers) {
    const apUsed = Math.max(0, 5 - (state.ap_remaining || 0));
    const correctPoints = Math.round((apUsed / 5) * 10);
    if (state.weekly_points > 15) {
      console.log(`\n🛠️  Fixing corrupted weekly_points for ${userId}: ${state.weekly_points} → ${correctPoints}`);
      await db.from('boss_player_states')
        .update({ weekly_points: correctPoints })
        .eq('user_id', userId)
        .eq('guild_id', GUILD_ID)
        .eq('week_identifier', '2026-W31');
    }
  }

  // 4. Process each user
  let patchedCount = 0;
  for (const bal of balances) {
    const uid = bal.discord_id;
    const updates = {};
    const notes = [];

    // Chat Quest: if messages_today >= 5, mark complete
    if (!bal.quest_chat_completed && (bal.messages_today || 0) >= 5) {
      updates.quest_chat_completed = true;
      notes.push(`chat ✅ (${bal.messages_today} msgs)`);
    }

    // Voice Quest: if voice_minutes_today >= 30, mark complete
    if (!bal.quest_voice_completed && (bal.voice_minutes_today || 0) >= 30) {
      updates.quest_voice_completed = true;
      notes.push(`voice ✅ (${bal.voice_minutes_today} min)`);
    }

    // Trivia Quest: if user answered trivia today, mark complete
    if (!bal.quest_trivia_completed && triviaParticipants.has(uid)) {
      updates.quest_trivia_completed = true;
      notes.push(`trivia ✅ (answered today)`);
    }

    // Boss Quest: if user attacked boss this week
    if (!bal.quest_boss_done && bossAttackers.has(uid)) {
      updates.quest_boss_done = true;
      notes.push(`boss ✅ (attacked this week)`);
    }

    // If we have updates, apply them
    if (Object.keys(updates).length > 0) {
      const { error } = await db
        .from('vault_balances')
        .update(updates)
        .eq('discord_id', uid)
        .eq('guild_id', GUILD_ID);

      if (error) {
        console.log(`  ❌ ${uid}: Error — ${error.message}`);
      } else {
        console.log(`  ✅ ${uid}: Patched — ${notes.join(', ')}`);
        patchedCount++;
      }
    }
  }

  console.log(`\n✅ Done! Patched ${patchedCount}/${balances.length} users.`);
}

healAllQuests().catch(console.error);
