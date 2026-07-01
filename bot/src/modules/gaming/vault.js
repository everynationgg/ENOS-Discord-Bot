const { EmbedBuilder } = require('discord.js');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// ─── Tier Configuration ────────────────────────────────────────────────────────
const DEFAULT_TIERS = [
  { name: 'Bronze', key: 'bronze', threshold: 0, emoji: '🥉' },
  { name: 'Gold', key: 'gold', threshold: 1000, emoji: '🥇' },
  { name: 'Platinum', key: 'platinum', threshold: 5000, emoji: '💎' },
];

// Default coin rates (overridden by dashboard config)
const DEFAULT_RATES = {
  message: 1,
  voice_per_minute: 2,
  daily_quest_bonus: 50,
  daily_quest_message_threshold: 10,
  message_rate_limit_seconds: 60,
};

/**
 * Get vault config for a guild
 */
async function getVaultConfig(guildId) {
  const featureConfig = await getFeatureConfig(guildId, 'vault');
  return featureConfig?.config || {};
}

/**
 * Get or create a vault balance record for a user.
 */
async function getOrCreateBalance(discordId, guildId) {
  const { data: existing } = await supabase
    .from('vault_balances')
    .select('*')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from('vault_balances')
    .insert({ discord_id: discordId, guild_id: guildId })
    .select()
    .single();

  return created;
}

/**
 * Awards coins to a user and records the transaction.
 * Also checks for tier promotions.
 */
async function awardCoins(discordId, guildId, amount, reason, guild = null) {
  if (amount <= 0) return;

  // Get multiplier from role if applicable
  let finalAmount = amount;
  if (guild) {
    const vaultConfig = await getVaultConfig(guildId);
    const multipliers = vaultConfig.role_multipliers || [];
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (member) {
      for (const { role_id, multiplier } of multipliers) {
        if (member.roles.cache.has(role_id)) {
          finalAmount = Math.round(amount * multiplier);
          break; // Apply highest matching multiplier
        }
      }
    }
  }

  // Update balance
  const { data: balance } = await supabase
    .from('vault_balances')
    .upsert(
      { discord_id: discordId, guild_id: guildId },
      { onConflict: 'discord_id,guild_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  await supabase.rpc('increment_coins', {
    p_discord_id: discordId,
    p_guild_id: guildId,
    p_delta: finalAmount,
  }).catch(async () => {
    // Fallback if RPC not set up: manual update
    const current = await getOrCreateBalance(discordId, guildId);
    await supabase
      .from('vault_balances')
      .update({
        coins: (current?.coins || 0) + finalAmount,
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);
  });

  // Log transaction
  await supabase.from('vault_transactions').insert({
    guild_id: guildId,
    discord_id: discordId,
    delta: finalAmount,
    reason,
  });

  // Check for tier promotion
  if (guild) {
    await checkTierPromotion(discordId, guildId, guild);
  }
}

/**
 * Awards coins for sending a message (rate-limited: 1 per N seconds).
 */
async function awardMessageCoins(discordId, guildId, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  const balance = await getOrCreateBalance(discordId, guildId);

  // Rate limit check
  if (balance?.last_message_at) {
    const secondsSinceLast = (Date.now() - new Date(balance.last_message_at).getTime()) / 1000;
    if (secondsSinceLast < rates.message_rate_limit_seconds) return;
  }

  // Update last_message_at + messages_today
  const newMessagesToday = (balance?.messages_today || 0) + 1;
  await supabase
    .from('vault_balances')
    .update({
      last_message_at: new Date().toISOString(),
      messages_today: newMessagesToday,
    })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  await awardCoins(discordId, guildId, rates.message, 'message', guild);

  // Check daily quest completion
  if (newMessagesToday >= rates.daily_quest_message_threshold && !balance?.quest_claimed) {
    await supabase
      .from('vault_balances')
      .update({ quest_claimed: true })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);

    await awardCoins(discordId, guildId, rates.daily_quest_bonus, 'daily_quest', guild);
    logger.info(`[VAULT] Daily quest completed by ${discordId}`);
  }
}

/**
 * Called when user joins voice — no coins yet, just tracking start
 */
async function handleVoiceJoin(discordId, guildId) {
  await getOrCreateBalance(discordId, guildId);
}

/**
 * Called when user leaves voice — awards coins for time spent
 */
async function handleVoiceLeave(discordId, guildId, minutesSpent, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };
  const earned = minutesSpent * rates.voice_per_minute;

  await awardCoins(discordId, guildId, earned, 'voice', guild);

  // Update total voice minutes
  const balance = await getOrCreateBalance(discordId, guildId);
  await supabase
    .from('vault_balances')
    .update({ voice_minutes: (balance?.voice_minutes || 0) + minutesSpent })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);
}

/**
 * Checks if user should be promoted to a new tier and grants the role.
 */
