import { createCanvas, loadImage } from '@napi-rs/canvas';

function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
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
function drawMomSprite(ctx: any, cx: number, cy: number) {
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
function drawDadSprite(ctx: any, cx: number, cy: number) {
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
function drawKidSprite(ctx: any, cx: number, cy: number) {
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
 * Draws High-Tech Corrupted Cyberspace Glitch Emblem (Fallback when no image URL set)
 */
function drawGlitchedBossEntity(ctx: any, cx: number, cy: number, isOverkill: boolean) {
  ctx.save();

  // 1. Digital Glitch Energy Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 140);
  if (isOverkill) {
    glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
    glowGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.2)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.6)');
    glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.fill();

  // 2. Cyber Hexagon / Matrix Core Emblem
  ctx.strokeStyle = isOverkill ? '#ef4444' : '#a855f7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = cx + 80 * Math.cos(angle);
    const y = cy + 80 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner Ring
  ctx.strokeStyle = isOverkill ? '#f87171' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 55, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Central Threat Icon Text
  ctx.fillStyle = isOverkill ? '#fca5a5' : '#e0e7ff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ANOMALY', cx, cy - 10);

  ctx.fillStyle = isOverkill ? '#ef4444' : '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('UNBOUND ENTITY', cx, cy + 15);

  // 4. Glitch Scanline Bars
  ctx.fillStyle = isOverkill ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
  ctx.fillRect(cx - 90, cy - 30, 180, 4);
  ctx.fillRect(cx - 60, cy + 35, 120, 5);

  ctx.restore();
}
export async function renderBossImage(data: {
  bossName?: string;
  bossTitle?: string;
  customImageUrl?: string | null;
  currentHp?: number;
  maxHp?: number;
  isOverkill?: boolean;
  viewMode?: 'spawn' | 'combat';
  momBuff?: boolean;
  dadDebuff?: boolean;
  lastAction?: string;
  classCounts?: { mom: number; dad: number; kid: number };
}): Promise<Buffer> {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const {
    bossName = 'ERROR-MOD: Corrupted Boss',
    customImageUrl = null,
    isOverkill = false,
    viewMode = 'spawn',
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

  // Draw Boss Image / Sprite
async function resolveDirectImageUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
  if (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) return url;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
    });
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<img\s+src=["'](https:\/\/i\.ibb\.co\/[^"']+)["']/i);
      if (ogMatch && ogMatch[1]) {
        return ogMatch[1];
      }
    }
  } catch (e) {
    // ignore
  }
  return url;
}

  let customLoaded = false;
  if (customImageUrl && typeof customImageUrl === 'string' && customImageUrl.startsWith('http')) {
    try {
      const directUrl = await resolveDirectImageUrl(customImageUrl);
      const res = await fetch(directUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const img = await loadImage(Buffer.from(arrayBuf));
        if (viewMode === 'spawn') {
          // Draw full-bleed custom artwork across entire banner
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          ctx.drawImage(img, 450, 50, 300, 300);
        }
        customLoaded = true;
      }
    } catch (e) {
      // fallback to emblem
    }
  }

  if (viewMode === 'spawn') {
    // ─── PHASE A: INITIAL BOSS SPAWN BANNER (Full-Bleed Art) ────────────────
    if (!customLoaded) {
      drawGlitchedBossEntity(ctx, 480, 210, isOverkill);
    }

    // Dark Vignette Frame
    const frameGrad = ctx.createRadialGradient(400, 210, 200, 400, 210, 420);
    frameGrad.addColorStop(0, 'rgba(0,0,0,0)');
    frameGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = frameGrad;
    ctx.fillRect(0, 0, width, height);

    // Left Title Text
    ctx.fillStyle = isOverkill ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SYSTEM ANOMALY DETECTED', 35, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(bossName.toUpperCase(), 35, 100);

    return canvas.toBuffer('image/png');
  }

  // ─── PHASE B: COMBAT ARENA VIEW (Chibi Heroes vs Glitched Boss) ─────────────
  const heroPositions = [
    { label: 'M.O.M.', draw: drawMomSprite, x: 80, y: 150 },
    { label: 'D.A.D.', draw: drawDadSprite, x: 180, y: 220 },
    { label: 'K.I.D.', draw: drawKidSprite, x: 280, y: 290 },
  ];

  heroPositions.forEach((hero) => {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y + 25, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.stroke();

    hero.draw(ctx, hero.x, hero.y);
  });

  if (!customLoaded) {
    drawGlitchedBossEntity(ctx, 580, 210, isOverkill);
  }

  if (lastAction) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    drawRoundedRect(ctx, 20, 365, width - 40, 38, 8);
    ctx.fill();
    ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)';
    ctx.stroke();

    const cleanLastAction = lastAction.replace(/[^\x00-\x7F]/g, '');
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`ACTION: ${cleanLastAction || lastAction}`, 35, 389);
  }

  return canvas.toBuffer('image/png');
}
