const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Clean up markdown block format if Gemini wrapped it despite prompt
  const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleanJson);

  if (!parsed.question || !parsed.correct_answer || !parsed.incorrect_answers || parsed.incorrect_answers.length !== 3) {
    throw new Error('Invalid JSON format returned by Gemini.');
  }

  return parsed;
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

/**
 * Triggers a trivia drop for a guild.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
async function triggerTriviaDrop(client, guildId) {
  try {
    const featureConfig = await getFeatureConfig(guildId, 'trivia');
    if (!featureConfig?.enabled) {
      logger.info(`[TRIVIA] Feature disabled for guild ${guildId}.`);
      return false;
    }

    const config = featureConfig.config || {};
    const allowedChannels = config.allowed_channels || [];
    const closeTime = config.close_time || '22:00';

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
        await forceCloseDrop(client, guildId, oldDrop.id, 'skipped');
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

    const sentMessage = await channel.send({ embeds: [embed], components: [row] });

    // Save message reference
    await supabase
      .from('trivia_drops')
      .update({ message_id: sentMessage.id })
      .eq('id', drop.id);

    await logBotEvent(guildId, 'trivia_drop', null, { dropId: drop.id, channelId: channel.id });
    return true;
  } catch (err) {
    logger.error('[TRIVIA] Error in triggerTriviaDrop:', err.message);
    return false;
  }
}

/**
 * Handles the "Start Trivia" button click. Spawns ephemeral message.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTriviaStartClick(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split(':');
  const dropId = parts[1];

  // Fetch drop
  const { data: drop, error } = await supabase
    .from('trivia_drops')
    .select('*')
    .eq('id', dropId)
    .maybeSingle();

  if (error || !drop) {
    return interaction.editReply({ content: '❌ Trivia session not found.' });
  }

  if (drop.status !== 'active') {
    return interaction.editReply({ content: '❌ This trivia session has already closed.' });
  }

  // Check roles
  const featureConfig = await getFeatureConfig(interaction.guild.id, 'trivia');
  const config = featureConfig?.config || {};
  const allowedRoles = config.allowed_roles || []; // Array of role IDs/names

  if (allowedRoles.length > 0) {
    const hasRole = interaction.member.roles.cache.some(r =>
      allowedRoles.includes(r.id) || allowedRoles.includes(r.name)
    );
    if (!hasRole) {
      return interaction.editReply({
        content: '❌ You do not have the required roles to participate in this trivia.',
      });
    }
  }

  // Check if already participated
  const { data: participant } = await supabase
    .from('trivia_participants')
    .select('*')
    .eq('drop_id', dropId)
    .eq('user_id', interaction.user.id)
    .maybeSingle();

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
    .setFooter({ text: 'Answer quickly! Sub-millisecond speed is tracked.' });

  const row = new ActionRowBuilder().addComponents(buttons);

  await interaction.editReply({ embeds: [embed], components: [row] });
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
      } else {
        await message.edit({ embeds: [updatedEmbed] }).catch(() => { });
      }
    }
  }

  // Update Live Point Tracker Leaderboard if configured
  await updateLiveLeaderboard(interaction.client, interaction.guild.id);

  return interaction.editReply({
    content: `✅ **Correct!** You came in **${placeName}**!\n⏱️ Response time: **${(speedMs / 1000).toFixed(6)}s**\n💰 Awarded **${winnerPoints}** trivia points!\n\n🏆 View standings with ${cmdMention} or click below:`,
    components: [leaderboardBtnRow],
  });
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
      // Send new message
      const sent = await channel.send({ embeds: [embed] });
      leaderboardMessageId = sent.id;
      // Update config with new message ID
      const updatedConfig = { ...config, leaderboard_message_id: sent.id };
      await supabase
        .from('guild_config')
        .update({ config: updatedConfig })
        .eq('guild_id', guildId)
        .eq('feature_key', 'trivia');
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

    const channel = await guild.channels.fetch(drop.channel_id).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(drop.message_id).catch(() => null);
    if (message) {
      const currentEmbed = message.embeds[0];
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('trivia_disabled')
          .setLabel(status === 'skipped' ? 'Session Cancelled' : 'Session Closed')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      const winners = drop.winners || [];
      const podiumLines = winners.map((w, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        return `${medal} <@${w.user_id}> — **${(w.speed_ms / 1000).toFixed(6)}s** (+${w.points} pts)`;
      });
      let podiumText = podiumLines.length > 0 ? podiumLines.join('\n') : '*No winners.*';
      podiumText += status === 'skipped' ? '\n\n❌ **Trivia Session was Cancelled/Skipped by Admin.**' : '\n\n🏁 **Trivia Session is now Closed!**';

      const updatedEmbed = EmbedBuilder.from(currentEmbed)
        .setFields(
          { name: '📚 Category / Topic', value: currentEmbed.fields[0].value, inline: true },
          { name: '🏆 Podium', value: podiumText }
        );

      await message.edit({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => { });
    }
  } catch (err) {
    logger.error('[TRIVIA] forceCloseDrop error:', err.message);
  }
}

/**
 * Helper to get local date and time values in a specific timezone
 * @param {string} timezone
 * @returns {{ dateStr: string, timeStr: string, hour: number, minute: number }}
 */
