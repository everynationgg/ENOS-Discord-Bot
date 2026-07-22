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

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chooseWeightedChannel(allowedChannels: any[]) {
  if (!allowedChannels?.length) return null;
  const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const pool: any[] = [];
  for (const ch of allowedChannels) {
    if (!ch.channel_id) continue;
    const w = weights[ch.priority?.toLowerCase()] || 1;
    for (let i = 0; i < w; i++) pool.push(ch);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function generateTriviaQuestion(topic: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in dashboard environment variables.');

  const prompt = `Generate a challenging multiple-choice trivia question.
If a topic is provided, it must be about that topic (lore, gameplay, details). Otherwise, it should be about general gaming, pop culture, or tech.
Topic: ${topic || 'Random general gaming, pop culture, or tech knowledge'}

Respond ONLY with a raw JSON object containing these keys:
{
  "question": "The question text",
  "correct_answer": "The correct answer text",
  "incorrect_answers": ["wrong answer 1", "wrong answer 2", "wrong answer 3"]
}
Do not wrap in markdown, backticks, or write any extra text.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleanJson);

  if (!parsed.question || !parsed.correct_answer || !parsed.incorrect_answers || parsed.incorrect_answers.length !== 3) {
    throw new Error('Invalid JSON format returned by Gemini API.');
  }

  return parsed;
}

async function closeActiveDrop(guildId: string, status: 'completed' | 'skipped' = 'skipped') {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

  // Find all active drops for this guild
  const { data: activeDrops } = await supabaseAdmin
    .from('trivia_drops')
    .select('*')
    .eq('guild_id', guildId)
    .eq('status', 'active');

  if (!activeDrops || activeDrops.length === 0) return false;

  for (const drop of activeDrops) {
    // 1. Update status in database
    await supabaseAdmin
      .from('trivia_drops')
      .update({ status: status, completed_at: new Date().toISOString() })
      .eq('id', drop.id);

    // 2. If Discord token and message ID are present, edit Discord message directly
    if (token && drop.channel_id && drop.message_id) {
      try {
        const winners = drop.winners || [];
        const podiumLines = winners.map((w: any, index: number) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          return `${medal} <@${w.user_id}> — **${(w.speed_ms / 1000).toFixed(6)}s** (+${w.points} pts)`;
        });
        let podiumText = podiumLines.length > 0 ? podiumLines.join('\n') : '*No winners.*';
        podiumText += status === 'skipped' ? '\n\n❌ **Trivia Session was Cancelled/Skipped by Admin.**' : '\n\n🏁 **Trivia Session is now Closed!**';

        await fetch(`https://discord.com/api/v10/channels/${drop.channel_id}/messages/${drop.message_id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [
              {
                title: '🧠 Daily Community Trivia!',
                description: 'A new daily trivia drop has arrived!\n\n⚠️ **Rules**:\n• You only have **one attempt**.\n• Your timer starts the millisecond you click the button.\n• First 3 correct submissions win points.',
                color: 16436245,
                fields: [
                  { name: '📚 Category / Topic', value: drop.question ? 'Trivia Drop' : 'General Knowledge', inline: true },
                  { name: '🏆 Podium', value: podiumText },
                ],
                footer: { text: `ENOS Trivia System • ID: ${drop.id.substring(0, 8)}` },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 2,
                    label: status === 'skipped' ? 'Session Cancelled' : 'Session Closed',
                    custom_id: 'trivia_disabled',
                    disabled: true,
                  },
                ],
              },
            ],
          }),
        });
      } catch (e) {
        console.error('[TRIVIA ACTION] Failed to edit Discord message on close:', e);
      }
    }
  }

  return true;
}

