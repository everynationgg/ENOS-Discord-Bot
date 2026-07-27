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

// Default coin rates (Vault Coins per activity)
const DEFAULT_RATES = {
  message: 0,                           // Passive message coins disabled (0)
  voice_per_minute: 0,                  // Passive VC coins disabled (0)
  daily_quest_bonus: 0.5,               // 0.5 Bonus for completing BOTH daily quests
  daily_quest_chat_bonus: 1.0,         // 1.0 Coin per quest
  daily_quest_voice_bonus: 1.0,
  daily_quest_trivia_bonus: 1.0,
  daily_quest_reactions_bonus: 1.0,
  daily_quest_voice_status_bonus: 1.0,
  daily_quest_ai_chat_bonus: 1.0,
  daily_quest_boss_bonus: 1.0,
  daily_quest_message_threshold: 5,
  daily_cap: 2.5,                        // 2.5 Coins/day hard cap from daily quests
  message_rate_limit_seconds: 60,
};

/**
 * Get vault config for a guild
 */
const lastUserMessageRAMMap = new Map();

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

  // Enforce 2.5 Coins/day hard cap for Daily Quest rewards (Boss slay rewards are exempt)
  const isBossReward = reason.startsWith('boss_main_slay') || reason.startsWith('boss_overkill_slay');
  let allowedAmount = finalAmount;

  if (!isBossReward) {
    const current = await getOrCreateBalance(discordId, guildId);
    const earnedToday = Number(current?.coins_earned_today || 0);
    const maxDaily = 2.5;

    if (earnedToday >= maxDaily) {
      logger.info(`[VAULT] User ${discordId} already reached daily quest cap (${earnedToday}/${maxDaily} Coins). Skipping award.`);
      return;
    }

    allowedAmount = Math.min(finalAmount, maxDaily - earnedToday);
    if (allowedAmount <= 0) return;

    // Track coins_earned_today
    await supabase
      .from('vault_balances')
      .update({
        coins_earned_today: earnedToday + allowedAmount,
      })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);
  }

  // Update balance
  const { error: rpcErr } = await supabase.rpc('increment_coins', {
    p_discord_id: discordId,
    p_guild_id: guildId,
    p_delta: allowedAmount,
  });

  if (rpcErr) {
    // Fallback if RPC not set up: manual update
    const current = await getOrCreateBalance(discordId, guildId);
    await supabase
      .from('vault_balances')
      .update({
        coins: (Number(current?.coins) || 0) + allowedAmount,
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);
  }

  // Log transaction
  await supabase.from('vault_transactions').insert({
    guild_id: guildId,
    discord_id: discordId,
    delta: allowedAmount,
    reason,
  });

  // Check for tier promotion
  if (guild) {
    await checkTierPromotion(discordId, guildId, guild);
  }
}

/**
 * Awards coins for sending a message and tracks daily chat quest progress.
 */
