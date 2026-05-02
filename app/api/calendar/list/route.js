import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { readPriorityState } from '../../../../lib/blobState';

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

function eventFromTask(task) {
  if (!task?.start || !task?.end) return null;
  return {
    id: task.internalEventId || task.eventId || task.id,
    taskId: task.id || null,
    googleEventId: task.eventId || null,
    googleLink: task.calLink || null,
    title: task.name || 'Untitled task',
    notes: task.notes || '',
    type: task.type || 'pr',
    quadrant: task.quadrant || null,
    recRule: task.recRule || null,
    start: task.start,
    end: task.end,
    tz: task.tz || 'UTC',
    source: task.eventId ? 'priorityos+google' : 'priorityos-task',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function mergeEvents(explicitEvents = [], tasks = []) {
  const events = [];
  const seen = new Set();
  for (const event of explicitEvents) {
    if (!event?.start || !event?.end) continue;
    const key = event.id || event.taskId || `${event.title}-${event.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }
  for (const task of tasks) {
    const event = eventFromTask(task);
    if (!event) continue;
    const key = event.id || event.taskId || `${event.title}-${event.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }
  return events;
}

export async function GET(request) {
  const session = getSession();
  const mode = modeFromRequest(request);

  if (!session?.profile?.email) {
    return NextResponse.json({ ok: false, error: 'No authenticated session found.', mode }, { status: 401 });
  }

  try {
    const fullState = await readPriorityState(session.profile.email);
    const workspace = fullState.workspaces?.[mode] || EMPTY_WORKSPACE;
    const events = mergeEvents(workspace.calendarEvents || [], workspace.tasks || []);

    return NextResponse.json({
      ok: true,
      email: session.profile.email,
      mode,
      calendarEventCount: workspace.calendarEvents?.length || 0,
      taskScheduledCount: (workspace.tasks || []).filter((task) => task.start && task.end).length,
      events,
      workspace
    });
  } catch (error) {
    return NextResponse.json({ ok: false, mode, error: error.message }, { status: 500 });
  }
}
