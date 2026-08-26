'use strict';
/**
 * ENOS Voice Translation Session
 * Extension of Herald of Voice — on-demand voice capture, transcription, and translation.
 *
 * Reuses: getVoiceBotClient, enqueueTtsText, activeSessions (from tts.js)
 * New:    Voice receiving pipeline (Opus -> PCM -> WAV), Gemini multimodal transcription, session lifecycle.
 *
 * Architecture rule: Never creates a parallel voice system. Reuses existing Herald of Voice
 * connection where available; creates a fresh sub-bot connection only when Herald of Voice
 * is not active in the guild.
 */

const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const prism = require('prism-media');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../lib/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Active translation sessions: guildId -> TranslationSession
const translationSessions = new Map();

// Completed sessions (temp, 30-min TTL): sessionId -> CompletedSession
const completedSessions = new Map();

// Minimum PCM bytes to bother transcribing: ~0.1s of 48kHz stereo 16-bit
// 48000 samples/s * 2 channels * 2 bytes * 0.1s = 19,200 bytes
const MIN_PCM_BYTES = 19200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a WAV file buffer from raw 48kHz stereo 16-bit PCM data.
 * @param {Buffer} pcmBuffer
 * @returns {Buffer}
 */
function pcmToWav(pcmBuffer) {
  const sampleRate = 48000;
  const channels = 2;
  const bitDepth = 16;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
  header.writeUInt16LE(channels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Sends a WAV audio buffer to Gemini for transcription + language detection.
 * Uses the same Gemini key/SDK as the rest of ENOS. Falls back through model cascade.
 * Returns null on total failure rather than throwing.
 *
 * @param {Buffer} wavBuffer
 * @returns {Promise<{transcript:string,language:string,language_code:string,is_english:boolean,translation:string}|null>}
 */
async function transcribeWithGemini(wavBuffer) {
  if (!process.env.GEMINI_API_KEY) return null;

  const prompt = [
    'Listen to this voice audio clip and transcribe what was said.',
    'Respond ONLY with valid JSON (no markdown, no extra text):',
    '{',
    '  "transcript": "the exact words spoken",',
    '  "language": "detected language name (e.g. English, Filipino, Japanese)",',
    '  "language_code": "ISO 639-1 code (en, tl, ja, es, fr, de, zh, ko, etc.)",',
    '  "is_english": true or false,',
    '  "translation": "English translation (copy transcript exactly if already English)"',
    '}',
    'If the audio is inaudible, silence, or contains no speech, return:',
    '{"transcript":"","language":"unknown","language_code":"unknown","is_english":false,"translation":""}',
  ].join('\n');

  const audioPart = {
    inlineData: {
      mimeType: 'audio/wav',
      data: wavBuffer.toString('base64'),
    },
  };

  // Same cascade pattern used throughout ENOS AI features
  const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, audioPart]);
      const text = result.response.text().trim();
      const clean = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(clean);
      if (typeof parsed.transcript === 'string') {
        logger.info(
          `[VTRANS] Transcribed via ${modelName}: [${parsed.language}] "${parsed.transcript}"`
        );
        return parsed;
      }
    } catch (err) {
      logger.warn(`[VTRANS] ${modelName} transcription failed: ${err.message}`);
    }
  }

  logger.error('[VTRANS] All transcription models failed for this chunk.');
  return null;
}

/**
 * Resolves the display name of a guild member. Falls back gracefully.
 * @param {string} userId
 * @param {string} guildId
 * @param {import('discord.js').Client|null} vbc
 * @returns {Promise<string>}
 */
async function resolveDisplayName(userId, guildId, vbc) {
  try {
    const guild =
      vbc?.guilds?.cache?.get(guildId) ||
      (await vbc?.guilds?.fetch(guildId).catch(() => null));
    if (!guild) return `User-${userId.slice(-4)}`;
    const member = await guild.members.fetch(userId).catch(() => null);
    return member?.displayName || member?.user?.username || `User-${userId.slice(-4)}`;
  } catch (_) {
    return `User-${userId.slice(-4)}`;
  }
}

