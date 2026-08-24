import crypto from 'crypto';
import { head, put } from '@vercel/blob';

export const EMPTY_WORKSPACE_STATE = {
  values: [],
  goals: [],
  tasks: [],
  calendarEvents: [],
  statistics: null,
  habits: null,
  canvas: null,
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0
};

export const EMPTY_PRIORITY_STATE = {
  activeMode: 'business',
  workspaces: {
    business: EMPTY_WORKSPACE_STATE,
    personal: EMPTY_WORKSPACE_STATE
  }
};

function userKey(email) {
  const hash = crypto.createHash('sha256').update(String(email || 'anonymous').toLowerCase()).digest('hex');
  return `priorityos/${hash}.json`;
}

async function fetchBlobText(url) {
  if (!url) return null;
  const authHeaders = process.env.BLOB_READ_WRITE_TOKEN ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } : undefined;
  let response = await fetch(url, { cache: 'no-store' });
  if (!response.ok && authHeaders) response = await fetch(url, { cache: 'no-store', headers: authHeaders });
  if (!response.ok) return null;
  return response.text();
}

async function readBlobJson(pathname) {
  try {
    const meta = await head(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const text = (await fetchBlobText(meta.downloadUrl)) || (await fetchBlobText(meta.url));
    if (!text) return EMPTY_PRIORITY_STATE;
    return JSON.parse(text);
  } catch (error) {
    // Handle 404 errors when blob doesn't exist yet
    if (error?.status === 404 || error?.statusCode === 404 || String(error?.message || '').toLowerCase().includes('not found')) {
      return EMPTY_PRIORITY_STATE;
    }
    throw error;
  }
}

export async function readPriorityState(email) {
  try {
    const state = await readBlobJson(userKey(email));
    return normalizePriorityState(state);
  } catch (error) {
    if (error?.status === 404 || error?.statusCode === 404 || String(error?.message || '').toLowerCase().includes('not found')) return EMPTY_PRIORITY_STATE;
    throw error;
  }
}

export async function writePriorityState(email, state) {
  const normalized = normalizePriorityState(state);
  await put(userKey(email), JSON.stringify(normalized, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return normalized;
}

function taskToCalendarEvent(task) {
  if (!task?.start || !task?.end) return null;
  return {
    id: task.internalEventId || task.eventId || task.id || crypto.randomUUID(),
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
    source: task.eventId ? 'priorityos+google' : 'priorityos',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function normalizeCalendarEvent(event) {
  if (!event?.start || !event?.end) return null;
  return {
    id: event.id || event.googleEventId || event.taskId || crypto.randomUUID(),
    taskId: event.taskId || null,
    googleEventId: event.googleEventId || event.eventId || null,
    googleLink: event.googleLink || event.calLink || null,
    title: event.title || event.name || 'Untitled event',
    notes: event.notes || '',
    type: event.type || 'pr',
    quadrant: event.quadrant || null,
    recRule: event.recRule || null,
    start: event.start,
    end: event.end,
    tz: event.tz || 'UTC',
    source: event.source || (event.googleEventId ? 'priorityos+google' : 'priorityos'),
    createdAt: event.createdAt || new Date().toISOString(),
    updatedAt: event.updatedAt || new Date().toISOString()
  };
}

function normalizeHabits(habits) {
  return { completions: habits?.completions && typeof habits.completions === 'object' ? habits.completions : {} };
}

function normalizeWorkspace(state) {
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const explicitEvents = Array.isArray(state?.calendarEvents) ? state.calendarEvents.map(normalizeCalendarEvent).filter(Boolean) : [];
  const eventIds = new Set(explicitEvents.map((event) => event.id));
  const migratedTaskEvents = tasks.map(taskToCalendarEvent).filter(Boolean).filter((event) => {
    if (eventIds.has(event.id)) return false;
    eventIds.add(event.id);
    return true;
  });

  return {
    values: Array.isArray(state?.values) ? state.values : [],
    goals: Array.isArray(state?.goals) ? state.goals : [],
    tasks,
    calendarEvents: [...explicitEvents, ...migratedTaskEvents],
    statistics: state?.statistics && typeof state.statistics === 'object' ? state.statistics : null,
    habits: normalizeHabits(state?.habits),
    canvas: state?.canvas && typeof state.canvas === 'object' ? state.canvas : null,
    quads: {
      q1: Array.isArray(state?.quads?.q1) ? state.quads.q1 : [],
      q2: Array.isArray(state?.quads?.q2) ? state.quads.q2 : [],
      q3: Array.isArray(state?.quads?.q3) ? state.quads.q3 : [],
      q4: Array.isArray(state?.quads?.q4) ? state.quads.q4 : []
    },
    synced: Number.isFinite(Number(state?.synced)) ? Number(state.synced) : tasks.filter((task) => task.eventId).length
  };
}

export function normalizePriorityState(state) {
  const activeMode = state?.activeMode === 'personal' ? 'personal' : 'business';
  if (!state?.workspaces) return { activeMode, workspaces: { business: normalizeWorkspace(state), personal: normalizeWorkspace(null) } };
  return { activeMode, workspaces: { business: normalizeWorkspace(state.workspaces.business), personal: normalizeWorkspace(state.workspaces.personal) } };
}
