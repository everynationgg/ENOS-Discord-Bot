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
      // If already logged in and visiting /login without error, route to server selection
      if (pathname === '/login' && req.auth && !req.nextUrl.searchParams.has('error')) {
        return NextResponse.redirect(new URL('/select-server', req.url));
      }
      return NextResponse.next();
    }

    // Require auth for /select-server, /dashboard routes, and root
    if (pathname.startsWith('/select-server') || pathname.startsWith('/dashboard') || pathname === '/') {
      if (!req.auth) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    // Allow /select-server once authenticated
    if (pathname.startsWith('/select-server')) {
      return NextResponse.next();
    }

    // Require server selection for /dashboard and root
    if (pathname.startsWith('/dashboard') || pathname === '/') {
      const selectedGuild = req.cookies.get('enos_guild_id')?.value || req.nextUrl.searchParams.get('guild_id');
      if (!selectedGuild) {
        return NextResponse.redirect(new URL('/select-server', req.url));
      }
      if (pathname === '/') {
        return NextResponse.redirect(new URL(`/dashboard?guild_id=${selectedGuild}`, req.url));
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