// ---------------------------------------------------------------------------
// Core Voice Receiving Pipeline
// ---------------------------------------------------------------------------

/**
 * Attaches the voice receiver to a connection for the given session.
 * Listens for speakers via the VoiceReceiver speaking event, decodes
 * Opus -> PCM per utterance, and submits to Gemini when silence detected.
 *
 * @param {import('@discordjs/voice').VoiceConnection} connection
 * @param {object} session
 * @param {import('discord.js').Client|null} vbc
 */
function attachReceiver(connection, session, vbc) {
  const { receiver } = connection;

  const onSpeakingStart = (userId) => {
    // Stop processing if session was ended or is stopping
    if (!translationSessions.has(session.guildId) || session.stopping) return;

    // Ignore the sub-bot's own audio (Discord doesn't echo it back, but be explicit)
    if (vbc?.user && userId === vbc.user.id) return;

    // Avoid double-subscribing during the same utterance
    if (session.activeSpeakers.has(userId)) return;
    session.activeSpeakers.add(userId);

    // Subscribe to this speaker's stream.
    // AfterSilence(1200ms) ends stream after 1.2s of silence -- natural utterance boundary.
    const userStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1200 },
    });

    // Opus -> PCM decoder via prism-media/opusscript
    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const chunks = [];

    userStream.pipe(decoder);

    decoder.on('data', (chunk) => chunks.push(chunk));

    decoder.on('error', (err) => {
      logger.warn(`[VTRANS] Decoder error for user ${userId}: ${err.message}`);
      session.activeSpeakers.delete(userId);
    });

    const processPromise = new Promise((resolve) => {
      decoder.on('end', async () => {
        session.activeSpeakers.delete(userId);
        if (chunks.length === 0) return resolve();

        const pcmBuffer = Buffer.concat(chunks);

        // Skip chunks too short to contain meaningful speech
        if (pcmBuffer.length < MIN_PCM_BYTES) {
          logger.info(`[VTRANS] Skipping short chunk for ${userId} (${pcmBuffer.length} bytes)`);
          return resolve();
        }

        try {
          const wavBuffer = pcmToWav(pcmBuffer);

          // Transcribe via Gemini (non-blocking -- next speaker can start while this runs)
          const result = await transcribeWithGemini(wavBuffer);
          if (result && result.transcript) {
            const displayName = await resolveDisplayName(userId, session.guildId, vbc);

            session.transcript.push({
              userId,
              displayName,
              language: result.language || 'Unknown',
              languageCode: result.language_code || 'unknown',
              originalText: result.transcript,
              translatedText: result.translation || result.transcript,
              isEnglish: result.is_english === true,
              timestamp: Date.now(),
            });

            logger.info(
              `[VTRANS] [${displayName}] [${result.language}] "${result.transcript}"` +
                (result.is_english ? '' : ` -> "${result.translation}"`)
            );
          }
        } catch (err) {
          logger.error(`[VTRANS] Transcription processing error for user ${userId}:`, err.message);
        }
        resolve();
      });
    });

    session.inFlightTranscriptions.add(processPromise);
    processPromise.finally(() => session.inFlightTranscriptions.delete(processPromise));

    userStream.on('error', (err) => {
      logger.warn(`[VTRANS] User stream error for ${userId}: ${err.message}`);
      session.activeSpeakers.delete(userId);
    });
  };

  receiver.speaking.on('start', onSpeakingStart);

  // Store reference for clean removal on session end
  session._speakingListener = onSpeakingStart;
  session._receiver = receiver;
}

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

/**
 * Starts a new Voice Translation Session.
 * Reuses the existing Herald of Voice connection if available,
 * otherwise creates a fresh one via the sub-bot.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').VoiceChannel} voiceChannel
 * @param {import('discord.js').TextChannel} textChannel
 * @param {import('discord.js').GuildMember} initiatorMember
 * @returns {Promise<{success:boolean, message:string}>}
 */
