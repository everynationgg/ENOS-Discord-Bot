import { NextRequest, NextResponse } from 'next/server';

// POST /api/gaming/boss/render-preview — Generate live composite canvas PNG preview for Weekly Boss setup
// NOTE: @napi-rs/canvas uses native .node binaries that are not supported in Vercel Serverless.
// This route returns a 501 so the dashboard can show a placeholder instead of crashing the Lambda.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Canvas preview is not available in the serverless environment. The bot generates the actual card image.' },
    { status: 501 }
  );
}
