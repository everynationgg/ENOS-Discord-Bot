import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameUniverse, bossName, customStyle } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const targetCharacter = bossName || 'Corrupted RPG Boss';
    const targetGame = gameUniverse || 'Popular RPG Universe';
    const extraStyle = customStyle ? `, ${customStyle}` : '';

    const prompt = `Full-body dramatic anime pixel-art style portrait of a glitched, corrupted boss entity inspired by ${targetCharacter} from ${targetGame}. Dark cyberspace background with matrix code streams. Red and cyan chromatic aberration glitch distortion overlays, digital scanlines, corrupted particle artifacts${extraStyle}. Cinematic 16:9 ratio RPG boss art banner. High contrast, highly detailed, no text, no logos.`;

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    // 1. Try Imagen 3 API if API key is provided
    if (apiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '16:9',
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const base64Data = data.generatedImages?.[0]?.image?.imageBytes;
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
          }
        }
      } catch (e: any) {
        console.warn('[BOSS AI IMAGE] Imagen 3 fetch failed:', e.message);
      }
    }

    // 2. High-Performance Fallback: Pollinations AI (FLUX / SDXL Engine — 100% Guaranteed, Free, No API Key Required)
    if (!imageBuffer) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=450&nologo=true&seed=${seed}&model=flux`;

        const res = await fetch(pollinationsUrl, { headers: { 'User-Agent': 'ENOS-Discord-Bot/1.0' } });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength > 1000) {
            imageBuffer = Buffer.from(arrayBuf);
            mimeType = res.headers.get('content-type') || 'image/jpeg';
          }
        } else {
          console.warn('[BOSS AI IMAGE] Pollinations flux returned status:', res.status);
        }
      } catch (e: any) {
        console.warn('[BOSS AI IMAGE] Pollinations AI fetch failed:', e.message);
      }
    }

    // 3. Secondary Fallback: Pollinations Standard SDXL
    if (!imageBuffer) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=450&nologo=true&seed=${seed}`;

        const res = await fetch(pollinationsUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength > 1000) {
            imageBuffer = Buffer.from(arrayBuf);
            mimeType = res.headers.get('content-type') || 'image/jpeg';
          }
        }
      } catch (e: any) {
        console.warn('[BOSS AI IMAGE] Pollinations standard fetch failed:', e.message);
      }
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'AI image generation service failed. Please check network connection or try again.' },
        { status: 500 }
      );
    }

    // Upload image to Supabase Storage 'boss-images' bucket
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `boss-ai-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('boss-images')
      .upload(fileName, imageBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      // If bucket does not exist or upload error, return base64 preview directly
      return NextResponse.json({
        success: true,
        imageUrl: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
        previewBase64: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
        note: `Storage upload note: ${uploadError.message}`,
      });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('boss-images')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      previewBase64: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
    });
  } catch (err: any) {
    console.error('[BOSS AI GENERATOR API] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
