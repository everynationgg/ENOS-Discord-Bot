import NextAuth, { DefaultSession } from 'next-auth';

// Augment the built-in session/user types with our custom fields
declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?: string;
    user: {
      discordId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    discordId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    discordId?: string;
  }
}
