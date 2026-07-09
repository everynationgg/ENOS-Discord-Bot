import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getKeyformRegistrations, deleteKeyformRegistration } from '@/lib/supabase';

function getGuildId(req: NextRequest) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    process.env.DISCORD_GUILD_ID ||
    'default_guild_id'
  );
}

// GET /api/moderation/keyform/registrations — fetch registration logs
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const gameKey = req.nextUrl.searchParams.get('game_key') || undefined;
    const registrations = await getKeyformRegistrations(guildId, gameKey);
    return NextResponse.json(registrations);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/moderation/keyform/registrations — delete/revoke a registration entry
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const guildId = getGuildId(req);
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing registration ID parameter' }, { status: 400 });
    }

    await deleteKeyformRegistration(guildId, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
