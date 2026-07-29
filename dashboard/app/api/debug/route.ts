import { NextResponse } from 'next/server';

// Temporary debug route — DELETE after diagnosing the 500
export async function GET() {
  return NextResponse.json({
    has_auth_secret: !!process.env.AUTH_SECRET,
    has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    has_discord_client_id: !!process.env.DISCORD_CLIENT_ID,
    has_discord_client_secret: !!process.env.DISCORD_CLIENT_SECRET,
    has_nextauth_url: !!process.env.NEXTAUTH_URL,
    nextauth_url: process.env.NEXTAUTH_URL || 'NOT SET',
    node_env: process.env.NODE_ENV,
    discord_client_id_prefix: process.env.DISCORD_CLIENT_ID?.slice(0, 6) || 'NOT SET',
  });
}
