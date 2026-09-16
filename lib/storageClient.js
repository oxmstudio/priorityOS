'use client';

import {Filesystem, Directory} from '@capacitor/filesystem';
import {Capacitor} from '@capacitor/core';

const LOCAL_STATE_KEY = 'priorityos.local.state.v1';
const LOCAL_FILE_DB = 'priorityos.local.files.v1';
const LOCAL_FILE_STORE = 'moodboard';
const LOCAL_FILE_DB_VERSION = 1;
const NATIVE_IMAGE_DIR = 'moodboard';
const LOCAL_IMAGE_PATH = id => `/api/moodboard/image/${encodeURIComponent(id)}`;

const EMPTY_WORKSPACE = {values: [], goals: [], tasks: [], calendarEvents: [], statistics: {charts: [], activeChartId: null, pinnedChartId: null}, habits: {completions: {}}, canvas: null, quads: {q1: [], q2: [], q3: [], q4: []}, synced: 0, dailyNotes: {}};
export const EMPTY_LOCAL_STATE = {activeMode: 'business', moodBoard: null, workspaces: {business: structuredClone(EMPTY_WORKSPACE), personal: structuredClone(EMPTY_WORKSPACE)}};

let serviceWorkerPromise = null;
let fetchPatched = false;
const localObjectUrls = new Map();

function localModeFromLocation() { return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('local') === '1'; }
function nativeFilesystemAvailable() { return typeof window !== 'undefined' && Capacitor.isNativePlatform(); }
function nativeImagePath(id) { return `${NATIVE_IMAGE_DIR}/${encodeURIComponent(id)}`; }

function ensureLocalServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !localModeFromLocation() || nativeFilesystemAvailable()) return;
  if (!serviceWorkerPromise) serviceWorkerPromise = navigator.serviceWorker.register('/priorityos-local-sw.js', {scope: '/'}).catch(error => { console.warn('PriorityOS local file service worker registration failed:', error); return null; });
  return serviceWorkerPromise;
}

function openLocalFileDb() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_FILE_DB, LOCAL_FILE_DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(LOCAL_FILE_STORE)) db.createObjectStore(LOCAL_FILE_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local file database could not be opened.'));
  });
}

function readLocalMoodImage(id) {
  return openLocalFileDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(LOCAL_FILE_STORE, 'readonly').objectStore(LOCAL_FILE_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Local image could not be read.'));
  }));
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function saveNativeMoodImage(id, file) {
  await Filesystem.writeFile({path: nativeImagePath(id), data: await blobToBase64(file), directory: Directory.Data, recursive: true});
}
async function deleteNativeMoodImage(id) { try { await Filesystem.deleteFile({path: nativeImagePath(id), directory: Directory.Data}); } catch {} }

async function resolveNativeImageDataUrl(id, type = 'image/jpeg') {
  try {
    const result = await Filesystem.readFile({path: nativeImagePath(id), directory: Directory.Data});
    if (!result?.data) return null;
    return `data:${type || 'image/jpeg'};base64,${result.data}`;
  } catch (error) {
    console.warn(`PriorityOS native image read failed for ${id}:`, error);
    return null;
  }
}

export async function resolveLocalImageUrl(id, type) {
  if (!id) return null;
  const cacheKey = `${id}:${type || ''}`;
  const existing = localObjectUrls.get(cacheKey);
  if (existing) return existing;
  if (nativeFilesystemAvailable()) {
    const nativeUrl = await resolveNativeImageDataUrl(id, type);
    if (nativeUrl) { localObjectUrls.set(cacheKey, nativeUrl); return nativeUrl; }
  }
  try {
    const stored = await readLocalMoodImage(id);
    if (!stored?.blob) return null;
    if (nativeFilesystemAvailable()) {
      await saveNativeMoodImage(id, stored.blob);
      const nativeUrl = await resolveNativeImageDataUrl(id, stored.type || type);
      if (nativeUrl) { localObjectUrls.set(cacheKey, nativeUrl); return nativeUrl; }
    }
    const url = URL.createObjectURL(stored.blob);
    localObjectUrls.set(cacheKey, url);
    return url;
  } catch (error) { console.warn(`PriorityOS local image read failed for ${id}:`, error); return null; }
}

function createLocalId() { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

async function localMoodUpload(request) {
  const formData = await request.formData();
  const files = Array.from(formData.getAll('files')).filter(value => value instanceof File).slice(0, 12);
  const images = [];
  for (const file of files) {
    const id = createLocalId();
    if (nativeFilesystemAvailable()) {
      await saveNativeMoodImage(id, file);
      const url = await resolveNativeImageDataUrl(id, file.type);
      if (!url) throw new Error('The image was saved but could not be opened.');
      localObjectUrls.set(`${id}:${file.type || ''}`, url);
      images.push({id, name: file.name, type: file.type, size: file.size, url, storage: 'native'});
    } else {
      const db = await openLocalFileDb();
      await new Promise((resolve, reject) => { const transaction = db.transaction(LOCAL_FILE_STORE, 'readwrite'); transaction.objectStore(LOCAL_FILE_STORE).put({blob: file, type: file.type, name: file.name, size: file.size}, id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error || new Error('Local image could not be saved.')); });
      const url = URL.createObjectURL(file); localObjectUrls.set(`${id}:${file.type || ''}`, url);
      images.push({id, name: file.name, type: file.type, size: file.size, url, storage: 'local'});
    }
  }
  return new Response(JSON.stringify({images}), {status: 200, headers: {'Content-Type': 'application/json'}});
}

async function localMoodDelete(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    for (const [key, url] of localObjectUrls.entries()) { if (key.startsWith(`${id}:`) && url.startsWith('blob:')) URL.revokeObjectURL(url); if (key.startsWith(`${id}:`)) localObjectUrls.delete(key); }
    if (nativeFilesystemAvailable()) await deleteNativeMoodImage(id);
    try { const db = await openLocalFileDb(); await new Promise((resolve, reject) => { const transaction = db.transaction(LOCAL_FILE_STORE, 'readwrite'); transaction.objectStore(LOCAL_FILE_STORE).delete(id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error || new Error('Local image could not be deleted.')); }); } catch {}
  }
  return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
}