async function awardMessageCoins(discordId, guildId, guild) {
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  const ramKey = `${guildId}:${discordId}`;
  const lastRAMTime = lastUserMessageRAMMap.get(ramKey) || 0;
  const elapsedSeconds = (Date.now() - lastRAMTime) / 1000;

  // Anti-spam 2-second check for counting messages toward daily quest
  if (elapsedSeconds < 2) return;
  lastUserMessageRAMMap.set(ramKey, Date.now());

  const balance = await getOrCreateBalance(discordId, guildId);

  // Always increment daily message counter
  const newMessagesToday = (balance?.messages_today || 0) + 1;
  const chatGoal = rates.daily_quest_chat_threshold || 5;
  let chatQuestCompleted = balance?.quest_chat_completed || false;

  if (!chatQuestCompleted && newMessagesToday >= chatGoal) {
    chatQuestCompleted = true;
    await awardCoins(discordId, guildId, rates.daily_quest_chat_bonus || 1, 'chat_quest', guild);
    // Log quest completion
    await supabase.from('vault_quest_log').insert({
      guild_id: guildId,
      discord_id: discordId,
      action: 'quest_complete',
      quest_key: 'chat',
      snapshot: { messages_today: newMessagesToday, goal: chatGoal },
    }).catch(() => {});
  }

  await supabase
    .from('vault_balances')
    .update({
      last_message_at: new Date().toISOString(),
      messages_today: newMessagesToday,
      quest_chat_completed: chatQuestCompleted,
      quest_started: true, // Ensure quest state is marked active
    })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  // Passive coins disabled (Quests only)
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
  // Passive VC coins disabled (Quests only)

  // Update total voice minutes & voice quest progress
  const balance = await getOrCreateBalance(discordId, guildId);
  const newTotalVoice = (balance?.voice_minutes || 0) + minutesSpent;
  const newVoiceToday = (balance?.voice_minutes_today || 0) + minutesSpent;

  const voiceGoal = rates.daily_quest_voice_threshold || 30;
  let voiceQuestCompleted = balance?.quest_voice_completed || false;

  if (!voiceQuestCompleted && newVoiceToday >= voiceGoal) {
    voiceQuestCompleted = true;
    await awardCoins(discordId, guildId, rates.daily_quest_voice_bonus || 1, 'voice_quest', guild);
    await supabase.from('vault_quest_log').insert({
      guild_id: guildId,
      discord_id: discordId,
      action: 'quest_complete',
      quest_key: 'voice',
      snapshot: { voice_minutes_today: newVoiceToday, goal: voiceGoal },
    }).catch(() => {});
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

    await awardCoins(discordId, guildId, rates.daily_quest_trivia_bonus || 1, 'trivia_quest', guild);
    await supabase.from('vault_quest_log').insert({
      guild_id: guildId,
      discord_id: discordId,
      action: 'quest_complete',
      quest_key: 'trivia',
      snapshot: { quest_trivia_completed: true },
    }).catch(() => {});
    logger.info(`[VAULT] Trivia quest completed by ${discordId}`);
  }
}

/**
 * Explicitly starts daily quests for a user, assigning 3 quests from the 7-quest pool and auto-completing boss quest if AP was used earlier.
 */
