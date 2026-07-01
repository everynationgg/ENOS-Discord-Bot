import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Require auth for all /dashboard routes
  if (pathname.startsWith('/dashboard') || pathname === '/') {
    if (!req.auth) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
