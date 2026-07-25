import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

// POST /api/moderation/showcase/dispatch — Dispatch a rich showcase update to Discord
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      guild_id,
      channel_id,
      preset_type = 'major',
      title,
      summary,
      body_markdown,
      banner_url,
      video_url,
      reward_coins = 0,
      try_feature_channel,
    } = body;

    const guildId = guild_id || process.env.DISCORD_GUILD_ID || '';

    if (!channel_id || typeof channel_id !== 'string' || !channel_id.trim()) {
      return NextResponse.json(
        { success: false, error: 'Target Channel ID is required.' },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 });
    }

    if (!body_markdown || !body_markdown.trim()) {
      return NextResponse.json(
        { success: false, error: 'Body content is required.' },
        { status: 400 }
      );
    }

    if (!DISCORD_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'DISCORD_TOKEN is missing in server environment variables.' },
        { status: 500 }
      );
    }

    // 1. Insert placeholder record into Supabase first to get UUID
    const { data: showcaseRecord, error: dbErr } = await supabaseAdmin
      .from('showcase_updates')
      .insert({
        guild_id: guildId,
        channel_id: channel_id.trim(),
        preset_type,
        title: title.trim(),
        summary: summary ? summary.trim() : null,
        body_markdown: body_markdown.trim(),
        banner_url: banner_url ? banner_url.trim() : null,
        video_url: video_url ? video_url.trim() : null,
        reward_coins: Number(reward_coins) || 0,
        created_by: session.user?.name || session.user?.email || 'Admin',
      })
      .select()
      .single();

    if (dbErr) {
      console.error('[SHOWCASE DISPATCH DB ERROR]:', dbErr);
      return NextResponse.json(
        { success: false, error: `Failed to create showcase record: ${dbErr.message}` },
        { status: 500 }
      );
    }

    const showcaseId = showcaseRecord.id;

    // 2. Build Discord Embed Color
    let colorHex = 0x6366f1; // Indigo (default)
    if (preset_type === 'patch') colorHex = 0x3b82f6; // Blue
    if (preset_type === 'showcase') colorHex = 0x10b981; // Emerald

    const embed: any = {
      title: `${preset_type === 'major' ? '🚀' : preset_type === 'patch' ? '🛠️' : '🎬'} ${title.trim()}`,
      description: summary ? `*${summary.trim()}*\n\n${body_markdown.trim()}` : body_markdown.trim(),
      color: colorHex,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'ENOS Bot Feature Showcase • Server Update System',
      },
    };

    if (banner_url && banner_url.trim()) {
      embed.image = { url: banner_url.trim() };
    }

    // 3. Build ActionRow Component Buttons
    const buttons: any[] = [];

    // Optional: Try Feature Deep-link
    if (try_feature_channel && try_feature_channel.trim()) {
      buttons.push({
        type: 2, // BUTTON
        style: 5, // LINK
        label: '🚀 Try Feature Now',
        url: `https://discord.com/channels/${guildId}/${try_feature_channel.trim()}`,
      });
    }

    // Optional: Video Link Button
    if (video_url && video_url.trim()) {
      buttons.push({
        type: 2, // BUTTON
        style: 5, // LINK
        label: '🎥 Watch Video Guide',
        url: video_url.trim(),
      });
    }

    // Reward Claim Button
    if (Number(reward_coins) > 0) {
      buttons.push({
        type: 2, // BUTTON
        style: 3, // SUCCESS (Green)
        custom_id: `showcase_claim_${showcaseId}`,
        label: `🎁 Claim +${reward_coins} Vault Coins`,
      });
    }

    // Quick Feedback Button
    buttons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY (Gray)
      custom_id: `showcase_feedback_${showcaseId}`,
      label: '💬 Send Feedback',
    });

    // 4. Build Select Menu Dropdown
    const selectMenu = {
      type: 3, // STRING SELECT MENU
      custom_id: `showcase_select_${showcaseId}`,
      placeholder: '📌 Select a feature to view guide, stats & commands...',
      options: [
        {
          label: '1. Weekly World Boss RPG & 5-Stat Tree',
          value: 'rpg_boss',
          description: 'Class roles (M.O.M/D.A.D/K.I.D), AP energy & stat trees',
          emoji: { name: '⚔️' },
        },
        {
          label: '2. Daily AI Trivia Drops & Speed Scoring',
          value: 'trivia',
          description: 'Weighted channel drops, anti-cheat & podium rewards',
          emoji: { name: '🧠' },
        },
        {
          label: '3. Vault Economy, Voice Activity & Quests',
          value: 'vault',
          description: 'Earn coins in voice channels, daily quests & tier ranks',
          emoji: { name: '💰' },
        },
        {
          label: '4. Gatekeeper Onboarding & Keyform Whitelists',
          value: 'gatekeeper',
          description: 'IGN logging, game branch roles & server whitelists',
          emoji: { name: '🔐' },
        },
        {
          label: '5. Taglish AI Daily Digest & Help Desk',
          value: 'ai_digest',
          description: '24-hr channel summaries & automated AI support threads',
          emoji: { name: '🤖' },
        },
        {
          label: '6. Social Systems (Birthdays & TikTok Alerts)',
          value: 'social',
          description: 'Birthday celebrations & automated TikTok stream alerts',
          emoji: { name: '🎂' },
        },
      ],
    };

    const components: any[] = [];
    if (buttons.length > 0) components.push({ type: 1, components: buttons });
    components.push({ type: 1, components: [selectMenu] });

    // 5. Send Message via Discord REST API
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${channel_id.trim()}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
          components,
        }),
      }
    );

    if (!discordRes.ok) {
      const errJson = await discordRes.json().catch(() => ({}));
      const errMsg = errJson?.message || discordRes.statusText;
      return NextResponse.json(
        { success: false, error: `Discord API Error (${discordRes.status}): ${errMsg}` },
        { status: discordRes.status }
      );
    }

    const sentMessage = await discordRes.json();

    // 6. Update message_id in DB
    await supabaseAdmin
      .from('showcase_updates')
      .update({ message_id: sentMessage.id })
      .eq('id', showcaseId);

    // 7. Log bot event
    await supabaseAdmin
      .from('bot_event_logs')
      .insert({
        guild_id: guildId,
        event_type: 'showcase_dispatched',
        details: {
          showcase_id: showcaseId,
          channel_id,
          message_id: sentMessage.id,
          title: title.trim(),
          reward_coins,
        },
      })
      .catch((e) => console.warn('[LOG SHOWCASE ERROR]:', e?.message));

    return NextResponse.json({
      success: true,
      showcase_id: showcaseId,
      message_id: sentMessage.id,
    });
  } catch (err: any) {
    console.error('[SHOWCASE DISPATCH EXCEPTION]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