async function handleStartQuest(discordId, guildId) {
  const balance = await getOrCreateBalance(discordId, guildId);

  const ALL_QUESTS = ['chat', 'voice', 'trivia', 'boss', 'reactions', 'voice_status', 'ai_chat'];
  let assigned = balance?.assigned_quests;

  if (!assigned || !Array.isArray(assigned) || assigned.length === 0) {
    const shuffled = [...ALL_QUESTS].sort(() => Math.random() - 0.5);
    assigned = shuffled.slice(0, 2); // 2 Quests Per Day
  }

  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  // RETROACTIVE / PRE-COMPLETED QUEST EVALUATION
  let chatDone = balance?.quest_chat_completed || false;
  let voiceDone = balance?.quest_voice_completed || false;
  let reactionDone = balance?.quest_claimed_reaction || false;
  let bossDone = balance?.quest_boss_done || false;

  // 1. Chat Quest check: if user already chatted enough today
  if (assigned.includes('chat') && !chatDone) {
    const chatGoal = rates.daily_quest_chat_threshold || 5;
    if ((balance?.messages_today || 0) >= chatGoal) {
      chatDone = true;
      await awardCoins(discordId, guildId, rates.daily_quest_chat_bonus || 1, 'chat_quest', null);
      logger.info(`[VAULT] Chat quest retroactively completed for ${discordId}`);
    }
  }

  // 2. Voice Quest check: if user already spent enough voice time today
  if (assigned.includes('voice') && !voiceDone) {
    const voiceGoal = rates.daily_quest_voice_threshold || 30;
    if ((balance?.voice_minutes_today || 0) >= voiceGoal) {
      voiceDone = true;
      await awardCoins(discordId, guildId, rates.daily_quest_voice_bonus || 1, 'voice_quest', null);
      logger.info(`[VAULT] Voice quest retroactively completed for ${discordId}`);
    }
  }

  // 3. Reaction Quest check: if user already reacted 3+ times today
  if (assigned.includes('reactions') && !reactionDone) {
    if ((balance?.quest_reactions_count || 0) >= 3) {
      reactionDone = true;
      await awardCoins(discordId, guildId, rates.daily_quest_reactions_bonus || 1, 'reaction_quest', null);
      logger.info(`[VAULT] Reaction quest retroactively completed for ${discordId}`);
    }
  }

  // 4. Weekly Boss Quest check: if user has spent AP or dealt damage earlier this week
  if (assigned.includes('boss') && !bossDone) {
    try {
      const { getWeekIdentifier } = require('./boss');
      const currentWeek = getWeekIdentifier();
      const { data: playerState } = await supabase
        .from('boss_player_states')
        .select('ap_remaining, total_damage')
        .eq('guild_id', guildId)
        .eq('user_id', discordId)
        .eq('week_identifier', currentWeek)
        .maybeSingle();

      if (playerState && (playerState.ap_remaining < 5 || playerState.total_damage > 0)) {
        bossDone = true;
        await awardCoins(discordId, guildId, rates.daily_quest_boss_bonus || 1, 'boss_quest', null);
        logger.info(`[VAULT] Weekly Boss quest auto-completed for ${discordId} (AP used previously)`);
      }
    } catch (e) {}
  }

  await supabase
    .from('vault_balances')
    .update({
      quest_started: true,
      assigned_quests: assigned,
      quest_chat_completed: chatDone,
      quest_voice_completed: voiceDone,
      quest_claimed_reaction: reactionDone,
      quest_boss_done: bossDone,
    })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);


  // Re-fetch final state to log accurate snapshot
  const finalBalance = await getOrCreateBalance(discordId, guildId);
  await supabase.from('vault_quest_log').insert({
    guild_id: guildId,
    discord_id: discordId,
    action: 'view_quests',
    snapshot: {
      assigned_quests: assigned,
      messages_today: finalBalance?.messages_today || 0,
      voice_minutes_today: finalBalance?.voice_minutes_today || 0,
      quest_chat_completed: chatDone,
      quest_voice_completed: voiceDone,
      quest_trivia_completed: finalBalance?.quest_trivia_completed || false,
      quest_boss_done: bossDone,
      quest_claimed_reaction: reactionDone,
      quest_ai_chat_done: finalBalance?.quest_ai_chat_done || false,
    },
  }).catch(() => {});

  return { success: true, message: '▶️ **Daily Quests Activated!** Your 3 daily quests are live for today.' };
}

/**
 * Handles completing the Reaction Quest (3 emoji reactions).
 */
async function handleReactionQuest(discordId, guildId, guild = null) {
  const balance = await getOrCreateBalance(discordId, guildId);

  const count = (balance.quest_reactions_count || 0) + 1;
  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  const assigned = balance?.assigned_quests || [];
  const isAssigned = assigned.includes('reactions');

  if (balance?.quest_started && isAssigned && count >= 3 && !balance.quest_claimed_reaction) {
    await supabase
      .from('vault_balances')
      .update({
        quest_reactions_count: count,
        quest_claimed_reaction: true
      })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);
    await awardCoins(discordId, guildId, rates.daily_quest_reactions_bonus || 1, 'reaction_quest', guild);
  } else {
    await supabase
      .from('vault_balances')
      .update({ quest_reactions_count: count })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);
  }
}

/**
 * Handles completing the Voice Status Quest.
 */
async function handleVoiceStatusQuest(discordId, guildId, guild = null) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance?.quest_started || balance.quest_voice_status_done) return;

  const assigned = balance.assigned_quests || ['chat', 'voice', 'trivia'];
  if (!assigned.includes('voice_status')) return;

  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  await supabase
    .from('vault_balances')
    .update({ quest_voice_status_done: true })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  await awardCoins(discordId, guildId, rates.daily_quest_voice_status_bonus || 1, 'voice_status_quest', guild);
}

/**
 * Handles completing the AI Chat Quest.
 */
