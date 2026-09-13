import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getSession } from '../../../../lib/session';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';

export const runtime = 'nodejs';

function userHash(email) {
  return crypto.createHash('sha256').update(String(email || '').toLowerCase()).digest('hex');
}

function imageType(type) {
  return /^image\/(jpeg|png|webp|gif|avif)$/i.test(type || '');
}

const TILE_PRESETS = [
  { x: 2, y: 4, w: 28 }, { x: 32, y: 4, w: 34 }, { x: 68, y: 4, w: 30 },
  { x: 32, y: 36, w: 18 }, { x: 52, y: 36, w: 22 }, { x: 76, y: 54, w: 22 }, { x: 2, y: 50, w: 28 }
];

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect your account before uploading mood board images.' }, { status: 401 });
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((file) => file && typeof file.arrayBuffer === 'function');
    if (!files.length) return NextResponse.json({ error: 'No images were provided.' }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: 'Upload up to 12 images at a time.' }, { status: 400 });

    const uploaded = [];
    for (const file of files) {
      if (!imageType(file.type)) continue;
      if (file.size > 8 * 1024 * 1024) continue;
      const id = crypto.randomUUID();
      const pathname = `priorityos-moodboard/${userHash(session.profile.email)}/${id}`;
      await put(pathname, file, { access: 'private', contentType: file.type, addRandomSuffix: false, allowOverwrite: false });
      uploaded.push({ id, url: `/api/moodboard/image/${id}`, name: file.name || 'Mood board image', type: file.type });
    }
    if (!uploaded.length) return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF, or AVIF images up to 8 MB are supported.' }, { status: 400 });

    // Persist metadata during the upload itself so the board is account-level
    // even if the dashboard workspace state is stale or changes modes.
    const existing = await readPriorityState(session.profile.email);
    const current = existing.moodBoard || (existing.workspaces?.business?.canvas?.items?.length
      ? existing.workspaces.business.canvas
      : existing.workspaces?.personal?.canvas?.items?.length
        ? existing.workspaces.personal.canvas
        : null);
    const currentItems = Array.isArray(current?.items) ? current.items : [];
    const nextItems = [...currentItems, ...uploaded.map((image, i) => {
      const p = TILE_PRESETS[(currentItems.length + i) % TILE_PRESETS.length];
      return { ...image, x: p.x, y: p.y, w: p.w, z: currentItems.length + i + 1 };
    })];
    await writePriorityState(session.profile.email, { ...existing, moodBoard: { items: nextItems } });

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
    const pathname = `priorityos-moodboard/${userHash(session.profile.email)}/${id}`;
    await del(pathname);
    const existing = await readPriorityState(session.profile.email);
    const items = Array.isArray(existing.moodBoard?.items) ? existing.moodBoard.items : [];
    await writePriorityState(session.profile.email, { ...existing, moodBoard: { items: items.filter((item) => item.id !== id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/moodboard/upload error:', error);
    return NextResponse.json({ error: error.message || 'Mood board image delete failed.' }, { status: 500 });
  }
}
