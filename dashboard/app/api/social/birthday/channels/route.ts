import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/birthday/channels — Fetch live text/announcement channels for the guild
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guildId = req.nextUrl.searchParams.get('guild_id') || process.env.DISCORD_GUILD_ID!;
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

  if (token) {
    try {
      const [chanRes, threadRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
        }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/threads/active`, {
          headers: { Authorization: `Bot ${token}` },
        }),
      ]);

      if (chanRes.ok) {
        const channels = await chanRes.json();
        const threadData = threadRes.ok ? await threadRes.json() : { threads: [] };
        const threads = threadData.threads || [];

        const channelNameMap = new Map<string, string>();
        channels.forEach((c: any) => channelNameMap.set(c.id, c.name));

        const channelList: any[] = [];

        const topChannels = channels
          .filter((c: any) => c.type === 0 || c.type === 5 || c.type === 15)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        for (const c of topChannels) {
          channelList.push({
            id: c.id,
            name: c.type === 15 ? `💬 Forum: ${c.name} (Creates New Threads)` : `# ${c.name}`,
            type: c.type,
          });

          const childThreads = threads
            .filter((t: any) => t.parent_id === c.id)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));

          for (const t of childThreads) {
            channelList.push({
              id: t.id,
              name: `    └ 🧵 Thread: ${t.name}`,
              type: t.type,
              parent_id: t.parent_id,
            });
          }
        }

        const matchedThreadIds = new Set(channelList.filter((x) => x.parent_id).map((x) => x.id));
        threads.forEach((t: any) => {
          if (!matchedThreadIds.has(t.id)) {
            const parentName = channelNameMap.get(t.parent_id) || 'channel';
            channelList.push({
              id: t.id,
              name: `🧵 Thread: ${t.name} (in #${parentName})`,
              type: t.type,
              parent_id: t.parent_id,
            });
          }
        });

        if (channelList.length > 0) {
          return NextResponse.json(channelList);
        }
      }
    } catch (e) {}
  }

  // Fallback: Query all configured channels from Supabase guild_config
  try {
    const { data: configs } = await supabaseAdmin
      .from('guild_config')
      .select('feature_key, config')
      .eq('guild_id', guildId);

    const channelMap = new Map<string, string>();

    // Common server channels
    channelMap.set('1530883419678969856', '# birthdays-and-leaderboards');
    channelMap.set('1530653518724333619', '# boss-bounty-rpg');
    channelMap.set('1522671232657653810', '# lfg-party-finder');
    channelMap.set('1111875254588031026', '# general-chat');
    channelMap.set('1345255211207364700', '# free-game-alerts');

    (configs || []).forEach((row: any) => {
      const c = row.config || {};
      if (c.birthday_channel_id) channelMap.set(c.birthday_channel_id, `# birthday-announcements (${c.birthday_channel_id.slice(-4)})`);
      if (c.leaderboard_channel_id) channelMap.set(c.leaderboard_channel_id, `# leaderboards (${c.leaderboard_channel_id.slice(-4)})`);
      if (c.notification_channel_id) channelMap.set(c.notification_channel_id, `# notifications (${c.notification_channel_id.slice(-4)})`);
      if (c.channel_id) channelMap.set(c.channel_id, `# ${row.feature_key}-channel (${c.channel_id.slice(-4)})`);
      if (c.lfg_channel_id) channelMap.set(c.lfg_channel_id, `# lfg-posts (${c.lfg_channel_id.slice(-4)})`);
      if (Array.isArray(c.allowed_channels)) {
        c.allowed_channels.forEach((item: any) => {
          if (item?.channel_id) channelMap.set(item.channel_id, `# ${item.topic || 'game-channel'} (${item.channel_id.slice(-4)})`);
        });
      }
    });

    const fallbackList = Array.from(channelMap.entries()).map(([id, name]) => ({ id, name }));
    return NextResponse.json(fallbackList);
  } catch (err: any) {
    return NextResponse.json([{ id: '1530883419678969856', name: '# birthdays-and-leaderboards (1530883419678969856)' }]);
  }
}

// Simple fallback logger since console.warn is fine
const logger = {
  warn: (...args: any[]) => console.warn(...args),
};
