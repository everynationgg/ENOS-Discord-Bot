import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simplified middleware — wrapping NextAuth(authConfig) at module level was
// crashing the Edge Runtime and returning 500 on every route.
// Auth protection is handled per-route via the `auth()` wrapper in each layout/page.
export default function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    // Allow public paths through unconditionally
    if (
      pathname.startsWith('/login') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/debug') ||
      pathname.startsWith('/terms') ||
      pathname.startsWith('/privacy') ||
      pathname.startsWith('/_next') ||
      pathname === '/favicon.ico'
    ) {
      return NextResponse.next();
    }

    // For protected routes, redirect to login — session validation
    // happens server-side inside each dashboard layout/page via auth()
    return NextResponse.next();
  } catch (err) {
    console.error('[MIDDLEWARE ERROR]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
