const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { performance } = require('perf_hooks');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Returns current absolute timestamp in milliseconds with microsecond precision.
 * @returns {number}
 */
function getPreciseTime() {
  return performance.timeOrigin + performance.now();
}

/**
 * Shuffles an array in place.
 * @param {any[]} array
 * @returns {any[]}
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates a trivia question using Gemini API.
 * @param {string|null} topic
 * @returns {Promise<{ question: string, correct_answer: string, incorrect_answers: string[] }>}
 */
async function generateTriviaQuestion(topic) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  const prompt = `Generate a challenging multiple-choice trivia question.
If a topic is provided, it must be about that topic (lore, gameplay, details). Otherwise, it should be about general gaming, pop culture, or tech.
Topic: ${topic || 'Random general gaming, pop culture, or tech knowledge'}

Respond ONLY with a raw JSON object containing these keys:
{
  "question": "The question text",
  "correct_answer": "The correct answer text",
  "incorrect_answers": ["wrong answer 1", "wrong answer 2", "wrong answer 3"]
}
Do not wrap in markdown, backticks, or write any extra text.`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.question && parsed.correct_answer && parsed.incorrect_answers && parsed.incorrect_answers.length === 3) {
        return parsed;
      }
    } catch (err) {
      logger.warn(`[TRIVIA] Model ${modelName} failed or quota exceeded: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw new Error(`Gemini API quota exceeded or unavailable across models: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Resolves a channel using priority weighting.
 * @param {any[]} allowedChannels
 * @returns {any|null}
 */
function chooseWeightedChannel(allowedChannels) {
  if (!allowedChannels?.length) return null;

  const weights = { high: 3, medium: 2, low: 1 };
  const pool = [];

  for (const ch of allowedChannels) {
    const w = weights[ch.priority?.toLowerCase()] || 1;
    for (let i = 0; i < w; i++) {
      pool.push(ch);
    }
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

let isTriviaDropInProgress = false;

/**
 * Triggers a trivia drop for a guild.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
async function triggerTriviaDrop(client, guildId) {
  if (isTriviaDropInProgress) {
    logger.warn('[TRIVIA] Drop trigger already in progress, skipping concurrent call.');
    return false;
  }
  isTriviaDropInProgress = true;

  try {
    const featureConfig = await getFeatureConfig(guildId, 'trivia');
    if (!featureConfig?.enabled) {
      logger.info(`[TRIVIA] Feature disabled for guild ${guildId}.`);
      return false;
    }

    const config = featureConfig.config || {};
    const allowedChannels = config.allowed_channels || [];
    const closeTime = config.close_time || '23:59';

    const chosen = chooseWeightedChannel(allowedChannels);
    if (!chosen) {
      logger.warn(`[TRIVIA] No allowed channels configured for guild ${guildId}.`);
      return false;
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return false;

    const channel = await guild.channels.fetch(chosen.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`[TRIVIA] Whitelisted channel ${chosen.channel_id} not found or not text-based.`);
      return false;
    }

    logger.info(`[TRIVIA] Generating question for topic: ${chosen.topic || 'Random'}`);
    const questionData = await generateTriviaQuestion(chosen.topic);

    const allAnswers = shuffleArray([questionData.correct_answer, ...questionData.incorrect_answers]);

    // Auto-close any existing active drops for this guild before spawning a new drop
    const { data: existingActive } = await supabase
      .from('trivia_drops')
      .select('id')
      .eq('guild_id', guildId)
      .eq('status', 'active');

    if (existingActive && existingActive.length > 0) {
      for (const oldDrop of existingActive) {
        await forceCloseDrop(client, guildId, oldDrop.id, 'superseded');
      }
    }

    // Insert drop in database
    const { data: drop, error } = await supabase
      .from('trivia_drops')
      .insert({
        guild_id: guildId,
        channel_id: channel.id,
        question: questionData.question,
        correct_answer: questionData.correct_answer,
        shuffled_answers: allAnswers,
        close_time: closeTime,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      logger.error('[TRIVIA] Failed to save trivia drop in Supabase:', error.message);
      return false;
    }

    // Build Public Embed
    const embed = new EmbedBuilder()
      .setColor(0xFACC15)
      .setTitle('🧠 Daily Community Trivia!')
      .setDescription(
        `A new daily trivia drop has arrived! Click **Start Trivia** to play.\n\n` +
        `⚠️ **Rules**:\n` +
        `• You only have **one attempt**.\n` +
        `• Your timer starts the millisecond you click the button.\n` +
        `• First 3 correct submissions win points.\n` +
        `• Session closes automatically at **${closeTime}** (server time) or after 3 winners.`
      )
      .addFields(
        { name: '📚 Category / Topic', value: chosen.topic || 'General Knowledge', inline: true },
        { name: '🏆 Podium', value: '*No winners yet. Be the first!*' }
      )
      .setFooter({ text: `ENOS Trivia System • ID: ${drop.id.substring(0, 8)}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_start:${drop.id}`)
        .setLabel('Start Trivia')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🧠')
    );

    let sentMessage = null;
    try {
      sentMessage = await channel.send({ embeds: [embed], components: [row] });
    } catch (sendErr) {
      logger.error(`[TRIVIA] Failed to send trivia drop message in channel ${channel.id}:`, sendErr.message);
      await supabase.from('trivia_drops').delete().eq('id', drop.id);
      return false;
    }

    if (!sentMessage) {
      await supabase.from('trivia_drops').delete().eq('id', drop.id);
      return false;
    }

    // Save message reference
    await supabase
      .from('trivia_drops')
      .update({ message_id: sentMessage.id })
      .eq('id', drop.id);

    await logBotEvent(guildId, 'trivia_drop', null, { dropId: drop.id, channelId: channel.id });

    // Send notification alert ONLY if notification channel is configured AND different from current drop channel
    if (config.notification_channel_id && config.notification_channel_id !== channel.id) {
      const notifChannel = await guild.channels.fetch(config.notification_channel_id).catch(() => null);
      if (notifChannel && notifChannel.isTextBased()) {
        // Delete any existing notification message first
        await deleteActiveTriviaNotification(guild, config);

        const notifEmbed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle('📢 Daily Trivia Drop Live!')
          .setDescription(
            `A new **Daily Trivia Drop** is now live!\n\n` +
            `📍 Head over to <#${channel.id}> right now to click **Start Trivia** first and win **Vault Coins**! 🧠⚡`
          )
          .setFooter({ text: 'Every Nation Trivia • ENOS Notification' })
          .setTimestamp();

        const notifMsg = await notifChannel.send({ embeds: [notifEmbed] }).catch((err) => {
          logger.error(`[TRIVIA] Failed to send drop notification to ${config.notification_channel_id}:`, err.message);
        });

        if (notifMsg) {
          config.active_notif_channel_id = config.notification_channel_id;
          config.active_notif_message_id = notifMsg.id;
          await supabase
            .from('guild_config')
            .update({ config })
            .eq('guild_id', guildId)
            .eq('feature_key', 'trivia');
        }
      }
    }

    return true;
  } catch (err) {
    logger.error('[TRIVIA] Error in triggerTriviaDrop:', err.message);
    return false;
  } finally {
    isTriviaDropInProgress = false;
  }
}

/**
 * Handles the "Start Trivia" button click. Spawns ephemeral message.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTriviaStartClick(interaction) {
  try {
    // Acknowledge immediately — must happen within 3s or Discord shows 'interaction failed'
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (e) {
        return; // Interaction expired or already handled
      }
    }
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 60000);

    const parts = interaction.customId.split(':');
    const dropId = parts[1];
    const guildId = interaction.guildId || interaction.guild?.id;

    // Parallelize all initial DB reads to minimize time-to-reply
    const [dropRes, participantRes, featureConfig] = await Promise.all([
      supabase.from('trivia_drops').select('*').eq('id', dropId).maybeSingle(),
      supabase.from('trivia_participants').select('*').eq('drop_id', dropId).eq('user_id', interaction.user.id).maybeSingle(),
      guildId ? getFeatureConfig(guildId, 'trivia') : Promise.resolve(null),
    ]);

    const { data: drop, error } = dropRes;

    if (error || !drop) {
      return interaction.editReply({ content: '❌ Trivia session not found.' });
    }

    if (drop.status !== 'active') {
      const { data: activeDrops } = await supabase
        .from('trivia_drops')
        .select('id, channel_id')
        .eq('guild_id', guildId)
        .eq('status', 'active')
        .neq('id', dropId)
        .order('created_at', { ascending: false })
        .limit(1);

      const activeDrop = activeDrops && activeDrops.length > 0 ? activeDrops[0] : null;

      if (activeDrop && activeDrop.channel_id) {
        if (activeDrop.channel_id === interaction.channelId) {
          return interaction.editReply({
            content: `❌ This trivia session has already closed.\n\n📍 **An active Trivia Drop is live right now in this channel!** Scroll down to the newest trivia message to play! 🧠⚡`,
          });
        } else {
          return interaction.editReply({
            content: `❌ This trivia session has already closed.\n\n📍 **An active Trivia Drop is live right now in <#${activeDrop.channel_id}>!** Head over to <#${activeDrop.channel_id}> to play! 🧠⚡`,
          });
        }
      }

      return interaction.editReply({ content: '❌ This trivia session has already closed.' });
    }

    // Check roles safely
    if (guildId) {
      const config = featureConfig?.config || {};
      const allowedRoles = config.allowed_roles || []; // Array of role IDs/names

      if (allowedRoles.length > 0) {
        let hasRole = false;
        const memberRoles = interaction.member?.roles;
        if (memberRoles) {
          if (Array.isArray(memberRoles)) {
            hasRole = memberRoles.some(rId => allowedRoles.includes(rId));
          } else if (memberRoles.cache) {
            hasRole = memberRoles.cache.some(r => allowedRoles.includes(r.id) || allowedRoles.includes(r.name));
          }
        }
        if (!hasRole) {
          return interaction.editReply({
            content: '❌ You do not have the required roles to participate in this trivia.',
          });
        }
      }
    }

    const { data: participant } = participantRes;

    if (participant) {
      const cmdMention = await getLeaderboardCommandMention(interaction.client);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('trivia_leaderboard')
          .setLabel('View Leaderboard')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: `❌ You have already participated in this trivia session.\n\n🏆 View standings with ${cmdMention} or click below:`,
        components: [row],
      });
    }

    // Shuffle answers specifically for this participant
    const shuffledOptions = shuffleArray(drop.shuffled_answers);
    const startTime = getPreciseTime();

    // Save start time and shuffled options in DB
    const { error: insertErr } = await supabase
      .from('trivia_participants')
      .insert({
        drop_id: dropId,
        user_id: interaction.user.id,
        started_at: new Date().toISOString(),
        started_at_ms: startTime,
        shuffled_options: shuffledOptions,
      });

    if (insertErr) {
      logger.error('[TRIVIA] Failed to insert participant:', insertErr.message);
      return interaction.editReply({ content: '❌ Failed to start trivia. Please try again.' });
    }

    // Render ephemeral view
    const letters = ['🇦', '🇧', '🇨', '🇩'];
    let description = `**Question:**\n${drop.question}\n\n`;
    const buttons = [];

    for (let i = 0; i < shuffledOptions.length; i++) {
      description += `${letters[i]} ${shuffledOptions[i]}\n`;
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`trivia_answer:${dropId}:${i}`)
          .setLabel(letters[i])
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0xFACC15)
      .setTitle('🧠 Daily Trivia Question')
      .setDescription(description)
      .setFooter({ text: '⏱️ You have 60 seconds to answer! Sub-millisecond speed is tracked.' });

    const row = new ActionRowBuilder().addComponents(buttons);

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error('[TRIVIA] Error in handleTriviaStartClick:', err.message || err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ An error occurred while starting trivia. Please try again.' }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ An error occurred while starting trivia. Please try again.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * Handles answering a trivia option button click.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTriviaAnswerClick(interaction) {
  const parts = interaction.customId.split(':');
  const dropId = parts[1];
  const choiceIndex = parseInt(parts[2], 10);
  const endTime = getPreciseTime();

  // Defer immediately to prevent 3-second Discord interaction timeouts during DB/API calls
  await interaction.deferReply({ ephemeral: true });
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, 20000);

  // Fetch drop and participant together
  const [dropRes, partRes] = await Promise.all([
    supabase.from('trivia_drops').select('*').eq('id', dropId).maybeSingle(),
    supabase.from('trivia_participants').select('*').eq('drop_id', dropId).eq('user_id', interaction.user.id).maybeSingle()
  ]);

  if (dropRes.error || !dropRes.data) {
    return interaction.editReply({ content: '❌ Trivia session not found.' });
  }

  const drop = dropRes.data;
  const participant = partRes.data;

  if (drop.status !== 'active') {
    return interaction.editReply({ content: '❌ This trivia session has already closed.' });
  }

  if (!participant) {
    return interaction.editReply({ content: '❌ You did not start this trivia correctly.' });
  }

  if (participant.answered_at) {
    return interaction.editReply({ content: '❌ You have already answered this trivia question.' });
  }

  const speedMs = endTime - participant.started_at_ms;
  const selectedOption = participant.shuffled_options[choiceIndex];
  const isCorrect = selectedOption === drop.correct_answer;

  // Update participant details
  await supabase
    .from('trivia_participants')
    .update({
      answered_at: new Date().toISOString(),
      speed_ms: speedMs,
      is_correct: isCorrect,
    })
    .eq('id', participant.id);

  // Trigger Daily Trivia Quest Completion in Vault
  const { handleTriviaQuestCompletion } = require('./vault');
  const targetGuildId = interaction.guildId || interaction.guild?.id;
  if (targetGuildId) {
    await handleTriviaQuestCompletion(interaction.user.id, targetGuildId, interaction.guild).catch(() => {});
  }

  const cmdMention = await getLeaderboardCommandMention(interaction.client);
  const leaderboardBtnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trivia_leaderboard')
      .setLabel('View Leaderboard')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary)
  );

  if (!isCorrect) {
    return interaction.editReply({
      content: `❌ **Incorrect answer!** Better luck next time.\n⏱️ Response time: **${(speedMs / 1000).toFixed(6)}s**\n\n🏆 View standings with ${cmdMention} or click below:`,
      components: [leaderboardBtnRow],
    });
  }

  // Correct answer! Manage leaderboard and podium
  // Fetch drop again under light isolation/refresh to get latest winners list
  const { data: freshDrop } = await supabase
    .from('trivia_drops')
    .select('winners, status')
    .eq('id', dropId)
    .maybeSingle();

  const winners = freshDrop?.winners || [];

  if (freshDrop?.status !== 'active') {
    return interaction.editReply({
      content: `✅ **Correct!** However, the session closed before your submission.\n⏱️ Response time: **${(speedMs / 1000).toFixed(6)}s**\n\n🏆 View standings with ${cmdMention} or click below:`,
      components: [leaderboardBtnRow],
    });
  }

  if (winners.length >= 3) {
    return interaction.editReply({
      content: `✅ **Correct!** However, 3 winners have already claimed the podium spots.\n⏱️ Response time: **${(speedMs / 1000).toFixed(6)}s**\n\n🏆 View standings with ${cmdMention} or click below:`,
      components: [leaderboardBtnRow],
    });
  }

  // We are a winner!
  const placePoints = [5, 2, 1];
  const placeNames = ['1st Place 🥇', '2nd Place 🥈', '3rd Place 🥉'];
  const winnerPoints = placePoints[winners.length];
  const placeName = placeNames[winners.length];

  const newWinner = {
    user_id: interaction.user.id,
    tag: interaction.user.tag,
    speed_ms: speedMs,
    points: winnerPoints,
    place: placeName,
  };

  const updatedWinners = [...winners, newWinner];
  const isCompleted = updatedWinners.length === 3;

  // Update drop in Supabase
  await supabase
    .from('trivia_drops')
    .update({
      winners: updatedWinners,
      status: isCompleted ? 'completed' : 'active',
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', dropId);

  // Update user's lifetime points
  const { data: currentPoints } = await supabase
    .from('trivia_points')
    .select('points')
    .eq('guild_id', interaction.guild.id)
    .eq('discord_id', interaction.user.id)
    .maybeSingle();

  const newPointsTotal = (currentPoints?.points || 0) + winnerPoints;
  await supabase
    .from('trivia_points')
    .upsert({
      guild_id: interaction.guild.id,
      discord_id: interaction.user.id,
      points: newPointsTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id,discord_id' });

  // Record point transaction
  await supabase.from('trivia_transactions').insert({
    guild_id: interaction.guild.id,
    discord_id: interaction.user.id,
    delta: winnerPoints,
    reason: `${winners.length + 1}_place`,
  });

  // Award Vault Coins 1:1 for Trivia Win
  try {
    const { awardCoins } = require('./vault');
    await awardCoins(interaction.user.id, interaction.guild.id, winnerPoints, 'trivia_win', interaction.guild).catch(() => {});
  } catch (e) {}

  // Log bot event
  await logBotEvent(interaction.guild.id, 'trivia_win', interaction.user.id, {
    dropId,
    place: winners.length + 1,
    speedMs,
  });

  // Refresh public message embed
  const guild = interaction.guild;
  const channel = await guild.channels.fetch(drop.channel_id).catch(() => null);
  if (channel) {
    const message = await channel.messages.fetch(drop.message_id).catch(() => null);
    if (message) {
      const podiumLines = updatedWinners.map((w, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        return `${medal} <@${w.user_id}> — **${(w.speed_ms / 1000).toFixed(6)}s** (+${w.points} pts)`;
      });
      const podiumText = podiumLines.join('\n') + (isCompleted ? '\n\n🏁 **Trivia Session is now Closed!**' : '');

      const currentEmbed = message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(currentEmbed)
        .setFields(
          { name: '📚 Category / Topic', value: currentEmbed.fields[0].value, inline: true },
          { name: '🏆 Podium', value: podiumText }
        );

      if (isCompleted) {
        // Remove button or replace with disabled button
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('trivia_disabled')
            .setLabel('Session Closed')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
        await message.edit({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => { });

        // Session completed - delete active trivia notification
        const featureConfig = await getFeatureConfig(interaction.guild.id, 'trivia');
        if (featureConfig?.config) {
          await deleteActiveTriviaNotification(interaction.guild, featureConfig.config);
        }
      } else {
        await message.edit({ embeds: [updatedEmbed] }).catch(() => { });
      }
    }
  }

  // Update Live Point Tracker Leaderboard if configured
  await updateLiveLeaderboard(interaction.client, interaction.guild.id);

  // Build inline leaderboard embed for the winner's ephemeral reply
  const { data: topPoints } = await supabase
    .from('trivia_points')
    .select('discord_id, points')
    .eq('guild_id', interaction.guild.id)
    .order('points', { ascending: false })
    .limit(5);

  const lbLines = (topPoints || []).map((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
    return `${medal} <@${entry.discord_id}> — **${entry.points.toLocaleString()}** points`;
  });
  if (lbLines.length === 0) lbLines.push('*No points yet.*');

  const lbEmbed = new EmbedBuilder()
    .setColor(0xFACC15)
    .setTitle('🏆 Server Trivia Leaderboard (Top 5)')
    .setDescription(lbLines.join('\n'))
    .setFooter({ text: 'Every Nation • This message will disappear in 30s' })
    .setTimestamp();

  await interaction.editReply({
    content: `✅ **Correct!** You came in **${placeName}**!\n⏱️ Response time: **${(speedMs / 1000).toFixed(6)}s**\n💰 Awarded **${winnerPoints}** trivia points!`,
    embeds: [lbEmbed],
    components: [],
  });

  // Auto-delete winner's ephemeral reply after 30 seconds
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, 30000);
}

/**
 * Updates the configured live leaderboard message in the server.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
async function updateLiveLeaderboard(client, guildId) {
  try {
    const featureConfig = await getFeatureConfig(guildId, 'trivia');
    if (!featureConfig?.enabled) return;

    const config = featureConfig.config || {};
    const leaderboardChannelId = config.leaderboard_channel_id;
    let leaderboardMessageId = config.leaderboard_message_id;

    if (!leaderboardChannelId) return;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(leaderboardChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    // Fetch top 5 point-holders
    const { data: topPoints, error } = await supabase
      .from('trivia_points')
      .select('discord_id, points')
      .eq('guild_id', guildId)
      .order('points', { ascending: false })
      .limit(5);

    if (error || !topPoints) {
      logger.error('[TRIVIA] Failed to load leaderboard data:', error?.message);
      return;
    }

    const lines = topPoints.map((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      return `${medal} <@${entry.discord_id}> — **${entry.points.toLocaleString()}** points`;
    });

    if (lines.length === 0) {
      lines.push('*No points earned yet. Play trivia to show up here!*');
    }

    const embed = new EmbedBuilder()
      .setColor(0xFACC15)
      .setTitle('🏆 Server Trivia Leaderboard (Top 5)')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Updates dynamically as trivia runs • Every Nation' })
      .setTimestamp();

    let message = null;
    if (leaderboardMessageId) {
      message = await channel.messages.fetch(leaderboardMessageId).catch(() => null);
    }

    if (message) {
      await message.edit({ embeds: [embed] });
    } else {
      // Send new message and auto-delete after 30 seconds to keep channel clean
      const sent = await channel.send({ embeds: [embed] });
      leaderboardMessageId = sent.id;
      // Update config with new message ID
      const updatedConfig = { ...config, leaderboard_message_id: sent.id };
      await supabase
        .from('guild_config')
        .update({ config: updatedConfig })
        .eq('guild_id', guildId)
        .eq('feature_key', 'trivia');
      // Auto-delete after 30 seconds so it doesn't permanently clutter the channel
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 30000);
    }
  } catch (err) {
    logger.error('[TRIVIA] updateLiveLeaderboard error:', err.message);
  }
}

/**
 * Force manual close of active trivia drops for a guild
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} dropId
 * @param {'completed'|'skipped'} status
 */
async function forceCloseDrop(client, guildId, dropId, status = 'completed') {
  try {
    const { data: drop } = await supabase
      .from('trivia_drops')
      .update({
        status: status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', dropId)
      .select()
      .single();

    if (!drop) return;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    // Delete active trivia notification message from notification channel
    const featureConfig = await getFeatureConfig(guildId, 'trivia');
    if (featureConfig?.config) {
      await deleteActiveTriviaNotification(guild, featureConfig.config);
    }

    const channel = await guild.channels.fetch(drop.channel_id).catch(() => null);
    if (!channel) return;

    const message = drop.message_id ? await channel.messages.fetch(drop.message_id).catch(() => null) : null;
    if (message) {
      if (status === 'superseded' || status === 'skipped') {
        await message.delete().catch(() => {});
        return;
      }

      if (message.embeds?.length) {
        const currentEmbed = message.embeds[0];
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('trivia_disabled')
            .setLabel('Session Closed')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        const winners = drop.winners || [];
        const podiumLines = winners.map((w, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          return `${medal} <@${w.user_id}> — **${(w.speed_ms / 1000).toFixed(6)}s** (+${w.points} pts)`;
        });
        let podiumText = podiumLines.length > 0 ? podiumLines.join('\n') : '*No winners.*';
        podiumText += '\n\n🏁 **Trivia Session is now Closed!**';

      const updatedEmbed = EmbedBuilder.from(currentEmbed)
        .setFields(
          { name: '📚 Category / Topic', value: currentEmbed.fields[0].value, inline: true },
          { name: '🏆 Podium', value: podiumText }
        );

      await message.edit({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => { });
    }
  }
} catch (err) {
  logger.error('[TRIVIA] forceCloseDrop error:', err.message);
}
}

/**
 * Helper to get local date and time values in a specific timezone
 * @param {string} timezone
 * @param {Date|string|number} [dateInput]
 * @returns {{ dateStr: string, timeStr: string, hour: number, minute: number }}
 */
function getLocalTimeInTimezone(timezone, dateInput = new Date()) {
  let tz = timezone || 'Asia/Manila';
  if (tz === 'Manila' || tz === 'manila' || !tz) tz = 'Asia/Manila';

  const options = {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date(dateInput));
  const map = parts.reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  // Format as YYYY-MM-DD
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  return {
    dateStr,
    timeStr,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10)
  };
}

/**
 * Generates drop times for a day based on drops count (1 to 3, max 3).
 * Spreads drops evenly across daytime hours (9:00 AM to 9:00 PM).
 * @param {number} dropsCount
 * @returns {string[]} Array of HH:MM time strings
 */
function generateDropTimesForDay(dropsCount) {
  const count = Math.min(3, Math.max(1, dropsCount || 1));
  if (count === 1) return ['00:01'];
  if (count === 2) return ['00:01', '12:00'];
  return ['00:01', '12:00', '18:00'];
}

/**
 * Checks all active trivia drop schedules and updates/closes sessions.
 * Called periodically (e.g. every 5 minutes) via cron.
 * @param {import('discord.js').Client} client
 */
async function checkAndProcessTrivia(client) {
  try {
    // 1. Process Trivia Drops for enabled guilds
    const { data: configs, error: configErr } = await supabase
      .from('guild_config')
      .select('*')
      .eq('feature_key', 'trivia')
      .eq('enabled', true);

    if (configErr) {
      logger.error('[TRIVIA CRON] Failed to fetch guild configs:', configErr.message);
      return;
    }

    for (const entry of configs || []) {
      const guildId = entry.guild_id;
      const config = entry.config || {};
      let tz = config.timezone || 'Asia/Manila';
      if (tz === 'Manila') tz = 'Asia/Manila';
      const dropsPerDay = Math.min(3, Math.max(1, parseInt(config.drops_per_day, 10) || 1));

      let local;
      try {
        local = getLocalTimeInTimezone(tz);
      } catch (e) {
        tz = 'Asia/Manila';
        local = getLocalTimeInTimezone('Asia/Manila');
      }

      const today = local.dateStr;
      const currentTimeStr = local.timeStr;

      // Query actual drops from database created today (using exact timezone offset)
      const tzOffsetStr = tz === 'Asia/Manila' || tz === 'Manila' ? '+08:00' : '+08:00';
      const startOfDayUtc = new Date(`${today}T00:00:00${tzOffsetStr}`).toISOString();
      const endOfDayUtc = new Date(`${today}T23:59:59${tzOffsetStr}`).toISOString();

      const { data: dropsToday } = await supabase
        .from('trivia_drops')
        .select('id, status')
        .eq('guild_id', guildId)
        .gte('created_at', startOfDayUtc)
        .lte('created_at', endOfDayUtc);

      const actualDropsToday = dropsToday?.length || 0;
      const hasActiveDrop = dropsToday?.some((d) => d.status === 'active');

      // If no active drop is present, sweep any stray trivia drop notification embeds from notification channel
      if (!hasActiveDrop) {
        await cleanupStrayTriviaNotifications(client, guildId, config);
      }

      // Ensure scheduling exists for today
      let isConfigDirty = false;
      if (
        !config.scheduled_drop_date ||
        config.scheduled_drop_date !== today ||
        !Array.isArray(config.scheduled_drop_times) ||
        config.scheduled_drop_times.length !== dropsPerDay
      ) {
        config.scheduled_drop_times = generateDropTimesForDay(dropsPerDay);
        config.scheduled_drop_time = config.scheduled_drop_times[0];
        config.completed_drops_today = actualDropsToday;
        config.scheduled_drop_date = today;
        isConfigDirty = true;

        logger.info(`[TRIVIA CRON] Scheduled ${dropsPerDay} drop(s) for guild ${guildId} at [${config.scheduled_drop_times.join(', ')}] (TZ: ${tz})`);
      }

      // Check if manual trigger was requested from the dashboard
      if (config.manual_trigger_requested) {
        logger.info(`[TRIVIA CRON] Manual trigger requested for guild ${guildId}. Executing immediately.`);
        const dropSuccess = await triggerTriviaDrop(client, guildId);
        if (dropSuccess) {
          config.last_drop_date = today;
          config.completed_drops_today = actualDropsToday + 1;
        }
        config.manual_trigger_requested = false;
        isConfigDirty = true;
      }
      // Check if it's time to drop today (scheduled)
      else {
        // Strict Guards: DO NOT spawn if an active drop is already running or max drops reached today
        if (hasActiveDrop) {
          // Active drop in progress, skip scheduling another drop
        } else if (actualDropsToday >= dropsPerDay) {
          // Max daily drops reached for today, skip
        } else {
          const completedCount = actualDropsToday;
          if (completedCount < config.scheduled_drop_times.length) {
            const targetTime = config.scheduled_drop_times[completedCount];
            const [currH, currM] = currentTimeStr.split(':').map(Number);
            const [schedH, schedM] = targetTime.split(':').map(Number);

            if (currH > schedH || (currH === schedH && currM >= schedM)) {
              logger.info(`[TRIVIA CRON] Triggering scheduled drop ${completedCount + 1}/${config.scheduled_drop_times.length} for guild ${guildId}. Time reached: ${currentTimeStr} >= ${targetTime}`);
              const dropSuccess = await triggerTriviaDrop(client, guildId);
              if (dropSuccess) {
                config.completed_drops_today = completedCount + 1;
                config.last_drop_date = today;
                isConfigDirty = true;
              }
            }
          }
        }
      }

      if (isConfigDirty) {
        await supabase
          .from('guild_config')
          .update({ config })
          .eq('guild_id', guildId)
          .eq('feature_key', 'trivia');
      }
    }

    // 2. Process Auto-Closing for active drops past close time
    const { data: activeDrops, error: activeErr } = await supabase
      .from('trivia_drops')
      .select('*')
      .eq('status', 'active');

    if (activeErr) {
      logger.error('[TRIVIA CRON] Failed to fetch active drops:', activeErr.message);
      return;
    }

    for (const drop of activeDrops || []) {
      // Find config to get timezone
      const { data: featureRow } = await supabase
        .from('guild_config')
        .select('config')
        .eq('guild_id', drop.guild_id)
        .eq('feature_key', 'trivia')
        .maybeSingle();

      const config = featureRow?.config || {};
      const tz = config.timezone || 'Asia/Manila';

      let local;
      try {
        local = getLocalTimeInTimezone(tz);
      } catch (e) {
        local = getLocalTimeInTimezone('Asia/Manila');
      }

      const today = local.dateStr;
      const currentTimeStr = local.timeStr;
      const dropLocalDate = drop.created_at ? getLocalTimeInTimezone(tz, drop.created_at).dateStr : today;

      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const closeTime = drop.close_time || '23:59';
      const [closeH, closeM] = closeTime.split(':').map(Number);

      const isPastCloseTime = currH > closeH || (currH === closeH && currM >= closeM);
      const isPastDate = dropLocalDate < today;

      if (isPastDate || isPastCloseTime) {
        logger.info(`[TRIVIA CRON] Auto-closing drop ${drop.id} (isPastDate=${isPastDate}, isPastCloseTime=${isPastCloseTime}, current=${currentTimeStr}, close=${closeTime}).`);
        await forceCloseDrop(client, drop.guild_id, drop.id, 'completed');
      }
    }
  } catch (err) {
    logger.error('[TRIVIA CRON] Error in checkAndProcessTrivia:', err.message);
  }
}

/**
 * Helper to get the formatted clickable slash command link for </trivia leaderboard:id>
 * @param {import('discord.js').Client} client
 * @returns {Promise<string>}
 */
async function getLeaderboardCommandMention(client) {
  try {
    const appCommands = client.application?.commands?.cache || await client.application?.commands?.fetch().catch(() => null);
    const cmd = appCommands?.find?.(c => c.name === 'trivia');
    if (cmd) {
      return `</trivia leaderboard:${cmd.id}>`;
    }
  } catch (e) {
    // Ignore fallback
  }
  return '`/trivia leaderboard`';
}

/**
 * Handles the "📊 View Leaderboard" button click
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTriviaLeaderboardButton(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (e) {
        return; // Interaction expired or already handled
      }
    }

    const { data: topPoints, error } = await supabase
    .from('trivia_points')
    .select('discord_id, points')
    .eq('guild_id', interaction.guild.id)
    .order('points', { ascending: false })
    .limit(5);

  if (error || !topPoints) {
    return interaction.editReply('❌ Failed to fetch leaderboard data.');
  }

  const lines = topPoints.map((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
    return `${medal} <@${entry.discord_id}> — **${entry.points.toLocaleString()}** points`;
  });

  if (lines.length === 0) {
    lines.push('*No points earned yet. Play trivia to show up here!*');
  }

  const embed = new EmbedBuilder()
    .setColor(0xFACC15)
    .setTitle('🏆 Server Trivia Leaderboard (Top 5)')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Every Nation Trivia System' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('[TRIVIA] Error in handleTriviaLeaderboardButton:', err.message || err);
  }
}

/**
 * Deletes the active trivia notification message from Discord, if any exists.
 * @param {import('discord.js').Guild} guild
 * @param {object} config
 */
async function deleteActiveTriviaNotification(guild, config) {
  try {
    if (!guild || !config) return;
    const notifChannelId = config.active_notif_channel_id || config.notification_channel_id;
    const notifMsgId = config.active_notif_message_id;

    if (notifChannelId && notifMsgId) {
      const notifChannel = await guild.channels.fetch(notifChannelId).catch(() => null);
      if (notifChannel && notifChannel.isTextBased()) {
        const notifMsg = await notifChannel.messages.fetch(notifMsgId).catch(() => null);
        if (notifMsg) {
          await notifMsg.delete().catch(() => {});
        }
      }
    }

    if (config.active_notif_message_id || config.active_notif_channel_id) {
      delete config.active_notif_message_id;
      delete config.active_notif_channel_id;
      await supabase
        .from('guild_config')
        .update({ config })
        .eq('guild_id', guild.id)
        .eq('feature_key', 'trivia');
    }
  } catch (err) {
    logger.error('[TRIVIA] deleteActiveTriviaNotification error:', err.message);
  }
}

/**
 * Sweeps and deletes any stray/abandoned "Daily Trivia Drop Live!" notifications in notification channel
 * if no trivia session is active.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {object} config
 */
async function cleanupStrayTriviaNotifications(client, guildId, config) {
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild || !config?.notification_channel_id) return;

    // Delete tracked message first if set
    await deleteActiveTriviaNotification(guild, config);

    // Also scan recent messages in notification channel to delete any orphan trivia notification embeds
    const notifChannel = await guild.channels.fetch(config.notification_channel_id).catch(() => null);
    if (notifChannel && notifChannel.isTextBased()) {
      const recentMsgs = await notifChannel.messages.fetch({ limit: 25 }).catch(() => null);
      if (recentMsgs && recentMsgs.size > 0) {
        for (const msg of recentMsgs.values()) {
          if (msg.author.id === client.user.id && msg.embeds && msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            const isTriviaNotif =
              embed.title === '📢 Daily Trivia Drop Live!' ||
              embed.footer?.text?.includes('Every Nation Trivia') ||
              embed.description?.includes('Daily Trivia Drop');
            if (isTriviaNotif) {
              await msg.delete().catch(() => {});
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error('[TRIVIA] cleanupStrayTriviaNotifications error:', err.message);
  }
}

module.exports = {
  triggerTriviaDrop,
  handleTriviaStartClick,
  handleTriviaAnswerClick,
  handleTriviaLeaderboardButton,
  forceCloseDrop,
  updateLiveLeaderboard,
  checkAndProcessTrivia,
  deleteActiveTriviaNotification,
  cleanupStrayTriviaNotifications,
};
// Trivia module helper comment


