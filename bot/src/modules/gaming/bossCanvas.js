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
 * Draws pixel-art M.O.M. avatar (Straw hat, blue ribbon, purple dress, red slipper)
 */
function drawMomSprite(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wavy Brown Hair
  ctx.fillStyle = '#65350f';
  ctx.fillRect(cx - 12, cy - 8, 24, 20);

  // Face
  ctx.fillStyle = '#fbcfe8';
  ctx.fillRect(cx - 8, cy - 10, 16, 14);

  // Angry Brows & Eyes
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(cx - 6, cy - 7, 5, 3);
  ctx.fillRect(cx + 1, cy - 7, 5, 3);

  // Purple Dress
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(cx - 8, cy + 4, 16, 14);

  // Green Sash Belt
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cx - 8, cy + 7, 16, 3);

  // Straw Hat
  ctx.fillStyle = '#fde047';
  ctx.fillRect(cx - 15, cy - 16, 30, 5);
  ctx.fillRect(cx - 10, cy - 21, 20, 6);

  // Blue Hat Ribbon
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(cx - 10, cy - 16, 20, 2);

  // Red Slipper (Weapon)
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx + 9, cy - 5, 6, 10);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx + 10, cy - 3, 5, 5);

  ctx.restore();
}

/**
 * Draws pixel-art D.A.D. avatar (Blonde mustache, flannel shirt, jeans, tools)
 */
function drawDadSprite(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Face
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(cx - 8, cy - 10, 16, 14);

  // Blonde Hair
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 10, cy - 17, 20, 8);

  // Eyes
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(cx - 6, cy - 6, 4, 3);
  ctx.fillRect(cx + 2, cy - 6, 4, 3);

  // Thick Blonde Mustache
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 7, cy - 1, 14, 5);

  // Plaid Flannel Shirt
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(cx - 8, cy + 4, 16, 10);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 5, cy + 4, 3, 10);
  ctx.fillRect(cx + 2, cy + 4, 3, 10);

  // Blue Jeans
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(cx - 7, cy + 14, 14, 5);

  // Red Screwdriver Tool
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx + 9, cy, 4, 9);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + 10, cy + 9, 2, 5);

  ctx.restore();
}

/**
 * Draws pixel-art K.I.D. avatar (Propeller hat, purple EN shirt, iPad tablet)
 */
function drawKidSprite(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Face
  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(cx - 8, cy - 9, 16, 13);

  // Brown Hair
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 9, cy - 13, 18, 6);

  // Red Propeller Hat (Backward)
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 10, cy - 16, 20, 6);

  // Spinning Yellow Propeller
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 1, cy - 21, 2, 5);
  ctx.fillRect(cx - 8, cy - 22, 16, 2);

  // Angry Eyes focusing on iPad
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(cx - 6, cy - 5, 4, 3);
  ctx.fillRect(cx + 2, cy - 5, 4, 3);

  // Purple & Yellow Shirt
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(cx - 8, cy + 4, 16, 10);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 8, cy + 4, 6, 10);

  // Glowing iPad Tablet
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(cx - 6, cy + 8, 12, 10);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx - 5, cy + 9, 10, 8);

  ctx.restore();
}

/**
 * Draws the Glitched Boss Entity on the right side of the canvas
 */
