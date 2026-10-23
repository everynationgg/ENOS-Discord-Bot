import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, bodyGuildId?: string) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    bodyGuildId ||
    req.cookies.get('enos_guild_id')?.value ||
    process.env.DISCORD_GUILD_ID!
  );
}

// GET /api/social/live-alerts — Fetch registered live alert channels/streamers
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guildId = getGuildId(req);

  try {
    // 1. Fetch current live_alerts records ordered by updated_at
    const { data, error } = await supabaseAdmin
      .from('live_alerts')
      .select('*')
      .eq('guild_id', guildId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // 2. Fetch guild_config for live_alerts to ensure any approved streamers are synced
    const { data: configRow } = await supabaseAdmin
      .from('guild_config')
      .select('config')
      .eq('guild_id', guildId)
      .eq('feature_key', 'live_alerts')
      .maybeSingle();

    const cfg = configRow?.config as {
      streamers?: Array<{
        platform?: string;
        handle?: string;
        display_name?: string;
        alert_channel_id?: string;
        channel_id?: string;
      }>;
      alert_channel_id?: string;
    } | null;

    const streamers = Array.isArray(cfg?.streamers) ? cfg.streamers : [];

    if (streamers.length > 0) {
      const existingKeys = new Set(
        (data || []).map(
          (row) => `${row.platform}:${(row.handle || '').toLowerCase().replace(/^@/, '')}`
        )
      );

      const missingStreamers = streamers.filter((s) => {
        const cleanHandle = (s.handle || '').toLowerCase().replace(/^@/, '');
        const platform = s.platform || 'twitch';
        return cleanHandle && !existingKeys.has(`${platform}:${cleanHandle}`);
      });

      if (missingStreamers.length > 0) {
        const rowsToUpsert = missingStreamers.map((s) => ({
          guild_id: guildId,
          platform: s.platform || 'twitch',
          handle: (s.handle || '').replace(/^@/, '').trim(),
          display_name: (s.display_name || s.handle || '').replace(/^@/, '').trim(),
          alert_channel_id: s.alert_channel_id || s.channel_id || cfg?.alert_channel_id || null,
          is_live: false,
        }));

        await supabaseAdmin
          .from('live_alerts')
          .upsert(rowsToUpsert, { onConflict: 'guild_id,platform,handle', ignoreDuplicates: true });

        // Re-fetch to return all alerts with their generated database IDs
        const { data: reFetched, error: reErr } = await supabaseAdmin
          .from('live_alerts')
          .select('*')
          .eq('guild_id', guildId)
          .order('updated_at', { ascending: false });

        if (reErr) throw reErr;
        return NextResponse.json(reFetched || []);
      }
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/social/live-alerts — Add new Twitch or TikTok live alert target
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as {
      platform?: string;
      handle?: string;
      channel_id?: string;
      guild_id?: string;
      display_name?: string;
    };
    const { platform, handle, channel_id, guild_id } = body;

    if (!platform || !['twitch', 'tiktok'].includes(platform)) {
      return NextResponse.json({ error: 'Platform must be twitch or tiktok' }, { status: 400 });
    }

    const cleanHandle = (handle || '').replace(/^@/, '').trim();
    if (!cleanHandle || !channel_id) {
      return NextResponse.json({ error: 'Missing handle or target channel_id' }, { status: 400 });
    }

    const targetGuildId = getGuildId(req, guild_id);
    const displayName = (body.display_name || cleanHandle).trim();
    const targetChannelId = channel_id.trim();

    const { data, error } = await supabaseAdmin
      .from('live_alerts')
      .upsert(
        {
          guild_id: targetGuildId,
          platform,
          handle: cleanHandle,
          display_name: displayName,
          alert_channel_id: targetChannelId,
          is_live: false,
        },
        { onConflict: 'guild_id,platform,handle' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, alert: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/social/live-alerts?id=... — Remove a live alert target
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const handleParam = req.nextUrl.searchParams.get('handle');
  const guildId = getGuildId(req);

  if (!id && !handleParam) {
    return NextResponse.json({ error: 'Missing alert id or handle parameter' }, { status: 400 });
  }

  try {
    let deletedHandle = handleParam ? handleParam.replace(/^@/, '').trim() : '';

    if (id) {
      const { data: record } = await supabaseAdmin
        .from('live_alerts')
        .select('handle, guild_id')
        .eq('id', id)
        .eq('guild_id', guildId)
        .maybeSingle();

      if (record?.handle) {
        deletedHandle = record.handle.replace(/^@/, '').trim();
        await supabaseAdmin
          .from('live_alerts')
          .delete()
          .ilike('handle', deletedHandle)
          .eq('guild_id', record.guild_id || guildId);
      }
      await supabaseAdmin.from('live_alerts').delete().eq('id', id).eq('guild_id', guildId);
    } else if (handleParam) {
      deletedHandle = handleParam.replace(/^@/, '').trim();
      await supabaseAdmin
        .from('live_alerts')
        .delete()
        .ilike('handle', deletedHandle)
        .eq('guild_id', guildId);
    }

    if (deletedHandle) {
      const { data: configRow } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'live_alerts')
        .maybeSingle();

      const cfg = configRow?.config as { streamers?: Array<{ handle?: string }> } | null;
      if (Array.isArray(cfg?.streamers)) {
        const cleanLower = deletedHandle.toLowerCase();
        const updatedStreamers = cfg.streamers.filter(
          (s) => (s.handle || '').toLowerCase().replace(/^@/, '') !== cleanLower
        );
        await supabaseAdmin
          .from('guild_config')
          .update({
            config: { ...cfg, streamers: updatedStreamers },
            updated_at: new Date().toISOString(),
          })
          .eq('guild_id', guildId)
          .eq('feature_key', 'live_alerts');
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
