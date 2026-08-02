const { createCanvas } = require('@napi-rs/canvas');
const logger = require('../../lib/logger');

/**
 * Renders Slide 0: Master Graphic Poster featuring all 5 achievements.
 */
async function renderMasterOverviewCanvas(achievements = []) {
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(0.5, '#1E1B4B');
  bgGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Border & Glow
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Title Header
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('🏆 ENOS COMMUNITY ACHIEVEMENTS GALLERY', 35, 50);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px sans-serif';
  ctx.fillText('Use [ ▶ Next ] to browse detailed tier milestones & single-player crown titles!', 35, 75);

  // 5 Achievement Cards Grid
  const cardWidth = 730;
  const cardHeight = 55;
  const startX = 35;
  let startY = 95;

  achievements.forEach((ach, index) => {
    // Card background
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.fillRect(startX, startY, cardWidth, cardHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, cardWidth, cardHeight);

    // Emoji Icon
    ctx.font = '24px sans-serif';
    ctx.fillText(ach.icon_emoji || '🏆', startX + 15, startY + 36);

    // Title & Category
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`#${index + 1} ${ach.title}`, startX + 55, startY + 26);

    ctx.fillStyle = '#A7F3D0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`🥉 ${ach.tier1_title}  |  🥈 ${ach.tier2_title}  |  🥇 👑 ${ach.tier3_title} (Exclusive)`, startX + 55, startY + 45);

    startY += 65;
  });

  // Footer Navigation Hint
  ctx.fillStyle = '#64748B';
  ctx.font = 'italic 12px sans-serif';
  ctx.fillText('Slide 1 / 6 • Click [ 🔍 Check Progress / How To Get ] for your personal status', 35, 425);

  return canvas.toBuffer('image/png');
}

/**
 * Renders Slides 1-5: Single Achievement 3-Tier Focus Card.
 */
async function renderAchievementDetailCanvas(achievement, slideIndex = 1, totalSlides = 6, reigningLeaderName = null) {
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(0.5, '#1E293B');
  bgGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Border
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Header Banner
  ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
  ctx.fillRect(20, 20, width - 40, 75);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${achievement.icon_emoji || '🏆'} ${achievement.title.toUpperCase()}`, 40, 55);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '14px sans-serif';
  ctx.fillText(achievement.description, 40, 80);

  // 3 Tiers Layout
  const tiers = [
    {
      label: 'TIER 1 (BRONZE)',
      title: achievement.tier1_title,
      goal: `${achievement.tier1_goal.toLocaleString()} Goal`,
      reward: `+${achievement.tier1_reward_coins} Vault Coins`,
      color: '#CD7F32',
      badge: '🥉',
      exclusive: false,
    },
    {
      label: 'TIER 2 (SILVER)',
      title: achievement.tier2_title,
      goal: `${achievement.tier2_goal.toLocaleString()} Goal`,
      reward: `+${achievement.tier2_reward_coins} Vault Coins`,
      color: '#C0C0C0',
      badge: '🥈',
      exclusive: false,
    },
    {
      label: 'TIER 3 (EXCLUSIVE CROWN)',
      title: achievement.tier3_title,
      goal: `${achievement.tier3_goal.toLocaleString()} Goal (Server Top)`,
      reward: `+${achievement.tier3_reward_coins} Coins + Exclusive Role`,
      color: '#F59E0B',
      badge: '👑',
      exclusive: true,
    },
  ];

  let cardY = 110;
  tiers.forEach((t) => {
    ctx.fillStyle = t.exclusive ? 'rgba(245, 158, 11, 0.12)' : 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(35, cardY, 730, 80);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = t.exclusive ? 2 : 1;
    ctx.strokeRect(35, cardY, 730, 80);

    // Badge
    ctx.font = '28px sans-serif';
    ctx.fillText(t.badge, 50, cardY + 48);

    // Tier Label & Title
    ctx.fillStyle = t.color;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(t.label, 95, cardY + 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(t.title, 95, cardY + 52);

    // Goal & Reward
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Target: ${t.goal}`, 420, cardY + 30);

    ctx.fillStyle = '#4ADE80';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Reward: ${t.reward}`, 420, cardY + 54);

    if (t.exclusive) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'italic 12px sans-serif';
      const holderText = reigningLeaderName ? `👑 Current Champion: @${reigningLeaderName}` : '👑 Unclaimed — Be the 1st!';
      ctx.fillText(holderText, 95, cardY + 70);
    }

    cardY += 92;
  });

  // Footer Navigation Hint
  ctx.fillStyle = '#64748B';
  ctx.font = 'italic 12px sans-serif';
  ctx.fillText(`Slide ${slideIndex} / ${totalSlides} • Click [ 🔍 Check Progress / How To Get ] for your standing`, 35, 425);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderMasterOverviewCanvas,
  renderAchievementDetailCanvas,
};
