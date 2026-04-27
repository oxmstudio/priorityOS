import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    profile: session.profile
  });
}
