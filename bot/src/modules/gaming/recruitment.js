const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { supabase, getFeatureConfig, logBotEvent } = require('../../lib/supabase');
const logger = require('../../lib/logger');

// Default Tier Fallbacks
const DEFAULT_TIERS = {
  enis: {
    title: 'They Who Herald the Nation',
    threshold: 5,
    reward_type: 'coins',
    reward_val: 50,
  },
  enara: {
    title: 'Those Who Exalt the Nation',
    threshold: 50,
    reward_type: 'nitro',
    reward_val: '1 Month Discord Nitro + Boost',
  },
  enorium: {
    title: 'The One Who Ordains the Nation',
    threshold: 100,
    reward_type: 'nitro',
    reward_val: '1 Year Discord Nitro + Boost',
    exclusive: true,
  },
};

/**
 * Records an invitation from Gatekeeper onboarding
 * @param {import('discord.js').Guild} guild
 * @param {string} inviterId - Discord ID of inviter
 * @param {import('discord.js').GuildMember} invitedMember - New member joining
 */
async function recordMemberInvite(guild, inviterId, invitedMember) {
  if (!inviterId || !invitedMember) return { success: false, reason: 'invalid_args' };

  // Self-invite prevention
  if (inviterId === invitedMember.id) {
    return { success: false, reason: 'self_invite' };
  }

  // Calculate account age in days
  const createdTimestamp = invitedMember.user.createdTimestamp;
  const ageInDays = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);
  const minAccountAgeDays = 365;

  const status = ageInDays >= minAccountAgeDays ? 'valid' : 'pending';

  try {
    // Write to member_invites
    const { error: dbErr } = await supabase.from('member_invites').upsert(
      {
        inviter_id: inviterId,
        invited_member_id: invitedMember.id,
        status,
        invited_account_created_at: new Date(createdTimestamp).toISOString(),
      },
      { onConflict: 'invited_member_id' }
    );

    if (dbErr) throw new Error(dbErr.message);

    logger.info(`[RECRUITMENT] Recorded invite: ${inviterId} -> ${invitedMember.user.tag} (${status}, age: ${Math.round(ageInDays)}d)`);

    // If valid immediately, check for tier upgrades
    if (status === 'valid') {
      await checkAndUpgradeUserTiers(guild, inviterId);
    }

    return { success: true, status };
  } catch (err) {
    logger.error('[RECRUITMENT] Error recording invite:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Evaluates a user's total valid invites and awards tier titles / rewards / role swaps
 */
async function checkAndUpgradeUserTiers(guild, inviterId) {
  try {
    // 1. Fetch valid invite count for inviter
    const { count, error: countErr } = await supabase
      .from('member_invites')
      .select('id', { count: 'exact', head: true })
      .eq('inviter_id', inviterId)
      .eq('status', 'valid');

    if (countErr) throw new Error(countErr.message);

    const validCount = count || 0;

    // 2. Fetch config
    const featureConfig = await getFeatureConfig(guild.id, 'recruitment_achievement');
    const config = featureConfig?.config || {};
    const tiers = config.tiers || DEFAULT_TIERS;

    const member = await guild.members.fetch(inviterId).catch(() => null);
    if (!member) return;

    // Evaluate Enis (5)
    if (validCount >= (tiers.enis?.threshold || 5)) {
      await grantAchievementTier(guild, member, 'enis', tiers.enis, validCount);
    }

    // Evaluate Enara (50)
    if (validCount >= (tiers.enara?.threshold || 50)) {
      await grantAchievementTier(guild, member, 'enara', tiers.enara, validCount);
    }

    // Evaluate Enorium Exclusive Crown Swap (100+)
    if (validCount >= (tiers.enorium?.threshold || 100)) {
      await evaluateEnoriumCrownSwap(guild, member, validCount, tiers.enorium);
    }
  } catch (err) {
    logger.error('[RECRUITMENT] Error checking tier upgrades:', err.message);
  }
}

/**
 * Grants a specific tier award and role if not already granted
 */
async function grantAchievementTier(guild, member, tierKey, tierConfig, currentInvites) {
  try {
    // Check if user already has this achievement unlocked in user_achievements table
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', member.id)
      .eq('achievement_key', 'recruitment')
      .eq('tier_key', tierKey)
      .maybeSingle();

    if (existing) return; // Already awarded

    // Record achievement unlock in Supabase
    await supabase.from('user_achievements').insert({
      user_id: member.id,
      achievement_key: 'recruitment',
      tier_key: tierKey,
      unlocked_at: new Date().toISOString(),
    });

    // Award Vault Coins if reward_type is coins
    if (tierConfig.reward_type === 'coins' && tierConfig.reward_val) {
      const rewardCoins = parseInt(tierConfig.reward_val, 10) || 50;
      await supabase.rpc('add_vault_coins', {
        p_user_id: member.id,
        p_guild_id: guild.id,
        p_amount: rewardCoins,
        p_reason: `Recruitment Tier ${tierKey.toUpperCase()} Unlock`,
      }).catch(err => logger.error(`[RECRUITMENT] Failed to add Vault coins:`, err.message));
    }

    // Auto-assign Discord role if configured
    if (tierConfig.role_id) {
      await member.roles.add(tierConfig.role_id).catch(() => null);
    }

    logger.info(`[RECRUITMENT] Member ${member.user.tag} unlocked Recruitment ${tierKey.toUpperCase()} (${tierConfig.title})`);
  } catch (err) {
    logger.error(`[RECRUITMENT] Error granting ${tierKey} tier to ${member.id}:`, err.message);
  }
}

/**
 * Evaluates Enorium exclusive crown title transfer (#1 leader with >= 100 invites)
 */
async function evaluateEnoriumCrownSwap(guild, member, inviterCount, enoriumConfig) {
  try {
    // Query max count holder
    const { data: allInvites } = await supabase
      .from('member_invites')
      .select('inviter_id')
      .eq('status', 'valid');

    if (!allInvites || allInvites.length === 0) return;

    // Count invites per inviter
    const counts = {};
    allInvites.forEach(row => {
      counts[row.inviter_id] = (counts[row.inviter_id] || 0) + 1;
    });

    // Find top inviter ID
    let topInviterId = null;
    let maxInvites = 0;
    Object.entries(counts).forEach(([id, c]) => {
      if (c > maxInvites) {
        maxInvites = c;
        topInviterId = id;
      }
    });

    if (topInviterId === member.id && maxInvites >= (enoriumConfig.threshold || 100)) {
      // Check current holder in user_achievements
      const { data: currentHolder } = await supabase
        .from('user_achievements')
        .select('user_id')
        .eq('achievement_key', 'recruitment')
        .eq('tier_key', 'enorium')
        .maybeSingle();

      if (!currentHolder || currentHolder.user_id !== member.id) {
        // Swap Enorium title!
        if (currentHolder) {
          // Remove Enorium role from previous holder
          const oldMember = await guild.members.fetch(currentHolder.user_id).catch(() => null);
          if (oldMember && enoriumConfig.role_id) {
            await oldMember.roles.remove(enoriumConfig.role_id).catch(() => null);
          }
          await supabase
            .from('user_achievements')
            .delete()
            .eq('achievement_key', 'recruitment')
            .eq('tier_key', 'enorium');
        }

        // Record new Enorium holder
        await supabase.from('user_achievements').insert({
          user_id: member.id,
          achievement_key: 'recruitment',
          tier_key: 'enorium',
          unlocked_at: new Date().toISOString(),
        });

        // Award Enorium Role
        if (enoriumConfig.role_id) {
          await member.roles.add(enoriumConfig.role_id).catch(() => null);
        }

        logger.info(`[RECRUITMENT] 👑 Enorium title transferred to ${member.user.tag} with ${maxInvites} invites!`);
      }
    }
  } catch (err) {
    logger.error('[RECRUITMENT] Error evaluating Enorium crown swap:', err.message);
  }
}

/**
 * Builds the Check Progress ephemeral embed
 */
async function getRecruitmentProgressEmbed(guild, userId) {
  // Fetch user's valid count
  const { count: validCount } = await supabase
    .from('member_invites')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', userId)
    .eq('status', 'valid');

  // Fetch pending count
  const { count: pendingCount } = await supabase
    .from('member_invites')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', userId)
    .eq('status', 'pending');

  const valid = validCount || 0;
  const pending = pendingCount || 0;

  // Determine current tier & title
  let currentTitle = 'Unranked Recruiter';
  let nextMilestone = 'Enis (5 Invites)';
  let nextReward = '50 Vault Coins';
  let targetGoal = 5;

  if (valid >= 100) {
    currentTitle = '👑 The One Who Ordains the Nation (Enorium Tier)';
    nextMilestone = 'Pinnacle Reached! Maintain #1 spot for Crown Title';
    nextReward = '1 Year Discord Nitro + Boost';
    targetGoal = 100;
  } else if (valid >= 50) {
    currentTitle = '🔥 Those Who Exalt the Nation (Enara Tier)';
    nextMilestone = 'Enorium (100 Invites)';
    nextReward = '1 Year Discord Nitro + Boost';
    targetGoal = 100;
  } else if (valid >= 5) {
    currentTitle = '💜 They Who Herald the Nation (Enis Tier)';
    nextMilestone = 'Enara (50 Invites)';
    nextReward = '1 Month Discord Nitro + Boost';
    targetGoal = 50;
  }

  // Create progress bar string
  const pct = Math.min(100, Math.round((valid / targetGoal) * 100));
  const filledBars = Math.round(pct / 10);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle(`📊 Recruitment Progress — <@${userId}>`)
    .addFields(
      { name: '🎖️ Current Title', value: currentTitle, inline: false },
      { name: '🎯 Next Milestone', value: nextMilestone, inline: true },
      { name: '🎁 Next Reward', value: nextReward, inline: true },
      { name: '📈 Progress (Valid Invites)', value: `${progressBar} **${valid} / ${targetGoal}** (${pct}%)`, inline: false },
      { name: '⏳ Pending Invites', value: `${pending} invite(s) (accounts < 1 yr old, maturing soon)`, inline: false }
    )
    .setFooter({ text: 'ENOS Achievement Engine • Ephemeral Response' })
    .setTimestamp();

  return embed;
}

/**
 * Builds the Rules ephemeral embed
 */
function getRecruitmentRulesEmbed() {
  return new EmbedBuilder()
    .setColor(0x3B82F6)
    .setTitle('📜 Recruitment Achievement Rules')
    .setDescription('Please review the official rules for earning invite credit in Every Nation:')
    .addFields(
      { name: '1. Onboarding Completion', value: 'Invite credit is only awarded after the invited member completes Gatekeeper onboarding.' },
      { name: '2. One Credit Per Account', value: 'Each Discord account may only grant invite credit once.' },
      { name: '3. No Self or Alt Invites', value: 'Self-invites, duplicate accounts, and alternate accounts strictly do not qualify.' },
      { name: '4. 1-Year Account Age Rule', value: 'Only Discord accounts at least **1 year old** qualify immediately. Younger accounts stay **Pending** until reaching 1 year of age.' },
      { name: '5. Exclusive Enorium Crown Title', value: 'The Enorium title (*The One Who Ordains the Nation*) is held by only **1 member at a time**. If another member surpasses your count, the title transfers automatically.' },
      { name: '6. Moderator Anti-Fraud', value: 'Fake or fraudulent invites will be revoked by moderators, deducting points from your rank.' }
    )
    .setFooter({ text: 'ENOS Compliance & Rules' });
}

const ACHIEVEMENTS_CATALOG = [
  {
    key: 'recruitment',
    title: 'Recruitment',
    description: 'Track successful member invitations to Every Nation.',
    image: 'recruitment.jpg',
    embedColor: 0x8B5CF6,
    tiers: [
      { name: '💜 Enis (5 Invites)', title: 'They Who Herald the Nation', reward: '50 Vault Coins' },
      { name: '🔥 Enara (50 Invites)', title: 'Those Who Exalt the Nation', reward: '1 Month Discord Nitro + Boost' },
      { name: '👑 Enorium (100 Invites)', title: 'The One Who Ordains the Nation', reward: '1 Year Discord Nitro + Boost (Crown)' },
    ],
  },
  {
    key: 'boss_slayer',
    title: 'Boss Slayer RPG',
    description: 'Defeat Weekly World Bosses in M.O.M., D.A.D., and K.I.D. combat.',
    image: 'recruitment.jpg',
    embedColor: 0xEF4444,
    tiers: [
      { name: '💜 Enis (1,000 DMG)', title: 'Vanguard Strike Herald', reward: '100 Vault Coins' },
      { name: '🔥 Enara (10,000 DMG)', title: 'Overkill Master Champion', reward: 'Special Discord Role + Badge' },
      { name: '👑 Enorium (#1 DMG)', title: 'Slayer of the Nation', reward: 'Exclusive Boss Crown Title' },
    ],
  },
  {
    key: 'trivia_master',
    title: 'Trivia Master',
    description: 'Answer daily community trivia questions accurately.',
    image: 'recruitment.jpg',
    embedColor: 0x3B82F6,
    tiers: [
      { name: '💜 Enis (10 Correct)', title: 'Scholar of the Realm', reward: '50 Vault Coins' },
      { name: '🔥 Enara (50 Correct)', title: 'Grand Archivist', reward: 'Custom Profile Frame' },
      { name: '👑 Enorium (#1 Points)', title: 'The Omniscient Mind', reward: 'Exclusive Trivia Crown Title' },
    ],
  },
];

/**
 * Main interaction handler for achievement buttons & components
 */
async function handleRecruitmentInteraction(interaction) {
  const { customId } = interaction;
  const path = require('path');
  const fs = require('fs');

  if (customId === 'achievement_progress') {
    const embed = await getRecruitmentProgressEmbed(interaction.guild, interaction.user.id);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (customId === 'achievement_rules') {
    const embed = getRecruitmentRulesEmbed();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (customId === 'achievement_prev' || customId === 'achievement_next') {
    let currentIndex = 0;
    if (interaction.message && interaction.message.embeds.length > 0) {
      const footerText = interaction.message.embeds[0].footer?.text || '';
      const match = footerText.match(/Card (\d+) of (\d+)/);
      if (match) {
        currentIndex = parseInt(match[1], 10) - 1;
      }
    }

    if (customId === 'achievement_prev') {
      currentIndex = (currentIndex - 1 + ACHIEVEMENTS_CATALOG.length) % ACHIEVEMENTS_CATALOG.length;
    } else {
      currentIndex = (currentIndex + 1) % ACHIEVEMENTS_CATALOG.length;
    }

    const item = ACHIEVEMENTS_CATALOG[currentIndex];
    const imagePath = path.join(__dirname, `../../assets/achievements/${item.image}`);
    let fileBuffer;
    if (fs.existsSync(imagePath)) {
      fileBuffer = fs.readFileSync(imagePath);
    }

    const tierDesc = item.tiers.map((t) => `**${t.name}** → Title: **"${t.title}"** | *${t.reward}*`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(item.embedColor)
      .setTitle(`📜 Achievement: ${item.title} — Every Nation`)
      .setDescription(`${item.description}\n\n${tierDesc}`)
      .setImage(`attachment://${item.image}`)
      .setFooter({ text: `ENOS Community Achievements System • Card ${currentIndex + 1} of ${ACHIEVEMENTS_CATALOG.length}` })
      .setTimestamp();

    const prevBtn = new ButtonBuilder().setCustomId('achievement_prev').setLabel('⬅ Previous').setStyle(ButtonStyle.Secondary);
    const progressBtn = new ButtonBuilder().setCustomId('achievement_progress').setLabel('📊 Check Progress').setStyle(ButtonStyle.Primary);
    const nextBtn = new ButtonBuilder().setCustomId('achievement_next').setLabel('➡ Next').setStyle(ButtonStyle.Secondary);
    const rulesBtn = new ButtonBuilder().setCustomId('achievement_rules').setLabel('📜 Rules').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(prevBtn, progressBtn, nextBtn, rulesBtn);

    const payload = { embeds: [embed], components: [row] };
    if (fileBuffer) {
      payload.files = [{ attachment: fileBuffer, name: item.image }];
    }

    return interaction.update(payload);
  }
}

/**
 * Posts or updates the Master Achievement Card in Discord
 */
async function postMasterAchievementCard(client, guildId, channelId) {
  if (!channelId) throw new Error('Channel ID is required');

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${channelId} not found or not text-based`);
  }

  const path = require('path');
  const fs = require('fs');

  const imagePath = path.join(__dirname, '../../assets/achievements/recruitment.jpg');
  let fileBuffer;

  if (fs.existsSync(imagePath)) {
    fileBuffer = fs.readFileSync(imagePath);
  } else {
    const { renderAchievementDetailCanvas } = require('./achievementCanvas');
    const achievementDef = {
      icon_emoji: '📜',
      title: 'Recruitment',
      description: 'Track successful member invitations to Every Nation.',
      tier1_title: 'They Who Herald the Nation',
      tier1_goal: 5,
      tier1_reward_coins: 50,
      tier2_title: 'Those Who Exalt the Nation',
      tier2_goal: 50,
      tier2_reward_coins: '1 Month Nitro + Boost',
      tier3_title: 'The One Who Ordains the Nation',
      tier3_goal: 100,
      tier3_reward_coins: '1 Year Nitro + Boost',
    };
    fileBuffer = await renderAchievementDetailCanvas(achievementDef, 1, 1);
  }

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle('📜 Achievement: Recruitment')
    .setDescription(
      'Track successful member invitations to Every Nation.\n\n' +
      '💜 **Enis (5 Invites)** → Title: **"They Who Herald the Nation"** | *50 Vault Coins*\n' +
      '🔥 **Enara (50 Invites)** → Title: **"Those Who Exalt the Nation"** | *1 Month Discord Nitro + Boost*\n' +
      '👑 **Enorium (100 Invites)** → Title: **"The One Who Ordains the Nation"** | *1 Year Discord Nitro + Boost*'
    )
    .setImage('attachment://achievement.jpg')
    .setFooter({ text: 'ENOS Community Achievements System • Interactive Buttons Below' })
    .setTimestamp();

  const prevBtn = new ButtonBuilder()
    .setCustomId('achievement_prev')
    .setLabel('⬅ Previous')
    .setStyle(ButtonStyle.Secondary);

  const progressBtn = new ButtonBuilder()
    .setCustomId('achievement_progress')
    .setLabel('📊 Check Progress')
    .setStyle(ButtonStyle.Primary);

  const nextBtn = new ButtonBuilder()
    .setCustomId('achievement_next')
    .setLabel('➡ Next')
    .setStyle(ButtonStyle.Secondary);

  const rulesBtn = new ButtonBuilder()
    .setCustomId('achievement_rules')
    .setLabel('📜 Rules')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(prevBtn, progressBtn, nextBtn, rulesBtn);

  await channel.send({
    embeds: [embed],
    files: [{ attachment: fileBuffer, name: 'achievement.jpg' }],
    components: [row],
  });

  return true;
}

module.exports = {
  recordMemberInvite,
  checkAndUpgradeUserTiers,
  getRecruitmentProgressEmbed,
  getRecruitmentRulesEmbed,
  handleRecruitmentInteraction,
  postMasterAchievementCard,
};
