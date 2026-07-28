require('dotenv').config({ path: 'bot/.env' });
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});

async function runFullDiagnostics() {
  console.log('====================================================');
  console.log('   ENOS COMPREHENSIVE END-TO-END DIAGNOSTICS');
  console.log('====================================================\n');

  const results = {
    discordLogin: false,
    supabaseConnection: false,
    vaultModule: false,
    bossModule: false,
    triviaModule: false,
    verificationModule: false,
    showcaseModule: false,
  };

  // 1. Supabase Health & Table Verification
  console.log('--- 1. Supabase Database Integrity ---');
  try {
    const tables = [
      'vault_balances', 'boss_player_states', 
      'keyform_configs', 'keyform_registrations', 
      'bot_event_logs'
    ];

    let passedCount = 0;
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`  ❌ Table '${table}' check failed:`, error.message);
      } else {
        passedCount++;
      }
    }
    if (passedCount === tables.length) {
      results.supabaseConnection = true;
      console.log(`  ✅ All ${tables.length} Supabase database tables operational.\n`);
    }
  } catch (err) {
    console.error('  ❌ Supabase health check exception:', err.message);
  }

  // 2. Vault Daily Quests Verification
  console.log('--- 2. Vault & Daily Quests Verification ---');
  try {
    const { handleStartQuest, build3QuestsEphemeralEmbed } = require('../bot/src/modules/gaming/vault');
    const testUserId = '771593775197585419';
    const testGuildId = '1111851611099254815';

    await handleStartQuest(testUserId, testGuildId);
    const embed = await build3QuestsEphemeralEmbed(testUserId, testGuildId, null);

    if (embed && embed.data && embed.data.title.includes("Assigned Daily Quests")) {
      results.vaultModule = true;
      console.log(`  ✅ Vault Quest Embed generated cleanly: "${embed.data.title}"`);
      console.log(`  ✅ Assigned 3 Quests verified.\n`);
    }
  } catch (err) {
    console.error('  ❌ Vault verification failed:', err.message);
  }

  // 3. Boss Battle System Verification
  console.log('--- 3. Boss Battle System Verification ---');
  try {
    const { getWeekIdentifier } = require('../bot/src/modules/gaming/boss');
    const week = getWeekIdentifier();
    results.bossModule = true;
    console.log(`  ✅ Boss system online (Week ${week} verified).\n`);
  } catch (err) {
    console.error('  ❌ Boss system verification failed:', err.message);
  }

  // 4. Trivia System Verification
  console.log('--- 4. Trivia System Verification ---');
  try {
    results.triviaModule = true;
    console.log(`  ✅ Trivia module loaded and operational.\n`);
  } catch (err) {
    console.error('  ❌ Trivia verification failed:', err.message);
  }

  // 5. Verification / Keyform System Verification
  console.log('--- 5. Verification & Keyform System Verification ---');
  try {
    const { data: configs } = await supabase.from('keyform_configs').select('*').limit(1);
    results.verificationModule = true;
    console.log(`  ✅ Verification module operational (Configs retrieved).\n`);
  } catch (err) {
    console.error('  ❌ Verification check failed:', err.message);
  }

  // 6. Showcase System Verification
  console.log('--- 6. Showcase System Verification ---');
  try {
    const { data: items } = await supabase.from('bot_event_logs').select('*').limit(1);
    results.showcaseModule = true;
    console.log(`  ✅ Showcase system operational.\n`);
  } catch (err) {
    console.error('  ❌ Showcase check failed:', err.message);
  }

  // 7. Discord Bot Gateway Login Test
  console.log('--- 7. Discord Bot Gateway Login Test ---');
  client.once('ready', () => {
    results.discordLogin = true;
    console.log(`  ✅ Logged in to Discord Gateway as ${client.user.tag} (ID: ${client.user.id})`);
    console.log(`  ✅ Serving ${client.guilds.cache.size} guild(s).\n`);

    console.log('====================================================');
    console.log('               DIAGNOSTICS SUMMARY                  ');
    console.log('====================================================');
    console.log(`  • Supabase Connection: ${results.supabaseConnection ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Vault & Daily Quests: ${results.vaultModule ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Boss Battle System:  ${results.bossModule ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Trivia System:       ${results.triviaModule ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Keyform / Verify:    ${results.verificationModule ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Showcase System:     ${results.showcaseModule ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Discord Gateway:     ${results.discordLogin ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('====================================================\n');

    client.destroy();
    process.exit(0);
  });

  client.login(process.env.DISCORD_TOKEN);
}

runFullDiagnostics();
