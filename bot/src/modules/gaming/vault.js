const { EmbedBuilder } = require('discord.js');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// ─── Tier Configuration (9 Official Nitro Badges) ──────────────────────────────
const DEFAULT_TIERS = [
  { name: 'Starter', key: 'starter', threshold: 0, emoji: '💨', rarity: 'COMMON', color: 0xF472B6 },
  { name: 'Bronze', key: 'bronze', threshold: 40, emoji: '🟤', rarity: 'UNCOMMON', color: 0xA75D00 },
  { name: 'Silver', key: 'silver', threshold: 125, emoji: '⚪', rarity: 'UNCOMMON', color: 0xCBD5E1 },
  { name: 'Gold', key: 'gold', threshold: 250, emoji: '🟡', rarity: 'RARE', color: 0xFACC15 },
  { name: 'Platinum', key: 'platinum', threshold: 500, emoji: '🪙', rarity: 'RARE', color: 0xE5E4E2 },
  { name: 'Diamond', key: 'diamond', threshold: 1000, emoji: '🔷', rarity: 'EPIC', color: 0x38BDF8 },
  { name: 'Emerald', key: 'emerald', threshold: 1500, emoji: '💚', rarity: 'EPIC', color: 0x10B981 },
  { name: 'Ruby', key: 'ruby', threshold: 2500, emoji: '🔴', rarity: 'LEGENDARY', color: 0xEF4444 },
  { name: 'Opal', key: 'opal', threshold: 3000, emoji: '🔮', rarity: 'MYTHIC', color: 0xA855F7 },
];

// Default coin rates (Calibrated for 500 Coins/Year max ~ ₱500 PHP)
const DEFAULT_RATES = {
  message: 0.02,
  voice_per_minute: 0.01,
  daily_quest_bonus: 0.50,
  daily_quest_message_threshold: 10,
  daily_cap: 1.50,
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
 * Explicitly starts the daily quest for a user so their messages begin counting.
 */
async function handleStartQuest(discordId, guildId) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (balance?.quest_started) return { success: true, message: 'Quest already started today!' };

  await supabase
    .from('vault_balances')
    .update({ quest_started: true })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  return { success: true, message: '▶️ **Daily Quest Started!** Your chat messages will now count towards today\'s quest goal.' };
}

/**
 * Awards coins for sending a message (rate-limited: 1 per N seconds, capped at daily ceiling).
 */
async function awardMessageCoins(discordId, guildId, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  // Fast RAM Cooldown Check: avoid any DB queries if message sent within rate limit
  const ramKey = `${guildId}:${discordId}`;
  const lastRAMTime = lastUserMessageRAMMap.get(ramKey);
  if (lastRAMTime) {
    const elapsedSeconds = (Date.now() - lastRAMTime) / 1000;
    if (elapsedSeconds < rates.message_rate_limit_seconds) return;
  }

  const balance = await getOrCreateBalance(discordId, guildId);

  // Daily Earning Hard Cap Check (prevent exceeding daily 1.50 coins cap)
  const maxDaily = rates.daily_cap || 1.50;
  if ((balance?.coins_earned_today || 0) >= maxDaily) return;

  // Rate limit check from DB timestamp
  if (balance?.last_message_at) {
    const secondsSinceLast = (Date.now() - new Date(balance.last_message_at).getTime()) / 1000;
    if (secondsSinceLast < rates.message_rate_limit_seconds) {
      lastUserMessageRAMMap.set(ramKey, new Date(balance.last_message_at).getTime());
      return;
    }
  }

  // Update RAM timestamp
  lastUserMessageRAMMap.set(ramKey, Date.now());

  // EXPLICIT QUEST START REQUIREMENT:
  // Messages only count towards daily quest if the user has explicitly started the quest today
  if (!balance?.quest_started) {
    // Member has not clicked 'Start Quest' yet — earn message coins if under daily cap, but do not increment quest message count
    await awardCoins(discordId, guildId, rates.message, 'message', guild);
    return;
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
 * Called when user leaves voice — awards coins for time spent and updates voice quest
 */
async function handleVoiceLeave(discordId, guildId, minutesSpent, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };
  const earned = minutesSpent * rates.voice_per_minute;

  await awardCoins(discordId, guildId, earned, 'voice', guild);

  // Update total voice minutes & voice quest progress
  const balance = await getOrCreateBalance(discordId, guildId);
  const newTotalVoice = (balance?.voice_minutes || 0) + minutesSpent;
  const newVoiceToday = (balance?.voice_minutes_today || 0) + minutesSpent;

  const voiceGoal = rates.daily_quest_voice_threshold || 15;
  let voiceQuestCompleted = balance?.quest_voice_completed || false;

  if (balance?.quest_started && !voiceQuestCompleted && newVoiceToday >= voiceGoal) {
    voiceQuestCompleted = true;
    await awardCoins(discordId, guildId, rates.daily_quest_voice_bonus || 0.20, 'voice_quest', guild);
  }

  await supabase
    .from('vault_balances')
    .update({
      voice_minutes: newTotalVoice,
      voice_minutes_today: newVoiceToday,
      quest_voice_completed: voiceQuestCompleted,
    })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);
}

