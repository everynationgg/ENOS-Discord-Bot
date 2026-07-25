import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/moderation/announcement/schedule — Queue a scheduled announcement
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { guild_id, channel_id, message, scheduled_at } = body;
    const guildId = guild_id || process.env.DISCORD_GUILD_ID || '';

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

    if (!scheduled_at) {
      return NextResponse.json(
        { success: false, error: 'Scheduled Date & Time is required.' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid Date & Time format.' },
        { status: 400 }
      );
    }

    if (scheduledDate.getTime() <= Date.now() + 10000) {
      return NextResponse.json(
        { success: false, error: 'Scheduled time must be at least 10 seconds in the future.' },
        { status: 400 }
      );
    }

    // Insert into scheduled_announcements
    const { data, error } = await supabaseAdmin
      .from('scheduled_announcements')
      .insert({
        guild_id: guildId,
        channel_id: channel_id.trim(),
        message: message.trim(),
        scheduled_at: scheduledDate.toISOString(),
        status: 'pending',
        created_by: session.user?.name || session.user?.email || 'Admin',
      })
      .select()
      .single();

    if (error) {
      console.error('[SCHEDULE ANNOUNCEMENT ERROR]:', error);
      return NextResponse.json(
        { success: false, error: `Failed to queue announcement: ${error.message}` },
        { status: 500 }
      );
    }

    // Log bot event in Supabase
    await supabaseAdmin.from('bot_event_logs').insert({
      guild_id: guildId,
      event_type: 'announcement_scheduled',
      details: {
        announcement_id: data.id,
        channel_id,
        scheduled_at: scheduledDate.toISOString(),
        created_by: session.user?.name || session.user?.email || 'Admin',
      },
    }).catch((e) => console.warn('[LOG SCHEDULE ERROR]:', e?.message));

    return NextResponse.json({
      success: true,
      announcement: data,
    });
  } catch (err: any) {
    console.error('[SCHEDULE ANNOUNCEMENT EXCEPTION]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
