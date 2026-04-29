import crypto from 'crypto';
import { get, put } from '@vercel/blob';

export const EMPTY_WORKSPACE_STATE = {
  values: [],
  goals: [],
  tasks: [],
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

async function blobBodyToJson(body) {
  if (!body) return EMPTY_PRIORITY_STATE;
  if (typeof body.text === 'function') return JSON.parse(await body.text());

  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function readPriorityState(email) {
  try {
    const result = await get(userKey(email), { access: 'private' });
    if (!result?.body) return EMPTY_PRIORITY_STATE;
    const state = await blobBodyToJson(result.body);
    return normalizePriorityState(state);
  } catch (error) {
    if (
      error?.status === 404 ||
      error?.statusCode === 404 ||
      String(error?.message || '').toLowerCase().includes('not found')
    ) return EMPTY_PRIORITY_STATE;
    throw error;
  }
}

export async function writePriorityState(email, state) {
  const normalized = normalizePriorityState(state);
  await put(userKey(email), JSON.stringify(normalized, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });
  return normalized;
}

function normalizeWorkspace(state) {
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

export function normalizePriorityState(state) {
  const activeMode = state?.activeMode === 'personal' ? 'personal' : 'business';

  // Migrate old single-workspace saves into the Business workspace.
  if (!state?.workspaces) {
    return {
      activeMode,
      workspaces: {
        business: normalizeWorkspace(state),
        personal: normalizeWorkspace(null)
      }
    };
  }

  return {
    activeMode,
    workspaces: {
      business: normalizeWorkspace(state.workspaces.business),
      personal: normalizeWorkspace(state.workspaces.personal)
    }
  };
}
