import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthUrl } from '../../../../lib/google';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const response = NextResponse.redirect(getAuthUrl(state));
    response.cookies.set({
      name: 'priorityos_oauth_state',
      value: state,
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
