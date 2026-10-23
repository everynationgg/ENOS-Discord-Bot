const {
  SlashCommandBuilder,
  PermissionFlagsBits,
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
    try {
      const sub = interaction.options.getSubcommand();
      const guild = interaction.guild;
      const member = interaction.member;
      if (!guild) return;

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

      const session = activeSessions.get(guild.id);
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has(PermissionFlagsBits.MoveMembers);
      const isInSameVoice = session && member?.voice?.channelId === session.voiceChannelId;

      if (session && !isInSameVoice && !isAdmin) {
        return interaction.reply({
          content: '❌ You must be inside the active TTS Voice Channel to control or disconnect the Voice Herald.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'come') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await relocateControlPanel(guild.id, interaction.channel);
        return interaction.editReply({ content: res.message });
      }

      if (sub === 'leave') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await leaveVoiceSession(guild.id, interaction.client);
        return interaction.editReply({ content: res.message });
      }
    } catch (err) {
      logger.error('[TTS COMMAND] Error:', err);
      const msg = '❌ An error occurred while executing the TTS command.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },

  /**
   * Component Interaction Handler for EN TTS Control Panel dropdowns & buttons
   */
  async handleTtsComponent(interaction) {
    try {
      const customId = interaction.customId;
      const guildId = interaction.guild?.id;
      if (!guildId) return;
      const session = activeSessions.get(guildId);

      if (!session) {
        return interaction.reply({
          content: '❌ No active EN TTS voice session in this server. Use `/tts join` first.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has(PermissionFlagsBits.MoveMembers);
      const isInSameVoice = interaction.member?.voice?.channelId === session.voiceChannelId;
      if (!isInSameVoice && !isAdmin) {
        return interaction.reply({
          content: '❌ You must be connected to the active TTS Voice Channel to use these controls.',
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
        const res = await leaveVoiceSession(guildId, interaction.client);
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
    } catch (err) {
      logger.error('[TTS COMPONENT] Error:', err);
      const msg = '❌ Failed to update TTS control settings.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
