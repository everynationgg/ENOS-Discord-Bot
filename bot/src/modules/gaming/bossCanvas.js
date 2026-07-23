const { createCanvas } = require('@napi-rs/canvas');

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws pixel-art M.O.M. avatar matching character sheet (Straw hat, blue ribbon, purple dress, red slipper)
 */
function drawMomSprite(ctx, cx, cy) {
  ctx.save();
  // Badge background
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wavy Brown Hair
  ctx.fillStyle = '#65350f';
  ctx.fillRect(cx - 10, cy - 6, 20, 16);

  // Face
  ctx.fillStyle = '#fbcfe8';
  ctx.fillRect(cx - 7, cy - 8, 14, 12);

  // Angry Brows & Eyes
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(cx - 5, cy - 6, 4, 2);
  ctx.fillRect(cx + 1, cy - 6, 4, 2);

  // Purple Dress
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(cx - 7, cy + 4, 14, 10);

  // Green Sash Belt
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cx - 7, cy + 6, 14, 3);

  // Straw Hat
  ctx.fillStyle = '#fde047';
  ctx.fillRect(cx - 12, cy - 13, 24, 4); // Brim
  ctx.fillRect(cx - 8, cy - 17, 16, 5);  // Crown

  // Blue Hat Ribbon
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(cx - 8, cy - 13, 16, 2);

  // Red Slipper (Weapon)
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx + 7, cy - 4, 5, 8);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx + 8, cy - 2, 4, 4);

  ctx.restore();
}

/**
 * Draws pixel-art D.A.D. avatar matching character sheet (Blonde mustache, plaid shirt, jeans, tools)
 */
function drawDadSprite(ctx, cx, cy) {
  ctx.save();
  // Badge background
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Face
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(cx - 7, cy - 8, 14, 12);

  // Blonde Hair
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 8, cy - 14, 16, 7);

  // Eyes
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(cx - 5, cy - 5, 3, 3);
  ctx.fillRect(cx + 2, cy - 5, 3, 3);

  // Thick Blonde Mustache
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 6, cy - 1, 12, 4);

  // Plaid Flannel Shirt
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(cx - 7, cy + 4, 14, 8);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 4, cy + 4, 2, 8);
  ctx.fillRect(cx + 2, cy + 4, 2, 8);

  // Blue Jeans
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(cx - 6, cy + 11, 12, 4);

  // Red Screwdriver Tool
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx + 7, cy, 3, 7);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + 8, cy + 7, 1, 4);

  ctx.restore();
}

/**
 * Draws pixel-art K.I.D. avatar matching character sheet (Propeller hat, purple EN shirt, iPad tablet)
 */
function drawKidSprite(ctx, cx, cy) {
  ctx.save();
  // Badge background
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Face
  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(cx - 7, cy - 7, 14, 11);

  // Brown Hair
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 8, cy - 10, 16, 5);

  // Red Propeller Hat (Backward)
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 9, cy - 13, 18, 5);

  // Spinning Yellow Propeller
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 1, cy - 17, 2, 4);  // Stem
  ctx.fillRect(cx - 7, cy - 18, 14, 2); // Propeller blades

  // Angry Eyes focusing on iPad
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(cx - 5, cy - 4, 3, 2);
  ctx.fillRect(cx + 2, cy - 4, 3, 2);

  // Purple & Yellow Shirt
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(cx - 7, cy + 4, 14, 8);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 7, cy + 4, 5, 8); // EN diagonal pattern

  // Glowing iPad Tablet
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(cx - 5, cy + 7, 10, 8);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx - 4, cy + 8, 8, 6);

  ctx.restore();
}

/**
 * Renders the Weekly Boss Arena graphics canvas.
 */
