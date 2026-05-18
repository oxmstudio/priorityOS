import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthedOAuthClient } from '../../../../lib/google';
import { getSession } from '../../../../lib/session';
import { readPriorityState, writePriorityState } from '../../../../lib/blobState';

export const runtime = 'nodejs';

function modeFromRequest(request, fallback = 'business') {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || fallback;
  return mode === 'personal' ? 'personal' : 'business';
}

function reconnectPath(request) {
  const mode = modeFromRequest(request);
  const returnTo = `/dashboard?mode=${mode}&view=dashboard`;
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}

function errorText(error) {
  return [
    error?.message,
    error?.response?.data?.error,
    error?.response?.data?.error_description,
    error?.errors?.[0]?.reason
  ].filter(Boolean).map((value) => String(value).toLowerCase()).join(' ');
}

function isInvalidGrant(error) {
  const text = errorText(error);
  return text.includes('invalid_grant') || text.includes('token has been expired') || text.includes('revoked');
}

function isInsufficientScopes(error) {
  const text = errorText(error);
  return text.includes('insufficient authentication scopes') || text.includes('insufficient_scope') || text.includes('insufficient permissions');
}

function dateAtLocalMidnight(dateString) {
  return `${dateString}T00:00:00`;
}

function normalizeGoogleEvent(event) {
  if (!event || event.status === 'cancelled') return null;
  const startRaw = event.start?.dateTime || (event.start?.date ? dateAtLocalMidnight(event.start.date) : null);
  const endRaw = event.end?.dateTime || (event.end?.date ? dateAtLocalMidnight(event.end.date) : null);
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const calendarId = 'primary';
  const sourceId = event.id || crypto.randomUUID();
  const instanceKey = event.recurringEventId ? `${event.recurringEventId}-${start.toISOString()}` : sourceId;
  return {
    id: `google-import-${calendarId}-${instanceKey}`,
    taskId: null,
    googleEventId: event.id || null,
    googleLink: event.htmlLink || null,
    title: event.summary || '(Busy)',
    notes: event.description || '',
    type: 'google',
    quadrant: null,
    recRule: null,
    start: start.toISOString(),
    end: end.toISOString(),
    tz: event.start?.timeZone || event.end?.timeZone || 'Google Calendar',
    source: 'google-import',
    calendarId,
    googleRecurringEventId: event.recurringEventId || null,
    googleICalUID: event.iCalUID || null,
    readOnly: true,
    createdAt: event.created || new Date().toISOString(),
    updatedAt: event.updated || new Date().toISOString()
  };
}

async function fetchPrimaryCalendarEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - 60);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + 365);
  timeMax.setHours(23, 59, 59, 999);
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
    showDeleted: false
  });
  return (data.items || []).map(normalizeGoogleEvent).filter(Boolean);
}

export async function POST(request) {
  const session = getSession();
  if (!session?.profile?.email) return NextResponse.json({ error: 'Connect Google Calendar before importing events.', reconnectUrl: reconnectPath(request), requiresReconnect: true }, { status: 401 });
  try {
    const auth = getAuthedOAuthClient(session);
    if (!auth) return NextResponse.json({ error: 'Google session is missing. Please reconnect Google.', reconnectUrl: reconnectPath(request), requiresReconnect: true }, { status: 401 });
    const importedEvents = await fetchPrimaryCalendarEvents(auth);
    const fullState = await readPriorityState(session.profile.email);
    const mode = modeFromRequest(request, fullState.activeMode);
    const workspace = fullState.workspaces?.[mode] || {};
    const currentEvents = Array.isArray(workspace.calendarEvents) ? workspace.calendarEvents : [];
    const nativeGoogleIds = new Set(currentEvents.filter((event) => event.source !== 'google-import' && event.googleEventId).map((event) => event.googleEventId));
    const existingNonImported = currentEvents.filter((event) => event.source !== 'google-import');
    const dedupedImported = [];
    const seen = new Set(existingNonImported.map((event) => event.id));
    for (const event of importedEvents) {
      if (event.googleEventId && nativeGoogleIds.has(event.googleEventId)) continue;
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      dedupedImported.push(event);
    }
    const nextWorkspace = { ...workspace, calendarEvents: [...existingNonImported, ...dedupedImported], googleImportedAt: new Date().toISOString(), googleImportedCount: dedupedImported.length };
    const nextState = { ...fullState, activeMode: mode, workspaces: { ...fullState.workspaces, [mode]: nextWorkspace } };
    const saved = await writePriorityState(session.profile.email, nextState);
    return NextResponse.json({ ok: true, mode, importedCount: dedupedImported.length, state: saved.workspaces[mode] });
  } catch (error) {
    if (isInvalidGrant(error) || isInsufficientScopes(error)) {
      return NextResponse.json({
        error: isInsufficientScopes(error) ? 'Google Calendar needs additional read permissions. Please reconnect Google and approve calendar access.' : 'Google authorization expired or was revoked. Please reconnect Google Calendar.',
        reconnectUrl: reconnectPath(request),
        requiresReconnect: true
      }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Google Calendar import failed.' }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}
