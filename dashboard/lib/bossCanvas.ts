import { createCanvas, loadImage } from '@napi-rs/canvas';

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

export async function renderBossImage(data: any): Promise<Buffer> {
  const width = 800;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const {
    bossName = 'ERROR-MOD: Corrupted Boss',
    customImageUrl = null,
    customBgUrl = null,
    isOverkill = false,
    viewMode = 'spawn',
    lastAction = '',
  } = data;

  // ─── LAYER 1: BACKGROUND (Custom Background Image or Dark Cyber Gradient) ───
  let customBgLoaded = false;
  if (customBgUrl && typeof customBgUrl === 'string' && customBgUrl.startsWith('http')) {
    try {
      const directBgUrl = await resolveDirectImageUrl(customBgUrl);
      const res = await fetch(directBgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const bgImg = await loadImage(Buffer.from(arrayBuf));
        ctx.drawImage(bgImg, 0, 0, width, height);
        customBgLoaded = true;
      }
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

    // Subtle Scanline Grid
    ctx.strokeStyle = isOverkill ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.09)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // ─── LAYER 2: BOSS CHARACTER IMAGE (Transparent PNG or Banner) ─────────────
  let customBossLoaded = false;
  if (customImageUrl && typeof customImageUrl === 'string' && customImageUrl.startsWith('http')) {
    try {
      const directUrl = await resolveDirectImageUrl(customImageUrl);
      const res = await fetch(directUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const bossImg = await loadImage(Buffer.from(arrayBuf));
        if (viewMode === 'spawn') {
          if (customBgLoaded) {
            ctx.drawImage(bossImg, 380, 20, 380, 380);
          } else {
            ctx.drawImage(bossImg, 0, 0, width, height);
          }
        } else {
          ctx.drawImage(bossImg, 380, 20, 380, 340);
        }
        customBossLoaded = true;
      }
    } catch (e) {}
  }

  if (viewMode === 'spawn') {
    // ─── PHASE A: INITIAL BOSS SPAWN BANNER ──────────────────────────────────
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

  // ─── PHASE B: COMBAT ARENA VIEW (Chibi Heroes vs Boss) ─────────────────────
  function drawMomSprite(c: any, x: number, y: number) {
    c.fillStyle = '#60a5fa';
    c.beginPath();
    c.arc(x, y, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#93c5fd';
    c.beginPath();
    c.arc(x, y - 4, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1e3a8a';
    c.fillRect(x - 10, y + 6, 20, 16);
    c.fillStyle = '#ffffff';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'center';
    c.fillText('M.O.M.', x, y + 4);
    c.textAlign = 'left';
  }

  function drawDadSprite(c: any, x: number, y: number) {
    c.fillStyle = '#fbbf24';
    c.beginPath();
    c.arc(x, y, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fde68a';
    c.beginPath();
    c.arc(x, y - 4, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#78350f';
    c.fillRect(x - 10, y + 6, 20, 16);
    c.fillStyle = '#000000';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'center';
    c.fillText('D.A.D.', x, y + 4);
    c.textAlign = 'left';
  }

  function drawKidSprite(c: any, x: number, y: number) {
    c.fillStyle = '#f43f5e';
    c.beginPath();
    c.arc(x, y, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fecdd3';
    c.beginPath();
    c.arc(x, y - 4, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#881337';
    c.fillRect(x - 10, y + 6, 20, 16);
    c.fillStyle = '#ffffff';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'center';
    c.fillText('K.I.D.', x, y + 4);
    c.textAlign = 'left';
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

  if (lastAction) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    drawRoundedRect(ctx, 20, 365, width - 40, 38, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`LOG: ${lastAction}`, 35, 389);
  }

  return canvas.toBuffer('image/png');
}
