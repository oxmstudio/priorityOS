'use client';

import { useEffect, useMemo, useState } from 'react';

const qNames = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };
const qColors = { q1: 'green', q2: 'blue', q3: 'amber', q4: 'red' };

function formatDate(value) {
  if (!value) return 'Not scheduled';
  try {
    return new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return value;
  }
}

function eventDay(value) {
  try {
    return new Date(value).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return 'Unscheduled';
  }
}

export default function CalendarClient() {
  const [mode, setMode] = useState('business');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const grouped = useMemo(() => {
    return events.slice().sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0)).reduce((acc, event) => {
      const day = eventDay(event.start);
      acc[day] ||= [];
      acc[day].push(event);
      return acc;
    }, {});
  }, [events]);

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
      if (!authResult.connected) return;
      const result = await fetch(`/api/calendar/internal?mode=${nextMode}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { events: [] });
      setEvents(Array.isArray(result.events) ? result.events : []);
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
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Calendar</div><h1 className="sh-title">Create an account to use your <span className="serif">internal calendar.</span></h1><p className="sh-sub">PriorityOS Calendar is saved to your private account dashboard.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard/calendar" style={{ display: 'inline-flex' }}>Create Account</a></section></main>;
  }

  return <>
    <section className="hero" style={{ minHeight: 'auto', paddingBottom: 42 }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="tag-pill lg"><span className="tag-new">Calendar</span><span className="tag-txt">{auth.profile?.email || 'Loading account…'}</span></div>
        <h1 className="hero-h1">PriorityOS<br /><span className="serif">Calendar.</span></h1>
        <p className="hero-sub">Your native app calendar for commitments that do not need Google Calendar, plus events that also synced externally.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a className="hero-cta" href="/dashboard/planner" style={{ textDecoration: 'none' }}>Open Planner</a>
          <a className="btn-ghost" href="/dashboard" style={{ textDecoration: 'none' }}>Dashboard</a>
        </div>
      </div>
    </section>

    <main className="main" style={{ paddingTop: 20 }}>
      <section className="lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 15, padding: '14px 16px', marginBottom: 18 }}>
        <div>
          <div className="card-hdr" style={{ marginBottom: 4 }}>Calendar Workspace</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Internal events are separated by Business and Personal.</div>
        </div>
        <div className="ttog" style={{ minWidth: 240, marginBottom: 0 }}>
          {['business', 'personal'].map((item) => <button key={item} className={`ttbtn ${mode === item ? (item === 'business' ? 'op' : 'pr') : ''}`} onClick={() => switchMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </section>

      <div className="stats">
        <SmallStat label="Internal Events" value={events.length} color="green" />
        <SmallStat label="Google Synced" value={events.filter((e) => e.googleEventId).length} color="blue" />
        <SmallStat label="Investment Blocks" value={events.filter((e) => e.quadrant === 'q2').length} color="amber" />
        <SmallStat label="Do It Now" value={events.filter((e) => e.quadrant === 'q1').length} color="red" />
      </div>

      {loading ? <section className="card"><p className="empty">Loading calendar…</p></section> : Object.keys(grouped).length ? Object.entries(grouped).map(([day, dayEvents]) => <section className="card" key={day}>
        <div className="card-hdr">{day}</div>
        <ul className="ilist">
          {dayEvents.map((event) => <li key={event.id}><span className="idot" style={{ background: `var(--${qColors[event.quadrant] || 'blue'})` }} /><span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{event.title}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(event.start)} · {qNames[event.quadrant] || 'PriorityOS'} · {event.googleEventId ? 'Google synced' : 'Internal only'}</span>{event.notes ? <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>{event.notes}</span> : null}</span>{event.googleLink ? <a href={event.googleLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'none' }}>Google ↗</a> : null}</li>)}
        </ul>
      </section>) : <section className="card"><div className="card-hdr">No Internal Events Yet</div><p className="empty">Open the planner, assign a task to the matrix, then save it to your PriorityOS Calendar.</p><a className="btn-cal" href="/dashboard/planner" style={{ display: 'inline-flex', marginTop: 12 }}>Open Planner</a></section>}
    </main>
  </>;
}

function SmallStat({ label, value, color }) {
  return <div className="sc"><div className="sc-n" style={{ color: `var(--${color})` }}>{value}</div><div className="sc-l">{label}</div></div>;
}