async function renderBossImage(data) {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const {
    bossName = 'ERROR-MOD: Corrupted Boss',
    bossTitle = 'System Glitch Threat',
    currentHp = 150000,
    maxHp = 150000,
    isOverkill = false,
    momBuff = false,
    dadDebuff = false,
    lastAction = 'Awaiting first strike of the week...',
    classCounts = { mom: 0, dad: 0, kid: 0 },
  } = data;

  // 1. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isOverkill) {
    bgGrad.addColorStop(0, '#1a0505');
    bgGrad.addColorStop(0.5, '#2b0909');
    bgGrad.addColorStop(1, '#110202');
  } else {
    bgGrad.addColorStop(0, '#0a0d18');
    bgGrad.addColorStop(0.5, '#12172b');
    bgGrad.addColorStop(1, '#080a12');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Scanline Grid Effect
  ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.07)' : 'rgba(99, 102, 241, 0.08)';
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 3. Header Card
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  drawRoundedRect(ctx, 20, 20, width - 40, 95, 12);
  ctx.fill();
  ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.5)' : 'rgba(99, 102, 241, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Boss Name
  ctx.fillStyle = isOverkill ? '#ef4444' : '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(bossName, 35, 52);

  if (isOverkill) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    drawRoundedRect(ctx, width - 180, 36, 145, 22, 6);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();
    ctx.fillStyle = '#fef2f2';
    ctx.fillText('⚠️ OVERKILL MODE', width - 168, 51);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(bossTitle, 35, 70);
  }

  // HP Bar Base
  const hpBarX = 35;
  const hpBarY = 78;
  const hpBarW = width - 110;
  const hpBarH = 18;

  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  drawRoundedRect(ctx, hpBarX, hpBarY, hpBarW, hpBarH, 9);
  ctx.fill();

  // HP Fill
  const hpRatio = Math.max(0, Math.min(1, currentHp / (maxHp || 1)));
  const fillWidth = Math.max(14, hpBarW * hpRatio);

  const hpGrad = ctx.createLinearGradient(hpBarX, 0, hpBarX + fillWidth, 0);
  if (isOverkill) {
    hpGrad.addColorStop(0, '#dc2626');
    hpGrad.addColorStop(1, '#991b1b');
  } else if (hpRatio > 0.5) {
    hpGrad.addColorStop(0, '#22c55e');
    hpGrad.addColorStop(1, '#16a34a');
  } else if (hpRatio > 0.2) {
    hpGrad.addColorStop(0, '#eab308');
    hpGrad.addColorStop(1, '#ca8a04');
  } else {
    hpGrad.addColorStop(0, '#ef4444');
    hpGrad.addColorStop(1, '#b91c1c');
  }

  if (hpRatio > 0) {
    ctx.fillStyle = hpGrad;
    drawRoundedRect(ctx, hpBarX, hpBarY, fillWidth, hpBarH, 9);
    ctx.fill();
  }

  // HP Text Overlay
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  const hpText = isOverkill
    ? `OVERKILL HP: -${(maxHp - currentHp).toLocaleString()}`
    : `${currentHp.toLocaleString()} / ${maxHp.toLocaleString()} HP (${Math.round(hpRatio * 100)}%)`;
  ctx.fillText(hpText, hpBarX + hpBarW - 10, hpBarY + 13);
  ctx.textAlign = 'left';

  // 4. Combat Arena Layout: Triad (Left) vs Boss (Right)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
  drawRoundedRect(ctx, 20, 130, 360, 215, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('COMBAT TRIAD CLASS SLOTS', 35, 155);

  const triadClasses = [
    { key: 'mom', name: 'M.O.M.', role: 'Buff Support', color: '#38bdf8', count: classCounts.mom || 0, buffActive: momBuff },
    { key: 'dad', name: 'D.A.D.', role: 'Debuff Setup', color: '#f59e0b', count: classCounts.dad || 0, buffActive: dadDebuff },
    { key: 'kid', name: 'K.I.D.', role: 'Nuke Combo', color: '#ec4899', count: classCounts.kid || 0, buffActive: false },
  ];

  triadClasses.forEach((cls, idx) => {
    const slotY = 172 + idx * 52;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    drawRoundedRect(ctx, 35, slotY, 330, 44, 8);
    ctx.fill();
    ctx.strokeStyle = cls.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Pixel Art Character Avatar
    if (cls.key === 'mom') drawMomSprite(ctx, 58, slotY + 22);
    else if (cls.key === 'dad') drawDadSprite(ctx, 58, slotY + 22);
    else if (cls.key === 'kid') drawKidSprite(ctx, 58, slotY + 22);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(cls.name, 88, slotY + 22);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${cls.role} • ${cls.count} Active`, 88, slotY + 36);

    if (cls.buffActive) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      drawRoundedRect(ctx, 245, slotY + 12, 110, 20, 5);
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('✓ SETUP READY', 251, slotY + 26);
    }
  });

  // Right Side: Boss Glitch Hologram
  ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
  drawRoundedRect(ctx, 400, 130, 380, 215, 12);
  ctx.fill();
  ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.4)' : 'rgba(168, 85, 247, 0.3)';
  ctx.stroke();

  const bossCenterX = 590;
  const bossCenterY = 230;

  ctx.save();
  ctx.beginPath();
  ctx.arc(bossCenterX, bossCenterY, 65, 0, Math.PI * 2);
  const bossGrad = ctx.createRadialGradient(bossCenterX, bossCenterY, 10, bossCenterX, bossCenterY, 65);
  if (isOverkill) {
    bossGrad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    bossGrad.addColorStop(1, 'rgba(127, 29, 29, 0.2)');
  } else {
    bossGrad.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
    bossGrad.addColorStop(1, 'rgba(88, 28, 135, 0.2)');
  }
  ctx.fillStyle = bossGrad;
  ctx.fill();

  ctx.fillStyle = isOverkill ? 'rgba(255, 255, 255, 0.4)' : 'rgba(56, 189, 248, 0.5)';
  ctx.fillRect(bossCenterX - 45, bossCenterY - 20, 90, 4);
  ctx.fillStyle = isOverkill ? 'rgba(239, 68, 68, 0.6)' : 'rgba(236, 72, 153, 0.6)';
  ctx.fillRect(bossCenterX - 55, bossCenterY + 10, 110, 6);
  ctx.restore();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bossName.toUpperCase(), bossCenterX, 320);
  ctx.textAlign = 'left';

  // 5. Bottom Combat Log Bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundedRect(ctx, 20, 355, width - 40, 45, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px sans-serif';
  ctx.fillText(`⚡ ${lastAction}`, 35, 382);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderBossImage,
};
