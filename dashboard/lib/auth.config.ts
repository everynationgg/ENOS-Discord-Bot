import type { NextAuthConfig, Account, Profile, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import DiscordProvider from 'next-auth/providers/discord';

export default {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
    async jwt({ token, account, profile }: { token: JWT; account?: Account | null; profile?: Profile }): Promise<JWT> {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.discordId = (profile as Record<string, unknown> | undefined)?.id as string | undefined;
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      if (session.user) {
        session.user.discordId = token.discordId;
      }
      session.accessToken = token.accessToken;
      return session;
    },

    async signIn({ account }: { account?: Account | null }) {
      if (!account?.access_token) return false;

      try {
        // Fetch user's joined guilds to verify ownership or admin/manage guild permissions
        const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });

        if (!res.ok) {
          return '/login?error=auth_failed';
        }

        const userGuilds = await res.json();
        if (!Array.isArray(userGuilds)) return '/login?error=auth_failed';

        interface DiscordUserGuild {
          id: string;
          name: string;
          owner?: boolean;
          permissions?: string;
        }

        const ADMINISTRATOR = BigInt(0x8);
        const MANAGE_GUILD = BigInt(0x20);

        // Filter user guilds where user has ownership or Administrator / Manage Guild permissions
        const adminGuilds = (userGuilds as DiscordUserGuild[]).filter((g) => {
          if (g.owner) return true;
          const permissions = BigInt(g.permissions || '0');
          return (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
        });

        const targetGuildId = process.env.DISCORD_GUILD_ID;
        const isMultiGuildAllowed = process.env.ALLOW_MULTI_GUILD === 'true';

        // When single-tenant is enforced, require permissions on DISCORD_GUILD_ID specifically
        if (targetGuildId && !isMultiGuildAllowed) {
          const hasTargetGuildPerms = adminGuilds.some((g) => g.id === targetGuildId);
          if (hasTargetGuildPerms) return true;
        } else if (adminGuilds.length > 0) {
          return true;
        }

        // Fallback check for dev guild admin role if configured
        if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_ADMIN_ROLE_ID) {
          const devMemberRes = await fetch(
            `https://discord.com/api/v10/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
            {
              headers: { Authorization: `Bearer ${account.access_token}` },
            }
          );
          if (devMemberRes.ok) {
            const member = (await devMemberRes.json()) as { roles?: string[] };
            if (member.roles?.includes(process.env.DISCORD_ADMIN_ROLE_ID)) {
              return true;
            }
          }
        }

        return '/login?error=insufficient_permissions';
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
