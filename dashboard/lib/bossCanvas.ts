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

  // ─── LAYER 1: ARENA BACKGROUND ─────────────────────────────────────────────
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
    if (customImageUrl && typeof customImageUrl === 'string' && customImageUrl.startsWith('http')) {
      try {
        const directUrl = await resolveDirectImageUrl(customImageUrl);
        const res = await fetch(directUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
        });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const bossImg = await loadImage(Buffer.from(arrayBuf));
          if (customBgLoaded) {
            ctx.drawImage(bossImg, 380, 20, 380, 380);
          } else {
            ctx.drawImage(bossImg, 0, 0, width, height);
          }
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

    return canvas.toBuffer('image/png');
  }

  // ─── PHASE B: COMBAT ARENA VIEW (Selected Class PNG vs Boss Upload PNG) ────

  // 1. Draw Boss Image on Right Side
  if (customImageUrl && typeof customImageUrl === 'string' && customImageUrl.startsWith('http')) {
    try {
      const directUrl = await resolveDirectImageUrl(customImageUrl);
      const res = await fetch(directUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const bossImg = await loadImage(Buffer.from(arrayBuf));
        ctx.drawImage(bossImg, 400, 20, 380, 330);
      }
    } catch (e) {}
  }

  // 2. Draw Selected Class Character Image on Left Side
  const activeClass = userClassKey || 'mom';
  const targetClassUrl = classImageUrls[activeClass] || classImageUrls.mom || classImageUrls.dad || classImageUrls.kid;

  let classLoaded = false;
  if (targetClassUrl && typeof targetClassUrl === 'string' && targetClassUrl.startsWith('http')) {
    try {
      const directClassUrl = await resolveDirectImageUrl(targetClassUrl);
      const res = await fetch(directClassUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ENOS-Bot/1.0' },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const classImg = await loadImage(Buffer.from(arrayBuf));
        ctx.drawImage(classImg, 20, 30, 340, 320);
        classLoaded = true;
      }
    } catch (e) {}
  }

  if (!classLoaded) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    drawRoundedRect(ctx, 30, 60, 320, 260, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const classTitles: Record<string, string> = { mom: '🛡️ M.O.M. COMBAT TRIAD', dad: '🔨 D.A.D. COMBAT TRIAD', kid: '⚡ K.I.D. COMBAT TRIAD' };
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(classTitles[activeClass] || 'COMBAT TRIAD', 50, 110);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Class Engaged in Battle', 50, 140);
  }

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

  return canvas.toBuffer('image/png');
}
