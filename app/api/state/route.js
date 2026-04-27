import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../lib/blobState';
import { getSession } from '../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ error: 'Connect Google Calendar before loading Blob state.' }, { status: 401 });
  }

  try {
    const state = await readPriorityState(session.profile.email);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ error: 'Connect Google Calendar before saving Blob state.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const state = await writePriorityState(session.profile.email, body.state || body);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
