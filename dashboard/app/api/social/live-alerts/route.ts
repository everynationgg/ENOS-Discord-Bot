import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/live-alerts — Fetch registered live alert channels/streamers
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;

  try {
    const { data, error } = await supabaseAdmin
      .from('live_alerts')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/social/live-alerts — Add new Twitch or TikTok live alert target
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { platform, handle, channel_id, guild_id } = body;

    if (!platform || !['twitch', 'tiktok'].includes(platform)) {
      return NextResponse.json({ error: 'Platform must be twitch or tiktok' }, { status: 400 });
    }

    const cleanHandle = (handle || '').replace(/^@/, '').trim();
    if (!cleanHandle || !channel_id) {
      return NextResponse.json({ error: 'Missing handle or target channel_id' }, { status: 400 });
    }

    const targetGuildId = guild_id || process.env.DISCORD_GUILD_ID!;

    const displayName = (body.display_name || cleanHandle).trim();
    const targetChannelId = channel_id.trim();

    const { data, error } = await supabaseAdmin
      .from('live_alerts')
      .insert({
        guild_id: targetGuildId,
        platform,
        handle: cleanHandle,
        display_name: displayName,
        alert_channel_id: targetChannelId,
        is_live: false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, alert: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/social/live-alerts?id=... — Remove a live alert target
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing alert id parameter' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('live_alerts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
