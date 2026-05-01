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

function cleanWorkspace(workspace) {
  return {
    values: Array.isArray(workspace?.values) ? workspace.values : [],
    goals: Array.isArray(workspace?.goals) ? workspace.goals : [],
    tasks: Array.isArray(workspace?.tasks) ? workspace.tasks : [],
    calendarEvents: Array.isArray(workspace?.calendarEvents) ? workspace.calendarEvents : [],
    quads: {
      q1: Array.isArray(workspace?.quads?.q1) ? workspace.quads.q1 : [],
      q2: Array.isArray(workspace?.quads?.q2) ? workspace.quads.q2 : [],
      q3: Array.isArray(workspace?.quads?.q3) ? workspace.quads.q3 : [],
      q4: Array.isArray(workspace?.quads?.q4) ? workspace.quads.q4 : []
    },
    synced: Number.isFinite(Number(workspace?.synced)) ? Number(workspace.synced) : 0
  };
}

function rebuildQuads(tasks) {
  return Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((q) => [
    q,
    tasks.filter((task) => task.quadrant === q).map((task) => task.name)
  ]));
}

function eventFromTask(task) {
  if (!task?.name || !task?.start || !task?.end) throw new Error('Task name, start, and end are required.');
  const now = new Date().toISOString();
  return {
    id: task.internalEventId || crypto.randomUUID(),
    taskId: task.id || crypto.randomUUID(),
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
    createdAt: task.createdAt || now,
    updatedAt: now
  };
}

function taskFromEventTask(task, event) {
  return {
    id: event.taskId,
    name: event.title,
    quadrant: event.quadrant,
    notes: event.notes,
    type: event.type,
    recRule: event.recRule,
    start: event.start,
    end: event.end,
    tz: event.tz,
    eventId: event.googleEventId,
    calLink: event.googleLink,
    internalEventId: event.id,
    ...(task || {})
  };
}

export async function GET(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect or create an account before loading calendar events.' }, { status: 401 });

  try {
    const fullState = await readPriorityState(session.profile.email);
    const mode = modeFromRequest(request, fullState.activeMode);
    const workspace = cleanWorkspace(fullState.workspaces?.[mode] || EMPTY_WORKSPACE);
    return NextResponse.json({ events: workspace.calendarEvents || [], state: workspace, mode });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect or create an account before saving calendar events.' }, { status: 401 });

  try {
    const body = await request.json();
    const incomingTask = body.task || body.event;
    const fullState = await readPriorityState(session.profile.email);
    const mode = body.mode === 'personal' ? 'personal' : modeFromRequest(request, fullState.activeMode);
    const workspace = cleanWorkspace(fullState.workspaces?.[mode] || EMPTY_WORKSPACE);
    const event = eventFromTask(incomingTask);

    const taskExists = workspace.tasks.some((task) => task.id === event.taskId);
    const tasks = taskExists
      ? workspace.tasks.map((task) => task.id === event.taskId ? { ...task, ...incomingTask, internalEventId: event.id, start: event.start, end: event.end, notes: event.notes, type: event.type, recRule: event.recRule, tz: event.tz, eventId: event.googleEventId, calLink: event.googleLink } : task)
      : [...workspace.tasks, taskFromEventTask(incomingTask, event)];

    const calendarEvents = [
      ...workspace.calendarEvents.filter((item) => item.id !== event.id && item.taskId !== event.taskId),
      event
    ];

    const nextWorkspace = {
      ...workspace,
      tasks,
      calendarEvents,
      quads: rebuildQuads(tasks),
      synced: tasks.filter((task) => task.eventId).length
    };

    const nextState = {
      ...fullState,
      activeMode: mode,
      workspaces: {
        ...fullState.workspaces,
        [mode]: nextWorkspace
      }
    };

    const saved = await writePriorityState(session.profile.email, nextState);
    const savedWorkspace = cleanWorkspace(saved.workspaces?.[mode] || nextWorkspace);
    return NextResponse.json({ ok: true, event, state: savedWorkspace, mode, counts: { tasks: savedWorkspace.tasks.length, calendarEvents: savedWorkspace.calendarEvents.length } });
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
    const workspace = cleanWorkspace(fullState.workspaces?.[mode] || EMPTY_WORKSPACE);
    const eventId = body.eventId || body.id;
    if (!eventId) return NextResponse.json({ error: 'eventId is required.' }, { status: 400 });
    const calendarEvents = workspace.calendarEvents.filter((event) => event.id !== eventId);
    const tasks = workspace.tasks.map((task) => task.internalEventId === eventId ? { ...task, internalEventId: null, start: null, end: null, recRule: null } : task);
    const nextWorkspace = { ...workspace, tasks, calendarEvents, quads: rebuildQuads(tasks) };
    const nextState = { ...fullState, activeMode: mode, workspaces: { ...fullState.workspaces, [mode]: nextWorkspace } };
    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({ ok: true, state: cleanWorkspace(saved.workspaces?.[mode] || nextWorkspace), mode });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
