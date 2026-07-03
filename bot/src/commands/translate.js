const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getFeatureConfig } = require('../lib/supabase');
const { cooldowns } = require('../modules/utility/translator');

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
    if (allowedRoleId && allowedRoleId.trim()) {
      const hasRole = interaction.member.roles.cache.has(allowedRoleId);
      if (!hasRole) {
        return interaction.reply({
          content: `❌ Only users with the <@&${allowedRoleId}> role are permitted to use the message translation feature.`,
          ephemeral: true,
        });
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

    // 4. Create language select dropdown
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

    // 5. Reply to user ephemerally
    await interaction.reply({
      content: '🌍 Select a target language to translate this message:',
      components: [row],
      ephemeral: true,
    });
  },
};
