/**
 * ENOS Retroactive Quest Healer v2
 * Uses actual trivia_participants table to patch trivia quest completion.
 * Run: node supabase/migrations/heal_quests.js
 */

require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GUILD_ID = '1111851611099254815';
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

async function healAllQuests() {
  console.log('🔧 ENOS Retroactive Quest Healer v2 — Starting...\n');

  // 1. Get all vault balances for the guild
  const { data: balances } = await db
    .from('vault_balances')
    .select('*')
    .eq('guild_id', GUILD_ID);

  console.log(`📋 Found ${balances?.length || 0} users in vault_balances\n`);

  // 2. Get trivia participants who answered correctly today
  //    Join through trivia_drops to filter by today's date
  const { data: todayDrops } = await db
    .from('trivia_drops')
    .select('id')
    .eq('guild_id', GUILD_ID)
    .gte('created_at', `${TODAY}T00:00:00Z`);

  const todayDropIds = (todayDrops || []).map(d => d.id);
  console.log(`🎯 Today's trivia drops: ${todayDropIds.length}`);

  const triviaWinners = new Set();
  const triviaParticipants = new Set();

  if (todayDropIds.length > 0) {
    const { data: participants } = await db
      .from('trivia_participants')
      .select('user_id, is_correct')
      .in('drop_id', todayDropIds);

    for (const p of participants || []) {
      triviaParticipants.add(p.user_id);
      if (p.is_correct) triviaWinners.add(p.user_id);
    }
  }
  console.log(`   Participants: ${triviaParticipants.size}, Winners: ${triviaWinners.size}`);

  // 3. Get boss attack data for current week
  const { data: bossStates } = await db
    .from('boss_player_states')
    .select('user_id, ap_remaining, total_damage, weekly_points')
    .eq('guild_id', GUILD_ID)
    .eq('week_identifier', '2026-W31');

  const bossAttackers = new Map();
  for (const b of bossStates || []) {
    bossAttackers.set(b.user_id, b);
  }
  console.log(`⚔️  Boss attackers this week: ${bossAttackers.size}\n`);

  // Fix any corrupted weekly_points (reset to correct AP-scaled value)
  for (const [userId, state] of bossAttackers) {
    const apUsed = Math.max(0, 5 - (state.ap_remaining || 0));
    const correctPoints = Math.round((apUsed / 5) * 10);
    if (state.weekly_points > 15) {
      console.log(`🛠️  Fixing corrupted weekly_points for ${userId}: ${state.weekly_points} → ${correctPoints}`);
      await db.from('boss_player_states')
        .update({ weekly_points: correctPoints })
        .eq('user_id', userId)
        .eq('guild_id', GUILD_ID)
        .eq('week_identifier', '2026-W31');
    }
  }

  // 4. Process each user
  let patchedCount = 0;
  for (const bal of balances || []) {
    const uid = bal.discord_id;
    const updates = {};
    const notes = [];

    // Chat Quest: messages_today >= 5
    if (!bal.quest_chat_completed && (bal.messages_today || 0) >= 5) {
      updates.quest_chat_completed = true;
      notes.push(`chat ✅ (${bal.messages_today} msgs)`);
    }

    // Voice Quest: voice_minutes_today >= 30
    if (!bal.quest_voice_completed && (bal.voice_minutes_today || 0) >= 30) {
      updates.quest_voice_completed = true;
      notes.push(`voice ✅ (${bal.voice_minutes_today} min)`);
    }

    // Trivia Quest: participated today (any attempt counts — being generous)
    if (!bal.quest_trivia_completed && triviaParticipants.has(uid)) {
      updates.quest_trivia_completed = true;
      const label = triviaWinners.has(uid) ? 'correct answer' : 'participated';
      notes.push(`trivia ✅ (${label})`);
    }

    // Boss Quest: attacked this week
    if (!bal.quest_boss_done && bossAttackers.has(uid)) {
      updates.quest_boss_done = true;
      notes.push(`boss ✅ (attacked this week)`);
    }

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

  console.log(`\n✅ Done! Patched ${patchedCount}/${balances?.length || 0} users.`);
}

healAllQuests().catch(console.error);
