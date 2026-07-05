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

    // Construct system instructions with FAQ cards
    let systemPrompt = config.ai_system_prompt || 'You are a helpful customer support bot.';
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

    // Initialize Gemini model with instructions
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({
      history: formattedHistory
    });

    const response = await chat.sendMessage(message.content);
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
    await thread.send('⚠️ I encountered an error formulating a reply. Please try again or ask an admin.');
  }
}

module.exports = {
  handleHelpDeskStart,
  handleHelpDeskClose,
  handleHelpDeskChatMessage
};
