import crypto from 'crypto';
import { list, put } from '@vercel/blob';

export const EMPTY_PRIORITY_STATE = {
  values: [],
  goals: [],
  tasks: [],
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0
};

function userKey(email) {
  const hash = crypto.createHash('sha256').update(String(email || 'anonymous').toLowerCase()).digest('hex');
  return `priorityos/${hash}.json`;
}

export async function readPriorityState(email) {
  const pathname = userKey(email);
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  const blob = blobs.find((item) => item.pathname === pathname);
  if (!blob?.url) return EMPTY_PRIORITY_STATE;

  const response = await fetch(blob.url, { cache: 'no-store' });
  if (!response.ok) return EMPTY_PRIORITY_STATE;
  const state = await response.json();
  return normalizePriorityState(state);
}

export async function writePriorityState(email, state) {
  const normalized = normalizePriorityState(state);
  await put(userKey(email), JSON.stringify(normalized, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });
  return normalized;
}

export function normalizePriorityState(state) {
  return {
    values: Array.isArray(state?.values) ? state.values : [],
    goals: Array.isArray(state?.goals) ? state.goals : [],
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    quads: {
      q1: Array.isArray(state?.quads?.q1) ? state.quads.q1 : [],
      q2: Array.isArray(state?.quads?.q2) ? state.quads.q2 : [],
      q3: Array.isArray(state?.quads?.q3) ? state.quads.q3 : [],
      q4: Array.isArray(state?.quads?.q4) ? state.quads.q4 : []
    },
    synced: Number.isFinite(Number(state?.synced)) ? Number(state.synced) : 0
  };
}