async function handleAIChatQuest(discordId, guildId, guild = null) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance?.quest_started || balance.quest_ai_chat_done) return;

  const assigned = balance.assigned_quests || ['chat', 'voice', 'trivia'];
  if (!assigned.includes('ai_chat')) return;

  const vaultConfig = await getVaultConfig(guildId);
  const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

  await supabase
    .from('vault_balances')
    .update({ quest_ai_chat_done: true })
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  await awardCoins(discordId, guildId, rates.daily_quest_ai_chat_bonus || 1, 'ai_chat_quest', guild);
}

/**
 * Handles completing the Weekly Boss Quest upon attacking.
 */
async function handleBossQuestCompletion(discordId, guildId, guild = null) {
  const balance = await getOrCreateBalance(discordId, guildId);
  if (!balance?.quest_boss_done) {
    const vaultConfig = await getVaultConfig(guildId);
    const rates = { ...DEFAULT_RATES, ...vaultConfig.rates };

    await supabase
      .from('vault_balances')
      .update({ quest_boss_done: true })
      .eq('discord_id', discordId)
      .eq('guild_id', guildId);

    await awardCoins(discordId, guildId, rates.daily_quest_boss_bonus || 1, 'boss_quest', guild);
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

  const assigned = balance?.assigned_quests || ['chat', 'voice', 'trivia'];

  const questDetails = {
    chat: {
      title: '💬 **1. Chat Active Quest** (5 msgs)',
      render: () => {
        const goal = rates.daily_quest_chat_threshold || 5;
        const msgs = balance?.messages_today || 0;
        const done = balance?.quest_chat_completed || balance?.quest_claimed || msgs >= goal;
        const bonus = (rates.daily_quest_chat_bonus || 0.10).toFixed(2);
        return done
          ? `\`[██████████]\` **${goal}/${goal}** msgs (✅ +${bonus} Coins)`
          : `\`[${'█'.repeat(Math.min(10, Math.round((msgs / goal) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.round((msgs / goal) * 10)))}]\` **${msgs}/${goal}** msgs (+${bonus} Coins)`;
      }
    },
    voice: {
      title: '🎙️ **2. Voice Active Quest** (30 mins)',
      render: () => {
        const goal = rates.daily_quest_voice_threshold || 30;
        let mins = balance?.voice_minutes_today || 0;

        // Calculate live active voice minutes if currently connected in VC
        try {
          const { voiceJoinTimes } = require('../../events/voiceStateUpdate');
          const joinTime = voiceJoinTimes?.get(`${guildId}:${discordId}`);
          if (joinTime) {
            const activeSessionMins = Math.floor((Date.now() - joinTime) / 60000);
            mins += Math.max(0, activeSessionMins);
          }
        } catch (e) {}

        const done = balance?.quest_voice_completed || mins >= goal;
        const bonus = (rates.daily_quest_voice_bonus || 0.15).toFixed(2);
        return done
          ? `\`[██████████]\` **${goal}/${goal}** mins (✅ +${bonus} Coins)`
          : `\`[${'█'.repeat(Math.min(10, Math.round((mins / goal) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.round((mins / goal) * 10)))}]\` **${mins}/${goal}** mins (+${bonus} Coins)`;
      }
    },
    trivia: {
      title: '🧠 **3. Daily Trivia Quest** (1 Drop)',
      render: () => {
        const done = balance?.quest_trivia_completed || false;
        const bonus = (rates.daily_quest_trivia_bonus || 0.05).toFixed(2);
        return done
          ? `\`[██████████]\` **1/1** Trivia Drop (✅ +${bonus} Coins)`
          : `\`[░░░░░░░░░░]\` **0/1** Trivia Drop (+${bonus} Coins)`;
      }
    },
    boss: {
      title: '🐉 **4. Weekly Boss Quest** (1 Attack / AP)',
      render: () => {
        const done = balance?.quest_boss_done || false;
        const bonus = (rates.daily_quest_boss_bonus || 0.10).toFixed(2);
        return done
          ? `\`[██████████]\` **1/1** Boss Engagement (✅ +${bonus} Coins)`
          : `\`[░░░░░░░░░░]\` **0/1** Boss Engagement (+${bonus} Coins)`;
      }
    },
    reactions: {
      title: '😄 **5. Emoji Reaction Quest** (3 Reactions)',
      render: () => {
        const count = balance?.quest_reactions_count || 0;
        const done = count >= 3;
        const bonus = (rates.daily_quest_reactions_bonus || 0.05).toFixed(2);
        return done
          ? `\`[██████████]\` **3/3** Reactions (✅ +${bonus} Coins)`
          : `\`[${'█'.repeat(Math.min(10, Math.round((count / 3) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.round((count / 3) * 10)))}]\` **${count}/3** Reactions (+${bonus} Coins)`;
      }
    },
    voice_status: {
      title: '🔊 **6. Voice Status Quest** (Set VC Status)',
      render: () => {
        const done = balance?.quest_voice_status_done || false;
        const bonus = (rates.daily_quest_voice_status_bonus || 0.02).toFixed(2);
        return done
          ? `\`[██████████]\` **1/1** Status Changed (✅ +${bonus} Coins)`
          : `\`[░░░░░░░░░░]\` **0/1** Status Changed (+${bonus} Coins)`;
      }
    },
    ai_chat: {
      title: '🤖 **7. AI Chat Quest** (Chat with AI Bot)',
      render: () => {
        const done = balance?.quest_ai_chat_done || false;
        const bonus = (rates.daily_quest_ai_chat_bonus || 0.03).toFixed(2);
        return done
          ? `\`[██████████]\` **1/1** AI Chat (✅ +${bonus} Coins)`
          : `\`[░░░░░░░░░░]\` **0/1** AI Chat (+${bonus} Coins)`;
      }
    }
  };

  const lines = assigned.map((key, i) => {
    const q = questDetails[key] || questDetails['chat'];
    return `${q.title}\n${q.render()}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle(`📜 ${displayName}'s 3 Assigned Daily Quests`)
    .setDescription(
      `Welcome! Your 3 daily quests assigned from today's pool are **Active**:\n\n` +
      lines.join('\n\n') +
      `\n\n🏆 **Total 3-Quest Daily Reward**: **+0.50 Vault Coins**`
    )
    .setFooter({ text: 'Every Nation Vault • 7-Quest Dynamic Pool' })
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
      `🏆 Complete all 3 daily quests to earn bonus **Vault Coins**!`
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
  let desc = `Click the **▶️ Start Daily Quest** button below to begin tracking chat messages today!\n\n**Goal**: Send **${questGoal} messages**\n**Reward**: **+${questBonus} Vault Coins**`;
  let color = 0x3B82F6;

  if (balance?.quest_claimed) {
    statusTitle = '✅ Daily Quest — Completed!';
    desc = `You have completed today's quest and claimed **+${questBonus} Vault Coins**!\n\n*Resets daily at midnight.*`;
    color = 0x10B981;
  } else if (balance?.quest_started) {
    const qProgress = Math.min(100, Math.round((msgs / questGoal) * 100));
    const qFilled = Math.max(0, Math.min(15, Math.round((qProgress / 100) * 15)));
    statusTitle = '▶️ Daily Quest — Active Progress';
    desc = `\`[${'█'.repeat(qFilled)}${'░'.repeat(15 - qFilled)}]\` **${msgs}/${questGoal}** messages (${qProgress}%)\n\n*Send ${questGoal - msgs} more messages today to claim +${questBonus} Vault Coins!*`;
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
      quest_reactions_count: 0,
      quest_claimed: false,
      quest_started: false,
      quest_chat_completed: false,
      quest_voice_completed: false,
      quest_trivia_completed: false,
      quest_voice_status_done: false,
      quest_ai_chat_done: false,
      quest_boss_done: false,
      quest_claimed_reaction: false,
      assigned_quests: null,
      coins_earned_today: 0,
    })
    .neq('discord_id', '');

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
  handleReactionQuest,
  handleVoiceStatusQuest,
  handleAIChatQuest,
  handleBossQuestCompletion,
  buildProfileEmbed,
  buildQuestEmbed,
  build3QuestsEphemeralEmbed,
  buildLeaderboardEmbed,
  postOrUpdateQuestLauncherChannel,
  resetDailyQuests,
  getOrCreateBalance,
};
