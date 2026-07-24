import { NextRequest, NextResponse } from 'next/server';
import { renderBossImage } from '@/lib/bossCanvas';

// POST /api/gaming/boss/render-preview — Generate live composite canvas PNG preview for Weekly Boss setup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const buffer = await renderBossImage({
      bossName: body.bossName || 'WEEKLY BOSS',
      customImageUrl: body.imageUrl || null,
      customBgUrl: body.bgUrl || null,
      userClassKey: body.userClassKey || 'mom',
      classImageUrls: {
        mom: body.momImageUrl || null,
        dad: body.dadImageUrl || null,
        kid: body.kidImageUrl || null,
      },
      isOverkill: body.isOverkill ?? false,
      viewMode: body.viewMode || 'spawn',
      lastAction: body.lastAction || '',
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to render preview' }, { status: 500 });
  }
}
