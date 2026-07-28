require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GUILD_ID = '1111851611099254815';

(async () => {
  console.log('=== STARTING AUTOMATED FULL RETROACTIVE HEAL & REWARD ===\n');

  // 1. Fetch all vault balances
  const { data: balances } = await db.from('vault_balances').select('*').eq('guild_id', GUILD_ID);

  // 2. Fetch all trivia participants
  const { data: triviaParts } = await db.from('trivia_participants').select('*');
  const triviaUserMap = new Map();
  (triviaParts || []).forEach(p => {
    const stat = triviaUserMap.get(p.user_id) || { attempted: 0, correct: 0, dates: new Set() };
    stat.attempted++;
    if (p.is_correct) stat.correct++;
    if (p.started_at) stat.dates.add(p.started_at.split('T')[0]);
    triviaUserMap.set(p.user_id, stat);
  });

  // 3. Fetch boss states
  const { data: bossStates } = await db.from('boss_player_states').select('*').eq('guild_id', GUILD_ID);
  const bossUserMap = new Map();
  (bossStates || []).forEach(bs => {
    const apUsed = Math.max(0, 5 - (bs.ap_remaining || 0));
    if (apUsed > 0 || (bs.total_damage || 0) > 0) {
      bossUserMap.set(bs.user_id, { apUsed, totalDamage: bs.total_damage || 0 });
    }
  });

  const { data: bossTx } = await db.from('boss_transactions').select('user_id').eq('guild_id', GUILD_ID);
  (bossTx || []).forEach(t => {
    if (!bossUserMap.has(t.user_id)) {
      bossUserMap.set(t.user_id, { apUsed: 1, totalDamage: 4000 });
    }
  });

  let healedUsersCount = 0;

  for (const b of balances || []) {
    const uid = b.discord_id;
    const tStat = triviaUserMap.get(uid) || { attempted: 0, correct: 0, dates: new Set() };
    const bStat = bossUserMap.get(uid);

    let coinsToAdd = 0;
    const updates = {};
    const notes = [];

    // Boss Quest Check
    if (bStat && !b.quest_boss_done) {
      updates.quest_boss_done = true;
      coinsToAdd += 1;
      notes.push('Boss Quest Completed (+1 Coin)');
    }

    // Trivia Quest Check (if attempted/won today or previously)
    if (tStat.attempted > 0 && !b.quest_trivia_completed) {
      updates.quest_trivia_completed = true;
      coinsToAdd += 1;
      notes.push('Trivia Quest Completed (+1 Coin)');
    }

    // Chat Quest Check (if messages_today >= 5)
    if ((b.messages_today || 0) >= 5 && !b.quest_chat_completed) {
      updates.quest_chat_completed = true;
      coinsToAdd += 1;
      notes.push('Chat Quest Completed (+1 Coin)');
    }

    // Voice Quest Check (if voice_minutes_today >= 30)
    if ((b.voice_minutes_today || 0) >= 30 && !b.quest_voice_completed) {
      updates.quest_voice_completed = true;
      coinsToAdd += 1;
      notes.push('Voice Quest Completed (+1 Coin)');
    }

    // Mark quest_started = true for everyone who has any activity
    if (!b.quest_started && (bStat || tStat.attempted > 0 || (b.messages_today || 0) > 0 || (b.voice_minutes_today || 0) > 0)) {
      updates.quest_started = true;
      notes.push('Quest Started Flag Activated');
    }

    if (coinsToAdd > 0) {
      updates.coins = (Number(b.coins) || 0) + coinsToAdd;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await db.from('vault_balances').update(updates).eq('discord_id', uid).eq('guild_id', GUILD_ID);

      if (error) {
        console.log(`❌ Error patching user ${uid}: ${error.message}`);
      } else {
        console.log(`✅ Patched ${uid}: ${notes.join(' | ')}`);
        if (coinsToAdd > 0) {
          // Log transaction
          try {
            await db.from('vault_transactions').insert({
              guild_id: GUILD_ID,
              discord_id: uid,
              delta: coinsToAdd,
              reason: 'retroactive_quest_heal',
            });
          } catch (e) {}
        }
        healedUsersCount++;
      }
    }
  }

  console.log(`\n🎉 HEAL COMPLETE! Successfully updated ${healedUsersCount} accounts with missing quest completions and coin drops!`);
})();
