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

// POST /api/gaming/trivia/action — Execute manual trivia actions (trigger, skip, reroll)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;
    const guildId = getGuildId(req, body);

    if (!['trigger', 'skip', 'reroll'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be trigger, skip, or reroll.' }, { status: 400 });
    }

    if (action === 'trigger' || action === 'reroll') {
      // For reroll: first close any active session, then trigger a new one
      if (action === 'reroll') {
        const { data: activeDrop } = await supabaseAdmin
          .from('trivia_drops')
          .select('id')
          .eq('guild_id', guildId)
          .eq('status', 'active')
          .maybeSingle();

        if (activeDrop) {
          await supabaseAdmin
            .from('trivia_drops')
            .update({ status: 'skipped', completed_at: new Date().toISOString() })
            .eq('id', activeDrop.id);
        }
      }

      // Set a signal in guild_config so the bot picks it up on its next 5-minute check
      // and immediately triggers a drop regardless of scheduled time
      const { data: existing } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'trivia')
        .maybeSingle();

      const existingConfig = existing?.config || {};
      const updatedConfig = {
        ...existingConfig,
        // Clear last_drop_date to allow the next cron check to trigger a drop
        last_drop_date: null,
        // Set scheduled_drop_time to a past time (00:00) so the cron immediately fires
        scheduled_drop_time: '00:00',
        scheduled_drop_date: new Date().toISOString().split('T')[0],
        // Flag for immediate trigger
        manual_trigger_requested: true,
      };

      await supabaseAdmin
        .from('guild_config')
        .update({ config: updatedConfig })
        .eq('guild_id', guildId)
        .eq('feature_key', 'trivia');

      return NextResponse.json({
        success: true,
        message: `${action === 'reroll' ? 'Reroll' : 'Force trigger'} queued. The bot will execute on next schedule check (within ~5 minutes).`,
      });
    }

    if (action === 'skip') {
      const { data: activeDrop } = await supabaseAdmin
        .from('trivia_drops')
        .select('id')
        .eq('guild_id', guildId)
        .eq('status', 'active')
        .maybeSingle();

      if (!activeDrop) {
        return NextResponse.json({ error: 'No active trivia session to skip.' }, { status: 404 });
      }

      // Mark as skipped in DB — the bot will update the Discord embed on its next check
      await supabaseAdmin
        .from('trivia_drops')
        .update({ status: 'skipped', completed_at: new Date().toISOString() })
        .eq('id', activeDrop.id);

      return NextResponse.json({ success: true, message: 'Active trivia session marked as skipped.' });
    }

    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
