'use client';

const LOCAL_STATE_KEY = 'priorityos.local.state.v1';

const EMPTY_WORKSPACE = {
  values: [],
  goals: [],
  tasks: [],
  calendarEvents: [],
  statistics: { charts: [], activeChartId: null, pinnedChartId: null },
  habits: { completions: {} },
  canvas: null,
  quads: { q1: [], q2: [], q3: [], q4: [] },
  synced: 0,
  dailyNotes: {}
};

export const EMPTY_LOCAL_STATE = {
  activeMode: 'business',
  moodBoard: null,
  workspaces: {
    business: structuredClone(EMPTY_WORKSPACE),
    personal: structuredClone(EMPTY_WORKSPACE)
  }
};

export function isLocalMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('local') === '1';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(state) {
  const source = state && typeof state === 'object' ? state : EMPTY_LOCAL_STATE;
  const workspace = (value) => ({
    ...clone(EMPTY_WORKSPACE),
    ...(value && typeof value === 'object' ? value : {}),
    statistics: value?.statistics && typeof value.statistics === 'object' ? value.statistics : clone(EMPTY_WORKSPACE.statistics),
    habits: value?.habits && typeof value.habits === 'object' ? value.habits : clone(EMPTY_WORKSPACE.habits),
    quads: value?.quads && typeof value.quads === 'object' ? value.quads : clone(EMPTY_WORKSPACE.quads),
    dailyNotes: value?.dailyNotes && typeof value.dailyNotes === 'object' ? value.dailyNotes : {}
  });
  return {
    activeMode: source.activeMode === 'personal' ? 'personal' : 'business',
    moodBoard: source.moodBoard && typeof source.moodBoard === 'object' ? source.moodBoard : null,
    workspaces: {
      business: workspace(source.workspaces?.business),
      personal: workspace(source.workspaces?.personal)
    }
  };
}

export function readLocalState() {
  if (typeof window === 'undefined') return clone(EMPTY_LOCAL_STATE);
  try {
    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : EMPTY_LOCAL_STATE);
  } catch (error) {
    console.warn('PriorityOS local state read failed:', error);
    return clone(EMPTY_LOCAL_STATE);
  }
}

export function writeLocalState(state) {
  const normalized = normalizeState(state);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export async function loadPriorityState(mode = 'business') {
  if (isLocalMode()) return readLocalState();
  const [workspaceResponse, moodBoardResponse] = await Promise.all([
    fetch(`/api/state?mode=${mode}&t=${Date.now()}`, { cache: 'no-store' }),
    fetch(`/api/moodboard/state?t=${Date.now()}`, { cache: 'no-store' })
  ]);
  const workspaceResult = workspaceResponse.ok ? await workspaceResponse.json() : { state: EMPTY_WORKSPACE };
  const moodBoardResult = moodBoardResponse.ok ? await moodBoardResponse.json() : { moodBoard: null };
  return { state: workspaceResult.state || EMPTY_WORKSPACE, moodBoard: moodBoardResult.moodBoard || null };
}

export async function saveWorkspaceState(mode, state) {
  if (isLocalMode()) {
    const current = readLocalState();
    current.workspaces[mode] = state;
    return writeLocalState(current);
  }
  const response = await fetch(`/api/state?mode=${mode}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, state })
  });
  if (!response.ok) throw new Error('Workspace save failed.');
  return (await response.json()).state || state;
}

export async function saveMoodBoardState(moodBoard) {
  if (isLocalMode()) {
    const current = readLocalState();
    current.moodBoard = moodBoard || null;
    return writeLocalState(current).moodBoard;
  }
  const response = await fetch('/api/moodboard/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moodBoard: moodBoard || null })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Mood board save failed.');
  }
  return (await response.json()).moodBoard || null;
}

export function localAuth() {
  return {
    loading: false,
    connected: true,
    profile: { email: 'local@priorityos.app', name: 'Local PriorityOS' }
  };
}
