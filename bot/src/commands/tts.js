const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const {
  joinVoiceSession,
  relocateControlPanel,
  leaveVoiceSession,
  activeSessions,
  buildControlPanelPayload,
} = require('../modules/social/tts');
const logger = require('../lib/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('EN TTS Voice System — Text-to-Speech Control')
    .addSubcommand((sub) =>
      sub.setName('join').setDescription('Summon the Voice Herald Sub-Bot to your current Voice Channel')
    )
    .addSubcommand((sub) =>
      sub.setName('come').setDescription('Move the EN TTS Control Panel embed to the bottom of text chat')
    )
    .addSubcommand((sub) =>
      sub.setName('leave').setDescription('Disconnect the Voice Herald Sub-Bot from Voice Channel')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    if (sub === 'join') {
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: '❌ You must be connected to a Voice Channel first before calling `/tts join`!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await joinVoiceSession(guild, voiceChannel, interaction.channel, interaction.client);
      return interaction.editReply({ content: res.message });
    }

    if (sub === 'come') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await relocateControlPanel(guild.id, interaction.channel);
      return interaction.editReply({ content: res.message });
    }

    if (sub === 'leave') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await leaveVoiceSession(guild.id);
      return interaction.editReply({ content: res.message });
    }
  },

  /**
   * Component Interaction Handler for EN TTS Control Panel dropdowns & buttons
   */
  async handleTtsComponent(interaction) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const session = activeSessions.get(guildId);

    if (!session) {
      return interaction.reply({
        content: '❌ No active EN TTS voice session in this server. Use `/tts join` first.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId === 'tts_btn:come') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await relocateControlPanel(guildId, interaction.channel);
      return interaction.editReply({ content: res.message });
    }

    if (customId === 'tts_btn:leave') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await leaveVoiceSession(guildId);
      return interaction.editReply({ content: res.message });
    }

    if (customId === 'tts_select:lang') {
      const selected = interaction.values[0];
      session.language = selected;
      const voiceChannel = interaction.guild.channels.cache.get(session.voiceChannelId);
      const vcName = voiceChannel ? voiceChannel.name : 'Voice Channel';

      const payload = buildControlPanelPayload(session, vcName);
      await interaction.update(payload);
      return;
    }

    if (customId === 'tts_select:model') {
      const selected = interaction.values[0];
      session.voiceModel = selected;
      const voiceChannel = interaction.guild.channels.cache.get(session.voiceChannelId);
      const vcName = voiceChannel ? voiceChannel.name : 'Voice Channel';

      const payload = buildControlPanelPayload(session, vcName);
      await interaction.update(payload);
      return;
    }

    if (customId === 'tts_select:persona') {
      const selected = interaction.values[0];
      session.persona = selected;
      const voiceChannel = interaction.guild.channels.cache.get(session.voiceChannelId);
      const vcName = voiceChannel ? voiceChannel.name : 'Voice Channel';

      const payload = buildControlPanelPayload(session, vcName);
      await interaction.update(payload);
      return;
    }
  },
};
