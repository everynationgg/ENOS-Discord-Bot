const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonStyle,
  ButtonBuilder,
} = require('discord.js');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// ─── Game Branch Options ───────────────────────────────────────────────────────
const GAME_BRANCHES = [
  'Where Winds Meet', 'Palworld', 'Wuwa', 'Hoyoverse', 'Enfi',
  'POE', 'BG3', 'D4', 'Minecraft', 'Phasmo', 'REPO', 'PEAK',
  'Subnautica 2', 'Devour', 'Demonologist', 'Valorant', 'CS2',
  'COD', 'HoK', 'ML', 'LOL', 'Others',
];

// ─── Discovery Sources ─────────────────────────────────────────────────────────
const DISCOVERY_SOURCES = [
  'TikTok Content',
  'Discord Server Discovery',
  'Streamer Community',
  'YouTube Recommendation',
  'Word of Mouth',
];

const MONTHS = [
  { name: 'January ❄️', value: '01' },
  { name: 'February 💖', value: '02' },
  { name: 'March 🍀', value: '03' },
  { name: 'April 🌸', value: '04' },
  { name: 'May 🌼', value: '05' },
  { name: 'June ☀️', value: '06' },
  { name: 'July 🏖️', value: '07' },
  { name: 'August 🍉', value: '08' },
  { name: 'September 🍂', value: '09' },
  { name: 'October 🎃', value: '10' },
  { name: 'November 🦃', value: '11' },
  { name: 'December 🎄', value: '12' },
];

const DAYS_1_15 = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0'));
const DAYS_16_31 = Array.from({ length: 16 }, (_, i) => String(i + 16).padStart(2, '0'));

function getMonthName(value) {
  return MONTHS.find(m => m.value === value)?.name || value;
}

// Temporary in-memory store for partial verification data (pending dropdowns)
// Key: userId, Value: { indianName, ign, birthday, birthMonth, birthDay, step }
const pendingVerifications = new Map();

/**
 * Step 1 — Opens the verification modal when user clicks "Verify Here"
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVerifyButton(interaction) {
  // Check if already verified in Discord (checks if they have the verified role)
  const featureConfig = await getFeatureConfig(interaction.guild.id, 'gatekeeper');
  const config = featureConfig?.config || {};
  const verifiedRoleId = config.verified_role_id;

  const hasVerifiedRole = verifiedRoleId && interaction.member.roles.cache.has(verifiedRoleId);

  if (hasVerifiedRole) {
    return interaction.reply({
      content: '✅ You are already verified!',
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('Every Nation — Member Registration');

  const indianNameInput = new TextInputBuilder()
    .setCustomId('indian_name')
    .setLabel('Discord Nickname *')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your preferred server nickname')
    .setRequired(true)
    .setMaxLength(32);

  const ignInput = new TextInputBuilder()
    .setCustomId('ign')
    .setLabel('In-Game Name(s) (IGN)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Optional — one per line, e.g.:\nValorant: Nickname#1234\nWuwa: Rover#5678')
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(indianNameInput),
    new ActionRowBuilder().addComponents(ignInput)
  );

  await interaction.showModal(modal);
}

/**
 * Step 2 — Stores partial data, sends ephemeral Birthday selection dropdowns
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleVerifyModalSubmit(interaction) {
  const indianName = interaction.fields.getTextInputValue('indian_name').trim();
  const ign = interaction.fields.getTextInputValue('ign').trim() || null;

  // Store partial data pending dropdown selections, start with birthday step
  const pending = { indianName, ign, birthday: null, birthMonth: null, birthDay: null, step: 'birthday' };
  pendingVerifications.set(interaction.user.id, pending);

  await sendBirthdayStep(interaction, pending);
}

/**
 * Renders the birthday selection step (ephemeral message with select menus)
 */
