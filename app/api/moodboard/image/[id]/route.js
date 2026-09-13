import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
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
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') || undefined
    });

    if (!result || result.statusCode === 404) return new NextResponse('Not found', { status: 404 });

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache'
        }
      });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Content-Length': String(result.blob.size || ''),
        'X-Content-Type-Options': 'nosniff',
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache'
      }
    });
  } catch (error) {
    console.error('GET /api/moodboard/image error:', error);
    return new NextResponse('Not found', { status: 404 });
  }
}
