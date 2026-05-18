import { google } from 'googleapis';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
];

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl().replace(/\/$/, '')}/api/auth/callback`;
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: false,
    scope: GOOGLE_SCOPES.join(' '),
    state
  });
}

export async function getGoogleProfile(oauthClient) {
  const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
  const { data } = await oauth2.userinfo.get();
  return {
    email: data.email,
    name: data.name || data.email,
    picture: data.picture || ''
  };
}

export function getAuthedOAuthClient(session) {
  if (!session?.tokens) return null;
  const client = getOAuthClient();
  client.setCredentials(session.tokens);
  return client;
}
