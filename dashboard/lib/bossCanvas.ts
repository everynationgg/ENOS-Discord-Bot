import { createCanvas, loadImage } from '@napi-rs/canvas';

const imageBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

async function resolveDirectImageUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
  if (url.includes('i.ibb.co/') || /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) return url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<img\s+src=["'](https:\/\/i\.ibb\.co\/[^"']+)["']/i) ||
                      html.match(/(https:\/\/i\.ibb\.co\/[a-zA-Z0-9_\-\.\/]+)/i);
      if (ogMatch && ogMatch[1]) {
        return ogMatch[1];
      }
    }
  } catch (e) {
    // ignore
  }
  return url;
}

async function fetchImageBuffer(url: string | null): Promise<Buffer | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;

  const cached = imageBufferCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.buffer;
  }

  try {
    const directUrl = await resolveDirectImageUrl(url);
    const cachedDirect = imageBufferCache.get(directUrl);
    if (cachedDirect && Date.now() - cachedDirect.timestamp < CACHE_TTL_MS) {
      return cachedDirect.buffer;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout for large ImgBB downloads
    const res = await fetch(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length > 100 && !buf.toString('utf8', 0, 50).includes('<!DOCTYPE')) {
        imageBufferCache.set(url, { buffer: buf, timestamp: Date.now() });
        imageBufferCache.set(directUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    }
  } catch (e) {}
  return null;
}

function drawRoundedRect(c: any, rx: number, ry: number, rw: number, rh: number, rad: number) {
  c.beginPath();
  c.moveTo(rx + rad, ry);
  c.lineTo(rx + rw - rad, ry);
  c.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
  c.lineTo(rx + rw, ry + rh - rad);
  c.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
  c.lineTo(rx + rad, ry + rh);
  c.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
  c.lineTo(rx, ry + rad);
  c.quadraticCurveTo(rx, ry, rx + rad, ry);
  c.closePath();
}

function drawImageContain(
  c: any,
  img: any,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  alignX: number = 0.5,
  alignY: number = 0.5
) {
  const imgW = img.width;
  const imgH = img.height;
  if (!imgW || !imgH) return;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const drawX = x + (maxW - drawW) * alignX;
  const drawY = y + (maxH - drawH) * alignY;
  c.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawAttackFX(ctx: any, lastAction: string, isOverkill: boolean) {
  const normAction = (lastAction || '').toLowerCase();
  const isNuke = normAction.includes('meltdown') || normAction.includes('overkill') || normAction.includes('nuke');
  const isSkill = normAction.includes('guilt') || normAction.includes('joke') || normAction.includes('meltdown') || normAction.includes('skill');

  const impactX = 580;
  const impactY = 180;

  ctx.save();

  // 1. Slash Arc / Laser Beam
  ctx.strokeStyle = isNuke ? '#ef4444' : isSkill ? '#facc15' : '#38bdf8';
  ctx.lineWidth = isNuke ? 6 : isSkill ? 4 : 3;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 16;

  ctx.beginPath();
  ctx.arc(impactX - 20, impactY, 75, -0.6 * Math.PI, 0.4 * Math.PI, false);
  ctx.stroke();

  if (isSkill || isNuke) {
    ctx.beginPath();
    ctx.arc(impactX + 20, impactY, 75, 0.6 * Math.PI, 1.6 * Math.PI, false);
    ctx.stroke();
  }

  // 2. Starburst Hit Sparks
  const sparkCount = isNuke ? 12 : isSkill ? 8 : 6;
  const sparkRadius = isNuke ? 65 : isSkill ? 45 : 30;

  for (let i = 0; i < sparkCount; i++) {
    const angle = (i * 2 * Math.PI) / sparkCount;
    const innerR = 8;
    const outerR = sparkRadius * (i % 2 === 0 ? 1 : 0.6);

    const x1 = impactX + Math.cos(angle) * innerR;
    const y1 = impactY + Math.sin(angle) * innerR;
    const x2 = impactX + Math.cos(angle) * outerR;
    const y2 = impactY + Math.sin(angle) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 3. Impact Radial Glow Core
  const flashGrad = ctx.createRadialGradient(impactX, impactY, 2, impactX, impactY, isNuke ? 60 : 35);
  flashGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  flashGrad.addColorStop(0.5, isNuke ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.6)');
  flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = flashGrad;
  ctx.beginPath();
  ctx.arc(impactX, impactY, isNuke ? 60 : 35, 0, 2 * Math.PI);
  ctx.fill();

  ctx.restore();
}

export async function renderBossImage(data: any): Promise<Buffer> {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const {
    bossName = 'ERROR-MOD: Corrupted Boss',
    customImageUrl = null,
    customBgUrl = null,
    userClassKey = null,
    classImageUrls = {},
    isOverkill = false,
    viewMode = 'spawn',
    lastAction = '',
  } = data;

  const activeClass = userClassKey || 'mom';
  const targetClassUrl = classImageUrls[activeClass] || classImageUrls.mom || classImageUrls.dad || classImageUrls.kid;

  const [bgBuf, bossBuf, classBuf] = await Promise.all([
    fetchImageBuffer(customBgUrl),
    fetchImageBuffer(customImageUrl),
    fetchImageBuffer(targetClassUrl),
  ]);

  const normAction = (lastAction || '').toLowerCase();
  const isAttackAction = normAction.includes('throw') ||
    normAction.includes('slap') ||
    normAction.includes('joke') ||
    normAction.includes('guilt') ||
    normAction.includes('meltdown') ||
    normAction.includes('attack') ||
    normAction.includes('skill') ||
    normAction.includes('triad');

  let shakeX = 0;
  let shakeY = 0;
  if (normAction.includes('meltdown') || normAction.includes('overkill') || normAction.includes('nuke')) {
    shakeX = Math.floor(Math.random() * 10) - 5;
    shakeY = Math.floor(Math.random() * 10) - 5;
  }

  ctx.save();
  if (shakeX !== 0 || shakeY !== 0) {
    ctx.translate(shakeX, shakeY);
  }

  // ─── LAYER 1: ARENA BACKGROUND ─────────────────────────────────────────────
  let customBgLoaded = false;
  if (bgBuf) {
    try {
      const bgImg = await loadImage(bgBuf);
      ctx.drawImage(bgImg, 0, 0, width, height);
      customBgLoaded = true;
    } catch (e) {}
  }

  if (!customBgLoaded) {
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

    ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.09)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // ─── PHASE A: INITIAL BOSS SPAWN BANNER (Boss Upload Only) ─────────────────
  if (viewMode === 'spawn') {
    if (bossBuf) {
      try {
        const bossImg = await loadImage(bossBuf);
        if (customBgLoaded) {
          drawImageContain(ctx, bossImg, 380, 20, 380, 380, 0.5, 0.5);
        } else {
          drawImageContain(ctx, bossImg, 0, 0, width, height, 0.5, 0.5);
        }
      } catch (e) {}
    }

    const frameGrad = ctx.createRadialGradient(400, 210, 200, 400, 210, 420);
    frameGrad.addColorStop(0, 'rgba(0,0,0,0)');
    frameGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = frameGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = isOverkill ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SYSTEM ANOMALY DETECTED', 35, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(bossName.toUpperCase(), 35, 100);

    ctx.restore();
    return canvas.toBuffer('image/png');
  }

  // ─── PHASE B: COMBAT ARENA VIEW (Selected Class PNG vs Boss Upload PNG) ────

  // 1. Draw Boss Image on Right Side (Aspect-Ratio Preserved)
  if (bossBuf) {
    try {
      const bossImg = await loadImage(bossBuf);
      drawImageContain(ctx, bossImg, 400, 20, 380, 330, 0.5, 0.5);
    } catch (e) {}
  }

  // 2. Draw Selected Class Character Image on Left Side
  const classX = isAttackAction ? 85 : 20;
  let classLoaded = false;
  if (classBuf) {
    try {
      const classImg = await loadImage(classBuf);
      drawImageContain(ctx, classImg, classX, 30, 340, 320, 0.5, 0.5);
      classLoaded = true;
    } catch (e) {}
  }

  if (!classLoaded) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    drawRoundedRect(ctx, classX + 10, 60, 320, 260, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const classTitles: Record<string, string> = { mom: '🛡️ M.O.M. COMBAT TRIAD', dad: '🔨 D.A.D. COMBAT TRIAD', kid: '⚡ K.I.D. COMBAT TRIAD' };
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(classTitles[activeClass] || 'COMBAT TRIAD', classX + 30, 110);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Class Engaged in Battle', classX + 30, 140);
  }

  // 3. Draw Attack Motion FX
  if (isAttackAction) {
    drawAttackFX(ctx, lastAction, isOverkill);
  }

  // 4. Action Log Footer Bar
  if (lastAction) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    drawRoundedRect(ctx, 20, 365, width - 40, 38, 8);
    ctx.fill();
    ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cleanLastAction = lastAction.replace(/[^\x00-\x7F]/g, '');
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`ACTION: ${cleanLastAction || lastAction}`, 35, 389);
  }

  ctx.restore();
  return canvas.toBuffer('image/png');
}
