import { NextResponse } from 'next/server';
import { getAuthedOAuthClient, GOOGLE_SCOPES } from '../../../../lib/google';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = getSession();
  const auth = getAuthedOAuthClient(session);

  if (!auth || !session?.profile?.email) {
    return NextResponse.json({
      connected: false,
      requiredScopes: GOOGLE_SCOPES
    });
  }

  try {
    const tokenInfo = await auth.getTokenInfo(session.tokens.access_token);
    return NextResponse.json({
      connected: true,
      email: session.profile.email,
      grantedScopes: tokenInfo.scopes || [],
      requiredScopes: GOOGLE_SCOPES,
      hasCalendarEventsScope: (tokenInfo.scopes || []).includes('https://www.googleapis.com/auth/calendar.events'),
      expiresAt: session.tokens.expiry_date || null
    });
  } catch (error) {
    return NextResponse.json({
      connected: true,
      email: session.profile.email,
      requiredScopes: GOOGLE_SCOPES,
      error: error.message || 'Unable to inspect token scopes.'
    }, { status: 500 });
  }
}