async function triggerInstantDrop(guildId: string) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Missing DISCORD_TOKEN in dashboard environment variables.');

  // Close existing active drops first
  await closeActiveDrop(guildId, 'skipped');

  // Fetch config
  const { data: featureRow } = await supabaseAdmin
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .eq('feature_key', 'trivia')
    .maybeSingle();

  if (!featureRow || !featureRow.enabled) {
    throw new Error('Trivia feature is not enabled for this server in Dashboard.');
  }

  const config = featureRow.config || {};
  const allowedChannels = config.allowed_channels || [];
  const closeTime = config.close_time || '22:00';

  const chosen = chooseWeightedChannel(allowedChannels);
  if (!chosen) {
    throw new Error('No allowed channels configured for trivia drops. Please add a channel whitelist in Trivia settings.');
  }

  // Generate question via Gemini AI
  const questionData = await generateTriviaQuestion(chosen.topic);
  const allAnswers = shuffleArray([questionData.correct_answer, ...questionData.incorrect_answers]);

  // Insert drop in Supabase
  const { data: drop, error: insertErr } = await supabaseAdmin
    .from('trivia_drops')
    .insert({
      guild_id: guildId,
      channel_id: chosen.channel_id,
      question: questionData.question,
      correct_answer: questionData.correct_answer,
      shuffled_answers: allAnswers,
      close_time: closeTime,
      status: 'active',
    })
    .select()
    .single();

  if (insertErr || !drop) {
    throw new Error(`Failed to insert trivia drop into database: ${insertErr?.message}`);
  }

  // Post to Discord via REST API
  const discordRes = await fetch(`https://discord.com/api/v10/channels/${chosen.channel_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [
        {
          title: '🧠 Daily Community Trivia!',
          description:
            `A new daily trivia drop has arrived! Click **Start Trivia** to play.\n\n` +
            `⚠️ **Rules**:\n` +
            `• You only have **one attempt**.\n` +
            `• Your timer starts the millisecond you click the button.\n` +
            `• First 3 correct submissions win points.\n` +
            `• Session closes automatically at **${closeTime}** (server time) or after 3 winners.`,
          color: 16436245, // 0xFACC15 (Yellow)
          fields: [
            { name: '📚 Category / Topic', value: chosen.topic || 'General Knowledge', inline: true },
            { name: '🏆 Podium', value: '*No winners yet. Be the first!*' },
          ],
          footer: { text: `ENOS Trivia System • ID: ${drop.id.substring(0, 8)}` },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1, // Primary
              label: 'Start Trivia',
              custom_id: `trivia_start:${drop.id}`,
              emoji: { name: '🧠' },
            },
          ],
        },
      ],
    }),
  });

  if (!discordRes.ok) {
    const errText = await discordRes.text();
    await supabaseAdmin.from('trivia_drops').delete().eq('id', drop.id);
    throw new Error(`Failed to post message to Discord channel: ${discordRes.statusText} (${errText})`);
  }

  const messageData = await discordRes.json();

  // Save message_id in Supabase
  await supabaseAdmin
    .from('trivia_drops')
    .update({ message_id: messageData.id })
    .eq('id', drop.id);

  // Update last_drop_date in guild_config
  const todayStr = new Date().toISOString().split('T')[0];
  const updatedConfig = { ...config, last_drop_date: todayStr, manual_trigger_requested: false };
  await supabaseAdmin
    .from('guild_config')
    .update({ config: updatedConfig })
    .eq('guild_id', guildId)
    .eq('feature_key', 'trivia');

  return drop;
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

    if (action === 'trigger') {
      const drop = await triggerInstantDrop(guildId);
      return NextResponse.json({
        success: true,
        message: `Trivia drop created and posted instantly to Discord! (ID: ${drop.id.substring(0, 8)})`,
      });
    }

    if (action === 'skip') {
      const closed = await closeActiveDrop(guildId, 'skipped');
      if (!closed) {
        return NextResponse.json({ error: 'No active trivia session to skip.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Active trivia session closed and disabled in Discord.' });
    }

    if (action === 'reroll') {
      await closeActiveDrop(guildId, 'skipped');
      const drop = await triggerInstantDrop(guildId);
      return NextResponse.json({
        success: true,
        message: `Active session closed and new trivia question dropped instantly! (ID: ${drop.id.substring(0, 8)})`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