function getLocalTimeInTimezone(timezone) {
  const options = {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
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
      const tz = config.timezone || 'Asia/Manila';

      let local;
      try {
        local = getLocalTimeInTimezone(tz);
      } catch (e) {
        logger.error(`[TRIVIA CRON] Invalid timezone configured for guild ${guildId}: ${tz}. Defaulting to Asia/Manila.`);
        local = getLocalTimeInTimezone('Asia/Manila');
      }

      const today = local.dateStr;
      const currentTimeStr = local.timeStr;

      // Ensure scheduling exists for today
      let isConfigDirty = false;
      if (!config.scheduled_drop_date || config.scheduled_drop_date !== today) {
        const randHour = Math.floor(Math.random() * (21 - 9 + 1)) + 9; // 9:00 AM to 9:00 PM
        const randMin = Math.floor(Math.random() * 60);
        const formatHour = String(randHour).padStart(2, '0');
        const formatMin = String(randMin).padStart(2, '0');

        config.scheduled_drop_time = `${formatHour}:${formatMin}`;
        config.scheduled_drop_date = today;
        isConfigDirty = true;

        logger.info(`[TRIVIA CRON] Scheduled trivia for guild ${guildId} at ${config.scheduled_drop_time} (TZ: ${tz})`);
      }

      // Check if manual trigger was requested from the dashboard
      if (config.manual_trigger_requested) {
        logger.info(`[TRIVIA CRON] Manual trigger requested for guild ${guildId}. Executing immediately.`);
        const dropSuccess = await triggerTriviaDrop(client, guildId);
        if (dropSuccess) {
          config.last_drop_date = today;
        }
        config.manual_trigger_requested = false;
        isConfigDirty = true;
      }
      // Check if it's time to drop today (scheduled)
      else if (config.last_drop_date !== today) {
        const [currH, currM] = currentTimeStr.split(':').map(Number);
        const [schedH, schedM] = (config.scheduled_drop_time || '09:00').split(':').map(Number);

        if (currH > schedH || (currH === schedH && currM >= schedM)) {
          logger.info(`[TRIVIA CRON] Triggering scheduled drop for guild ${guildId}. Time reached: ${currentTimeStr} >= ${config.scheduled_drop_time}`);
          const dropSuccess = await triggerTriviaDrop(client, guildId);
          if (dropSuccess) {
            config.last_drop_date = today;
            isConfigDirty = true;
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

      const currentTimeStr = local.timeStr;
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [closeH, closeM] = drop.close_time.split(':').map(Number);

      if (currH > closeH || (currH === closeH && currM >= closeM)) {
        logger.info(`[TRIVIA CRON] Auto-closing drop ${drop.id} due to close time reached (${currentTimeStr} >= ${drop.close_time}).`);
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
  await interaction.deferReply({ ephemeral: true });

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
}

module.exports = {
  triggerTriviaDrop,
  handleTriviaStartClick,
  handleTriviaAnswerClick,
  handleTriviaLeaderboardButton,
  forceCloseDrop,
  updateLiveLeaderboard,
  checkAndProcessTrivia,
};
// Trivia module helper comment