async function startTranslationSession(guild, voiceChannel, textChannel, initiatorMember) {
  const guildId = guild.id;

  if (translationSessions.has(guildId)) {
    return {
      success: false,
      message: 'A Voice Translation session is already active in this server.',
    };
  }

  // Lazy-load to avoid circular dependency at module parse time
  const { activeSessions: ttsActiveSessions, getVoiceBotClient } = require('./tts');
  const vbc = getVoiceBotClient();

  let connection = null;
  let ownedConnection = false;

  const ttsSession = ttsActiveSessions.get(guildId);

  if (ttsSession?.connection) {
    // Reuse existing Herald of Voice connection, toggle selfDeaf off for listening
    connection = ttsSession.connection;
    try {
      connection.rejoin({ channelId: voiceChannel.id, selfDeaf: false, selfMute: false });
      logger.info('[VTRANS] Reused Herald of Voice connection (selfDeaf -> false).');
    } catch (err) {
      logger.warn('[VTRANS] rejoin on existing connection failed:', err.message);
    }
  } else {
    // No Herald of Voice session -- join fresh via sub-bot
    if (!vbc || !vbc.isReady()) {
      return {
        success: false,
        message: 'Voice Herald Sub-Bot is not online. Please contact an admin.',
      };
    }
    const voiceGuild = vbc.guilds.cache.get(guildId);
    if (!voiceGuild) {
      return {
        success: false,
        message: 'Voice Herald Sub-Bot is not a member of this server.',
      };
    }
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceGuild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    ownedConnection = true;
    logger.info('[VTRANS] Created new voice connection for translation (no TTS session active).');
  }

  const session = {
    guildId,
    voiceChannelId: voiceChannel.id,
    textChannelId: textChannel.id,
    statusMessageId: null,
    initiatorId: initiatorMember.id,
    startedAt: Date.now(),
    transcript: [],
    activeSpeakers: new Set(),
    inFlightTranscriptions: new Set(),
    stopping: false,
    connection,
    ownedConnection,
    _speakingListener: null,
    _receiver: null,
  };

  translationSessions.set(guildId, session);
  attachReceiver(connection, session, vbc);

  // Post status embed
  const statusEmbed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('Voice Translation Active')
    .setDescription(
      `**Target Language:** English\n` +
        `ENOS is listening to **${voiceChannel.name}**.\n\n` +
        `*Speak naturally in any language. ENOS will transcribe and translate when the session ends.*`
    )
    .setFooter({
      text: `Started by ${initiatorMember.displayName || initiatorMember.user.username} \u2022 ENOS Voice System`,
    })
    .setTimestamp();

  const stopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vtrans_stop')
      .setLabel('Stop Translation')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('\u23F9')
  );

  const statusMsg = await textChannel.send({ embeds: [statusEmbed], components: [stopRow] });
  session.statusMessageId = statusMsg.id;

  return { success: true, message: 'Voice Translation session started.' };
}

/**
 * Stops the active Voice Translation Session for a guild.
 * Cleans up receiver, restores Herald of Voice state, posts the completion embed.
 *
 * @param {string} guildId
 * @param {import('discord.js').TextChannel|null} textChannel
 * @returns {Promise<{success:boolean, message?:string}>}
 */
