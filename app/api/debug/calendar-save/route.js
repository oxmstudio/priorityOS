import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';

export const runtime = 'nodejs';

const EMPTY_WORKSPACE = {
  values: [],
  goals: [],
  tasks: [],
  calendarEvents: [],
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0
};

function modeFromRequest(request) {
  const url = new URL(request.url);
  return url.searchParams.get('mode') === 'personal' ? 'personal' : 'business';
}

function testEvent() {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 15);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  const id = `debug-${Date.now()}`;
  return {
    id,
    taskId: id,
    googleEventId: null,
    googleLink: null,
    title: 'Debug PriorityOS Calendar Event',
    notes: 'Created by /api/debug/calendar-save to verify Blob calendar saving.',
    type: 'pr',
    quadrant: 'q2',
    recRule: null,
    start: start.toISOString().slice(0, 19),
    end: end.toISOString().slice(0, 19),
    tz: 'UTC',
    source: 'priorityos-debug',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function GET(request) {
  const session = getSession();
  const mode = modeFromRequest(request);

  if (!session?.profile?.email) {
    return NextResponse.json({
      ok: false,
      stage: 'auth',
      error: 'No authenticated session found.',
      mode
    }, { status: 401 });
  }

  try {
    const before = await readPriorityState(session.profile.email);
    const workspaceBefore = before.workspaces?.[mode] || EMPTY_WORKSPACE;
    const event = testEvent();

    const nextWorkspace = {
      ...workspaceBefore,
      calendarEvents: [...(workspaceBefore.calendarEvents || []), event]
    };

    const nextState = {
      ...before,
      activeMode: mode,
      workspaces: {
        ...before.workspaces,
        [mode]: nextWorkspace
      }
    };

    const saved = await writePriorityState(session.profile.email, nextState);
    const workspaceAfter = saved.workspaces?.[mode] || EMPTY_WORKSPACE;

    return NextResponse.json({
      ok: true,
      stage: 'saved',
      email: session.profile.email,
      mode,
      beforeCount: workspaceBefore.calendarEvents?.length || 0,
      afterCount: workspaceAfter.calendarEvents?.length || 0,
      event
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: 'write',
      mode,
      error: error.message
    }, { status: 500 });
  }
}
