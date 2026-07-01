const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
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

// Temporary in-memory store for partial verification data (pending dropdowns)
// Key: userId, Value: { indian_name, ign, birthday }
const pendingVerifications = new Map();

/**
 * Step 1 — Opens the verification modal when user clicks "Verify Here"
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVerifyButton(interaction) {
  // Check if already verified
  const { data: existing } = await supabase
    .from('verified_members')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .eq('guild_id', interaction.guild.id)
    .maybeSingle();

  if (existing) {
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
    .setLabel('INDIAN NAME (Verifiable Handle) *')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Your preferred community handle')
    .setRequired(true)
    .setMaxLength(32);

  const ignInput = new TextInputBuilder()
    .setCustomId('ign')
    .setLabel('In-Game Name (IGN)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Optional — your primary in-game name')
    .setRequired(false)
    .setMaxLength(64);

  const birthdayInput = new TextInputBuilder()
    .setCustomId('birthday')
    .setLabel('Birthday (MM/DD/YYYY)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Optional — e.g. 01/15/2000')
    .setRequired(false)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(indianNameInput),
    new ActionRowBuilder().addComponents(ignInput),
    new ActionRowBuilder().addComponents(birthdayInput)
  );

  await interaction.showModal(modal);
}

/**
 * Step 2 — Stores partial data, sends ephemeral dropdown message
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleVerifyModalSubmit(interaction) {
  const indianName = interaction.fields.getTextInputValue('indian_name').trim();
  const ign = interaction.fields.getTextInputValue('ign').trim() || null;
  const birthday = interaction.fields.getTextInputValue('birthday').trim() || null;

  // Store partial data pending dropdown selections
  pendingVerifications.set(interaction.user.id, { indianName, ign, birthday, step: 'discovery' });

  const discoverySelect = new StringSelectMenuBuilder()
    .setCustomId('verify_discovery')
    .setPlaceholder('Where did you find us? *')
    .addOptions(
      DISCOVERY_SOURCES.map(source =>
        new StringSelectMenuOptionBuilder().setLabel(source).setValue(source)
      )
    );

  await interaction.reply({
    content: '**Step 2 of 3** — Where did you find us?',
    components: [new ActionRowBuilder().addComponents(discoverySelect)],
    ephemeral: true,
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
    content: '**Step 3 of 3** — Select your Primary Game Branch:',
    components: [new ActionRowBuilder().addComponents(gameBranchSelect)],
  });
}

/**
 * Step 3b — Completes verification: writes DB, grants roles, syncs nickname
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
};
