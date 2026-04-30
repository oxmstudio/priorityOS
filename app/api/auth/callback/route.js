import { NextResponse } from 'next/server';
import { getOAuthClient, getGoogleProfile } from '../../../../lib/google';
import { setSessionCookie } from '../../../../lib/session';

export const runtime = 'nodejs';

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getReturnPath(request) {
  const value = request.cookies.get('priorityos_return_to')?.value || '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = request.cookies.get('priorityos_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${appUrl()}/?auth=failed`);
  }

  try {
    const oauthClient = getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);
    const profile = await getGoogleProfile(oauthClient);

    const destination = `${appUrl()}${getReturnPath(request)}?auth=connected`;
    const response = NextResponse.redirect(destination);
    setSessionCookie(response, { tokens, profile });
    response.cookies.set({
      name: 'priorityos_oauth_state',
      value: '',
      path: '/',
      maxAge: 0
    });
    response.cookies.set({
      name: 'priorityos_return_to',
      value: '',
      path: '/',
      maxAge: 0
    });
    return response;
  } catch (_error) {
    return NextResponse.redirect(`${appUrl()}/?auth=failed`);
  }
}
