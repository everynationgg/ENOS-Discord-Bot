import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// GET /api/social/birthday/channels — Fetch live text/announcement channels for the guild
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!DISCORD_TOKEN) {
    // If bot token is not configured on the dashboard, return a helpful fallback message
    logger.warn('[BIRTHDAYS] DISCORD_TOKEN is missing in dashboard environment variables.');
    return NextResponse.json([
      { id: 'fallback-text', name: '⚠️ Set DISCORD_TOKEN in env to load channels' }
    ]);
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord API error: ${res.statusText} (${errText})`);
    }

    const channels = await res.json();

    // Filter for Text (0) and Announcement/News (5) channels
    const textChannels = channels
      .filter((c: any) => c.type === 0 || c.type === 5)
      .map((c: any) => ({
        id: c.id,
        name: `# ${c.name}`,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json(textChannels);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Simple fallback logger since console.warn is fine
const logger = {
  warn: (...args: any[]) => console.warn(...args),
};
