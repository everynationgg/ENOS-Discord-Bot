import type { NextAuthConfig } from 'next-auth';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import DiscordProvider from 'next-auth/providers/discord';

export default {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds guilds.members.read',
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }): Promise<JWT> {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.discordId = (profile as any)?.id;
      }
      return token;
    },

    async session({ session, token }): Promise<Session> {
      if (session.user) {
        session.user.discordId = token.discordId;
      }
      session.accessToken = token.accessToken;
      return session;
    },

    async signIn({ account }) {
      if (!account?.access_token) return false;
      if (!process.env.DISCORD_GUILD_ID || !process.env.DISCORD_ADMIN_ROLE_ID) {
        // If not configured, allow all (dev mode)
        return true;
      }

      try {
        // Check if the user is in the guild and has the admin role
        const res = await fetch(
          `https://discord.com/api/v10/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
          {
            headers: { Authorization: `Bearer ${account.access_token}` },
          }
        );

        if (!res.ok) return '/login?error=not_in_guild';

        const member = await res.json();
        const hasAdminRole = member.roles?.includes(process.env.DISCORD_ADMIN_ROLE_ID);

        if (!hasAdminRole) return '/login?error=insufficient_permissions';

        return true;
      } catch {
        return '/login?error=auth_failed';
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
} satisfies NextAuthConfig;
