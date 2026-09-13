import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const state = await readPriorityState(session.profile.email);
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
    const existing = await readPriorityState(session.profile.email);
    const saved = await writePriorityState(session.profile.email, { ...existing, moodBoard });
    return NextResponse.json({ ok: true, moodBoard: saved.moodBoard || null });
  } catch (error) {
    console.error('PUT /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be saved.' }, { status: 500 });
  }
}