async function checkTierPromotion(discordId, guildId, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const tiers = vaultConfig.tiers || DEFAULT_TIERS;
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance) return;

  const coins = balance.coins;
  let newTier = tiers[0];

  for (const tier of tiers) {
    if (coins >= tier.threshold) newTier = tier;
  }

  if (newTier.key === balance.tier) return;

  // Update tier in DB
  await supabase
    .from('vault_balances')
    .update({ tier: newTier.key })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  // Grant tier role
  const tierRoles = vaultConfig.tier_roles || {};
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return;

  // Remove old tier roles
  for (const tier of tiers) {
    const roleId = tierRoles[tier.key];
    if (roleId && member.roles.cache.has(roleId) && tier.key !== newTier.key) {
      await member.roles.remove(roleId).catch(() => {});
    }
  }

  // Grant new tier role
  const newRoleId = tierRoles[newTier.key];
  if (newRoleId) {
    await member.roles.add(newRoleId).catch(() => {});
  }

  logger.info(`[VAULT] ${discordId} promoted to ${newTier.name} (${coins} coins)`);
  await logBotEvent(guildId, 'tier_promotion', discordId, { tier: newTier.key, coins });
}

/**
 * Builds a rich profile embed for /vault profile
 */
async function buildProfileEmbed(discordId, guildId, guild) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance) return null;

  const vaultConfig = await getVaultConfig(guildId);
  const tiers = vaultConfig.tiers || DEFAULT_TIERS;

  const currentTierIdx = tiers.findIndex(t => t.key === balance.tier);
  const currentTier = tiers[currentTierIdx] || tiers[0];
  const nextTier = tiers[currentTierIdx + 1] || null;

  // Progress bar to next tier
  let progressText = '';
  if (nextTier) {
    const rangeStart = currentTier.threshold;
    const rangeEnd = nextTier.threshold;
    const progress = ((balance.coins - rangeStart) / (rangeEnd - rangeStart)) * 100;
    const filled = Math.max(0, Math.min(20, Math.round(progress / 5)));
    progressText = `\`[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}]\` ${Math.round(progress)}%\n${balance.coins.toLocaleString()} / ${rangeEnd.toLocaleString()} coins to **${nextTier.emoji} ${nextTier.name}**`;
  } else {
    progressText = '🏆 **Maximum Tier Reached!**';
  }

  // Recent transactions
  const { data: recentTxs } = await supabase
    .from('vault_transactions')
    .select('delta, reason, created_at')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(5);

  const txText = recentTxs?.length
    ? recentTxs
        .map(tx => {
          const sign = tx.delta >= 0 ? '▲' : '▼';
          const label = tx.reason.replace('_', ' ');
          return `\`${sign} ${Math.abs(tx.delta).toLocaleString()}\` — ${label}`;
        })
        .join('\n')
    : '*No transactions yet.*';

  const member = await guild.members.fetch(discordId).catch(() => null);
  const displayName = member?.displayName || 'Unknown';

  const embed = new EmbedBuilder()
    .setColor(currentTier.key === 'platinum' ? 0xE5E4E2 : currentTier.key === 'gold' ? 0xFACC15 : 0x8B5CF6)
    .setTitle(`${currentTier.emoji} ${displayName}'s Vault`)
    .setThumbnail(member?.user.displayAvatarURL({ size: 128 }) || null)
    .addFields(
      {
        name: '💰 Vault Coins',
        value: `**${balance.coins.toLocaleString()}** coins`,
        inline: true,
      },
      {
        name: '📊 Current Tier',
        value: `${currentTier.emoji} **${currentTier.name}**`,
        inline: true,
      },
      {
        name: '🎙️ Voice Time',
        value: `${balance.voice_minutes} min`,
        inline: true,
      },
      {
        name: nextTier ? `⬆️ Progress to ${nextTier.name}` : '🏆 Rank',
        value: progressText,
      },
      {
        name: '📜 Recent Transactions',
        value: txText,
      }
    )
    .setFooter({ text: 'Every Nation Vault • ENOS System' })
    .setTimestamp();

  return embed;
}

/**
 * Builds the leaderboard embed (top 10)
 */
async function buildLeaderboardEmbed(guildId, guild) {
  const { data: top } = await supabase
    .from('vault_balances')
    .select('discord_id, coins, tier')
    .eq('guild_id', guildId)
    .order('coins', { ascending: false })
    .limit(10);

  if (!top?.length) return null;

  const vaultConfig = await getVaultConfig(guildId);
  const tiers = vaultConfig.tiers || DEFAULT_TIERS;

  const lines = await Promise.all(
    top.map(async (entry, index) => {
      const tier = tiers.find(t => t.key === entry.tier) || tiers[0];
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      return `${medal} ${tier.emoji} <@${entry.discord_id}> — **${entry.coins.toLocaleString()}** coins`;
    })
  );

  return new EmbedBuilder()
    .setColor(0xFACC15)
    .setTitle('🏆 Vault Leaderboard — Every Nation')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Every Nation Vault • ENOS System' })
    .setTimestamp();
}

/**
 * Cron: Reset daily quest flags at midnight
 */
async function resetDailyQuests() {
  const { error } = await supabase
    .from('vault_balances')
    .update({ messages_today: 0, quest_claimed: false });

  if (error) {
    logger.error('[VAULT] Failed to reset daily quests:', error.message);
  } else {
    logger.info('[VAULT] Daily quests reset for all users.');
  }
}

module.exports = {
  awardMessageCoins,
  awardCoins,
  handleVoiceJoin,
  handleVoiceLeave,
  buildProfileEmbed,
  buildLeaderboardEmbed,
  resetDailyQuests,
  getOrCreateBalance,
};
