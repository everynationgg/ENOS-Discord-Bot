import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// POST /api/moderation/helpdesk/sync — Post the permanent Help Desk trigger embed card
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { launcher_channel_id } = body;

    if (!launcher_channel_id || !launcher_channel_id.trim()) {
      return NextResponse.json({ error: 'Missing launcher_channel_id' }, { status: 400 });
    }

    if (!DISCORD_TOKEN) {
      return NextResponse.json({ error: 'DISCORD_TOKEN is missing in the dashboard environment.' }, { status: 500 });
    }

    // Call Discord API directly to send the Launcher card
    const res = await fetch(`https://discord.com/api/v10/channels/${launcher_channel_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [
          {
            title: '🤖 AI Support Help Desk',
            description: 'Need help or have a question? Click the button below to start a private chat thread with our AI Assistant.',
            color: 9133302, // 0x8B5CF6 (Electric Violet)
            footer: {
              text: 'Every Nation Support Desk',
            },
            timestamp: new Date().toISOString(),
          },
        ],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 1, // Primary (Blurple/Violet)
                label: 'Start Chat',
                custom_id: 'helpdesk_start',
                emoji: {
                  name: '💬',
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord API error: ${res.statusText} (${errText})`);
    }

    const result = await res.json();
    return NextResponse.json({ success: true, messageId: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
