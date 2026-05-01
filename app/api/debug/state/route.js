import { NextResponse } from 'next/server';
import { readPriorityState } from '../../../../lib/blobState';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

function modeFromRequest(request, fallback = 'business') {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || fallback;
  return mode === 'personal' ? 'personal' : 'business';
}

export async function GET(request) {
  const session = getSession();
  if (!session?.profile?.email) {
    return NextResponse.json({ error: 'No active PriorityOS session.' }, { status: 401 });
  }

  const fullState = await readPriorityState(session.profile.email);
  const mode = modeFromRequest(request, fullState.activeMode);
  const workspace = fullState.workspaces?.[mode] || {};

  return NextResponse.json({
    email: session.profile.email,
    mode,
    counts: {
      values: workspace.values?.length || 0,
      goals: workspace.goals?.length || 0,
      tasks: workspace.tasks?.length || 0,
      calendarEvents: workspace.calendarEvents?.length || 0,
      q1: workspace.quads?.q1?.length || 0,
      q2: workspace.quads?.q2?.length || 0,
      q3: workspace.quads?.q3?.length || 0,
      q4: workspace.quads?.q4?.length || 0
    },
    latestTask: workspace.tasks?.[workspace.tasks.length - 1] || null,
    latestCalendarEvent: workspace.calendarEvents?.[workspace.calendarEvents.length - 1] || null,
    workspace
  });
}
