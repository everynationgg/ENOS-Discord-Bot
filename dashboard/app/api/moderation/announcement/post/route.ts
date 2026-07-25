import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

// POST /api/moderation/announcement/post — Post an announcement immediately as the bot
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { guild_id, channel_id, message } = body;

    if (!channel_id || typeof channel_id !== 'string' || !channel_id.trim()) {
      return NextResponse.json(
        { success: false, error: 'Target Channel ID is required.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Announcement message text is required.' },
        { status: 400 }
      );
    }

    if (!DISCORD_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'DISCORD_TOKEN is missing in server environment variables.' },
        { status: 500 }
      );
    }

    // Dispatch message to Discord Channel via REST API
    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channel_id.trim()}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message.trim(),
      }),
    });

    if (!discordRes.ok) {
      const errJson = await discordRes.json().catch(() => ({}));
      const errMsg = errJson?.message || discordRes.statusText;
      return NextResponse.json(
        { success: false, error: `Discord API Error (${discordRes.status}): ${errMsg}` },
        { status: discordRes.status }
      );
    }

    const sentMessageData = await discordRes.json();
    const guildId = guild_id || process.env.DISCORD_GUILD_ID || '';

    // Log bot event in Supabase
    if (guildId) {
      await supabaseAdmin.from('bot_event_logs').insert({
        guild_id: guildId,
        event_type: 'announcement_posted',
        details: {
          channel_id,
          message_id: sentMessageData.id,
          scheduled: false,
          created_by: session.user?.name || session.user?.email || 'Admin',
        },
      }).catch((e) => console.warn('[LOG ANNOUNCEMENT ERROR]:', e?.message));
    }

    return NextResponse.json({
      success: true,
      message_id: sentMessageData.id,
    });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT POST EXCEPTION]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
