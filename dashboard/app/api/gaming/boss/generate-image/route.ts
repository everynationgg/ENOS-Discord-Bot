import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameUniverse, bossName, customStyle, guild_id } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in server environment.' }, { status: 500 });
    }

    const targetCharacter = bossName || 'Corrupted RPG Boss';
    const targetGame = gameUniverse || 'Popular RPG Universe';
    const extraStyle = customStyle ? `, ${customStyle}` : '';

    const prompt = `Full-body dramatic anime pixel-art style portrait of a glitched, corrupted boss entity inspired by ${targetCharacter} from ${targetGame}. Dark cyberspace background with matrix code streams. Red and cyan chromatic aberration glitch distortion overlays, digital scanlines, corrupted particle artifacts${extraStyle}. Cinematic 16:9 ratio RPG boss art banner. High contrast, highly detailed, no text, no logos.`;

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    // 1. Try Imagen 3 API (imagen-3.0-generate-002)
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
      } else {
        console.warn('[BOSS AI IMAGE] Imagen 3 returned status:', res.status, await res.text());
      }
    } catch (e: any) {
      console.warn('[BOSS AI IMAGE] Imagen 3 fetch failed:', e.message);
    }

    // 2. Fallback: Try imagen-3.0-fast-generate-001
    if (!imageBuffer) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-fast-generate-001:generateImages?key=${apiKey}`,
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
        console.warn('[BOSS AI IMAGE] Imagen fast fetch failed:', e.message);
      }
    }

    // 3. Fallback: Try Gemini 2.0 Flash generateContent
    if (!imageBuffer) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
          if (imagePart) {
            imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
            mimeType = imagePart.inlineData.mimeType || 'image/png';
          }
        }
      } catch (e: any) {
        console.warn('[BOSS AI IMAGE] Gemini Flash fetch failed:', e.message);
      }
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'AI image generation failed across all models. Please check your Gemini API key or try again.' },
        { status: 500 }
      );
    }

    // Save to Supabase Storage 'boss-images' bucket
    const fileName = `boss-ai-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('boss-images')
      .upload(fileName, imageBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
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
