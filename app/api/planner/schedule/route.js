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

function modeFromBody(mode) {
  return mode === 'personal' ? 'personal' : 'business';
}

function normalizeWorkspace(workspace) {
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

function buildQuads(tasks) {
  return Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((q) => [q, tasks.filter((task) => task.quadrant === q).map((task) => task.name)]));
}

function makeEvent(task) {
  const now = new Date().toISOString();
  const id = task.internalEventId || `po-${task.id || crypto.randomUUID()}`;
  return {
    id,
    taskId: task.id,
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

function validTask(task) {
  if (!task?.name) return 'Task name is required.';
  if (!task?.start) return 'Task start time is required.';
  if (!task?.end) return 'Task end time is required.';
  return null;
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ error: 'You must be signed in before scheduling.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = modeFromBody(body.mode);
    const incomingTask = body.task || {};
    const validationError = validTask(incomingTask);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const fullState = await readPriorityState(session.profile.email);
    const workspace = normalizeWorkspace(fullState.workspaces?.[mode] || EMPTY_WORKSPACE);

    const taskId = incomingTask.id || crypto.randomUUID();
    const task = {
      ...incomingTask,
      id: taskId,
      internalEventId: incomingTask.internalEventId || `po-${taskId}`,
      tz: incomingTask.tz || 'UTC'
    };
    const event = makeEvent(task);

    const existingTaskIndex = workspace.tasks.findIndex((item) => item.id === taskId);
    const tasks = existingTaskIndex >= 0
      ? workspace.tasks.map((item) => item.id === taskId ? { ...item, ...task, internalEventId: event.id } : item)
      : [...workspace.tasks, { ...task, internalEventId: event.id }];

    const calendarEvents = [
      ...workspace.calendarEvents.filter((item) => item.id !== event.id && item.taskId !== taskId),
      event
    ];

    const nextWorkspace = {
      ...workspace,
      tasks,
      calendarEvents,
      quads: buildQuads(tasks),
      synced: tasks.filter((item) => item.eventId).length
    };

    const nextState = {
      ...fullState,
      activeMode: mode,
      workspaces: {
        business: normalizeWorkspace(fullState.workspaces?.business || EMPTY_WORKSPACE),
        personal: normalizeWorkspace(fullState.workspaces?.personal || EMPTY_WORKSPACE),
        [mode]: nextWorkspace
      }
    };

    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({
      ok: true,
      mode,
      task: { ...task, internalEventId: event.id },
      event,
      state: saved.workspaces?.[mode] || nextWorkspace,
      counts: {
        tasks: nextWorkspace.tasks.length,
        calendarEvents: nextWorkspace.calendarEvents.length,
        synced: nextWorkspace.synced
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Schedule save failed.' }, { status: 500 });
  }
}
