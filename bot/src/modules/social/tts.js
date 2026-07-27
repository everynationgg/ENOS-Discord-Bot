const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');
const { execFile } = require('child_process');
const logger = require('../../lib/logger');
const { supabase } = require('../../lib/supabase');

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Dedicated Voice Herald Client Instance
let voiceBotClient = null;

// Active Sessions Store: guildId -> Session Object
const activeSessions = new Map();

// Default Settings
const DEFAULT_SETTINGS = {
  language: 'en',
  voiceModel: 'female',
  persona: 'default',
};

// Supported Languages
const LANGUAGES = [
  { label: 'English (US)', value: 'en', code: 'en' },
  { label: 'Japanese (日本語)', value: 'ja', code: 'ja' },
  { label: 'Tagalog (Filipino)', value: 'tl', code: 'tl' },
  { label: 'Spanish (Español)', value: 'es', code: 'es' },
  { label: 'French (Français)', value: 'fr', code: 'fr' },
  { label: 'German (Deutsch)', value: 'de', code: 'de' },
];

// Voice Models / Pitches
const VOICE_MODELS = [
  { label: 'Female Voice', value: 'female' },
  { label: 'Male Voice', value: 'male' },
  { label: 'Neutral Voice', value: 'neutral' },
  { label: 'Deep Voice', value: 'deep' },
];

// Character Personas
const PERSONAS = [
  { label: 'Default Natural', value: 'default', desc: 'Standard natural spoken tone' },
  { label: 'Hype Announcer', value: 'announcer', desc: 'Energetic esports stadium announcer' },
  { label: 'Glitched / ERROR-MOD', value: 'error_mod', desc: 'Corrupted AI system voice' },
  { label: 'Calm & Chill', value: 'calm', desc: 'Relaxed ambient lofi tone' },
];

/**
 * Initializes the secondary Voice Herald Sub-Bot client.
 */
function initVoiceBot(mainClient) {
  const token = process.env.DISCORD_VOICE_BOT_TOKEN;
  if (!token) {
    logger.warn('[EN TTS] DISCORD_VOICE_BOT_TOKEN not configured in bot/.env');
    return;
  }

  voiceBotClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  voiceBotClient.on('ready', () => {
    logger.info(`[EN TTS] Voice Herald Sub-Bot logged in as ${voiceBotClient.user.tag}`);
  });

  // Track Auto-Disconnect when all human members leave VC
  voiceBotClient.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = oldState.guild.id;
    const session = activeSessions.get(guildId);
    if (!session) return;

    if (oldState.channelId === session.voiceChannelId) {
      const channel = oldState.channel;
      if (channel) {
        const humanMembers = channel.members.filter((m) => !m.user.bot);
        if (humanMembers.size === 0) {
          logger.info(`[EN TTS] All humans left Voice Channel ${channel.name}. Auto-disconnecting...`);
          leaveVoiceSession(guildId, mainClient);
        }
      }
    }
  });

  voiceBotClient.login(token).catch((err) => {
    logger.error('[EN TTS] Failed to login Voice Herald Sub-Bot:', err.message);
  });
}

/**
 * Clean raw text: Strip Discord custom emojis, URLs, and user mentions
 */
function cleanTextForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, '') // Custom emojis
    .replace(/https?:\/\/\S+/g, 'link') // URLs
    .replace(/<@!?([0-9]+)>/g, '') // Mentions
    .replace(/<#([0-9]+)>/g, '') // Channels
    .replace(/[`*_~]/g, '') // Markdown symbols
    .trim();
}

/**
 * Translates input text using Gemini 2.0 / 1.5 Flash with fallback model chain & strict translation rules
 */
async function translateTextWithGemini(rawText, targetLangCode, persona) {
  const cleaned = cleanTextForSpeech(rawText);
  if (!cleaned) return '';

  const personaInstructions = {
    default: 'Translate the text accurately into the target language.',
    announcer: 'Translate the text into an energetic, hyped announcement style in the target language.',
    error_mod: 'Translate the text with subtle sci-fi system diagnostics framing in the target language.',
    calm: 'Translate the text into a relaxed, smooth, calming tone in the target language.',
  };

  const targetLangNames = {
    en: 'English',
    ja: 'Japanese',
    tl: 'Tagalog (Filipino)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  };

  const langName = targetLangNames[targetLangCode] || 'English';
  const instruction = personaInstructions[persona] || personaInstructions.default;

  const prompt = `You are a strict, high-precision voice translator.\n` +
    `Task: ${instruction}\n` +
    `Target Spoken Language: ${langName}\n\n` +
    `CRITICAL RULE: If the original text is in Tagalog, Spanish, Japanese, or any other language, YOU MUST TRANSLATE IT FULLY into ${langName}. For example, if the input is "Ano nangyari?" and Target Language is English, return "What happened?". NEVER echo untranslated words.\n\n` +
    `Original Input Text: "${cleaned}"\n\n` +
    `Output: Return ONLY the translated spoken sentence in ${langName}. Do NOT include quotes, "Translation:", or "User said:".`;

  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent(prompt);
      const translation = res.response.text().trim();
      if (translation) {
        logger.info(`[EN TTS] Translated via ${modelName}: "${cleaned}" -> "${translation}" (${langName})`);
        return translation;
      }
    } catch (err) {
      logger.warn(`[EN TTS] Model ${modelName} error (${err.message}). Trying fallback...`);
    }
  }

  return cleaned;
}

/**
 * Synthesizes audio file for target translation using gTTS
 */
function generateTtsAudioFile(text, langCode) {
  const gttsLangMap = {
    en: 'en',
    ja: 'ja',
    tl: 'es',
    es: 'es',
    fr: 'fr',
    de: 'de',
  };

  const primaryLang = gttsLangMap[langCode] || 'en';

  return new Promise((resolve) => {
    const tempPath = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);

    const attemptSave = (langToUse) => {
      try {
        const gtts = new gTTS(text, langToUse);
        gtts.save(tempPath, (err) => {
          if (err && langToUse !== 'en') {
            attemptSave('en');
          } else {
            resolve(tempPath);
          }
        });
      } catch (e) {
        if (langToUse !== 'en') {
          attemptSave('en');
        } else {
          resolve(tempPath);
        }
      }
    };

    attemptSave(primaryLang);
  });
}

/**
 * Applies Voice Model pitch shifting & Character Persona audio filters via FFmpeg
 */
function applyAudioEffects(inputPath, voiceModel, persona) {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(inputPath);

    const outputPath = path.join(os.tmpdir(), `tts_fx_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
    let filters = [];

    // 1. Voice Model Pitch Modulation
    if (voiceModel === 'male') {
      filters.push('asetrate=24000*0.82,atempo=1.22');
    } else if (voiceModel === 'deep') {
      filters.push('asetrate=24000*0.70,atempo=1.42,equalizer=f=100:width_type=h:width=200:g=10');
    } else if (voiceModel === 'neutral') {
      filters.push('asetrate=24000*0.92,atempo=1.08');
    } else if (voiceModel === 'female') {
      filters.push('asetrate=24000*1.08,atempo=0.92');
    }

    // 2. Character Persona Audio Effects
    if (persona === 'announcer') {
      filters.push('atempo=1.12,equalizer=f=3000:width_type=h:width=1000:g=5');
    } else if (persona === 'error_mod') {
      filters.push('flanger=delay=8:depth=4:regen=60:speed=0.6,phaser=speed=0.5:decay=0.5');
    } else if (persona === 'calm') {
      filters.push('lowpass=f=3200,atempo=0.92');
    }

    if (filters.length === 0) return resolve(inputPath);

    const filterString = filters.join(',');
    const args = ['-y', '-i', inputPath, '-af', filterString, outputPath];

    execFile(ffmpegPath, args, (err) => {
      if (err) {
        logger.warn('[EN TTS] FFmpeg audio filter fallback:', err.message);
        resolve(inputPath);
      } else {
        fs.unlink(inputPath, () => {});
        resolve(outputPath);
      }
    });
  });
}

