'use client';

import DashboardCalendarPanel from '../DashboardCalendarPanel';
import { useEffect, useState } from 'react';

const EMPTY = { calendarEvents: [] };

export default function CalendarClientV2() {
  const [mode, setMode] = useState('business');
  const [events, setEvents] = useState([]);
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get('mode') === 'personal' ? 'personal' : localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business';
    setMode(nextMode);
    load(nextMode);
  }, []);

  async function load(nextMode) {
    const authResult = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ connected: false }));
    setAuth({ loading: false, connected: !!authResult.connected, profile: authResult.profile || null });
    if (!authResult.connected) return;
    const result = await fetch(`/api/state?mode=${nextMode}&t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: EMPTY });
    setEvents(Array.isArray(result.state?.calendarEvents) ? result.state.calendarEvents : []);
  }

  if (!auth.loading && !auth.connected) {
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><h1 className="sh-title">Create an account to use your <span className="serif">calendar.</span></h1><p className="sh-sub">PriorityOS Calendar is saved to your private account dashboard.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard/calendar" style={{ display: 'inline-flex' }}>Create Account</a></section></main>;
  }

  return <main className="main" style={{ paddingTop: 40, maxWidth: 1180 }}><DashboardCalendarPanel mode={mode} events={events} setView={() => { window.location.href = `/dashboard?mode=${mode}&view=planner`; }} /></main>;
}
