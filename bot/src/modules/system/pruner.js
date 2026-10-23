const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

/**
 * Purges records older than 30 days from purgeable tables.
 * Mirrors the SQL prune_old_records() function but runs from the bot process
 * as a fallback (or replacement) for pg_cron.
 */
async function pruneOldRecords() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff30d = cutoff;
  const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const results = {};

  // Invoke database-level prune RPC (system_logs, npc_deliberation_logs, newsroom_posts, bot_event_logs, lfg_sessions)
  try {
    const { error: rpcError } = await supabase.rpc('prune_old_records');
    results.rpc_prune = rpcError ? `error: ${rpcError.message}` : 'success';
  } catch (rpcErr) {
    results.rpc_prune = `error: ${rpcErr.message}`;
  }

  // Vault quest log retention (30 days) to protect 500MB free tier
  const { count: questCount, error: questError } = await supabase
    .from('vault_quest_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff30d);

  results.vault_quest_log = questError ? 'error' : questCount;

  // Vault transactions
  const { count: txCount, error: txError } = await supabase
    .from('vault_transactions')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  results.vault_transactions = txError ? 'error' : txCount;

  // Digest logs
  const { count: digestCount, error: digestError } = await supabase
    .from('digest_logs')
    .delete({ count: 'exact' })
    .lt('posted_at', cutoff);

  results.digest_logs = digestError ? 'error' : digestCount;

  // Bot event logs
  const { count: logCount, error: logError } = await supabase
    .from('bot_event_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  results.bot_event_logs = logError ? 'error' : logCount;

  // Closed LFG sessions (7-day retention)
  const { count: lfgCount, error: lfgError } = await supabase
    .from('lfg_sessions')
    .delete({ count: 'exact' })
    .eq('status', 'closed')
    .lt('updated_at', weekCutoff);

  results.lfg_sessions = lfgError ? 'error' : lfgCount;

  // Completed or Skipped Trivia drops (cascades to trivia_participants)
  const { count: triviaDropCount, error: triviaDropError } = await supabase
    .from('trivia_drops')
    .delete({ count: 'exact' })
    .in('status', ['completed', 'skipped'])
    .lt('created_at', cutoff);

  results.trivia_drops = triviaDropError ? 'error' : triviaDropCount;

  // Trivia transactions
  const { count: triviaTxCount, error: triviaTxError } = await supabase
    .from('trivia_transactions')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  results.trivia_transactions = triviaTxError ? 'error' : triviaTxCount;

  logger.info('[PRUNER] Pruning complete:', results);
  return results;
}

module.exports = { pruneOldRecords };
