'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = { values: [], goals: [], tasks: [], calendarEvents: [], quads: { q1: [], q2: [], q3: [], q4: [] }, synced: 0 };
const modes = ['business', 'personal'];
const qNames = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };
const qColors = { q1: 'green', q2: 'blue', q3: 'amber', q4: 'red' };

function normalize(s) {
  return {
    values: Array.isArray(s?.values) ? s.values : [],
    goals: Array.isArray(s?.goals) ? s.goals : [],
    tasks: Array.isArray(s?.tasks) ? s.tasks : [],
    calendarEvents: Array.isArray(s?.calendarEvents) ? s.calendarEvents : [],
    quads: {
      q1: Array.isArray(s?.quads?.q1) ? s.quads.q1 : [],
      q2: Array.isArray(s?.quads?.q2) ? s.quads.q2 : [],
      q3: Array.isArray(s?.quads?.q3) ? s.quads.q3 : [],
      q4: Array.isArray(s?.quads?.q4) ? s.quads.q4 : []
    },
    synced: Number.isFinite(Number(s?.synced)) ? Number(s.synced) : 0
  };
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  try {
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return value;
  }
}

export default function DashboardClient() {
  const [mode, setMode] = useState('business');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const calendarEvents = useMemo(() => state.calendarEvents || [], [state.calendarEvents]);
  const scheduledTasks = useMemo(() => state.tasks.filter((task) => task.internalEventId || task.eventId || task.start), [state.tasks]);
  const unscheduledTasks = useMemo(() => state.tasks.filter((task) => !task.internalEventId && !task.eventId && !task.start), [state.tasks]);
  const q1Tasks = useMemo(() => state.tasks.filter((task) => task.quadrant === 'q1'), [state.tasks]);
  const q2Tasks = useMemo(() => state.tasks.filter((task) => task.quadrant === 'q2'), [state.tasks]);
  const nextCommitment = useMemo(() => {
    const fromEvents = calendarEvents.map((event) => ({ name: event.title, start: event.start, quadrant: event.quadrant, calLink: event.googleLink }));
    const fromTasks = scheduledTasks.map((task) => ({ name: task.name, start: task.start, quadrant: task.quadrant, calLink: task.calLink }));
    return [...fromEvents, ...fromTasks].filter((item) => item.start).sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0))[0];
  }, [calendarEvents, scheduledTasks]);

  useEffect(() => {
    const storedMode = localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business';
    setMode(storedMode);
    load(storedMode);
  }, []);

  async function load(nextMode) {
    setLoading(true);
    try {
      const authResult = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json());
      setAuth({ loading: false, connected: !!authResult.connected, profile: authResult.profile || null });
      if (!authResult.connected) {
        setState(EMPTY);
        return;
      }
      const result = await fetch(`/api/state?mode=${nextMode}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: EMPTY });
      setState(normalize(result.state));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    localStorage.setItem('priorityos.mode', nextMode);
    setMode(nextMode);
    load(nextMode);
  }

  if (!auth.loading && !auth.connected) {
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Account</div><h1 className="sh-title">Connect to open your <span className="serif">dashboard.</span></h1><p className="sh-sub">Your dashboard becomes available after connecting Google Calendar and creating your PriorityOS account.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard" style={{ display: 'inline-flex' }}>Create Account & Connect Calendar</a></section></main>;
  }

  return <>
    <section className="hero" style={{ minHeight: 'auto', paddingBottom: 48 }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="tag-pill lg"><span className="tag-new">Account</span><span className="tag-txt">{auth.profile?.email || 'Loading account…'}</span></div>
        <h1 className="hero-h1">Your PriorityOS<br /><span className="serif">Dashboard.</span></h1>
        <p className="hero-sub">A private command center for your values, goals, matrix, and PriorityOS Calendar commitments.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a className="hero-cta" href="/dashboard/planner" style={{ textDecoration: 'none' }}>Open Planner</a>
          <a className="btn-ghost" href="/dashboard/calendar" style={{ textDecoration: 'none' }}>Open Calendar</a>
        </div>
      </div>
    </section>

    <main className="main" style={{ paddingTop: 20 }}>
      <section className="lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 15, padding: '14px 16px', marginBottom: 18 }}>
        <div>
          <div className="card-hdr" style={{ marginBottom: 4 }}>Workspace</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>View your separate Business and Personal dashboards.</div>
        </div>
        <div className="ttog" style={{ minWidth: 240, marginBottom: 0 }}>
          {modes.map((item) => <button key={item} className={`ttbtn ${mode === item ? (item === 'business' ? 'op' : 'pr') : ''}`} onClick={() => switchMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </section>

      <div className="stats">
        <SmallStat label="Values" value={state.values.length} color="green" />
        <SmallStat label="Goals" value={state.goals.length} color="blue" />
        <SmallStat label="Calendar Events" value={calendarEvents.length} color="amber" />
        <SmallStat label="Needs Scheduling" value={unscheduledTasks.length} color="red" />
      </div>

      <section className="card">
        <div className="card-hdr">Next Commitment</div>
        {loading ? <p className="empty">Loading dashboard…</p> : nextCommitment ? <div>
          <h2 className="sh-title" style={{ fontSize: 24, marginBottom: 6 }}>{nextCommitment.name}</h2>
          <p className="sh-sub" style={{ marginBottom: 12 }}>{formatDate(nextCommitment.start)} · {qNames[nextCommitment.quadrant] || 'PriorityOS Calendar'}</p>
          {nextCommitment.calLink ? <a className="btn-cal" href={nextCommitment.calLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex' }}>Open in Google Calendar</a> : <a className="btn-cal" href="/dashboard/calendar" style={{ display: 'inline-flex' }}>Open PriorityOS Calendar</a>}
        </div> : <p className="empty">No scheduled task yet. Use the planner to schedule your first priority.</p>}
      </section>

      <section className="cmp">
        <div className="cmp-col ops"><h4>Q1 Pressure</h4><div className="cr"><span className="ck">Do It Now</span><span className="cv">{q1Tasks.length}</span></div><p style={{ fontSize: 12, color: 'rgba(96,165,250,.75)', lineHeight: 1.6, marginTop: 10 }}>Keep this number low. Q1 work is handled today or tomorrow, not left to ferment.</p></div>
        <div className="cmp-col prj"><h4>Q2 Investment</h4><div className="cr"><span className="ck">Scheduled growth work</span><span className="cv">{q2Tasks.length}</span></div><p style={{ fontSize: 12, color: 'rgba(251,191,36,.75)', lineHeight: 1.6, marginTop: 10 }}>This is the quiet treasure room. Schedule these before they become emergencies.</p></div>
      </section>

      <section className="card">
        <div className="card-hdr">Priority Matrix Snapshot</div>
        <div className="mx" style={{ marginBottom: 0 }}>
          {['q1', 'q2', 'q3', 'q4'].map((q) => <div key={q} className={`qd ${q}`}><div className="qey">{q}</div><div className="qnm">{qNames[q]}</div><ul className="qi">{state.quads[q]?.length ? state.quads[q].slice(0, 5).map((name, index) => <li key={`${name}-${index}`}><span style={{ fontSize: 9, flexShrink: 0 }}>▸</span>{name}</li>) : <li className="qe">Empty</li>}</ul></div>)}
        </div>
      </section>

      <section className="card">
        <div className="card-hdr">Recent Calendar Events</div>
        <ul className="ilist">
          {calendarEvents.length ? calendarEvents.slice(-8).reverse().map((event) => <li key={event.id}><span className="idot" style={{ background: `var(--${qColors[event.quadrant] || 'blue'})` }} /><span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{event.title}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(event.start)} · {qNames[event.quadrant] || 'PriorityOS Calendar'} · {event.googleEventId ? 'Google synced' : 'Internal only'}</span></span>{event.googleLink ? <a href={event.googleLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'none' }}>Open ↗</a> : null}</li>) : <li className="empty">No calendar events yet.</li>}
        </ul>
      </section>
    </main>
  </>;
}

function SmallStat({ label, value, color }) {
  return <div className="sc"><div className="sc-n" style={{ color: `var(--${color})` }}>{value}</div><div className="sc-l">{label}</div></div>;
}
