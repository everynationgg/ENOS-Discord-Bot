const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getFeatureConfig } = require('../lib/supabase');
const { cooldowns, translateText } = require('../modules/utility/translator');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Translate Message')
    .setType(ApplicationCommandType.Message),

  /**
   * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const targetMessage = interaction.targetMessage;
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ This command can only be used in server text channels.',
        ephemeral: true,
      });
    }

    // 1. Fetch translation configs from database
    const featureConfig = await getFeatureConfig(guildId, 'translator');
    const isEnabled = featureConfig?.enabled || false;

    if (!isEnabled) {
      return interaction.reply({
        content: '❌ The message translation feature is currently disabled on this server.',
        ephemeral: true,
      });
    }

    const config = featureConfig.config || {};
    const charLimit = parseInt(config.character_limit || '1000', 10);
    const cooldownSeconds = parseInt(config.cooldown_seconds || '10', 10);
    const allowedRoleId = config.allowed_role_id;

    // 1.5. Validate allowed role restriction (if configured)
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin && allowedRoleId && allowedRoleId.trim()) {
      const allowedRoleIds = allowedRoleId.split(',').map(id => id.trim()).filter(Boolean);
      if (allowedRoleIds.length > 0) {
        const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        if (!hasAllowedRole) {
          const roleMentions = allowedRoleIds.map(id => `<@&${id}>`).join(', ');
          return interaction.reply({
            content: `❌ Only users with one of the configured roles (${roleMentions}) are permitted to use the message translation feature.`,
            ephemeral: true,
          });
        }
      }
    }

    // 2. Validate content length
    const sourceText = targetMessage.content;
    if (!sourceText || !sourceText.trim()) {
      return interaction.reply({
        content: '❌ Cannot translate a message with empty text content.',
        ephemeral: true,
      });
    }

    if (sourceText.length > charLimit) {
      return interaction.reply({
        content: `❌ This message length (${sourceText.length} characters) exceeds the server limit of **${charLimit}** characters.`,
        ephemeral: true,
      });
    }

    // 3. Validate user cooldown
    const now = Date.now();
    const cooldownKey = `${guildId}-${interaction.user.id}`;
    const lastUsed = cooldowns.get(cooldownKey) || 0;
    const cooldownMs = cooldownSeconds * 1000;

    if (now - lastUsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
      return interaction.reply({
        content: `⏳ You are on cooldown. Please wait **${remaining}** second(s) before translating another message.`,
        ephemeral: true,
      });
    }

    // Apply cooldown lock immediately
    cooldowns.set(cooldownKey, now);

    // 4. Check if user has a saved language preference in guild_config
    const userLanguages = config.user_languages || {};
    const savedLanguage = userLanguages[interaction.user.id];

    if (savedLanguage) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const translation = await translateText(sourceText, savedLanguage);

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`translate_select_${targetMessage.id}`)
          .setPlaceholder(`Change target language (current: ${savedLanguage})...`)
          .addOptions([
            { label: 'English 🇺🇸', value: 'English' },
            { label: 'Chinese 🇨🇳', value: 'Chinese' },
            { label: 'Indonesian 🇮🇩', value: 'Indonesian' },
            { label: 'Filipino 🇵🇭', value: 'Filipino' },
            { label: 'German 🇩🇪', value: 'German' },
            { label: 'Polish 🇵🇱', value: 'Polish' },
            { label: 'Thai 🇹🇭', value: 'Thai' },
            { label: 'Japanese 🇯🇵', value: 'Japanese' },
            { label: 'Malaysian 🇲🇾', value: 'Malaysian' },
            { label: 'Turkish 🇹🇷', value: 'Turkish' },
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
          content: `**Translation to ${savedLanguage}:**\n${translation}`,
          components: [row],
        });
      } catch (err) {
        logger.error(`[TRANSLATOR] Auto-translation failed:`, err.message);
        await interaction.editReply({
          content: `❌ Translation failed: ${err.message}`,
        });
      }
      return;
    }

    // 5. Create language select dropdown (fallback if no saved language preference)
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`translate_select_${targetMessage.id}`)
      .setPlaceholder('Select target language...')
      .addOptions([
        { label: 'English 🇺🇸', value: 'English' },
        { label: 'Chinese 🇨🇳', value: 'Chinese' },
        { label: 'Indonesian 🇮🇩', value: 'Indonesian' },
        { label: 'Filipino 🇵🇭', value: 'Filipino' },
        { label: 'German 🇩🇪', value: 'German' },
        { label: 'Polish 🇵🇱', value: 'Polish' },
        { label: 'Thai 🇹🇭', value: 'Thai' },
        { label: 'Japanese 🇯🇵', value: 'Japanese' },
        { label: 'Malaysian 🇲🇾', value: 'Malaysian' },
        { label: 'Turkish 🇹🇷', value: 'Turkish' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: '🌍 Select a target language to translate this message:',
      components: [row],
      ephemeral: true,
    });
  },
};