/**
 * Process next audio item in queue for a session with pitch shift & persona FX
 */
async function processSpeechQueue(guildId) {
  const session = activeSessions.get(guildId);
  if (!session || session.isPlaying || session.queue.length === 0) return;

  session.isPlaying = true;
  const rawText = session.queue.shift();

  try {
    const translatedText = await translateTextWithGemini(rawText, session.language, session.persona);
    if (!translatedText) {
      session.isPlaying = false;
      return processSpeechQueue(guildId);
    }

    const rawAudioFile = await generateTtsAudioFile(translatedText, session.language);
    const finalAudioFile = await applyAudioEffects(rawAudioFile, session.voiceModel, session.persona);

    const resource = createAudioResource(finalAudioFile);

    session.player.play(resource);

    const onFinish = () => {
      session.isPlaying = false;
      fs.unlink(finalAudioFile, () => {});
      processSpeechQueue(guildId);
    };

    session.player.once(AudioPlayerStatus.Idle, onFinish);
    session.player.once('error', (err) => {
      logger.error('[EN TTS] Audio Player Error:', err.message);
      onFinish();
    });
  } catch (err) {
    logger.error('[EN TTS] Speech queue processing error:', err.message);
    session.isPlaying = false;
    processSpeechQueue(guildId);
  }
}

/**
 * Builds the EN TTS Interactive Control Panel Embed Payload
 */
function buildControlPanelPayload(session, voiceChannelName) {
  const langObj = LANGUAGES.find((l) => l.value === session.language) || LANGUAGES[0];
  const modelObj = VOICE_MODELS.find((m) => m.value === session.voiceModel) || VOICE_MODELS[0];
  const personaObj = PERSONAS.find((p) => p.value === session.persona) || PERSONAS[0];

  const embed = new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle('🎙️ EN TTS — Interactive Control Panel')
    .setDescription(
      `**Active Voice Channel**: 🔊 \`${voiceChannelName}\`\n\n` +
      `🗣️ **Spoken Language**: \`${langObj.label}\`\n` +
      `🎙️ **Voice Profile**: \`${modelObj.label}\`\n` +
      `🎭 **Character Persona**: \`${personaObj.label}\` (*${personaObj.desc}*)\n\n` +
      `💬 *Type standard messages in this text channel to speak aloud in VC! Messages starting with \`!\` or \`//\` are ignored.*`
    )
    .setFooter({ text: 'ENOS Voice System • Powered by Gemini 2.0' })
    .setTimestamp();

  const rowLang = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tts_select:lang')
      .setPlaceholder('Select Spoken Language...')
      .addOptions(LANGUAGES.map((l) => ({ label: l.label, value: l.value, default: l.value === session.language })))
  );

  const rowModel = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tts_select:model')
      .setPlaceholder('Select Voice Model / Pitch...')
      .addOptions(VOICE_MODELS.map((m) => ({ label: m.label, value: m.value, default: m.value === session.voiceModel })))
  );

  const rowPersona = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tts_select:persona')
      .setPlaceholder('Select Character Persona...')
      .addOptions(PERSONAS.map((p) => ({ label: p.label, value: p.value, description: p.desc, default: p.value === session.persona })))
  );

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tts_btn:come').setLabel('Bring Menu Here (/come)').setStyle(ButtonStyle.Secondary).setEmoji('📍'),
    new ButtonBuilder().setCustomId('tts_btn:leave').setLabel('Disconnect (/leave)').setStyle(ButtonStyle.Danger).setEmoji('🔴')
  );

  return { embeds: [embed], components: [rowLang, rowModel, rowPersona, rowButtons] };
}

/**
 * Joins a Voice Channel and posts the Control Panel card
 */