function drawGlitchedBossEntity(ctx, cx, cy, isOverkill) {
  ctx.save();

  // Outer Digital Matrix Aura
  const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 130);
  if (isOverkill) {
    auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
    auraGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.4)');
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
    auraGrad.addColorStop(0.5, 'rgba(126, 34, 206, 0.4)');
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();

  // Cyber Wing Silhouette (Left Wing)
  ctx.fillStyle = isOverkill ? 'rgba(220, 38, 38, 0.7)' : 'rgba(147, 51, 234, 0.7)';
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 30);
  ctx.bezierCurveTo(cx - 90, cy - 120, cx - 140, cy - 80, cx - 110, cy + 40);
  ctx.bezierCurveTo(cx - 80, cy + 10, cx - 40, cy + 20, cx - 20, cy - 30);
  ctx.fill();

  // Boss Body Silhouette
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 45, 95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Silver Hair Streams
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy - 75);
  ctx.quadraticCurveTo(cx + 40, cy - 110, cx + 85, cy + 60);
  ctx.lineTo(cx + 65, cy + 70);
  ctx.quadraticCurveTo(cx + 25, cy - 80, cx - 15, cy - 75);
  ctx.fill();

  // Glitched Katana Energy Blade
  ctx.strokeStyle = isOverkill ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 80);
  ctx.lineTo(cx + 110, cy - 110);
  ctx.stroke();

  // Chromatic Aberration & Glitch Distortion Bands
  ctx.fillStyle = isOverkill ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
  ctx.fillRect(cx - 65, cy - 40, 130, 6);
  ctx.fillRect(cx - 45, cy + 15, 90, 8);
  ctx.fillStyle = isOverkill ? 'rgba(255, 255, 255, 0.5)' : 'rgba(236, 72, 153, 0.5)';
  ctx.fillRect(cx - 80, cy - 10, 160, 5);

  ctx.restore();
}

/**
 * Renders the Weekly Boss graphics canvas.
 * - viewMode === 'spawn': Full-bleed Glitched Boss Banner (Zero UI boxes)
 * - viewMode === 'combat': Combat Arena view (Chibi Heroes vs Boss)
 */
async function renderBossImage(data) {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const {
    bossName = 'ERROR-MOD: Corrupted Boss',
    isOverkill = false,
    viewMode = 'spawn', // 'spawn' or 'combat'
    lastAction = '',
  } = data;

  // 1. Cyber Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isOverkill) {
    bgGrad.addColorStop(0, '#1a0303');
    bgGrad.addColorStop(0.5, '#2d0808');
    bgGrad.addColorStop(1, '#0e0202');
  } else {
    bgGrad.addColorStop(0, '#060814');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#060710');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Scanline Grid Effect
  ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.09)';
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Code Streams Background Lines
  ctx.fillStyle = isOverkill ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
  ctx.font = '10px monospace';
  for (let col = 20; col < width; col += 60) {
    for (let row = 30; row < height; row += 40) {
      if ((col + row) % 3 === 0) {
        ctx.fillText('010101', col, row);
      }
    }
  }

  if (viewMode === 'spawn') {
    // ─── PHASE A: INITIAL BOSS SPAWN BANNER (Full-Bleed Art) ────────────────
    // Draw Glitched Boss Entity centered in 16:9 banner
    drawGlitchedBossEntity(ctx, 480, 210, isOverkill);

    // Dark Vignette Frame
    const frameGrad = ctx.createRadialGradient(400, 210, 200, 400, 210, 420);
    frameGrad.addColorStop(0, 'rgba(0,0,0,0)');
    frameGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = frameGrad;
    ctx.fillRect(0, 0, width, height);

    // Left Glitch Title Accent
    ctx.fillStyle = isOverkill ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('⚡ SYSTEM ANOMALY DETECTED', 35, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(bossName.toUpperCase(), 35, 100);

    return canvas.toBuffer('image/png');
  }

  // ─── PHASE B: COMBAT ARENA VIEW (Chibi Heroes vs Glitched Boss) ─────────────
  // Left Side: Three Chibi Pixel Heroes Lined Up Facing Boss
  const heroPositions = [
    { label: 'M.O.M.', draw: drawMomSprite, x: 80, y: 150 },
    { label: 'D.A.D.', draw: drawDadSprite, x: 180, y: 220 },
    { label: 'K.I.D.', draw: drawKidSprite, x: 280, y: 290 },
  ];

  heroPositions.forEach((hero) => {
    // Spotlight pedestal under hero
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y + 25, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.stroke();

    hero.draw(ctx, hero.x, hero.y);
  });

  // Right Side: Glitched Boss Entity
  drawGlitchedBossEntity(ctx, 580, 210, isOverkill);

  // Action Line at Bottom
  if (lastAction) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    drawRoundedRect(ctx, 20, 365, width - 40, 38, 8);
    ctx.fill();
    ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`⚡ ${lastAction}`, 35, 389);
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderBossImage,
};
