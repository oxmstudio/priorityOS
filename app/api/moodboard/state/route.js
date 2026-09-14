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

async function discoverMoodBoard(identity) {
  if (!identity) return null;
  try {
    // Do not use `mode: 'folded'` here. Folded listing is folder-oriented;
    // recovery needs the actual blob objects in `result.blobs`.
    const result = await list({ prefix: `priorityos-moodboard/${userHash(identity)}/`, limit: 1000 });
    const blobs = Array.isArray(result?.blobs) ? result.blobs : [];
    const items = blobs.map((blob, i) => {
      const id = blob.pathname?.split('/').pop();
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return null;
      const p = TILE_PRESETS[i % TILE_PRESETS.length];
      return {
        id,
        url: `/api/moodboard/image/${id}`,
        name: blob.pathname?.split('/').pop() || 'Mood board image',
        type: blob.contentType || '',
        x: p.x,
        y: p.y,
        w: p.w,
        z: i + 1
      };
    }).filter(Boolean);
    return items.length ? { items } : null;
  } catch (error) {
    console.error('Mood board blob discovery failed:', error);
    return null;
  }
}

async function readAccountState(session) {
  const identity = accountIdentity(session);
  const current = await readPriorityState(identity);
  if (hasItems(current.moodBoard)) return current;

  if (session.profile.sub && session.profile.email && session.profile.sub !== session.profile.email) {
    const legacy = await readPriorityState(session.profile.email);
    if (hasItems(legacy.moodBoard)) return writePriorityState(identity, { ...current, moodBoard: legacy.moodBoard });
    if (hasItems(legacy.workspaces?.business?.canvas)) return writePriorityState(identity, { ...current, moodBoard: legacy.workspaces.business.canvas });
    if (hasItems(legacy.workspaces?.personal?.canvas)) return writePriorityState(identity, { ...current, moodBoard: legacy.workspaces.personal.canvas });
  }

  // If metadata was lost but the private image blobs survived, rebuild the board
  // directly from the blob objects and persist the recovered metadata.
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
    // Do not let an accidental null request erase an existing/recovered board.
    // An intentional empty board is represented by { items: [] } by the UI.
    const moodBoard = requested || (hasItems(existing.moodBoard) ? existing.moodBoard : null);
    const saved = await writePriorityState(identity, { ...existing, moodBoard });
    return NextResponse.json({ ok: true, moodBoard: saved.moodBoard || null });
  } catch (error) {
    console.error('PUT /api/moodboard/state error:', error);
    return NextResponse.json({ error: error.message || 'Mood board state could not be saved.' }, { status: 500 });
  }
}
