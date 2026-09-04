import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

const TIMEZONE = process.env.BOT_TIMEZONE || 'Asia/Manila';

function getTargetDatesForOffset(daysAhead = 0) {
  const target = new Date(Date.now() + daysAhead * 86400000);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(target);
  const map = parts.reduce((acc: Record<string, string>, p) => ({ ...acc, [p.type]: p.value }), {});
  return {
    mmDd: `${map.month}-${map.day}`,
    yyyyMmDd: `${map.year}-${map.month}-${map.day}`,
  };
}

// GET /api/social/birthday/queue — Fetch unsent birthday queue items
export async function GET(req: NextRequest) {
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
          try {
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
                is_dismissed: false,
              });
          } catch {
            // duplicate key or other insert error — safe to ignore
          }
        }
      }
    }

    const { yyyyMmDd: todayDate } = getTargetDatesForOffset(0);
    const { yyyyMmDd: maxDate } = getTargetDatesForOffset(3);

    const { data, error } = await supabaseAdmin
      .from('birthday_queue')
      .select('*')
      .eq('is_sent', false)
      .or('is_dismissed.is.null,is_dismissed.eq.false')
      .gte('target_date', todayDate)
      .lte('target_date', maxDate)
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
          is_dismissed: false,
        })
        .eq('id', id)
        .eq('guild_id', guildId);

      if (dbError) throw new Error(dbError.message);

      return NextResponse.json({ success: true, sent: true });
    }

    if (action === 'delete' || action === 'dismiss') {
      // Mark as dismissed so that auto-sync does not recreate this item for this target_date
      const { error: dbError } = await supabaseAdmin
        .from('birthday_queue')
        .update({
          is_dismissed: true,
          is_approved: false,
        })
        .eq('id', id)
        .eq('guild_id', guildId);

      if (dbError) throw new Error(dbError.message);

      return NextResponse.json({ success: true, deleted: true, dismissed: true });
    }

    if (action === 'send_admin_alert') {
      const { data: item } = await supabaseAdmin
        .from('birthday_queue')
        .select('*')
        .eq('id', id)
        .eq('guild_id', guildId)
        .maybeSingle();

      if (!item) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

      const { data: settings } = await supabaseAdmin
        .from('guild_settings')
        .select('log_channel_id, birthday_channel_id')
        .eq('guild_id', guildId)
        .maybeSingle();

      const { data: gConfig } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'birthday')
        .maybeSingle();

      const adminChanId = gConfig?.config?.admin_channel_id
        || gConfig?.config?.notification_channel_id
        || settings?.log_channel_id
        || settings?.birthday_channel_id;

      if (!adminChanId) {
        return NextResponse.json({ error: 'No admin or log channel configured' }, { status: 400 });
      }

      if (!process.env.DISCORD_TOKEN) {
        return NextResponse.json({ error: 'Missing DISCORD_TOKEN configuration' }, { status: 500 });
      }

      const isItemApproved = item.is_approved;
      const hasNotes = Boolean(item.scratchpad_text?.trim());
      const statusStr = isItemApproved
        ? '✅ **Approved & Scheduled** (Ready to release on birthday)'
        : hasNotes
        ? '📝 **Draft Ready** (Needs final approval on Dashboard)'
        : '⚠️ **Needs Review** (Visit Dashboard to customize greeting)';

      const discordRes = await fetch(`https://discord.com/api/v10/channels/${adminChanId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: '🎂 Upcoming Birthday Reminder',
            description: `🎉 **Upcoming (${item.target_date})** for <@${item.user_id}>!\n\n` +
              `• **Status**: ${statusStr}\n` +
              (item.ign ? `• **IGN**: \`${item.ign}\`\n` : '') +
              (hasNotes ? `• **Greeting Preview**:\n> *${item.scratchpad_text.slice(0, 150)}${item.scratchpad_text.length > 150 ? '...' : ''}*\n\n` : '\n') +
              `Manage and authorize greetings on the **ENOS Dashboard** under Social ➜ Birthday Queue.`,
            color: isItemApproved ? 0x10B981 : 0xF43F5E,
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        return NextResponse.json({ error: `Discord API error: ${errText}` }, { status: 500 });
      }

      try {
        await supabaseAdmin
          .from('birthday_queue')
          .update({ admin_alert_sent: true })
          .eq('id', id);
      } catch (updateErr) {
        console.warn('Failed to update admin_alert_sent:', updateErr);
      }

      return NextResponse.json({ success: true, alert_sent: true });
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
