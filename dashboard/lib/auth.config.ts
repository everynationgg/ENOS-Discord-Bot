import type { NextAuthConfig } from 'next-auth';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import DiscordProvider from 'next-auth/providers/discord';

export default {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'enos_dashboard_default_auth_secret_2026_key',
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || 'missing_client_id',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'missing_client_secret',
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

      try {
        // Fetch user's joined guilds to verify ownership or admin/manage guild permissions
        const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });

        if (!res.ok) {
          // If profile fetch fails, check environment fallback for dev guild
          if (!process.env.DISCORD_GUILD_ID) return true;
          return '/login?error=auth_failed';
        }

        const userGuilds = await res.json();
        if (!Array.isArray(userGuilds)) return true;

        // Check if user is an owner or has Administrator (0x8) / Manage Guild (0x20) permission in ANY guild
        const canManageAnyGuild = userGuilds.some((g: any) => {
          if (g.owner) return true;
          const permissions = BigInt(g.permissions || '0');
          const ADMINISTRATOR = BigInt(0x8);
          const MANAGE_GUILD = BigInt(0x20);
          return (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
        });

        if (canManageAnyGuild) return true;

        // Fallback check for dev guild admin role if configured
        if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_ADMIN_ROLE_ID) {
          const devMemberRes = await fetch(
            `https://discord.com/api/v10/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
            {
              headers: { Authorization: `Bearer ${account.access_token}` },
            }
          );
          if (devMemberRes.ok) {
            const member = await devMemberRes.json();
            if (member.roles?.includes(process.env.DISCORD_ADMIN_ROLE_ID)) {
              return true;
            }
          }
        }

        return '/login?error=insufficient_permissions';
      } catch {
        return true; // Allow sign in gracefully on network issues
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
} satisfies NextAuthConfig;
