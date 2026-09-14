import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getSession } from '../../../../lib/session';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';

export const runtime = 'nodejs';

function userHash(identity) {
  return crypto.createHash('sha256').update(String(identity || 'anonymous').toLowerCase()).digest('hex');
}

function accountIdentity(session) {
  return session?.profile?.sub || session?.profile?.email || '';
}

function imageType(type) {
  return /^image\/(jpeg|png|webp|gif|avif)$/i.test(type || '');
}

const TILE_PRESETS = [
  { x: 2, y: 4, w: 28 }, { x: 32, y: 4, w: 34 }, { x: 68, y: 4, w: 30 },
  { x: 32, y: 36, w: 18 }, { x: 52, y: 36, w: 22 }, { x: 76, y: 54, w: 22 }, { x: 2, y: 50, w: 28 }
];

function hasMoodBoardItems(state) {
  return Array.isArray(state?.moodBoard?.items) && state.moodBoard.items.length > 0;
}

async function readAccountState(session) {
  const identity = accountIdentity(session);
  const current = await readPriorityState(identity);
  // Migrate an older email-keyed board into the stable Google-account key.
  if (session.profile.sub && session.profile.email && session.profile.sub !== session.profile.email && !hasMoodBoardItems(current)) {
    const legacy = await readPriorityState(session.profile.email);
    if (hasMoodBoardItems(legacy)) {
      const migrated = await writePriorityState(identity, { ...current, moodBoard: legacy.moodBoard });
      return migrated;
    }
  }
  return current;
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect your account before uploading mood board images.' }, { status: 401 });
  try {
    const identity = accountIdentity(session);
    const form = await request.formData();
    const files = form.getAll('files').filter((file) => file && typeof file.arrayBuffer === 'function');
    if (!files.length) return NextResponse.json({ error: 'No images were provided.' }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: 'Upload up to 12 images at a time.' }, { status: 400 });

    const uploaded = [];
    for (const file of files) {
      if (!imageType(file.type)) continue;
      if (file.size > 8 * 1024 * 1024) continue;
      const id = crypto.randomUUID();
      const pathname = `priorityos-moodboard/${userHash(identity)}/${id}`;
      await put(pathname, file, { access: 'private', contentType: file.type, addRandomSuffix: false, allowOverwrite: false });
      uploaded.push({ id, pathname, url: `/api/moodboard/image/${id}`, name: file.name || 'Mood board image', type: file.type });
    }
    if (!uploaded.length) return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF, or AVIF images up to 8 MB are supported.' }, { status: 400 });

    const existing = await readAccountState(session);
    const current = existing.moodBoard || (existing.workspaces?.business?.canvas?.items?.length
      ? existing.workspaces.business.canvas
      : existing.workspaces?.personal?.canvas?.items?.length
        ? existing.workspaces.personal.canvas
        : null);
    const currentItems = Array.isArray(current?.items) ? current.items : [];
    const nextItems = [...currentItems, ...uploaded.map((image, i) => {
      const p = TILE_PRESETS[(currentItems.length + i) % TILE_PRESETS.length];
      return { ...image, x: p.x, y: p.y, w: p.w, aspectRatio: null, z: currentItems.length + i + 1 };
    })];
    await writePriorityState(identity, { ...existing, moodBoard: { items: nextItems } });

    return NextResponse.json({ ok: true, images: uploaded, moodBoard: { items: nextItems } });
  } catch (error) {
    console.error('POST /api/moodboard/upload error:', error);
    return NextResponse.json({ error: error.message || 'Mood board upload failed.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid image.' }, { status: 400 });
    const identity = accountIdentity(session);
    const primaryPath = `priorityos-moodboard/${userHash(identity)}/${id}`;
    const legacyPath = `priorityos-moodboard/${userHash(session.profile.email)}/${id}`;
    try {
      await del(primaryPath);
    } catch (error) {
      if (primaryPath === legacyPath) throw error;
      await del(legacyPath);
    }
    const existing = await readAccountState(session);
    const items = Array.isArray(existing.moodBoard?.items) ? existing.moodBoard.items : [];
    await writePriorityState(identity, { ...existing, moodBoard: { items: items.filter((item) => item.id !== id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/moodboard/upload error:', error);
    return NextResponse.json({ error: error.message || 'Mood board image delete failed.' }, { status: 500 });
  }
}
