import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/moderation/announcement/queue — List scheduled announcements
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

    const { data, error } = await supabaseAdmin
      .from('scheduled_announcements')
      .select('*')
      .eq('guild_id', guildId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      // If table doesn't exist yet, return empty list cleanly
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw new Error(error.message);
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('[ANNOUNCEMENT QUEUE GET ERROR]:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE /api/moderation/announcement/queue — Cancel/Delete a scheduled announcement
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Announcement ID is required.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('scheduled_announcements')
      .delete()
      .eq('id', id)
      .eq('guild_id', guildId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT QUEUE DELETE ERROR]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
