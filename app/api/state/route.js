import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../lib/blobState';
import { getSession } from '../../../lib/session';

export const runtime = 'nodejs';

const EMPTY_WORKSPACE = {
  values: [],
  goals: [],
  tasks: [],
  calendarEvents: [],
  statistics: null,
  habits: { completions: {} },
  canvas: null,
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0,
  dailyNotes: {}
};

function modeFromRequest(request, fallback = 'business') {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || fallback;
  return mode === 'personal' ? 'personal' : 'business';
}

function isWorkspaceState(state) {
  return state && Array.isArray(state.tasks) && state.quads;
}

function ensureHabits(habits) {
  return { completions: habits?.completions && typeof habits.completions === 'object' ? habits.completions : {} };
}

function ensureWorkspaceShape(workspace) {
  return {
    values: Array.isArray(workspace?.values) ? workspace.values : [],
    goals: Array.isArray(workspace?.goals) ? workspace.goals : [],
    tasks: Array.isArray(workspace?.tasks) ? workspace.tasks : [],
    calendarEvents: Array.isArray(workspace?.calendarEvents) ? workspace.calendarEvents : [],
    statistics: workspace?.statistics && typeof workspace.statistics === 'object' ? workspace.statistics : null,
    habits: ensureHabits(workspace?.habits),
    canvas: workspace?.canvas && typeof workspace.canvas === 'object' ? workspace.canvas : null,
    quads: {
      q1: Array.isArray(workspace?.quads?.q1) ? workspace.quads.q1 : [],
      q2: Array.isArray(workspace?.quads?.q2) ? workspace.quads.q2 : [],
      q3: Array.isArray(workspace?.quads?.q3) ? workspace.quads.q3 : [],
      q4: Array.isArray(workspace?.quads?.q4) ? workspace.quads.q4 : []
    },
    synced: Number.isFinite(Number(workspace?.synced)) ? Number(workspace.synced) : 0,
    dailyNotes: workspace?.dailyNotes && typeof workspace.dailyNotes === 'object' && !Array.isArray(workspace.dailyNotes) ? workspace.dailyNotes : {}
  };
}

export async function GET(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect Google Calendar before loading Blob state.' }, { status: 401 });
  try {
    const fullState = await readPriorityState(session.profile.email);
    const mode = modeFromRequest(request, fullState.activeMode);
    const workspace = ensureWorkspaceShape(fullState.workspaces?.[mode] || EMPTY_WORKSPACE);
    // Mood board is account-level. Keep the legacy workspace canvas in the
    // response so the existing dashboard component can consume it unchanged.
    workspace.canvas = fullState.moodBoard || null;
    return NextResponse.json({ state: workspace, mode, moodBoard: fullState.moodBoard || null, fullState });
  } catch (error) {
    console.error('GET /api/state error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect Google Calendar before saving Blob state.' }, { status: 401 });
  try {
    const body = await request.json();
    const existing = await readPriorityState(session.profile.email);
    const mode = body.mode === 'personal' || body.activeMode === 'personal' ? 'personal' : modeFromRequest(request, existing.activeMode);

    // Mood board metadata is account-level, while the rest of the dashboard
    // remains workspace-specific. This makes the same board available on every
    // device and in both Business and Personal modes.
    if (Object.prototype.hasOwnProperty.call(body, 'moodBoard')) {
      const saved = await writePriorityState(session.profile.email, { ...existing, moodBoard: body.moodBoard || null });
      const workspace = ensureWorkspaceShape(saved.workspaces?.[mode] || EMPTY_WORKSPACE);
      workspace.canvas = saved.moodBoard || null;
      return NextResponse.json({ ok: true, state: workspace, mode, moodBoard: saved.moodBoard || null, fullState: saved });
    }

    const incoming = body.state || body;
    let nextState;
    if (incoming?.workspaces) nextState = { ...incoming, moodBoard: existing.moodBoard || null };
    else if (isWorkspaceState(incoming)) {
      const currentWorkspace = ensureWorkspaceShape(existing.workspaces?.[mode] || EMPTY_WORKSPACE);
      nextState = {
        ...existing,
        activeMode: mode,
        // Mirror legacy canvas writes into the account-level mood board so the
        // existing dashboard component remains compatible during migration.
        moodBoard: incoming.canvas && typeof incoming.canvas === 'object' ? incoming.canvas : existing.moodBoard || null,
        workspaces: {
          business: ensureWorkspaceShape(existing.workspaces?.business || EMPTY_WORKSPACE),
          personal: ensureWorkspaceShape(existing.workspaces?.personal || EMPTY_WORKSPACE),
          [mode]: ensureWorkspaceShape({ ...currentWorkspace, ...incoming })
        }
      };
    } else nextState = existing;
    const saved = await writePriorityState(session.profile.email, nextState);
    const workspace = ensureWorkspaceShape(saved.workspaces?.[mode] || EMPTY_WORKSPACE);
    workspace.canvas = saved.moodBoard || null;
    return NextResponse.json({ ok: true, state: workspace, mode, moodBoard: saved.moodBoard || null, fullState: saved });
  } catch (error) {
    console.error('PUT /api/state error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
