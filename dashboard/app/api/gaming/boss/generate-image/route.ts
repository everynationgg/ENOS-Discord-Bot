// Deleted AI generator endpoint - manual image URL mode enabled
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'AI Generator disabled. Please enter custom image URL directly.' }, { status: 410 });
}
