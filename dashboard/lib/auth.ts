import NextAuth from 'next-auth';
import authConfig from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  ...authConfig,
});