async function sendBirthdayStep(interaction, pending) {
  const monthSelect = new StringSelectMenuBuilder()
    .setCustomId('verify_birth_month')
    .setPlaceholder(pending.birthMonth ? `Month: ${getMonthName(pending.birthMonth)}` : '📅 Select Month')
    .addOptions(
      MONTHS.map(m => new StringSelectMenuOptionBuilder().setLabel(m.name).setValue(m.value))
    );

  const day1Select = new StringSelectMenuBuilder()
    .setCustomId('verify_birth_day_1')
    .setPlaceholder(pending.birthDay && parseInt(pending.birthDay) <= 15 ? `Day: ${pending.birthDay}` : '📅 Select Day (1-15)')
    .addOptions(
      DAYS_1_15.map(d => new StringSelectMenuOptionBuilder().setLabel(`Day ${d}`).setValue(d))
    );

  const day2Select = new StringSelectMenuBuilder()
    .setCustomId('verify_birth_day_2')
    .setPlaceholder(pending.birthDay && parseInt(pending.birthDay) > 15 ? `Day: ${pending.birthDay}` : '📅 Select Day (16-31)')
    .addOptions(
      DAYS_16_31.map(d => new StringSelectMenuOptionBuilder().setLabel(`Day ${d}`).setValue(d))
    );

  const confirmButton = new ButtonBuilder()
    .setCustomId('verify_birthday_confirm')
    .setLabel('✅ Confirm Birthday')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!pending.birthMonth || !pending.birthDay);

  const skipButton = new ButtonBuilder()
    .setCustomId('verify_birthday_skip')
    .setLabel('⏭️ Skip Birthday')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(monthSelect);
  const row2 = new ActionRowBuilder().addComponents(day1Select);
  const row3 = new ActionRowBuilder().addComponents(day2Select);
  const row4 = new ActionRowBuilder().addComponents(confirmButton, skipButton);

  const content = `📅 **Step 2 of 4** — Please select your Birthday (Month & Day):
${pending.birthMonth ? `• **Month**: ${getMonthName(pending.birthMonth)}` : '• *Month not selected*'}
${pending.birthDay ? `• **Day**: ${pending.birthDay}` : '• *Day not selected*'}`;

  if (interaction.isModalSubmit()) {
    await interaction.reply({
      content,
      components: [row1, row2, row3, row4],
      ephemeral: true,
    });
  } else {
    await interaction.update({
      content,
      components: [row1, row2, row3, row4],
    });
  }
}

async function handleBirthMonthSelect(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  pending.birthMonth = interaction.values[0];
  pendingVerifications.set(interaction.user.id, pending);

  await sendBirthdayStep(interaction, pending);
}

async function handleBirthDaySelect(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  pending.birthDay = interaction.values[0];
  pendingVerifications.set(interaction.user.id, pending);

  await sendBirthdayStep(interaction, pending);
}

async function handleBirthdayConfirm(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  pending.birthday = `${pending.birthMonth}/${pending.birthDay}`;
  pending.step = 'discovery';
  pendingVerifications.set(interaction.user.id, pending);

  await sendDiscoveryStep(interaction);
}

async function handleBirthdaySkip(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  pending.birthday = null;
  pending.step = 'discovery';
  pendingVerifications.set(interaction.user.id, pending);

  await sendDiscoveryStep(interaction);
}

/**
 * Step 3 — Sends discovery source dropdown
 */
async function sendDiscoveryStep(interaction) {
  const discoverySelect = new StringSelectMenuBuilder()
    .setCustomId('verify_discovery')
    .setPlaceholder('Where did you find us? *')
    .addOptions(
      DISCOVERY_SOURCES.map(source =>
        new StringSelectMenuOptionBuilder().setLabel(source).setValue(source)
      )
    );

  await interaction.update({
    content: '🔍 **Step 3 of 4** — Where did you find us?',
    components: [new ActionRowBuilder().addComponents(discoverySelect)],
  });
}

