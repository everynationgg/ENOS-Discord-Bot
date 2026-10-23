import NextAuth from 'next-auth';
import authConfig from './auth.config';
import { NextRequest } from 'next/server';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  ...authConfig,
});

/**
 * Resolves the target guild ID from parameters, cookies, or environment fallback,
 * and verifies that the authenticated user's session is authorized for that guild.
 * Returns the resolved guildId if authorized, or null if unauthorized.
 */
export async function resolveAuthorizedGuildId(
  req: NextRequest,
  explicitGuildId?: string | null
): Promise<string | null> {
  const guildId =
    explicitGuildId ||
    req.nextUrl.searchParams.get('guild_id') ||
    req.nextUrl.searchParams.get('guildId') ||
    req.cookies.get('enos_guild_id')?.value ||
    process.env.DISCORD_GUILD_ID ||
    '';

  if (!guildId) return null;

  const session = await auth();
  if (!session) return null;

  // Single-tenant check: if session was validated at sign-in and matches DISCORD_GUILD_ID
  const defaultGuild = process.env.DISCORD_GUILD_ID || '';
  if (defaultGuild && guildId === defaultGuild) {
    return guildId;
  }

  // Multi-guild check: verify that session's guilds array contains guildId
  const sessionGuilds = (session as unknown as { guilds?: string[] | Array<{ id: string }> }).guilds;
  if (Array.isArray(sessionGuilds)) {
    const isMember = sessionGuilds.some((g) => (typeof g === 'string' ? g === guildId : g.id === guildId));
    if (isMember) {
      return guildId;
    }
  }

  return null;
}

