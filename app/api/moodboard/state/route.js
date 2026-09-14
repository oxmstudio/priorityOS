import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

function userHash(identity) {
  return crypto.createHash('sha256').update(String(identity || '').toLowerCase()).digest('hex');
}

function accountIdentity(session) {
  return session?.profile?.sub || session?.profile?.email || '';
}

const TILE_PRESETS = [
  { x: 2, y: 4, w: 28 }, { x: 32, y: 4, w: 34 }, { x: 68, y: 4, w: 30 },
  { x: 32, y: 36, w: 18 }, { x: 52, y: 36, w: 22 }, { x: 76, y: 54, w: 22 }, { x: 2, y: 50, w: 28 }
];

function hasItems(board) {
  return Array.isArray(board?.items) && board.items.length > 0;
}

function blobsToBoard(blobs) {
  const items = (Array.isArray(blobs) ? blobs : []).map((blob, i) => {
    const parts = String(blob?.pathname || '').split('/');
    const id = parts.at(-1);
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return null;
    const p = TILE_PRESETS[i % TILE_PRESETS.length];
    return {
      id,
      pathname: blob.pathname,
      url: `/api/moodboard/image/${id}`,
      name: blob?.pathname || 'Mood board image',
      type: blob?.contentType || '',
      x: p.x,
      y: p.y,
      w: p.w,
      z: i + 1
    };
  }).filter(Boolean);
  return items.length ? { items } : null;
}

async function discoverMoodBoard(identity) {
  if (!identity) return null;
  const hash = userHash(identity);
  try {
    const exact = await list({ prefix: `priorityos-moodboard/${hash}/`, limit: 1000 });
    const exactBoard = blobsToBoard(exact?.blobs);
    if (exactBoard) return exactBoard;

    const root = await list({ prefix: 'priorityos-moodboard/', limit: 1000 });
    const matching = (Array.isArray(root?.blobs) ? root.blobs : []).filter(blob => {
      const parts = String(blob?.pathname || '').split('/');
      return parts[0] === 'priorityos-moodboard' && parts[1] === hash;
    });
    return blobsToBoard(matching);
  } catch (error) {
    console.error('Mood board blob discovery failed:', error);
    return null;
  }
}

async function attachStoredPaths(session, board) {
  if (!hasItems(board)) return board;
  const missing = board.items.some(item => !item?.pathname);
  if (!missing) return board;

  const identities = [...new Set([session.profile.sub, session.profile.email].filter(Boolean))];
  const byId = new Map();
  for (const identity of identities) {
    try {
      const result = await list({ prefix: `priorityos-moodboard/${userHash(identity)}/`, limit: 1000 });
      for (const blob of result?.blobs || []) {
        const id = String(blob.pathname || '').split('/').at(-1);
        if (id) byId.set(id, blob.pathname);
      }
    } catch (error) {
      console.error('Mood board path recovery failed:', error);
    }
  }
  const items = board.items.map(item => item.pathname ? item : ({ ...item, pathname: byId.get(item.id) || undefined }));
  return { ...board, items };
}

async function readAccountState(session) {
  const identity = accountIdentity(session);
  let current = await readPriorityState(identity);
  if (hasItems(current.moodBoard)) {
    const repaired = await attachStoredPaths(session, current.moodBoard);
    if (JSON.stringify(repaired) !== JSON.stringify(current.moodBoard)) {
      current = await writePriorityState(identity, { ...current, moodBoard: repaired });
    }
    return current;
  }

  if (session.profile.sub && session.profile.email && session.profile.sub !== session.profile.email) {
    const legacy = await readPriorityState(session.profile.email);
    if (hasItems(legacy.moodBoard)) return writePriorityState(identity, { ...current, moodBoard: await attachStoredPaths(session, legacy.moodBoard) });
    if (hasItems(legacy.workspaces?.business?.canvas)) return writePriorityState(identity, { ...current, moodBoard: await attachStoredPaths(session, legacy.workspaces.business.canvas) });
    if (hasItems(legacy.workspaces?.personal?.canvas)) return writePriorityState(identity, { ...current, moodBoard: await attachStoredPaths(session, legacy.workspaces.personal.canvas) });
  }

  for (const candidate of [...new Set([session.profile.sub, session.profile.email].filter(Boolean))]) {
    const discovered = await discoverMoodBoard(candidate);
    if (hasItems(discovered)) return writePriorityState(identity, { ...current, moodBoard: discovered });
  }

  return current;
}

export async function GET() {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const state = await readAccountState(session);
    return NextResponse.json({ ok: true, moodBoard: state.moodBoard || null });
  } catch (error) {
    console.error('GET /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be loaded.' }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const body = await request.json();
    const identity = accountIdentity(session);
    const existing = await readAccountState(session);
    const requested = body.moodBoard && typeof body.moodBoard === 'object' ? body.moodBoard : null;
    const moodBoard = requested || (hasItems(existing.moodBoard) ? existing.moodBoard : null);
    const saved = await writePriorityState(identity, { ...existing, moodBoard });
    return NextResponse.json({ ok: true, moodBoard: saved.moodBoard || null });
  } catch (error) {
    console.error('PUT /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be saved.' }, { status: 500 });
  }
}
