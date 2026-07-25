const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const logger = require('../../lib/logger');
const { supabase } = require('../../lib/supabase');

/**
 * Handles reward claim button click for a showcase update.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleShowcaseClaim(interaction) {
  try {
    const showcaseId = interaction.customId.replace('showcase_claim_', '');
    const userId = interaction.user.id;
    const guildId = interaction.guildId || process.env.DISCORD_GUILD_ID;

    // Fetch showcase update details
    const { data: showcase, error: scErr } = await supabase
      .from('showcase_updates')
      .select('reward_coins')
      .eq('id', showcaseId)
      .maybeSingle();

    if (scErr || !showcase) {
      return interaction.reply({
        content: '⚠️ Unable to locate this update record in the database.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const rewardCoins = showcase.reward_coins || 50;

    // Check if user already claimed
    const { data: existingClaim } = await supabase
      .from('showcase_claims')
      .select('id')
      .eq('showcase_id', showcaseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingClaim) {
      return interaction.reply({
        content: `⚠️ You have already claimed the **+${rewardCoins} Vault Coins** bonus for this update!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Insert claim record
    const { error: claimErr } = await supabase.from('showcase_claims').insert({
      showcase_id: showcaseId,
      guild_id: guildId,
      user_id: userId,
      coins_awarded: rewardCoins,
    });

    if (claimErr) {
      logger.error('[SHOWCASE CLAIM ERROR]:', claimErr.message);
      return interaction.reply({
        content: '❌ Failed to register your reward claim. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Update user's Vault coins balance
    const { data: currentVault } = await supabase
      .from('vault_balances')
      .select('coins')
      .eq('guild_id', guildId)
      .eq('discord_id', userId)
      .maybeSingle();

    const newCoins = (currentVault?.coins || 0) + rewardCoins;

    await supabase.from('vault_balances').upsert(
      {
        guild_id: guildId,
        discord_id: userId,
        coins: newCoins,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'guild_id,discord_id' }
    );

    return interaction.reply({
      content: `🎁 **Reward Claimed!** You received **+${rewardCoins} Vault Coins** for reading our server update.\nYour new Vault balance is **${newCoins.toLocaleString()} coins**.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error('[SHOWCASE CLAIM EXCEPTION]:', err);
    return interaction.reply({
      content: '❌ An error occurred while processing your reward claim.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Shows feedback modal when user clicks "Send Feedback".
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleShowcaseFeedbackButton(interaction) {
  try {
    const showcaseId = interaction.customId.replace('showcase_feedback_', '');

    const modal = new ModalBuilder()
      .setCustomId(`showcase_feedback_modal:${showcaseId}`)
      .setTitle('Server Update Feedback');

    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback_text')
      .setLabel('Your Thoughts / Suggestions')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('What do you think of this new feature or update?')
      .setRequired(true)
      .setMaxLength(1000);

    const row = new ActionRowBuilder().addComponents(feedbackInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  } catch (err) {
    logger.error('[SHOWCASE FEEDBACK BUTTON ERROR]:', err);
    return interaction.reply({
      content: '❌ Failed to open feedback form.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles feedback modal submission and dispatches embed to private admin feedback channel.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleShowcaseFeedbackSubmit(interaction) {
  try {
    const showcaseId = interaction.customId.replace('showcase_feedback_modal:', '');
    const feedbackText = interaction.fields.getTextInputValue('feedback_text');
    const guildId = interaction.guildId || process.env.DISCORD_GUILD_ID;
    const userTag = interaction.user.tag || interaction.user.username;

    // 1. Save feedback to database
    await supabase.from('showcase_feedback').insert({
      showcase_id: showcaseId,
      guild_id: guildId,
      user_id: interaction.user.id,
      user_tag: userTag,
      feedback_text: feedbackText.trim(),
    });

    // 2. Fetch showcase details to find feedback_channel_id
    const { data: showcase } = await supabase
      .from('showcase_updates')
      .select('title, feedback_channel_id')
      .eq('id', showcaseId)
      .maybeSingle();

    // 3. Post to private admin feedback channel if configured
    if (showcase && showcase.feedback_channel_id) {
      const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
      if (DISCORD_TOKEN) {
        const feedbackEmbed = {
          title: '💬 New Member Feedback Received',
          color: 0x10b981, // Emerald Green
          fields: [
            { name: '👤 Member', value: `<@${interaction.user.id}> (${userTag})`, inline: true },
            { name: '📌 Showcase Update', value: showcase.title || 'Server Update', inline: true },
            { name: '✍️ Feedback Message', value: feedbackText.trim() },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'ENOS Moderation • Private Admin Feedback Log' },
        };

        await fetch(
          `https://discord.com/api/v10/channels/${showcase.feedback_channel_id.trim()}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [feedbackEmbed] }),
          }
        ).catch((err) => logger.error('[SEND ADMIN FEEDBACK DISCORD ERROR]:', err));
      }
    }

    return interaction.reply({
      content: '💬 **Thank you for your feedback!** Your message has been sent to our moderation team.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error('[SHOWCASE FEEDBACK SUBMIT ERROR]:', err);
    return interaction.reply({
      content: '❌ Failed to save your feedback.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles dynamic select menu clicks and rerolls ephemeral feature guide cards with hero photos.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleShowcaseSelectMenu(interaction) {
  try {
    const showcaseId = interaction.customId.replace('showcase_select_', '');
    const selectedItemId = interaction.values[0];
    const guildId = interaction.guildId || process.env.DISCORD_GUILD_ID;

    // Fetch showcase update details from database
    const { data: showcase, error: scErr } = await supabase
      .from('showcase_updates')
      .select('*')
      .eq('id', showcaseId)
      .maybeSingle();

    if (scErr || !showcase) {
      return interaction.reply({
        content: '⚠️ Unable to locate this update record in the database.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const items = Array.isArray(showcase.dropdown_items) ? showcase.dropdown_items : [];
    const targetItem = items.find(
      (it) => it.id === selectedItemId || it.label === selectedItemId
    );

    if (!targetItem) {
      return interaction.reply({
        content: '⚠️ Selected update details could not be found.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Build Ephemeral Embed with Hero Photo
    const embed = {
      title: targetItem.label,
      description: targetItem.content_markdown || 'No additional details specified.',
      color: 0x6366f1, // Indigo
      footer: { text: 'ENOS Bot Feature Showcase • Interactive Update Guide' },
      timestamp: new Date().toISOString(),
    };

    if (targetItem.hero_image_url && targetItem.hero_image_url.trim()) {
      embed.image = { url: targetItem.hero_image_url.trim() };
    }

    // Build Ephemeral Action Buttons (Per-item overrides global)
    const buttons = [];

    const targetChannel = (targetItem.try_channel_id || showcase.try_feature_channel || '').trim();
    const targetButtonLabel = (targetItem.try_button_label || '🚀 Try Feature Now').trim();
    const targetVideoUrl = (targetItem.video_url || showcase.video_url || '').trim();

    if (targetChannel) {
      buttons.push({
        type: 2,
        style: 5, // LINK
        label: targetButtonLabel,
        url: `https://discord.com/channels/${guildId}/${targetChannel}`,
      });
    }

    if (targetVideoUrl) {
      buttons.push({
        type: 2,
        style: 5, // LINK
        label: '🎥 Watch Video Guide',
        url: targetVideoUrl,
      });
    }

    if (Number(showcase.reward_coins) > 0) {
      buttons.push({
        type: 2,
        style: 3, // SUCCESS
        custom_id: `showcase_claim_${showcaseId}`,
        label: `🎁 Claim +${showcase.reward_coins} Vault Coins`,
      });
    }

    buttons.push({
      type: 2,
      style: 2, // SECONDARY
      custom_id: `showcase_feedback_${showcaseId}`,
      label: '💬 Send Feedback',
    });

    const components = [];
    if (buttons.length > 0) {
      components.push({ type: 1, components: buttons });
    }

    // Seamless Reroll: If interaction has already replied/deferred or is component, update or reply ephemeral
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error('[SHOWCASE SELECT MENU ERROR]:', err);
    return interaction.reply({
      content: '❌ Failed to load update details.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = {
  handleShowcaseClaim,
  handleShowcaseFeedbackButton,
  handleShowcaseFeedbackSubmit,
  handleShowcaseSelectMenu,
};
