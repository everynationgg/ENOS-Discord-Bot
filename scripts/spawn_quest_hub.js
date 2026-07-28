require('dotenv').config({ path: 'bot/.env' });
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  try {
    console.log('Fetching vault configs from Supabase...');
    const { data: configs } = await supabase.from('feature_configs').select('*').eq('feature_key', 'vault');

    if (!configs || configs.length === 0) {
      console.log('No vault configs found.');
      process.exit(0);
    }

    for (const cfg of configs) {
      const guildId = cfg.guild_id;
      const targetChannelId = cfg.config?.daily_quest_channel_id || '1530883419678969856';

      console.log(`Processing Quest Hub for guild ${guildId} in channel ${targetChannelId}...`);
      const channel = await client.channels.fetch(targetChannelId).catch(() => null);
      if (!channel) {
        console.error(`Could not fetch channel ${targetChannelId}`);
        continue;
      }

      // Sweep any stray launcher embeds previously posted
      const recentMsgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      if (recentMsgs) {
        for (const [, msg] of recentMsgs) {
          if (msg.author.id === client.user.id && msg.embeds?.[0]?.title?.includes('Daily Quests Hub')) {
            await msg.delete().catch(() => {});
            console.log(`Deleted stray launcher message ${msg.id}`);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Every Nation Vault — Daily Quests Hub')
        .setDescription(
          `Welcome to the **Daily Quest Hub**!\n\n` +
          `Click **📜 Get Daily Quests** below to launch your personal daily quests for today. You will receive an ephemeral panel with live progress bars for:\n\n` +
          `💬 **Chat Quest** — Send active messages in community channels.\n` +
          `🎙️ **Voice Quest** — Hang out in voice channels with friends.\n` +
          `🧠 **Trivia Quest** — Participate in daily AI trivia drops.\n\n` +
          `🏆 Complete all 3 daily quests to earn bonus **Vault Coins (₱ PHP)**!`
        )
        .setColor(0xFACC15)
        .setFooter({ text: 'Every Nation Vault • ENOS Quest Launcher' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('vault_get_daily_quests')
          .setLabel('📜 Get Daily Quests')
          .setStyle(ButtonStyle.Success)
      );

      const sentMsg = await channel.send({ embeds: [embed], components: [row] });
      console.log(`✅ Successfully posted fresh Daily Quest Hub launcher message! (ID: ${sentMsg.id})`);
    }
  } catch (err) {
    console.error('Error spawning Quest Hub:', err);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