/**
 * Handles completing the Daily Trivia Quest for a member.
 */
async function handleTriviaQuestCompletion(discordId, guildId, guild) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance?.quest_trivia_completed) {
    const vaultConfig = await getVaultConfig(guildId);
    const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

    await supabase
      .from('vault_balances')
      .update({ quest_trivia_completed: true })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);

    await awardCoins(discordId, guildId, rates.daily_quest_trivia_bonus || 0.10, 'trivia_quest', guild);
    logger.info(`[VAULT] Trivia quest completed by ${discordId}`);
  }
}

/**
 * Builds the 3 Daily Quests ephemeral embed card with live progress bars.
 */
async function build3QuestsEphemeralEmbed(discordId, guildId, guild) {
  const balance = await getOrCreateBalance(discordId, guildId);
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  const member = await guild.members.fetch(discordId).catch(() => null);
  const displayName = member?.displayName || 'Member';

  const chatGoal = rates.daily_quest_chat_threshold || 10;
  const chatBonus = (rates.daily_quest_chat_bonus || 0.20).toFixed(2);
  const msgs = balance?.messages_today || 0;
  const chatDone = balance?.quest_chat_completed || balance?.quest_claimed || msgs >= chatGoal;

  const voiceGoal = rates.daily_quest_voice_threshold || 15;
  const voiceBonus = (rates.daily_quest_voice_bonus || 0.20).toFixed(2);
  const voiceMins = balance?.voice_minutes_today || 0;
  const voiceDone = balance?.quest_voice_completed || voiceMins >= voiceGoal;

  const triviaBonus = (rates.daily_quest_trivia_bonus || 0.10).toFixed(2);
  const triviaDone = balance?.quest_trivia_completed || false;

  const cBar = chatDone
    ? `\`[██████████]\` **${chatGoal}/${chatGoal}** msgs (✅ +₱${chatBonus})`
    : `\`[${'█'.repeat(Math.min(10, Math.round((msgs / chatGoal) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.round((msgs / chatGoal) * 10)))}]\` **${msgs}/${chatGoal}** msgs (+₱${chatBonus})`;

  const vBar = voiceDone
    ? `\`[██████████]\` **${voiceGoal}/${voiceGoal}** mins (✅ +₱${voiceBonus})`
    : `\`[${'█'.repeat(Math.min(10, Math.round((voiceMins / voiceGoal) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.round((voiceMins / voiceGoal) * 10)))}]\` **${voiceMins}/${voiceGoal}** mins (+₱${voiceBonus})`;

  const tBar = triviaDone
    ? `\`[██████████]\` **1/1** Trivia Drop (✅ +₱${triviaBonus})`
    : `\`[░░░░░░░░░░]\` **0/1** Trivia Drop (+₱${triviaBonus})`;

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle(`📜 ${displayName}'s 3 Daily Quests`)
    .setDescription(
      `Welcome! Your daily quest tracking is now **Active** for today!\n\n` +
      `💬 **1. Chat Active Quest**\n${cBar}\n\n` +
      `🎙️ **2. Voice Active Quest**\n${vBar}\n\n` +
      `🧠 **3. Daily Trivia Quest**\n${tBar}\n\n` +
      `🏆 **Total 3-Quest Daily Reward**: **+0.50 Vault Coins (₱0.50 PHP)**`
    )
    .setFooter({ text: 'Every Nation Vault • Ephemeral Daily Panel' })
    .setTimestamp();

  return embed;
}