function patchLocalMoodBoardFetch() {
  if (fetchPatched || typeof window === 'undefined' || !localModeFromLocation()) return;
  fetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url, window.location.href);
    if (url.pathname === '/api/moodboard/upload' && request.method.toUpperCase() === 'POST') return localMoodUpload(request);
    if (url.pathname === '/api/moodboard/upload' && request.method.toUpperCase() === 'DELETE') return localMoodDelete(request);
    return nativeFetch(input, init);
  };
}

export function isLocalMode() { const local = localModeFromLocation(); if (local) { ensureLocalServiceWorker(); patchLocalMoodBoardFetch(); } return local; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalizeCanvas(canvas) { if (!canvas || typeof canvas !== 'object' || !Array.isArray(canvas.items)) return canvas; return {...canvas, items: canvas.items.map(item => !item || typeof item !== 'object' || !item.id || !['local','native'].includes(item.storage) ? item : {...item, url: LOCAL_IMAGE_PATH(item.id)})}; }
function normalizeState(state) {
  const source = state && typeof state === 'object' ? state : EMPTY_LOCAL_STATE;
  const workspace = value => ({...clone(EMPTY_WORKSPACE), ...(value && typeof value === 'object' ? value : {}), canvas: normalizeCanvas(value?.canvas), statistics: value?.statistics && typeof value.statistics === 'object' ? value.statistics : clone(EMPTY_WORKSPACE.statistics), habits: value?.habits && typeof value.habits === 'object' ? value.habits : clone(EMPTY_WORKSPACE.habits), quads: value?.quads && typeof value.quads === 'object' ? value.quads : clone(EMPTY_WORKSPACE.quads), dailyNotes: value?.dailyNotes && typeof value.dailyNotes === 'object' ? value.dailyNotes : {}});
  return {activeMode: source.activeMode === 'personal' ? 'personal' : 'business', moodBoard: source.moodBoard && typeof source.moodBoard === 'object' ? normalizeCanvas(source.moodBoard) : null, workspaces: {business: workspace(source.workspaces?.business), personal: workspace(source.workspaces?.personal)}};
}

export async function hydrateLocalCanvas(canvas) {
  const normalized = normalizeCanvas(canvas); if (!normalized || !Array.isArray(normalized.items)) return normalized;
  const items = await Promise.all(normalized.items.map(async item => { if (!item?.id || !['local','native'].includes(item.storage)) return item; const url = await resolveLocalImageUrl(item.id, item.type); return url ? {...item, url, storage: nativeFilesystemAvailable() ? 'native' : item.storage} : item; }));
  return {...normalized, items};
}
export async function hydrateLocalState(state) { const normalized = normalizeState(state); normalized.workspaces.business.canvas = await hydrateLocalCanvas(normalized.workspaces.business.canvas); normalized.workspaces.personal.canvas = await hydrateLocalCanvas(normalized.workspaces.personal.canvas); if (normalized.moodBoard) normalized.moodBoard = await hydrateLocalCanvas(normalized.moodBoard); return normalized; }
export function readLocalState() { if (typeof window === 'undefined') return clone(EMPTY_LOCAL_STATE); try { const raw = window.localStorage.getItem(LOCAL_STATE_KEY); return normalizeState(raw ? JSON.parse(raw) : EMPTY_LOCAL_STATE); } catch (error) { console.warn('PriorityOS local state read failed:', error); return clone(EMPTY_LOCAL_STATE); } }
export function writeLocalState(state) { const normalized = normalizeState(state); if (typeof window !== 'undefined') window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(normalized)); return normalized; }
export async function loadPriorityState(mode = 'business') { if (isLocalMode()) { const localState = await hydrateLocalState(readLocalState()); return {state: localState, moodBoard: localState.moodBoard}; } const [workspaceResponse, moodBoardResponse] = await Promise.all([fetch(`/api/state?mode=${mode}&t=${Date.now()}`, {cache: 'no-store'}), fetch(`/api/moodboard/state?t=${Date.now()}`, {cache: 'no-store'})]); const workspaceResult = workspaceResponse.ok ? await workspaceResponse.json() : {state: EMPTY_WORKSPACE}; const moodBoardResult = moodBoardResponse.ok ? await moodBoardResponse.json() : {moodBoard: null}; return {state: workspaceResult.state || EMPTY_WORKSPACE, moodBoard: moodBoardResult.moodBoard || null}; }
export async function saveWorkspaceState(mode, state) { if (isLocalMode()) { const current = readLocalState(); current.workspaces[mode] = normalizeCanvas(state?.canvas) ? {...state, canvas: normalizeCanvas(state.canvas)} : state; return writeLocalState(current); } const response = await fetch(`/api/state?mode=${mode}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({mode, state})}); if (!response.ok) throw new Error('Workspace save failed.'); return (await response.json()).state || state; }
export async function saveMoodBoardState(moodBoard) { if (isLocalMode()) { const current = readLocalState(); current.moodBoard = moodBoard || null; return writeLocalState(current).moodBoard; } const response = await fetch('/api/moodboard/state', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({moodBoard: moodBoard || null})}); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Mood board save failed.'); } return (await response.json()).moodBoard || null; }
export function localAuth() { return {loading: false, connected: true, profile: {email: 'local@priorityos.app', name: 'Local PriorityOS'}}; }