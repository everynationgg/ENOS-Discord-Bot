const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase, getFeatureConfig, isFeatureEnabled } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory cooldown tracking to ensure ambient messages don't spam
// Key: `${guildId}:${channelId}` -> Timestamp of last spontaneous/ambient speech
const ambientCooldowns = new Map();

/**
 * Checks if current time falls within quiet hours (format: "HH:MM" 24h).
 * @param {string} start "02:00"
 * @param {string} end "08:00"
 * @returns {boolean}
 */
function isQuietHours(start, end) {
  if (!start || !end) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Crosses midnight
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * Fetches member relationship data and top facts from Supabase.
 * @param {string} guildId
 * @param {string} userId
 */
async function getMemberProfile(guildId, userId) {
  try {
    const { data: rel } = await supabase
      .from('npc_relationships')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    const { data: memories } = await supabase
      .from('npc_member_memories')
      .select('fact, category')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('last_reinforced_at', { ascending: false })
      .limit(5);

    return {
      relationship: rel || { familiarity_tier: 0, interaction_count: 0 },
      facts: memories ? memories.map(m => m.fact) : [],
    };
  } catch (err) {
    logger.warn(`[NPC] Error fetching member profile for ${userId}: ${err.message}`);
    return { relationship: { familiarity_tier: 0, interaction_count: 0 }, facts: [] };
  }
}

/**
 * Fetches server lore items for context.
 * @param {string} guildId
 */
async function getServerLore(guildId) {
  try {
    const { data } = await supabase
      .from('npc_server_lore')
      .select('title, content, category')
      .eq('guild_id', guildId)
      .limit(10);
    return data || [];
  } catch (err) {
    logger.warn(`[NPC] Error fetching server lore for ${guildId}: ${err.message}`);
    return [];
  }
}

/**
 * Updates member relationship interaction count and updates last_spoke_at.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} displayName
 */
async function recordInteraction(guildId, userId, displayName) {
  try {
    const { data: existing } = await supabase
      .from('npc_relationships')
      .select('interaction_count, familiarity_tier')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    const count = (existing?.interaction_count || 0) + 1;
    let tier = existing?.familiarity_tier || 0;

    // Automatic tier progression based on real interaction history
    if (count >= 50 && tier < 3) tier = 3; // Veteran
    else if (count >= 20 && tier < 2) tier = 2; // Regular
    else if (count >= 5 && tier < 1) tier = 1; // Acquaintance

    await supabase
      .from('npc_relationships')
      .upsert({
        guild_id: guildId,
        user_id: userId,
        display_name: displayName,
        interaction_count: count,
        familiarity_tier: tier,
        last_spoke_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id,user_id' });
  } catch (err) {
    logger.error(`[NPC] Failed to record interaction for ${userId}: ${err.message}`);
  }
}

/**
 * Generates an NPC response and deliberation verdict via Gemini Flash.
 */
async function deliberateAndRespond({
  systemPrompt,
  conversationHistory,
  triggerMessage,
  authorName,
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `${systemPrompt}

CONVERSATION HISTORY (RECENT CHAT IN THIS CHANNEL):
${conversationHistory}

LATEST MESSAGE:
[${authorName}]: ${triggerMessage}

DELIBERATION INSTRUCTION:
1. If the user directly mentioned you or called your name ("enos"), you are being spoken to — should_speak must be TRUE and you must provide a natural, dry-witted response.
2. If this is ambient room chatter, evaluate whether to speak (TRUE) or remain quiet (FALSE).
3. If should_speak is TRUE, generate a concise, natural, 1-2 sentence response.
4. Respond ONLY with valid JSON in this exact structure:
{
  "should_speak": true,
  "thought": "Brief internal reason for speaking or staying silent",
  "response": "The exact response to send in chat (or empty string if silent)"
}`;

  const modelsToTry = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (typeof parsed.should_speak === 'boolean') {
        return parsed;
      }
    } catch (err) {
      logger.warn(`[NPC] Model ${modelName} deliberation error: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed');
}

/**
 * Main message handler for the NPC AI Community Member.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
async function handleNpcMessage(message, client) {
  // Ignore bots, DMs, system messages
  if (!message || message.author?.bot || !message.guild || message.system) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const content = message.content?.trim();
  if (!content || content.length < 2) return;

  // 1. Check feature toggle
  const isEnabled = await isFeatureEnabled(guildId, 'npc_companion');
  if (!isEnabled) return;

  const featureConfig = await getFeatureConfig(guildId, 'npc_companion');
  const config = featureConfig?.config || {};

  // 2. Channel Whitelist Check
  const allowedChannels = config.allowed_channel_ids || [];
  if (allowedChannels.length > 0 && !allowedChannels.includes(channelId)) {
    return;
  }

  // 3. Quiet Hours Check
  if (config.quiet_hours_enabled && isQuietHours(config.quiet_hours_start, config.quiet_hours_end)) {
    return;
  }

  // 4. Determine Trigger Type
  const isDirectPing = client.user && message.mentions.has(client.user.id);
  const isNameDropped = /\benos\b/i.test(content);

  let triggerType = null;
  if (isDirectPing) {
    triggerType = 'mention';
  } else if (isNameDropped) {
    triggerType = 'name_drop';
  } else {
    // Ambient chatter check
    const socialEnergy = config.social_energy || 2; // 1 to 5
    const ambientCooldownMin = config.ambient_cooldown_minutes || 20;
    const cooldownKey = `${guildId}:${channelId}`;
    const lastSpoke = ambientCooldowns.get(cooldownKey) || 0;
    const now = Date.now();

    if (now - lastSpoke < ambientCooldownMin * 60 * 1000) {
      return; // Still in cooldown for ambient chatter
    }

    // Dynamic probability: 1 -> 2%, 2 -> 5%, 3 -> 8%, 4 -> 12%, 5 -> 18%
    const ambientProbabilities = [0.02, 0.05, 0.08, 0.12, 0.18];
    const triggerProb = ambientProbabilities[socialEnergy - 1] || 0.05;

    if (Math.random() > triggerProb) {
      return; // Skip ambient trigger
    }

    triggerType = 'ambient_chat';
  }

  // 5. Gather Context
  const authorName = message.member?.displayName || message.author.username;
  const authorId = message.author.id;

  // Working Memory: Last 8 messages
  let conversationHistory = '';
  try {
    const recentMessages = await message.channel.messages.fetch({ limit: 8 });
    const sorted = [...recentMessages.values()].reverse();
    conversationHistory = sorted
      .filter(m => !m.system && m.content)
      .map(m => `[${m.member?.displayName || m.author.username}]: ${m.content.substring(0, 200)}`)
      .join('\n');
  } catch (e) {
    logger.warn(`[NPC] Failed to fetch channel history: ${e.message}`);
  }

  // Member Profile & Relationship
  const profile = await getMemberProfile(guildId, authorId);
  const tierNames = ['Stranger', 'Acquaintance', 'Regular', 'Veteran'];
  const currentTierName = tierNames[profile.relationship.familiarity_tier] || 'Stranger';

  // Server Lore
  const loreItems = await getServerLore(guildId);
  const loreText = loreItems.length > 0
    ? loreItems.map(l => `- [${l.category.toUpperCase()}] ${l.title}: ${l.content}`).join('\n')
    : 'No specific lore recorded yet.';

  // Build System Persona Prompt
  const sarcasmLevel = config.sarcasm_level || 3;
  const brevity = config.response_brevity || 'balanced';

  let systemPrompt = `You are ENOS, an observant, calm, and dry-witted community member in the Every Nation Discord server.

CORE CHARACTER IDENTITY:
- You are a veteran community regular who lives in this server.
- You speak casually like a real gamer on Discord (lowercase-friendly, dry humor, direct).
- You care about the server's vibe, banter, and gaming camaraderie.
- You are NOT an emotional therapist. Do NOT give cheesy support speeches or advice.
- You are NOT a sellout or system mascot. NEVER mention Vault coins, taxes, or promote server features unprompted.
- NEVER ping @everyone, @here, or any Discord roles under any circumstance.
- Respect your familiarity level with the person talking to you.

CURRENT SPEAKER CONTEXT:
- Speaker: ${authorName} (ID: ${authorId})
- Familiarity Tier: ${currentTierName} (Level ${profile.relationship.familiarity_tier}/3)
- Known Facts About Speaker: ${profile.facts.length > 0 ? profile.facts.join('; ') : 'None yet (new/stranger)'}

SERVER LORE & COMMUNITY MEMORY:
${loreText}

TONE & STYLE SETTINGS:
- Sarcasm/Banter Level: ${sarcasmLevel}/5 (1: chill & grounded, 3: dry wit & teasing, 5: sharp roaster)
- Brevity Mode: ${brevity} (Keep responses strictly 1-2 punchy sentences)
- Trigger Context: ${triggerType === 'mention' ? 'Direct mention' : triggerType === 'name_drop' ? 'Name mentioned without @' : 'Ambient room chatter'}`;

  // 6. Deliberate and Respond
  try {
    // Show brief typing indicator if direct mention or name drop
    if (triggerType === 'mention' || triggerType === 'name_drop') {
      message.channel.sendTyping().catch(() => {});
    }

    const decision = await deliberateAndRespond({
      systemPrompt,
      conversationHistory,
      triggerMessage: content,
      authorName,
    });

    // Ephemeral log to database (safe non-blocking)
    try {
      await supabase.from('npc_deliberation_logs').insert({
        guild_id: guildId,
        channel_id: channelId,
        trigger_type: triggerType,
        trigger_message: content.substring(0, 300),
        author_id: authorId,
        should_speak: decision.should_speak,
        internal_thought: decision.thought || null,
        generated_response: decision.response || null,
      });
    } catch (e) {
      logger.warn(`[NPC] Log error: ${e.message}`);
    }

    if (decision.should_speak && decision.response && decision.response.trim().length > 0) {
      const replyContent = decision.response.trim();

      // Send inline reply to the user's message
      await message.reply({
        content: replyContent,
        allowedMentions: { repliedUser: true, parse: [] } // NEVER parse @everyone or roles
      });

      // Update cooldown for this channel
      ambientCooldowns.set(`${guildId}:${channelId}`, Date.now());

      // Update relationship & interaction count
      await recordInteraction(guildId, authorId, authorName);
    }
  } catch (err) {
    logger.error(`[NPC] Deliberation error for guild ${guildId}: ${err.message}`);
  }
}

/**
 * Handles /enos forget-me privacy command.
 * Purges all relationship data and memories for a member.
 */
async function forgetMember(guildId, userId) {
  try {
    await supabase
      .from('npc_relationships')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    await supabase
      .from('npc_member_memories')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    return { success: true };
  } catch (err) {
    logger.error(`[NPC] Error forgetting user ${userId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves a user's current status and relationship tier with ENOS.
 */
async function getMemberStatus(guildId, userId) {
  return getMemberProfile(guildId, userId);
}

module.exports = {
  handleNpcMessage,
  forgetMember,
  getMemberStatus,
};
