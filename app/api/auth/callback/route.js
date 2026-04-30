import { NextResponse } from 'next/server';
import { getOAuthClient, getGoogleProfile } from '../../../../lib/google';
import { setSessionCookie } from '../../../../lib/session';

export const runtime = 'nodejs';

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function safePath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

function decodeState(rawState) {
  try {
    const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    return {
      token: decoded.token || '',
      returnTo: safePath(decoded.returnTo)
    };
  } catch (_error) {
    return { token: rawState || '', returnTo: '/dashboard' };
  }
}

function getReturnPath(request, decodedState) {
  return safePath(decodedState.returnTo || request.cookies.get('priorityos_return_to')?.value || '/dashboard');
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state');
  const decodedState = decodeState(rawState);
  const storedState = request.cookies.get('priorityos_oauth_state')?.value;

  if (!code || !decodedState.token || !storedState || decodedState.token !== storedState) {
    return NextResponse.redirect(`${appUrl()}/?auth=failed`);
  }

  try {
    const oauthClient = getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);
    const profile = await getGoogleProfile(oauthClient);

    const destination = `${appUrl()}${getReturnPath(request, decodedState)}?auth=connected`;
    const response = NextResponse.redirect(destination);
    setSessionCookie(response, { tokens, profile });
    response.cookies.set({ name: 'priorityos_oauth_state', value: '', path: '/', maxAge: 0 });
    response.cookies.set({ name: 'priorityos_return_to', value: '', path: '/', maxAge: 0 });
    return response;
  } catch (_error) {
    return NextResponse.redirect(`${appUrl()}/?auth=failed`);
  }
}