/**
 * Posts or updates the persistent Quest Channel Launcher card.
 */
async function postOrUpdateQuestLauncherChannel(client, guildId, channelId) {
  if (!channelId) return false;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const embed = new EmbedBuilder()
    .setColor(0xFACC15)
    .setTitle('📜 Every Nation Vault — Daily Quests Hub')
    .setDescription(
      `Welcome to the **Daily Quest Hub**!\n\n` +
      `Click **📜 Get Daily Quests** below to launch your personal daily quests for today. You will receive an ephemeral panel with live progress bars for:\n\n` +
      `💬 **Chat Quest** — Send active messages in community channels.\n` +
      `🎙️ **Voice Quest** — Hang out in voice channels with friends.\n` +
      `🧠 **Trivia Quest** — Participate in daily AI trivia drops.\n\n` +
      `🏆 Complete all 3 daily quests to earn bonus **Vault Coins (₱ PHP)**!`
    )
    .setFooter({ text: 'Every Nation Vault • ENOS Quest Launcher' })
    .setTimestamp();

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vault_get_daily_quests')
      .setLabel('📜 Get Daily Quests')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📜')
  );

  await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
  return true;
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

  const phpValue = (balance.coins || 0).toFixed(2);
  const rarity = currentTier.rarity || 'COMMON';

  // Daily quest progress text
  let questText = '';
  const questGoal = vaultConfig.rates?.daily_quest_message_threshold || 10;
  const questBonus = (vaultConfig.rates?.daily_quest_bonus || 0.50).toFixed(2);
  const msgs = balance.messages_today || 0;

  if (balance.quest_claimed) {
    questText = `✅ **Completed!** Claimed +${questBonus} coins (₱${questBonus} PHP)`;
  } else if (balance.quest_started) {
    const qProgress = Math.min(100, Math.round((msgs / questGoal) * 100));
    const qFilled = Math.max(0, Math.min(10, Math.round(qProgress / 10)));
    questText = `\`[${'█'.repeat(qFilled)}${'░'.repeat(10 - qFilled)}]\` **${msgs}/${questGoal}** msgs (${qProgress}%)\n*Reward: +${questBonus} coins (₱${questBonus} PHP)*`;
  } else {
    questText = `⏸️ **Not Started**\n*Click the **▶️ Start Daily Quest** button below to begin tracking chat messages!*`;
  }

  const embed = new EmbedBuilder()
    .setColor(currentTier.color || 0x8B5CF6)
    .setTitle(`${currentTier.emoji} ${displayName}'s Vault Profile`)
    .setThumbnail(member?.user.displayAvatarURL({ size: 128 }) || null)
    .addFields(
      {
        name: '💰 Vault Balance',
        value: `**${(balance.coins || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}** coins\n*(₱${phpValue} PHP)*`,
        inline: true,
      },
      {
        name: '📊 Current Rank',
        value: `${currentTier.emoji} **${currentTier.name}**\n\`[▲ ${rarity}]\``,
        inline: true,
      },
      {
        name: '🎙️ Voice Time',
        value: `${balance.voice_minutes} min`,
        inline: true,
      },
      {
        name: '🎯 Daily Quest',
        value: questText,
      },
      {
        name: nextTier ? `⬆️ Progress to ${nextTier.name}` : '🏆 Rank Status',
        value: progressText,
      },
      {
        name: '📜 Recent Transactions',
        value: txText,
      }
    )
    .setFooter({ text: 'Every Nation Vault • ₱1 = 1 Coin' })
    .setTimestamp();

  // If daily quest is not started, attach interactive Start Quest button
  const components = [];
  if (!balance.quest_started) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vault_start_quest')
        .setLabel('▶️ Start Daily Quest')
        .setStyle(ButtonStyle.Success)
    );
    components.push(row);
  }

  return { embed, components };
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
      return `${medal} ${tier.emoji} <@${entry.discord_id}> — **${entry.coins.toLocaleString()}** coins (₱${entry.coins.toFixed(2)})`;
    })
  );

  return new EmbedBuilder()
    .setColor(0xFACC15)
    .setTitle('🏆 Vault Leaderboard — Every Nation')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Every Nation Vault • ₱1 = 1 Coin' })
    .setTimestamp();
}

