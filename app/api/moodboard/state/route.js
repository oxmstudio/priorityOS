import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

function accountIdentity(session) {
  return session?.profile?.sub || session?.profile?.email || '';
}

async function readAccountState(session) {
  const identity = accountIdentity(session);
  const current = await readPriorityState(identity);
  // Older boards were keyed by email. Copy them forward once a stable Google ID is available.
  if (session.profile.sub && session.profile.email && session.profile.sub !== session.profile.email
      && !current?.moodBoard?.items?.length) {
    const legacy = await readPriorityState(session.profile.email);
    if (legacy?.moodBoard?.items?.length) {
      return writePriorityState(identity, { ...current, moodBoard: legacy.moodBoard });
    }
  }
  return current;
}

export async function GET() {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const state = await readAccountState(session);
    const legacyCanvas = state.workspaces?.business?.canvas?.items?.length
      ? state.workspaces.business.canvas
      : state.workspaces?.personal?.canvas?.items?.length
        ? state.workspaces.personal.canvas
        : null;
    const moodBoard = state.moodBoard || legacyCanvas || null;
    return NextResponse.json({ ok: true, moodBoard });
  } catch (error) {
    console.error('GET /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be loaded.' }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const body = await request.json();
    const moodBoard = body.moodBoard && typeof body.moodBoard === 'object' ? body.moodBoard : null;
    const identity = accountIdentity(session);
    const existing = await readAccountState(session);
    const saved = await writePriorityState(identity, { ...existing, moodBoard });
    return NextResponse.json({ ok: true, moodBoard: saved.moodBoard || null });
  } catch (error) {
    console.error('PUT /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be saved.' }, { status: 500 });
  }
}
