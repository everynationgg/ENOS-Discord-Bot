import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

const TIMEZONE = process.env.BOT_TIMEZONE || 'Asia/Manila';

function getTargetDatesForOffset(daysAhead: number) {
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  date.setDate(date.getDate() + daysAhead);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return {
    mmDd: `${mm}-${dd}`,
    yyyyMmDd: `${yyyy}-${mm}-${dd}`,
  };
}

// GET /api/social/birthday/queue — Fetch unsent birthday queue items
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);

    // Auto-sync birthdays for Today (0d), 1d, 2d, 3d into birthday_queue if missing
    for (let offset = 0; offset <= 3; offset++) {
      const { mmDd, yyyyMmDd } = getTargetDatesForOffset(offset);
      const parts = mmDd.split('-');
      const mm = parts[0];
      const dd = parts[1];
      const monthNum = parseInt(mm, 10);
      const dayNum = parseInt(dd, 10);

      const possibleFormats = Array.from(
        new Set([
          `${mm}-${dd}`,
          `${monthNum}-${dayNum}`,
          `${monthNum}-${dd}`,
          `${mm}-${dayNum}`,
          `${mm}/${dd}`,
          `${monthNum}/${dayNum}`,
        ])
      );

      const { data: bdays } = await supabaseAdmin
        .from('member_birthdays')
        .select('user_id, ign, guild_id')
        .in('birth_date', possibleFormats);

      if (bdays && bdays.length > 0) {
        for (const b of bdays) {
          await supabaseAdmin
            .from('birthday_queue')
            .insert({
              guild_id: b.guild_id || guildId,
              user_id: b.user_id,
              ign: b.ign || null,
              target_date: yyyyMmDd,
              scratchpad_text: '',
              is_approved: false,
              is_sent: false,
            })
            .catch(() => {});
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('birthday_queue')
      .select('*')
      .eq('is_sent', false)
      .order('target_date', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/social/birthday/queue — Update scratchpad notes and approval status
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, scratchpad_text, draft_message, rough_notes, is_approved, action } = body;
    const guildId = getGuildId(req, body);

    if (!id) {
      return NextResponse.json({ error: 'Missing queue item ID' }, { status: 400 });
    }

    const textToSave = scratchpad_text || draft_message || rough_notes || '';

    if (action === 'send_now') {
      if (!textToSave.trim()) {
        return NextResponse.json({ error: 'Cannot send an empty birthday wish' }, { status: 400 });
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('guild_settings')
        .select('birthday_channel_id')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (settingsError || !settings?.birthday_channel_id) {
        return NextResponse.json({ error: 'Birthday announcement channel is not configured in settings.' }, { status: 400 });
      }

      if (!process.env.DISCORD_TOKEN) {
        return NextResponse.json({ error: 'Discord Token is missing from dashboard environment configurations.' }, { status: 500 });
      }

      // Send to Discord text channel
      const discordRes = await fetch(`https://discord.com/api/v10/channels/${settings.birthday_channel_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: textToSave,
        }),
      });

      if (!discordRes.ok) {
        const errDetails = await discordRes.text();
        return NextResponse.json({ error: `Discord API rejected request: ${discordRes.statusText} (${errDetails})` }, { status: 500 });
      }

      // Mark as sent & approved
      const { error: dbError } = await supabaseAdmin
        .from('birthday_queue')
        .update({
          scratchpad_text: textToSave,
          is_approved: true,
          is_sent: true,
        })
        .eq('id', id)
        .eq('guild_id', guildId);

      if (dbError) throw new Error(dbError.message);

      return NextResponse.json({ success: true, sent: true });
    }

    if (action === 'delete') {
      const { error: dbError } = await supabaseAdmin
        .from('birthday_queue')
        .delete()
        .eq('id', id)
        .eq('guild_id', guildId);

      if (dbError) throw new Error(dbError.message);

      return NextResponse.json({ success: true, deleted: true });
    }

    let isApproved = typeof is_approved === 'boolean' ? is_approved : false;
    if (action === 'approve') {
      isApproved = true;
    }

    const { error } = await supabaseAdmin
      .from('birthday_queue')
      .update({
        scratchpad_text: textToSave,
        is_approved: isApproved,
      })
      .eq('id', id)
      .eq('guild_id', guildId); // Enforce guild isolation

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