/**
 * Builds a dedicated Daily Quest embed card.
 */
async function buildQuestEmbed(discordId, guildId, guild) {
  const balance = await getOrCreateBalance(discordId, guildId);
  const vaultConfig = await getVaultConfig(guildId);
  const questGoal = vaultConfig.rates?.daily_quest_message_threshold || 10;
  const questBonus = (vaultConfig.rates?.daily_quest_bonus || 0.50).toFixed(2);
  const msgs = balance?.messages_today || 0;

  const member = await guild.members.fetch(discordId).catch(() => null);
  const displayName = member?.displayName || 'Member';

  let statusTitle = '⏸️ Daily Quest — Not Started';
  let desc = `Click the **▶️ Start Daily Quest** button below to begin tracking chat messages today!\n\n**Goal**: Send **${questGoal} messages**\n**Reward**: **+${questBonus} coins (₱${questBonus} PHP)**`;
  let color = 0x3B82F6;

  if (balance?.quest_claimed) {
    statusTitle = '✅ Daily Quest — Completed!';
    desc = `You have completed today's quest and claimed **+${questBonus} coins (₱${questBonus} PHP)**!\n\n*Resets daily at midnight.*`;
    color = 0x10B981;
  } else if (balance?.quest_started) {
    const qProgress = Math.min(100, Math.round((msgs / questGoal) * 100));
    const qFilled = Math.max(0, Math.min(15, Math.round((qProgress / 100) * 15)));
    statusTitle = '▶️ Daily Quest — Active Progress';
    desc = `\`[${'█'.repeat(qFilled)}${'░'.repeat(15 - qFilled)}]\` **${msgs}/${questGoal}** messages (${qProgress}%)\n\n*Send ${questGoal - msgs} more messages today to claim +${questBonus} coins (₱${questBonus} PHP)!*`;
    color = 0xFACC15;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎯 ${displayName}'s Daily Quest`)
    .setDescription(desc)
    .setFooter({ text: 'Every Nation Vault • Daily Reset at Midnight' })
    .setTimestamp();

  const components = [];
  if (!balance?.quest_started) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vault_start_quest')
        .setLabel('▶️ Start Daily Quest')
        .setStyle(ButtonStyle.Success)
    );
    components.push(row);
  }

  return { embed, components };
}

/**
 * Cron: Reset daily quest flags at midnight
 */
async function resetDailyQuests() {
  const { error } = await supabase
    .from('vault_balances')
    .update({
      messages_today: 0,
      voice_minutes_today: 0,
      quest_claimed: false,
      quest_started: false,
      quest_chat_completed: false,
      quest_voice_completed: false,
      quest_trivia_completed: false,
      coins_earned_today: 0,
    });

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
  handleStartQuest,
  handleTriviaQuestCompletion,
  buildProfileEmbed,
  buildQuestEmbed,
  build3QuestsEphemeralEmbed,
  buildLeaderboardEmbed,
  postOrUpdateQuestLauncherChannel,
  resetDailyQuests,
  getOrCreateBalance,
};
