import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

// POST /api/moderation/showcase/dispatch — Dispatch or Edit a dynamic showcase update on Discord
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      showcase_id, // If provided, updates existing showcase post
      guild_id,
      channel_id,
      feedback_channel_id,
      preset_type = 'major',
      title_size = 'h1',
      title,
      body_size = 'normal',
      summary,
      body_markdown,
      banner_url,
      video_url,
      reward_coins = 0,
      try_feature_channel,
      dropdown_items = [],
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

    let activeShowcaseId = showcase_id;
    let existingMessageId: string | null = null;

    if (activeShowcaseId) {
      // 1A. Update existing record in Supabase
      const { data: updatedRecord, error: updateErr } = await supabaseAdmin
        .from('showcase_updates')
        .update({
          guild_id: guildId,
          channel_id: channel_id.trim(),
          feedback_channel_id: feedback_channel_id ? feedback_channel_id.trim() : null,
          preset_type,
          title_size,
          title: title.trim(),
          body_size,
          summary: summary ? summary.trim() : null,
          body_markdown: body_markdown.trim(),
          banner_url: banner_url ? banner_url.trim() : null,
          video_url: video_url ? video_url.trim() : null,
          reward_coins: Number(reward_coins) || 0,
          try_feature_channel: try_feature_channel ? try_feature_channel.trim() : null,
          dropdown_items: Array.isArray(dropdown_items) ? dropdown_items : [],
        })
        .eq('id', activeShowcaseId)
        .select()
        .single();

      if (updateErr) {
        console.error('[SHOWCASE UPDATE DB ERROR]:', updateErr);
        return NextResponse.json(
          { success: false, error: `Failed to update showcase record: ${updateErr.message}` },
          { status: 500 }
        );
      }

      existingMessageId = updatedRecord.message_id;
    } else {
      // 1B. Insert new record into Supabase to generate UUID
      const { data: showcaseRecord, error: dbErr } = await supabaseAdmin
        .from('showcase_updates')
        .insert({
          guild_id: guildId,
          channel_id: channel_id.trim(),
          feedback_channel_id: feedback_channel_id ? feedback_channel_id.trim() : null,
          preset_type,
          title_size,
          title: title.trim(),
          body_size,
          summary: summary ? summary.trim() : null,
          body_markdown: body_markdown.trim(),
          banner_url: banner_url ? banner_url.trim() : null,
          video_url: video_url ? video_url.trim() : null,
          reward_coins: Number(reward_coins) || 0,
          try_feature_channel: try_feature_channel ? try_feature_channel.trim() : null,
          dropdown_items: Array.isArray(dropdown_items) ? dropdown_items : [],
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

      activeShowcaseId = showcaseRecord.id;
    }

    // 2. Format Embed Title & Body Markdown
    let formattedTitle = title.trim();
    if (title_size === 'h1') formattedTitle = `# 🚀 ${title.trim()}`;
    else if (title_size === 'h2') formattedTitle = `## 🚀 ${title.trim()}`;
    else if (title_size === 'h3') formattedTitle = `### 🚀 ${title.trim()}`;

    let formattedBody = body_markdown.trim();
    if (body_size === 'h2') formattedBody = `## ${body_markdown.trim()}`;
    else if (body_size === 'h3') formattedBody = `### ${body_markdown.trim()}`;

    let colorHex = 0x6366f1; // Indigo
    if (preset_type === 'patch') colorHex = 0x3b82f6; // Blue
    if (preset_type === 'showcase') colorHex = 0x10b981; // Emerald

    const embed: any = {
      title: formattedTitle,
      description: summary ? `*${summary.trim()}*\n\n${formattedBody}` : formattedBody,
      color: colorHex,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'ENOS Bot Feature Showcase • Server Update System',
      },
    };

    if (banner_url && banner_url.trim()) {
      embed.image = { url: banner_url.trim() };
    }

    // 3. Build Dynamic Select Menu Options
    const selectOptions = (Array.isArray(dropdown_items) ? dropdown_items : []).map(
      (item: any, idx: number) => ({
        label: (item.label || `Update ${idx + 1}`).substring(0, 100),
        value: (item.id || `item_${idx}`).substring(0, 100),
        description: item.description ? item.description.substring(0, 100) : undefined,
        emoji: { name: '📌' },
      })
    );

    const components: any[] = [];
    if (selectOptions.length > 0) {
      const selectMenu = {
        type: 3, // STRING SELECT MENU
        custom_id: `showcase_select_${activeShowcaseId}`,
        placeholder: '📌 Select a feature update to view hero artwork & details...',
        options: selectOptions,
      };
      components.push({ type: 1, components: [selectMenu] });
    }

    // 4. Send or Edit Message via Discord REST API
    let discordRes: Response;
    if (existingMessageId) {
      // EDIT existing message using PATCH
      discordRes = await fetch(
        `https://discord.com/api/v10/channels/${channel_id.trim()}/messages/${existingMessageId}`,
        {
          method: 'PATCH',
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
    } else {
      // CREATE new message using POST
      discordRes = await fetch(
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
    }

    if (!discordRes.ok) {
      const errJson = await discordRes.json().catch(() => ({}));
      const errMsg = errJson?.message || discordRes.statusText;
      return NextResponse.json(
        { success: false, error: `Discord API Error (${discordRes.status}): ${errMsg}` },
        { status: discordRes.status }
      );
    }

    const sentMessage = await discordRes.json();

    // 5. Update message_id in DB if new
    if (!existingMessageId && sentMessage.id) {
      await supabaseAdmin
        .from('showcase_updates')
        .update({ message_id: sentMessage.id })
        .eq('id', activeShowcaseId);
    }

    return NextResponse.json({
      success: true,
      updated: !!existingMessageId,
      showcase_id: activeShowcaseId,
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
