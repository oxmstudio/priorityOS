import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { getSession } from '../../../../../lib/session';

export const runtime = 'nodejs';

function userHash(email) {
  return crypto.createHash('sha256').update(String(email || '').toLowerCase()).digest('hex');
}

export async function GET(request, { params }) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  const id = params?.id;
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid image.' }, { status: 400 });

  try {
    const pathname = `priorityos-moodboard/${userHash(session.profile.email)}/${id}`;
    const token = await issueSignedToken({ pathname, operations: ['get'] });
    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: 'get',
      validUntil: Date.now() + 60 * 60 * 1000
    });
    return NextResponse.redirect(presignedUrl, 302);
  } catch (error) {
    console.error('GET /api/moodboard/image error:', error);
    return new NextResponse('Not found', { status: 404 });
  }
}