async function joinVoiceSession(guild, voiceChannel, textChannel, mainClient) {
  const guildId = guild.id;
  let session = activeSessions.get(guildId);

  if (!voiceBotClient || !voiceBotClient.isReady()) {
    return { success: false, message: '❌ Voice Herald Sub-Bot is not online or token is missing.' };
  }

  const voiceGuild = voiceBotClient.guilds.cache.get(guildId);
  if (!voiceGuild) {
    return { success: false, message: '❌ Please invite the Voice Herald Sub-Bot to this server first!' };
  }

  // Connect Voice Herald Client to VC
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: voiceGuild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  if (!session) {
    session = {
      guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: textChannel.id,
      controlMessageId: null,
      language: DEFAULT_SETTINGS.language,
      voiceModel: DEFAULT_SETTINGS.voiceModel,
      persona: DEFAULT_SETTINGS.persona,
      connection,
      player,
      queue: [],
      isPlaying: false,
    };
    activeSessions.set(guildId, session);
  } else {
    session.voiceChannelId = voiceChannel.id;
    session.textChannelId = textChannel.id;
    session.connection = connection;
    session.player = player;
  }

  // Post fresh Control Panel Card
  const payload = buildControlPanelPayload(session, voiceChannel.name);
  const msg = await textChannel.send(payload);
  session.controlMessageId = msg.id;

  return { success: true, message: `✅ Joined Voice Channel **${voiceChannel.name}**!` };
}

/**
 * Relocates the Control Panel to the bottom of text chat (/come)
 */
async function relocateControlPanel(guildId, textChannel) {
  const session = activeSessions.get(guildId);
  if (!session) return { success: false, message: '❌ No active EN TTS voice session in this server. Use `/join` first.' };

  // Delete previous control message if it exists
  if (session.controlMessageId) {
    try {
      const oldMsg = await textChannel.messages.fetch(session.controlMessageId).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    } catch (e) {}
  }

  session.textChannelId = textChannel.id;
  const voiceChannel = textChannel.guild.channels.cache.get(session.voiceChannelId);
  const vcName = voiceChannel ? voiceChannel.name : 'Voice Channel';

  const payload = buildControlPanelPayload(session, vcName);
  const newMsg = await textChannel.send(payload);
  session.controlMessageId = newMsg.id;

  return { success: true, message: '📍 Control Panel moved to bottom of chat!' };
}

/**
 * Leaves the Voice Channel and deletes the Control Panel card (/leave)
 */
async function leaveVoiceSession(guildId) {
  const session = activeSessions.get(guildId);
  if (!session) return { success: false, message: '❌ No active EN TTS voice session in this server.' };

  // Delete control panel card
  if (session.textChannelId && session.controlMessageId) {
    try {
      if (voiceBotClient) {
        const ch = await voiceBotClient.channels.fetch(session.textChannelId).catch(() => null);
        if (ch) {
          const msg = await ch.messages.fetch(session.controlMessageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      }
    } catch (e) {}
  }

  // Disconnect voice connection
  try {
    if (session.connection) {
      session.connection.destroy();
    }
  } catch (e) {}

  activeSessions.delete(guildId);
  return { success: true, message: '🔴 Voice Herald disconnected from Voice Channel.' };
}

/**
 * Queue spoken message when a user types in VC text chat
 */
function queueTextMessage(guildId, textChannelId, rawText) {
  const session = activeSessions.get(guildId);
  if (!session || session.textChannelId !== textChannelId) return;

  // Ignore prefixes
  if (rawText.startsWith('!') || rawText.startsWith('//') || rawText.startsWith('(')) return;

  const cleaned = cleanTextForSpeech(rawText);
  if (!cleaned) return;

  session.queue.push(cleaned);
  processSpeechQueue(guildId);
}

module.exports = {
  initVoiceBot,
  joinVoiceSession,
  relocateControlPanel,
  leaveVoiceSession,
  queueTextMessage,
  buildControlPanelPayload,
  activeSessions,
  LANGUAGES,
  VOICE_MODELS,
  PERSONAS,
};
