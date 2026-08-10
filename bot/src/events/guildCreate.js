const { Events, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');
const { registerCommandsForGuild } = require('../lib/deployHelper');

module.exports = {
  name: Events.GuildCreate,
  /**
   * @param {import('discord.js').Guild} guild
   * @param {import('discord.js').Client} client
   */
  async execute(guild, client) {
    logger.info(`[GUILD_CREATE] ENOS joined new server: ${guild.name} (${guild.id})`);

    // 1. Insert default server configuration row
    const { error: settingsErr } = await supabase.from('guild_settings').upsert(
      {
        guild_id: guild.id,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id' }
    );

    if (settingsErr) {
      logger.error(`[GUILD_CREATE] Failed to initialize settings for guild ${guild.id}:`, settingsErr.message);
    } else {
      logger.info(`[GUILD_CREATE] Successfully initialized default settings for guild ${guild.id}`);
    }

    // 2. Auto-seed initial active Weekly Boss Season row if none exists
    try {
      const { data: existingBoss } = await supabase
        .from('boss_seasons')
        .select('id')
        .eq('guild_id', guild.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingBoss) {
        await supabase.from('boss_seasons').insert({
          guild_id: guild.id,
          season_number: 1,
          boss_name: 'Shadow Monarch',
          boss_title: 'S-Rank Gate Lord',
          max_hp: 1000,
          current_hp: 1000,
          is_active: true,
          lore: 'A towering dark monarch emerging from the abyss gate. Stand together to claim victory!',
          spawned_at: new Date().toISOString(),
        });
        logger.info(`[GUILD_CREATE] Seeded default initial boss season for guild ${guild.id}`);
      }
    } catch (bossErr) {
      logger.error(`[GUILD_CREATE] Boss season seed error for guild ${guild.id}:`, bossErr.message);
    }

    // 3. Register slash commands & Apps context menu ("Translate Message") for new guild
    if (client) {
      await registerCommandsForGuild(client, guild.id);
    }

    // 4. Send welcome & quick setup embed to system channel or first writable text channel
    try {
      let targetChannel = guild.systemChannel;

      if (!targetChannel || !targetChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        targetChannel = guild.channels.cache.find(
          (ch) =>
            ch.type === ChannelType.GuildText &&
            ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
        );
      }

      if (targetChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('🏰 Thanks for inviting ENOS!')
          .setDescription(
            `Hello **${guild.name}**! ENOS is now ready to serve your community with RPG Boss Battles, Vault Economy, Daily Trivia, Auto-Translations, and Voice Herald TTS.\n\n` +
            `**🚀 Quick Start Commands:**\n` +
            `• \`/boss status\` — View the active World Boss RPG battle\n` +
            `• \`/vault\` — View your coin balance & claim daily quests\n` +
            `• Right-click any message → **Apps → Translate Message** or react with flag emojis (🇺🇸, 🇨🇳, 🇮🇩, 🇵🇭, 🇯🇵, 🇩🇪, 🇪🇸) for instant translations!\n\n` +
            `**🌐 Server Web Dashboard:**\n` +
            `Configure announcement channels and features at **[dashboard.enos.gg](https://dashboard.enos.gg)**`
          )
          .setColor(0x6366f1)
          .setFooter({ text: 'ENOS Community Platform • 100% Free & Open' })
          .setTimestamp();

        await targetChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
      }
    } catch (welcomeErr) {
      logger.warn(`[GUILD_CREATE] Welcome message error for guild ${guild.id}:`, welcomeErr.message);
    }
  },
};
