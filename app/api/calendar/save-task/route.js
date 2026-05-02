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

function modeFromRequest(request, body) {
  const url = new URL(request.url);
  const raw = body?.mode || url.searchParams.get('mode');
  return raw === 'personal' ? 'personal' : 'business';
}

function nowIso() {
  return new Date().toISOString();
}

function eventFromTask(task) {
  if (!task?.name) throw new Error('Task name is required.');
  if (!task?.start) throw new Error('Task start time is required.');
  if (!task?.end) throw new Error('Task end time is required.');

  const id = task.internalEventId || `po-${task.id || Date.now()}-${Date.now()}`;
  return {
    id,
    taskId: task.id || id,
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
    createdAt: task.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function rebuildQuads(tasks) {
  return {
    q1: tasks.filter((task) => task.quadrant === 'q1').map((task) => task.name),
    q2: tasks.filter((task) => task.quadrant === 'q2').map((task) => task.name),
    q3: tasks.filter((task) => task.quadrant === 'q3').map((task) => task.name),
    q4: tasks.filter((task) => task.quadrant === 'q4').map((task) => task.name)
  };
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ ok: false, stage: 'auth', error: 'No authenticated session found.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = modeFromRequest(request, body);
    const incomingTask = body.task;
    const fullState = await readPriorityState(session.profile.email);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    const beforeCount = workspace.calendarEvents?.length || 0;

    const event = eventFromTask(incomingTask);
    const savedTask = {
      ...(incomingTask || {}),
      id: incomingTask?.id || event.taskId,
      internalEventId: event.id,
      start: event.start,
      end: event.end,
      notes: event.notes,
      type: event.type,
      recRule: event.recRule,
      quadrant: event.quadrant,
      tz: event.tz
    };

    const taskExists = (workspace.tasks || []).some((task) => task.id === savedTask.id);
    const tasks = taskExists
      ? (workspace.tasks || []).map((task) => task.id === savedTask.id ? { ...task, ...savedTask } : task)
      : [...(workspace.tasks || []), savedTask];

    const calendarEvents = [
      ...(workspace.calendarEvents || []).filter((item) => item.id !== event.id && item.taskId !== event.taskId),
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
    const afterWorkspace = saved.workspaces?.[mode] || EMPTY_WORKSPACE;
    const afterCount = afterWorkspace.calendarEvents?.length || 0;

    return NextResponse.json({
      ok: true,
      stage: 'saved',
      email: session.profile.email,
      mode,
      beforeCount,
      afterCount,
      event,
      task: savedTask,
      state: afterWorkspace
    });
  } catch (error) {
    return NextResponse.json({ ok: false, stage: 'write', error: error.message }, { status: 500 });
  }
}
