const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const logger = require('../../lib/logger');
const { supabase } = require('../../lib/supabase');

/**
 * Handles the reward claim button click for a showcase update.
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
 * Handles feedback modal submission.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleShowcaseFeedbackSubmit(interaction) {
  try {
    const showcaseId = interaction.customId.replace('showcase_feedback_modal:', '');
    const feedbackText = interaction.fields.getTextInputValue('feedback_text');
    const guildId = interaction.guildId || process.env.DISCORD_GUILD_ID;

    await supabase.from('showcase_feedback').insert({
      showcase_id: showcaseId,
      guild_id: guildId,
      user_id: interaction.user.id,
      user_tag: interaction.user.tag || interaction.user.username,
      feedback_text: feedbackText.trim(),
    });

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
 * Handles dropdown select menu selections from feature showcase updates.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleShowcaseSelectMenu(interaction) {
  try {
    const selected = interaction.values[0];

    let embedData = {
      title: '📖 ENOS Feature Guide',
      description: 'Select an option from the dropdown menu to view feature details.',
      color: 0x6366f1,
    };

    if (selected === 'rpg_boss') {
      embedData = {
        title: '⚔️ Weekly World Boss RPG System & 5-Stat Skill Tree',
        color: 0xef4444,
        description:
          '**How to Play**:\n' +
          '• Use `/boss attack` in `#weekly-boss` to attack the server raid boss.\n' +
          '• **3 Playable Classes**:\n' +
          '  - 🛡️ **M.O.M.** (Tank / Shielding Barrier)\n' +
          '  - 🔨 **D.A.D.** (Heavy Brawler DPS)\n' +
          '  - ⚡ **K.I.D.** (Speed / AP Synergy)\n' +
          '• **5-Attribute Skill Tree**: Level up to gain points and allocate into **DMG**, **Crit Chance**, **AP Save**, **XP Boost**, and **Loot Boost**!\n' +
          '• **Commands**: `/boss attack`, `/boss stats`, `/boss leaderboard`.',
      };
    } else if (selected === 'trivia') {
      embedData = {
        title: '🧠 Daily AI Trivia Drops & Speed Scoring',
        color: 0xf59e0b,
        description:
          '**How it Works**:\n' +
          '• ENOS drops a daily AI-generated question in weighted server channels.\n' +
          '• **Anti-Cheat Shuffling**: Every player gets a private, shuffled answer order so choices cannot be shared in voice chat!\n' +
          '• **Microsecond Speed Scoring**: Quick answers score top podium points.\n' +
          '• **Commands**: `/trivia status`, `/trivia leaderboard`.',
      };
    } else if (selected === 'vault') {
      embedData = {
        title: '💰 Vault Economy & Voice Activity Leveling',
        color: 0x10b981,
        description:
          '**How it Works**:\n' +
          '• **Voice Coins**: Earn Vault Coins automatically for every minute spent hanging out in server voice channels.\n' +
          '• **Tier Ranks**: Advance through Bronze → Silver → Gold → Diamond → Mythic.\n' +
          '• **Daily Quests**: Complete daily tasks using `/vault daily` to claim bonus coin crates.\n' +
          '• **Commands**: `/vault balance`, `/vault daily`, `/vault leaderboard`.',
      };
    } else if (selected === 'gatekeeper') {
      embedData = {
        title: '🔐 Gatekeeper Onboarding & Keyform Whitelists',
        color: 0x6366f1,
        description:
          '**How it Works**:\n' +
          '• **Gatekeeper**: New joiners complete a fast sign-up modal logging their In-Game Name (IGN), Discovery Source, and Game Branch roles.\n' +
          '• **Keyform Whitelists**: One-click whitelist application for community game servers (*Palworld, Where Winds Meet, BG3, etc.*).\n' +
          '• **Commands**: `/register-keyform`.',
      };
    } else if (selected === 'ai_digest') {
      embedData = {
        title: '🤖 Taglish AI Daily Digest & Support Help Desk',
        color: 0xec4899,
        description:
          '**How it Works**:\n' +
          '• **Daily Digest**: Every 24 hours, Gemini AI scrapes server channels to generate a Taglish summary digest of top conversations.\n' +
          '• **AI Help Desk**: Click `[🤖 Get AI Help]` in support channels to spawn a private AI thread that answers FAQs and server rules instantly.',
      };
    } else if (selected === 'social') {
      embedData = {
        title: '🎂 Social Systems (Birthdays & TikTok Live Alerts)',
        color: 0x8b5cf6,
        description:
          '**How it Works**:\n' +
          '• **Birthdays**: Log your birthday during onboarding or via `/birthday` to get automated daily birthday announcements & custom card graphics.\n' +
          '• **TikTok Live Alerts**: Automatic alerts dropped when community creators go live.',
      };
    }

    return interaction.reply({
      embeds: [embedData],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error('[SHOWCASE SELECT MENU ERROR]:', err);
    return interaction.reply({
      content: '❌ Failed to load feature guide.',
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