async function stopTranslationSession(guildId, textChannel) {
  const session = translationSessions.get(guildId);
  if (!session) {
    return { success: false, message: 'No active Voice Translation session.' };
  }

  // Mark session as stopping so no new speaking bursts are started
  session.stopping = true;

  // Clean up speaking event listener
  if (session._speakingListener && session._receiver) {
    try {
      session._receiver.speaking.removeListener('start', session._speakingListener);
    } catch (_) {}
  }

  // If there are active speakers or in-flight decoders/Gemini transcriptions, give them up to 2.5s to finish
  if (session.activeSpeakers.size > 0 || session.inFlightTranscriptions.size > 0) {
    logger.info(
      `[VTRANS] Flushing in-flight audio on session stop: activeSpeakers=${session.activeSpeakers.size}, inFlight=${session.inFlightTranscriptions.size}`
    );
    const timeout = new Promise((r) => setTimeout(r, 2500));
    await Promise.race([
      Promise.allSettled(Array.from(session.inFlightTranscriptions)),
      timeout,
    ]);
  }

  // Remove from active map now that in-flight chunks have settled
  translationSessions.delete(guildId);

  const { getVoiceBotClient } = require('./tts');
  const vbc = getVoiceBotClient();

  // Restore voice state
  if (session.ownedConnection) {
    // We owned this connection for translation only -- destroy it
    try { session.connection.destroy(); } catch (_) {}
  } else {
    // Herald of Voice owns this connection -- restore selfDeaf: false
    try {
      session.connection.rejoin({
        channelId: session.voiceChannelId,
        selfDeaf: false,
        selfMute: false,
      });
      logger.info('[VTRANS] Restored Herald of Voice connection state.');
    } catch (err) {
      logger.warn('[VTRANS] Could not update voice connection state:', err.message);
    }
  }

  // Delete the status message
  const resolvedChannel =
    textChannel ||
    (vbc ? await vbc.channels.fetch(session.textChannelId).catch(() => null) : null);

  if (resolvedChannel && session.statusMessageId) {
    const statusMsg = await resolvedChannel.messages
      .fetch(session.statusMessageId)
      .catch(() => null);
    if (statusMsg) await statusMsg.delete().catch(() => {});
  }

  // Build completion summary
  const durationMs = Date.now() - session.startedAt;
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);
  const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;
  const uniqueSpeakers = new Set(session.transcript.map((e) => e.userId)).size;
  const hasTranscript = session.transcript.length > 0;

  // Store completed session with 30-minute auto-expiry
  const sessionId = `${guildId}_${session.startedAt}`;
  completedSessions.set(sessionId, session);
  setTimeout(() => completedSessions.delete(sessionId), 30 * 60 * 1000);

  const completionEmbed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('Voice Translation Complete')
    .addFields(
      { name: 'Duration', value: durationStr, inline: true },
      { name: 'Speakers', value: uniqueSpeakers.toString(), inline: true },
      { name: 'Lines', value: session.transcript.length.toString(), inline: true }
    )
    .setFooter({ text: 'ENOS Voice System' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vtrans_view:${sessionId}`)
      .setLabel('View Translation')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\uD83D\uDCC4')
      .setDisabled(!hasTranscript),
    new ButtonBuilder()
      .setCustomId(`vtrans_tts:${sessionId}`)
      .setLabel('Generate TTS')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('\uD83D\uDD0A')
      .setDisabled(!hasTranscript),
    new ButtonBuilder()
      .setCustomId(`vtrans_delete:${sessionId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('\uD83D\uDDD1')
  );

  if (resolvedChannel) {
    await resolvedChannel.send({ embeds: [completionEmbed], components: [actionRow] });
  }

  logger.info(
    `[VTRANS] Session ended: guild=${guildId}, lines=${session.transcript.length}, speakers=${uniqueSpeakers}, duration=${durationStr}`
  );
  return { success: true };
}

// ---------------------------------------------------------------------------
// Button Interaction Handler
// ---------------------------------------------------------------------------

/**
 * Handles all vtrans_ button interactions.
 * Called from interactionCreate.js for customId.startsWith('vtrans_').
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTranslationInteraction(interaction) {
  const customId = interaction.customId;
  const guildId = interaction.guild.id;

  // -- Stop -----------------------------------------------------------------
  if (customId === 'vtrans_stop') {
    if (!translationSessions.has(guildId)) {
      return interaction.reply({
        content: 'No active Voice Translation session.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await stopTranslationSession(guildId, interaction.channel);
    return interaction.editReply({
      content: result.success ? 'Voice Translation stopped.' : result.message,
    });
  }

  // -- View Translation -----------------------------------------------------
  if (customId.startsWith('vtrans_view:')) {
    const sessionId = customId.slice('vtrans_view:'.length);
    const session = completedSessions.get(sessionId);

    if (!session) {
      return interaction.reply({
        content: 'Translation data has expired or was deleted.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (session.transcript.length === 0) {
      return interaction.reply({
        content: 'No speech was captured in this session.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Format: speaker, language, original, translation
    const lines = session.transcript.map((entry) => {
      if (entry.isEnglish) {
        return `**${entry.displayName} \u00B7 ${entry.language}**\n> "${entry.originalText}"`;
      }
      return (
        `**${entry.displayName} \u00B7 ${entry.language}**\n` +
        `> "${entry.originalText}"\n` +
        `> \u2192 "${entry.translatedText}"`
      );
    });

    // Paginate into Discord-safe chunks (<= 1800 chars)
    const pages = [];
    let current = '';
    for (const line of lines) {
      const sep = current ? '\n\n' : '';
      if ((current + sep + line).length > 1800) {
        pages.push(current);
        current = line;
      } else {
        current = current + sep + line;
      }
    }
    if (current) pages.push(current);

    await interaction.reply({
      content:
        `**Voice Translation Transcript**${pages.length > 1 ? ` (1/${pages.length})` : ''}\n\n${pages[0]}`,
      flags: MessageFlags.Ephemeral,
    });

    for (let i = 1; i < pages.length; i++) {
      await interaction.followUp({
        content: `*(Part ${i + 1}/${pages.length})*\n\n${pages[i]}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // -- Generate TTS ---------------------------------------------------------
  if (customId.startsWith('vtrans_tts:')) {
    const sessionId = customId.slice('vtrans_tts:'.length);
    const session = completedSessions.get(sessionId);

    if (!session) {
      return interaction.reply({
        content: 'Translation data has expired or was deleted.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (session.transcript.length === 0) {
      return interaction.reply({
        content: 'No speech to read back.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Herald of Voice must be active to play TTS
    const { activeSessions: ttsActiveSessions, enqueueTtsText } = require('./tts');
    const ttsSession = ttsActiveSessions.get(guildId);

    if (!ttsSession) {
      return interaction.reply({
        content:
          'Herald of Voice is not active in this server.\n' +
          'Use `/tts join` to bring it to your Voice Channel first, then press **Generate TTS** again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const ttsScript = session.transcript
      .map((e) => e.translatedText || e.originalText)
      .filter(Boolean)
      .join('. ');

    if (!ttsScript.trim()) {
      return interaction.editReply({ content: 'No translatable content found.' });
    }

    const queued = enqueueTtsText(guildId, ttsScript);
    return interaction.editReply({
      content: queued
        ? 'Translation queued through Herald of Voice!'
        : 'Could not queue TTS. Make sure Herald of Voice is still active.',
    });
  }

  // -- Delete ---------------------------------------------------------------
  if (customId.startsWith('vtrans_delete:')) {
    const sessionId = customId.slice('vtrans_delete:'.length);
    completedSessions.delete(sessionId);

    try {
      await interaction.update({
        embeds: interaction.message.embeds,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`vtrans_view:${sessionId}`)
              .setLabel('View Translation')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('\uD83D\uDCC4')
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`vtrans_tts:${sessionId}`)
              .setLabel('Generate TTS')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('\uD83D\uDD0A')
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`vtrans_delete:${sessionId}`)
              .setLabel('Deleted')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('\uD83D\uDDD1')
              .setDisabled(true)
          ),
        ],
      });
    } catch (err) {
      logger.warn('[VTRANS] Could not update buttons after delete:', err.message);
      await interaction.reply({
        content: 'Translation data deleted.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  }
}

module.exports = {
  startTranslationSession,
  stopTranslationSession,
  handleTranslationInteraction,
  translationSessions,
};
