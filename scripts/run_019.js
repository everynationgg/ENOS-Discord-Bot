require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const columns = [
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_started BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS coins_earned_today NUMERIC NOT NULL DEFAULT 0",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_chat_completed BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_completed BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_trivia_completed BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS assigned_quests JSONB DEFAULT '[\"chat\", \"voice\", \"trivia\"]'::jsonb",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_reactions_count INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_voice_status_done BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_ai_chat_done BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_boss_done BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS voice_minutes_today INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE vault_balances ADD COLUMN IF NOT EXISTS quest_claimed_reaction BOOLEAN NOT NULL DEFAULT FALSE",
];

(async () => {
  for (const stmt of columns) {
    const colName = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
    const { error } = await db.rpc('exec_sql', { query: stmt }).catch(() => ({ error: 'rpc_not_available' }));
    if (error && error !== 'rpc_not_available') {
      console.error('ERROR on', colName, ':', error);
    } else if (error === 'rpc_not_available') {
      // Try direct insert workaround - update a row with the new column to force schema refresh
      console.log('RPC not available, will use Supabase dashboard SQL editor');
      break;
    } else {
      console.log('OK:', colName);
    }
  }

  // Verify final column list
  const { data } = await db.from('vault_balances').select('*').limit(1);
  console.log('\nFINAL COLUMNS:', Object.keys(data?.[0] || {}).join(', '));
})();