/**
 * Step 3a — Stores discovery source, sends game branch dropdown
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleDiscoverySelect(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  pending.discoverySource = interaction.values[0];
  pending.step = 'game_branch';
  pendingVerifications.set(interaction.user.id, pending);

  const gameBranchSelect = new StringSelectMenuBuilder()
    .setCustomId('verify_game_branch')
    .setPlaceholder('Select your Primary Game Branch *')
    .addOptions(
      GAME_BRANCHES.map(game =>
        new StringSelectMenuOptionBuilder().setLabel(game).setValue(game)
      )
    );

  await interaction.update({
    content: '🌿 **Step 4 of 4** — Select your Primary Game Branch:',
    components: [new ActionRowBuilder().addComponents(gameBranchSelect)],
  });
}

/**
 * Step 4 — Completes verification: writes DB, grants roles, syncs nickname
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleGameBranchSelect(interaction) {
  const pending = pendingVerifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '❌ Session expired. Please click Verify Here again.', ephemeral: true });
  }

  const gameBranch = interaction.values[0];
  const { indianName, ign, birthday, discoverySource } = pending;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  await interaction.deferUpdate();

  try {
    // 1. Write to Supabase
    const { error: dbError } = await supabase.from('verified_members').upsert(
      {
        discord_id: userId,
        guild_id: guildId,
        indian_name: indianName,
        discovery_source: discoverySource,
        ign,
        game_branch: gameBranch,
        birthday,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'discord_id,guild_id' }
    );

    if (dbError) throw new Error(dbError.message);

    // 2. Fetch feature config for role IDs
    const featureConfig = await getFeatureConfig(guildId, 'gatekeeper');
    const config = featureConfig?.config || {};
    const entryRoleId = config.entry_role_id;
    const verifiedRoleId = config.verified_role_id;

    const member = interaction.member;

    // 3. Strip entry role
    if (entryRoleId && member.roles.cache.has(entryRoleId)) {
      await member.roles.remove(entryRoleId);
    }

    // 4. Grant verified role
    if (verifiedRoleId) {
      await member.roles.add(verifiedRoleId);
    }

    // 5. Sync nickname
    try {
      await member.setNickname(indianName.substring(0, 32));
    } catch {
      // Bot may lack permission to change owner's nickname — non-fatal
      logger.warn(`[VERIFICATION] Could not set nickname for ${interaction.user.tag}`);
    }

    // 6. Clean up pending state
    pendingVerifications.delete(userId);

    // 7. Log event
    await logBotEvent(guildId, 'verification', userId, { indianName, gameBranch, discoverySource });

    // 7.5. Send verification details to log channel
    const logChannelId = config.log_channel_id;
    if (logChannelId) {
      try {
        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x8B5CF6)
            .setTitle('📥 Member Verified')
            .setDescription(`Member <@${userId}> has successfully verified!`)
            .addFields(
              { name: '👤 Discord Nickname', value: indianName, inline: true },
              { name: '🎂 Birthday', value: birthday || 'Not provided', inline: true },
              { name: '🌿 Primary Game Branch', value: gameBranch, inline: true },
              { name: '🔍 Discovery Source', value: discoverySource, inline: true },
              { name: '🎮 In-Game Name(s) (IGN)', value: ign || 'Not provided', inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
            .setFooter({ text: `ID: ${userId}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        } else {
          logger.warn(`[VERIFICATION] Log channel ${logChannelId} not found or is not text-based.`);
        }
      } catch (logErr) {
        logger.error(`[VERIFICATION] Failed to send log to channel ${logChannelId}:`, logErr.message);
      }
    }

    // 8. Success response
    const successEmbed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle('✅ Verification Complete!')
      .setDescription(
        `Welcome to **Every Nation**, **${indianName}**! 🎉\n\nYou now have full access to the server. See you in the game branches!`
      )
      .addFields(
        { name: 'Game Branch', value: gameBranch, inline: true },
        { name: 'Joined Via', value: discoverySource, inline: true }
      )
      .setFooter({ text: 'Every Nation — ENOS System' })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [successEmbed], components: [] });

  } catch (err) {
    logger.error('[VERIFICATION] Error completing verification:', err);
    pendingVerifications.delete(userId);
    await interaction.editReply({
      content: '❌ An error occurred during verification. Please try again or contact an admin.',
      components: [],
    });
  }
}

module.exports = {
  handleVerifyButton,
  handleVerifyModalSubmit,
  handleDiscoverySelect,
  handleGameBranchSelect,
  handleBirthMonthSelect,
  handleBirthDaySelect,
  handleBirthdayConfirm,
  handleBirthdaySkip,
};
