import NextAuth from 'next-auth';
import authConfig from './lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  try {
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (
      pathname.startsWith('/login') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/terms') ||
      pathname.startsWith('/privacy')
    ) {
      return NextResponse.next();
    }

    // Require auth for all /dashboard routes and root
    if (pathname.startsWith('/dashboard') || pathname === '/') {
      if (!req.auth) {
        return NextResponse.redirect(new URL('/login', req.nextUrl));
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error('[MIDDLEWARE ERROR]', err);
    return NextResponse.next();
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
