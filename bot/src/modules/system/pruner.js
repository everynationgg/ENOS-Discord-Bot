const { supabase } = require('../../lib/supabase');
const logger = require('../../lib/logger');

/**
 * Purges records older than 30 days from purgeable tables.
 * Mirrors the SQL prune_old_records() function but runs from the bot process
 * as a fallback (or replacement) for pg_cron.
 */
async function pruneOldRecords() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const results = {};

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

  logger.info('[PRUNER] Pruning complete:', results);
  return results;
}

module.exports = { pruneOldRecords };
