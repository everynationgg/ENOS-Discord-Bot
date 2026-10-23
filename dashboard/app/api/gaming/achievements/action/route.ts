import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const guildId =
      searchParams.get('guild_id') ||
      searchParams.get('guildId') ||
      req.cookies.get('enos_guild_id')?.value ||
      process.env.DISCORD_GUILD_ID ||
      'global';

    // Fetch recruitment achievement config (check guildId first, fallback to 'global')
    const { data: configRows } = await supabase
      .from('guild_config')
      .select('guild_id, enabled, config, updated_at')
      .eq('feature_key', 'recruitment_achievement')
      .in('guild_id', [guildId, 'global'])
      .order('updated_at', { ascending: false })
      .limit(1);

    const configData = configRows?.[0] || null;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, inviteId, newStatus, config, enabled } = body;
    const targetGuildId =
      body.guild_id ||
      body.guildId ||
      req.cookies.get('enos_guild_id')?.value ||
      process.env.DISCORD_GUILD_ID ||
      'global';

    if (action === 'save_config') {
      const nowIso = new Date().toISOString();
      const rowsToUpsert = [
        {
          guild_id: targetGuildId,
          feature_key: 'recruitment_achievement',
          enabled: enabled ?? true,
          config,
          updated_at: nowIso,
        },
      ];
      if (targetGuildId !== 'global') {
        rowsToUpsert.push({
          guild_id: 'global',
          feature_key: 'recruitment_achievement',
          enabled: enabled ?? true,
          config,
          updated_at: nowIso,
        });
      }

      const { error } = await supabase
        .from('guild_config')
        .upsert(rowsToUpsert, { onConflict: 'guild_id,feature_key' });

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

      await supabase.from('system_logs').insert({
        event_type: 'achievement_dispatch_card',
        payload: { channel_id: channelId, timestamp: new Date().toISOString() },
      });

      const token = process.env.DISCORD_TOKEN;
      if (token) {
        try {
          const { data: configData } = await supabase
            .from('guild_config')
            .select('config')
            .eq('guild_id', targetGuildId)
            .eq('feature_key', 'recruitment_achievement')
            .maybeSingle();

          const customList = configData?.config?.custom_achievements;
          const activeCard = Array.isArray(customList) && customList.length > 0 ? customList[0] : null;

          const title = activeCard?.name ? `📜 Achievement: ${activeCard.name} — Every Nation` : '📜 Achievement: Recruitment — Every Nation';
          const description = activeCard?.description || 'Track successful member invitations to Every Nation.';

          let tierDesc = '';
          if (activeCard?.tiers) {
            const t = activeCard.tiers;
            tierDesc =
              `💜 **Enis (${t.enis?.threshold || 5} Required)** → Title: **"${t.enis?.title || 'They Who Herald the Nation'}"** | *${t.enis?.reward_val || '50 Vault Coins'}*\n` +
              `🔥 **Enara (${t.enara?.threshold || 50} Required)** → Title: **"${t.enara?.title || 'Those Who Exalt the Nation'}"** | *${t.enara?.reward_val || '1 Month Nitro + Boost'}*\n` +
              `👑 **Enorium (${t.enorium?.threshold || 100} Required)** → Title: **"${t.enorium?.title || 'The One Who Ordains the Nation'}"** | *${t.enorium?.reward_val || '1 Year Nitro + Boost'}*`;
          } else {
            tierDesc =
              '💜 **Enis (5 Invites)** → Title: **"They Who Herald the Nation"** | *50 Vault Coins*\n' +
              '🔥 **Enara (50 Invites)** → Title: **"Those Who Exalt the Nation"** | *1 Month Discord Nitro + Boost*\n' +
              '👑 **Enorium (100 Invites)** → Title: **"The One Who Ordains the Nation"** | *1 Year Discord Nitro + Boost*';
          }

          const embed: Record<string, unknown> = {
            title,
            description: `${description}\n\n${tierDesc}`,
            color: 0x8b5cf6,
            footer: { text: `ENOS Community Achievements System • Card 1 of ${customList?.length || 3}` },
            timestamp: new Date().toISOString(),
          };

          let finalImageUrl = activeCard?.image_url;
          if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
            finalImageUrl = 'https://raw.githubusercontent.com/everynationgg/ENOS-Discord-Bot/main/dashboard/public/images/achievements-card-preview.png';
          }

          embed.image = { url: finalImageUrl };

          const components = [
            {
              type: 1,
              components: [
                { type: 2, custom_id: 'achievement_prev', label: '⬅ Previous', style: 2 },
                { type: 2, custom_id: 'achievement_progress', label: '📊 Check Progress', style: 1 },
                { type: 2, custom_id: 'achievement_next', label: '➡ Next', style: 2 },
                { type: 2, custom_id: 'achievement_rules', label: '📜 Rules', style: 2 },
              ],
            },
          ];

          await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [embed], components }),
          });
        } catch (e) {
          console.warn('[DIRECT DISPATCH ERROR]:', e);
        }
      }

      return NextResponse.json({ success: true, message: 'Master Achievement Card successfully posted to Discord!' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
