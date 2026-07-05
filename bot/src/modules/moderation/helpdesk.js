const { 
  ChannelType, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder 
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFeatureConfig } = require('../../lib/supabase');
const logger = require('../../lib/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Handles the "Start Chat" button click.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleHelpDeskStart(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) return;

  try {
    const featureConfig = await getFeatureConfig(guild.id, 'help_desk');
    const isEnabled = featureConfig?.enabled || false;

    if (!isEnabled) {
      await interaction.editReply({ content: '❌ The AI Help Desk is currently disabled for this server.' });
      return;
    }

    // Create Private Thread under the current channel
    const thread = await interaction.channel.threads.create({
      name: `💬-${interaction.user.username}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread,
      reason: `AI Help Desk support session for ${interaction.user.tag}`
    });

    // Add user to the thread
    await thread.members.add(interaction.user.id);

    // Send welcome embed and Close button inside the thread
    const welcomeEmbed = {
      title: '🤖 AI Support Session Started',
      description: `Welcome <@${interaction.user.id}>! I am your AI assistant. How can I help you today?\n\n*When you are finished, click the **Close Chat** button below to delete this channel and save the transcript.*`,
      color: 9133302, // 0x8B5CF6 (Electric Violet)
      timestamp: new Date().toISOString()
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('helpdesk_close')
        .setLabel('Close Chat')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await thread.send({ embeds: [welcomeEmbed], components: [row] });

    // Confirm to the user
    await interaction.editReply({ content: `✅ Private support thread created here: <#${thread.id}>!` });

    // Auto-delete the ephemeral reply after 15 seconds
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 15000);

  } catch (err) {
    logger.error('[HELPDESK] Failed to start session:', err.message);
    await interaction.editReply({ content: '❌ Failed to open a private support thread. Please contact an admin.' });
  }
}

/**
 * Handles the "Close Chat" button click.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleHelpDeskClose(interaction) {
  const thread = interaction.channel;
  if (!thread || !thread.isThread()) return;

  await interaction.deferUpdate().catch(() => {});

  try {
    // 1. Fetch messages for transcript compilation
    const messages = await thread.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    let transcript = `==================================================\n`;
    transcript += `         ENOS AI SUPPORT DESK TRANSCRIPT          \n`;
    transcript += `==================================================\n`;
    transcript += `Thread Name: ${thread.name} (${thread.id})\n`;
    transcript += `Guild ID:    ${thread.guildId}\n`;
    transcript += `Closed At:   ${new Date().toISOString()}\n`;
    transcript += `==================================================\n\n`;

    for (const msg of sorted) {
      // Ignore bot welcome templates or buttons
      if (msg.author.bot && (msg.embeds.length > 0 || msg.components.length > 0)) continue;
      const timestamp = msg.createdAt.toISOString().replace('T', ' ').substring(0, 19);
      const sender = msg.author.tag;
      const content = msg.content || (msg.attachments.size > 0 ? '[Attachment]' : '[System Message]');
      transcript += `[${timestamp}] ${sender}: ${content}\n`;
    }

    const buffer = Buffer.from(transcript, 'utf-8');
    const fileAttachment = new AttachmentBuilder(buffer, { name: `transcript-${thread.id}.txt` });

    // 2. Fetch config to find log channel
    const featureConfig = await getFeatureConfig(thread.guildId, 'help_desk');
    const logChannelId = featureConfig?.config?.transcript_channel_id;

    if (logChannelId) {
      const logChannel = await thread.guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel) {
        const authorName = thread.name.replace('💬-', '');
        await logChannel.send({
          content: `🔒 **Support Session Closed**: \`${thread.name}\` (User: \`${authorName}\`) has been closed. Attached is the chat transcript.`,
          files: [fileAttachment]
        }).catch(() => {});
      }
    }

    // 3. Send goodbye and delete thread
    await thread.send({ content: '👋 Thank you for using the AI Help Desk. Closing this channel...' }).catch(() => {});
    setTimeout(async () => {
      await thread.delete('Support thread closed').catch(() => {});
    }, 3000);

  } catch (err) {
    logger.error('[HELPDESK] Failed to close session:', err.message);
    // Fallback deletion to keep server clean
    await thread.delete('Support thread closed (force)').catch(() => {});
  }
}

/**
 * Handles incoming messages inside Help Desk private threads.
 * @param {import('discord.js').Message} message
 */
async function handleHelpDeskChatMessage(message) {
  const guildId = message.guild.id;
  const thread = message.channel;

  // Show typing indicator
  await thread.sendTyping().catch(() => {});

  try {
    const featureConfig = await getFeatureConfig(guildId, 'help_desk');
    const config = featureConfig?.config || {};

    if (!process.env.GEMINI_API_KEY) {
      await thread.send('❌ AI Support Assistant is currently offline (GEMINI_API_KEY is not configured).');
      return;
    }

    // Fetch message history for context
    const messages = await thread.messages.fetch({ limit: 15 });
    const sorted = [...messages.values()].reverse();

    // Fetch live guild updates to ensure member count and structures are fully accurate
    const guild = message.guild;
    try {
      await guild.fetch();
    } catch (e) {
      logger.warn('[HELPDESK] Failed to fetch live guild updates:', e.message);
    }

    let guildContext = `\n\nLive Server Context Details for the server "${guild.name}":\n`;
    guildContext += `- Server Name: ${guild.name}\n`;
    guildContext += `- Total Server Members (live): ${guild.memberCount}\n`;

    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) {
      guildContext += `- Server Owner: ${owner.user.tag} (ID: ${owner.user.id})\n`;
    }

    // List server text, announcement, and voice channels for context referencing
    const channelList = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 2 || c.type === 5)
      .map(c => {
        const typeStr = c.type === 2 ? 'Voice' : 'Text';
        const prefix = c.type === 2 ? '🔊 ' : '#';
        return `  * ${prefix}${c.name} (${typeStr}): <#${c.id}>`;
      })
      .slice(0, 150) // High limit to cover all channels without truncation
      .join('\n');
    if (channelList) {
      guildContext += `- Available Channels list (you should mention channels in your response using the exact format <#channel_id> so they render as clickable channel links in Discord):\n${channelList}\n`;
    }

    // Retrieve available slash commands for ENOS bot
    const client = message.client;
    if (client.commands && client.commands.size > 0) {
      const commandHelp = client.commands
        .map(cmd => `  * /${cmd.data.name}: ${cmd.data.description || 'No description.'}`)
        .join('\n');
      guildContext += `- Available ENOS Slash Commands:\n${commandHelp}\n`;
    }

    // Retrieve active configuration contexts
    const gatekeeperConfig = await getFeatureConfig(guildId, 'gatekeeper');
    if (gatekeeperConfig?.enabled) {
      guildContext += `- Gatekeeper Onboarding is ACTIVE.\n`;
      if (gatekeeperConfig.config?.landing_channel_id) {
        guildContext += `  * Landing / Entry Channel: <#${gatekeeperConfig.config.landing_channel_id}>\n`;
      }
    }

    const vaultConfig = await getFeatureConfig(guildId, 'vault');
    if (vaultConfig?.enabled) {
      guildContext += `- Vault Coins Economy is ACTIVE. Members earn vault coins by sending messages in active text channels.\n`;
    }

    // Construct system instructions with FAQ cards and live context
    let systemPrompt = config.ai_system_prompt || 'You are a helpful customer support bot.';
    systemPrompt += guildContext;

    const faqList = config.faq_list || [];
    if (faqList.length > 0) {
      systemPrompt += '\n\nUse the following Server FAQ list to answer the user\'s questions about this server accurately:\n';
      faqList.forEach((faq, index) => {
        systemPrompt += `Card #${index + 1}:\nQuestion: ${faq.question}\nAnswer: ${faq.answer}\n\n`;
      });
    }

    // Format historical messages for Gemini chat structure
    const formattedHistory = [];
    const historyPool = sorted.slice(0, -1);

    for (const msg of historyPool) {
      if (msg.system || (msg.author.bot && (msg.embeds.length > 0 || msg.components.length > 0))) continue;
      if (!msg.content || !msg.content.trim()) continue;

      formattedHistory.push({
        role: msg.author.bot ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    let modelName = 'gemini-2.5-flash';
    let model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt
    });

    let chat = model.startChat({
      history: formattedHistory
    });

    let response;
    try {
      response = await chat.sendMessage(message.content);
    } catch (apiErr) {
      const isQuotaErr = apiErr.message.includes('quota') || apiErr.message.includes('429') || apiErr.message.includes('Quota');
      if (isQuotaErr) {
        logger.warn('[HELPDESK] gemini-2.5-flash quota exceeded. Attempting self-healing fallback to gemini-1.5-flash...');
        modelName = 'gemini-1.5-flash';
        model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt
        });
        chat = model.startChat({
          history: formattedHistory
        });
        response = await chat.sendMessage(message.content);
      } else {
        throw apiErr;
      }
    }

    const replyText = response.response.text();

    if (replyText && replyText.trim()) {
      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1950}/g) || [replyText];
        for (const chunk of chunks) {
          await thread.send(chunk);
        }
      } else {
        await thread.send(replyText);
      }
    } else {
      await thread.send('I am here to help. What else can I assist you with?');
    }

  } catch (err) {
    logger.error('[HELPDESK] Chatbot error:', err.message);
    if (err.message.includes('quota') || err.message.includes('429') || err.message.includes('Quota')) {
      await thread.send('⚠️ **Gemini API Limit Reached**: The bot has temporarily exceeded the Google Gemini API free-tier request quota. Please wait a bit before asking again, or contact an administrator to link a pay-as-you-go key (which is extremely low cost!).');
    } else {
      await thread.send('⚠️ I encountered an error formulating a reply. Please try again or ask an admin.');
    }
  }
}

module.exports = {
  handleHelpDeskStart,
  handleHelpDeskClose,
  handleHelpDeskChatMessage
};
