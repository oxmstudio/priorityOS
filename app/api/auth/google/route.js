import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthUrl } from '../../../../lib/google';

export const runtime = 'nodejs';

function safeReturnTo(request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('returnTo');
  if (!requested || !requested.startsWith('/')) return '/dashboard';
  if (requested.startsWith('//')) return '/dashboard';
  return requested;
}

function encodeState(token, returnTo) {
  return Buffer.from(JSON.stringify({ token, returnTo })).toString('base64url');
}

export async function GET(request) {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    const returnTo = safeReturnTo(request);
    const state = encodeState(token, returnTo);
    const response = NextResponse.redirect(getAuthUrl(state));
    response.cookies.set({
      name: 'priorityos_oauth_state',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10
    });
    response.cookies.set({
      name: 'priorityos_return_to',
      value: returnTo,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
