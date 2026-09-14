import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getSession } from '../../../../../lib/session';

export const runtime = 'nodejs';

function userHash(identity) {
  return crypto.createHash('sha256').update(String(identity || '').toLowerCase()).digest('hex');
}

export async function GET(request, { params }) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Not connected.' }, { status: 401 });
  const id = params?.id;
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return new NextResponse('Invalid image.', { status: 400 });

  const identities = [session.profile.sub, session.profile.email].filter(Boolean);
  const uniqueIdentities = [...new Set(identities)];
  let result = null;

  try {
    for (const identity of uniqueIdentities) {
      const pathname = `priorityos-moodboard/${userHash(identity)}/${id}`;
      try {
        result = await get(pathname, {
          access: 'private',
          useCache: false,
          ifNoneMatch: request.headers.get('if-none-match') || undefined
        });
        if (result) break;
      } catch (_error) {
        // Try the next identity key so older email-keyed uploads remain readable.
      }
    }

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
