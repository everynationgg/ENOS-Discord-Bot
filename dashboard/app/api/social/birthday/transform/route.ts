import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

// POST /api/social/birthday/transform — Call Gemini API to polish admin notes
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { user_id, ign, current_text } = body;
    const guildId = getGuildId(req, body);

    if (!user_id || !ign) {
      return NextResponse.json({ error: 'Missing user_id or ign context' }, { status: 400 });
    }

    // 1. Fetch AI Prompt Formula from guild_settings
    const { data: settings } = await supabaseAdmin
      .from('guild_settings')
      .select('ai_prompt_formula')
      .eq('guild_id', guildId)
      .maybeSingle();

    const formula = settings?.ai_prompt_formula || 'You are an enthusiastic gaming community bot. Write a short, fun, 2-sentence birthday wish. Keep it gaming-themed.';

    // 2. Build LLM prompt
    const prompt = `System Prompt: Take the rough, fragmented notes provided by the admin and transform them into a polished, highly engaging, 2-to-3 sentence birthday announcement for our community server. Follow these core style guidelines: ${formula}

Do not include any placeholders, hashtags, or meta-commentary. Output ONLY the final message ready for Discord.

Context:
- Discord User Tag: <@${user_id}>
- In-Game Name (IGN): ${ign}
- Admin Notes to transform: ${current_text || '(No additional notes provided, write a friendly generic birthday post based on the style guidelines)'}`;

    // 3. Request Gemini API using native fetch
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} (${errText})`);
    }

    const resData = await response.json();
    const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
