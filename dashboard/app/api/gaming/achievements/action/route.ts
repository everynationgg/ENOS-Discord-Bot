import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Fetch recruitment achievement config
    const { data: configData } = await supabase
      .from('guild_config')
      .select('enabled, config')
      .eq('feature_key', 'recruitment_achievement')
      .maybeSingle();

    // Fetch invites list
    const { data: invites } = await supabase
      .from('member_invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      success: true,
      config: configData?.config || {},
      enabled: configData?.enabled ?? true,
      invites: invites || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, inviteId, newStatus, config, enabled } = body;

    if (action === 'save_config') {
      const { error } = await supabase
        .from('guild_config')
        .upsert(
          {
            guild_id: 'global',
            feature_key: 'recruitment_achievement',
            enabled: enabled ?? true,
            config,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id,feature_key' }
        );

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, message: 'Configuration saved successfully!' });
    }

    if (action === 'update_invite_status') {
      if (!inviteId || !newStatus) {
        return NextResponse.json({ success: false, error: 'Missing inviteId or newStatus' }, { status: 400 });
      }

      const { error } = await supabase
        .from('member_invites')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', inviteId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, message: `Invite status updated to ${newStatus}` });
    }

    if (action === 'dispatch_card') {
      const channelId = body.channel_id;
      if (!channelId) {
        return NextResponse.json({ success: false, error: 'Target Channel ID is required' }, { status: 400 });
      }

      const { error } = await supabase.from('system_logs').insert({
        event_type: 'achievement_dispatch_card',
        payload: { channel_id: channelId, timestamp: new Date().toISOString() },
      });

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, message: 'Card dispatch request sent to bot!' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
