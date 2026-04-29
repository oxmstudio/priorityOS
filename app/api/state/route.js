import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../lib/blobState';
import { getSession } from '../../../lib/session';

export const runtime = 'nodejs';

const EMPTY_WORKSPACE = {
  values: [],
  goals: [],
  tasks: [],
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0
};

function modeFromRequest(request, fallback = 'business') {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || fallback;
  return mode === 'personal' ? 'personal' : 'business';
}

function isWorkspaceState(state) {
  return state && Array.isArray(state.tasks) && state.quads;
}

export async function GET(request) {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ error: 'Connect Google Calendar before loading Blob state.' }, { status: 401 });
  }

  try {
    const fullState = await readPriorityState(session.profile.email);
    const mode = modeFromRequest(request, fullState.activeMode);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    return NextResponse.json({ state: workspace, mode, fullState });
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
    const incoming = body.state || body;
    const existing = await readPriorityState(session.profile.email);
    const mode = body.mode === 'personal' || body.activeMode === 'personal' ? 'personal' : modeFromRequest(request, existing.activeMode);

    let nextState;
    if (incoming?.workspaces) {
      nextState = incoming;
    } else if (isWorkspaceState(incoming)) {
      nextState = {
        ...existing,
        activeMode: mode,
        workspaces: {
          business: existing.workspaces?.business || EMPTY_WORKSPACE,
          personal: existing.workspaces?.personal || EMPTY_WORKSPACE,
          [mode]: incoming
        }
      };
    } else {
      nextState = existing;
    }

    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({ ok: true, state: saved.workspaces?.[mode] || EMPTY_WORKSPACE, mode, fullState: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
