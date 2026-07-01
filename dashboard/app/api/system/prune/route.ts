import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { triggerPruning } from '@/lib/supabase';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await triggerPruning();
    return NextResponse.json({ success: true, message: 'Pruning completed.' });
  } catch (err: any) {
    // Fallback: pruning via RPC may not be set up, return success hint
    return NextResponse.json({
      success: false,
      message: `Pruning via RPC failed: ${err.message}. Run /admin prune-now in Discord instead.`,
    }, { status: 500 });
  }
}
