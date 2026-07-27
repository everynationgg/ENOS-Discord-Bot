require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GUILD_ID = '1111851611099254815';

(async () => {
  console.log('=== FULL GUILD COMPREHENSIVE AUDIT ===\n');

  const { data: balances } = await db.from('vault_balances').select('*').eq('guild_id', GUILD_ID);
  const { data: triviaParts } = await db.from('trivia_participants').select('*');
  const { data: triviaPoints } = await db.from('trivia_points').select('*').eq('guild_id', GUILD_ID);
  const { data: bossStates } = await db.from('boss_player_states').select('*').eq('guild_id', GUILD_ID);
  const { data: bossTx } = await db.from('boss_transactions').select('*').eq('guild_id', GUILD_ID);

  const triviaUserMap = new Map();
  (triviaParts || []).forEach(p => {
    const stat = triviaUserMap.get(p.user_id) || { attempted: 0, correct: 0, dates: new Set() };
    stat.attempted++;
    if (p.is_correct) stat.correct++;
    if (p.started_at) stat.dates.add(p.started_at.split('T')[0]);
    triviaUserMap.set(p.user_id, stat);
  });

  const triviaPointsMap = new Map();
  (triviaPoints || []).forEach(tp => triviaPointsMap.set(tp.discord_id, tp.points));

  const bossUserMap = new Map();
  (bossStates || []).forEach(bs => {
    const apUsed = Math.max(0, 5 - (bs.ap_remaining || 0));
    const stat = bossUserMap.get(bs.user_id) || { weeks: new Set(), totalDamage: 0, apUsedTotal: 0, currentWeekAp: 0 };
    if (apUsed > 0 || bs.total_damage > 0) {
      stat.weeks.add(bs.week_identifier);
      stat.totalDamage += (bs.total_damage || 0);
      stat.apUsedTotal += apUsed;
      if (bs.week_identifier === '2026-W31') stat.currentWeekAp = apUsed;
    }
    bossUserMap.set(bs.user_id, stat);
  });

  const bossTxUsers = new Set((bossTx || []).map(t => t.user_id));

  console.log(`Found ${balances?.length || 0} members in Vault:\n`);

  for (const b of balances || []) {
    const uid = b.discord_id;
    const tStat = triviaUserMap.get(uid) || { attempted: 0, correct: 0, dates: new Set() };
    const tPts = triviaPointsMap.get(uid) || 0;
    const bStat = bossUserMap.get(uid) || { weeks: new Set(), totalDamage: 0, apUsedTotal: 0, currentWeekAp: 0 };
    const attackedBoss = bossTxUsers.has(uid) || bStat.weeks.size > 0;

    console.log(`User: ${uid}`);
    console.log(`  Coins: ${b.coins} | Tier: ${b.tier}`);
    console.log(`  Quests Today: Chat=${b.quest_chat_completed} (${b.messages_today || 0} msgs) | Voice=${b.quest_voice_completed} (${b.voice_minutes_today || 0} mins) | Trivia=${b.quest_trivia_completed} | Boss=${b.quest_boss_done}`);
    console.log(`  Trivia History: LifetimePts=${tPts} | Attempted=${tStat.attempted} drops | Correct=${tStat.correct} | Dates=[${Array.from(tStat.dates).join(', ')}]`);
    console.log(`  Boss History: Attacked=${attackedBoss} | WeeksActive=${bStat.weeks.size} | TotalDMG=${bStat.totalDamage} | W31_AP=${bStat.currentWeekAp}/5 AP`);
    console.log('');
  }
})();
