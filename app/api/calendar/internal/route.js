import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

const EMPTY_WORKSPACE = {
  values: [],
  goals: [],
  tasks: [],
  calendarEvents: [],
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0
};

function modeFromRequest(request, fallback = 'business') {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || fallback;
  return mode === 'personal' ? 'personal' : 'business';
}

function eventFromTask(task) {
  if (!task?.name || !task?.start || !task?.end) throw new Error('Task name, start, and end are required.');
  const now = new Date().toISOString();
  return {
    id: task.internalEventId || crypto.randomUUID(),
    taskId: task.id || null,
    googleEventId: task.eventId || null,
    googleLink: task.calLink || null,
    title: task.name,
    notes: task.notes || '',
    type: task.type || 'pr',
    quadrant: task.quadrant || null,
    recRule: task.recRule || null,
    start: task.start,
    end: task.end,
    tz: task.tz || 'UTC',
    source: task.eventId ? 'priorityos+google' : 'priorityos',
    createdAt: now,
    updatedAt: now
  };
}

export async function GET(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect or create an account before loading calendar events.' }, { status: 401 });

  try {
    const fullState = await readPriorityState(session.profile.email);
    const mode = modeFromRequest(request, fullState.activeMode);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    return NextResponse.json({ events: workspace.calendarEvents || [], mode });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect or create an account before saving calendar events.' }, { status: 401 });

  try {
    const body = await request.json();
    const fullState = await readPriorityState(session.profile.email);
    const mode = body.mode === 'personal' ? 'personal' : modeFromRequest(request, fullState.activeMode);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    const event = eventFromTask(body.task || body.event);
    const tasks = Array.isArray(workspace.tasks) ? workspace.tasks.map((task) => task.id === event.taskId ? { ...task, internalEventId: event.id, notes: event.notes, start: event.start, end: event.end, type: event.type, recRule: event.recRule, tz: event.tz } : task) : [];
    const calendarEvents = [...(workspace.calendarEvents || []).filter((item) => item.id !== event.id), event];
    const nextState = {
      ...fullState,
      activeMode: mode,
      workspaces: {
        ...fullState.workspaces,
        [mode]: { ...workspace, tasks, calendarEvents }
      }
    };
    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({ ok: true, event, state: saved.workspaces?.[mode] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect or create an account before deleting calendar events.' }, { status: 401 });

  try {
    const body = await request.json();
    const fullState = await readPriorityState(session.profile.email);
    const mode = body.mode === 'personal' ? 'personal' : modeFromRequest(request, fullState.activeMode);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    const eventId = body.eventId || body.id;
    if (!eventId) return NextResponse.json({ error: 'eventId is required.' }, { status: 400 });
    const calendarEvents = (workspace.calendarEvents || []).filter((event) => event.id !== eventId);
    const tasks = (workspace.tasks || []).map((task) => task.internalEventId === eventId ? { ...task, internalEventId: null } : task);
    const nextState = {
      ...fullState,
      activeMode: mode,
      workspaces: {
        ...fullState.workspaces,
        [mode]: { ...workspace, tasks, calendarEvents }
      }
    };
    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({ ok: true, state: saved.workspaces?.[mode] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
