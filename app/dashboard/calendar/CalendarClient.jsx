'use client';

import { useEffect, useMemo, useState } from 'react';

const qNames = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };
const qClasses = { q1: 'q1', q2: 'q2', q3: 'q3', q4: 'q4' };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthTitle(d) {
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function eventTime(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

function buildMonthDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function addRecurringInstances(events, days) {
  const windowStart = new Date(days[0]);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(days[days.length - 1]);
  windowEnd.setHours(23, 59, 59, 999);
  const instances = [];

  for (const event of events) {
    if (!event.start || !event.end) continue;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = Math.max(15 * 60 * 1000, end - start);

    if (!event.recRule) {
      instances.push({ ...event, instanceStart: event.start, instanceEnd: event.end, instanceDate: isoDate(start) });
      continue;
    }

    for (const day of days) {
      const current = new Date(day);
      current.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (current < windowStart || current > windowEnd || current < new Date(start.getFullYear(), start.getMonth(), start.getDate())) continue;

      let include = false;
      if (event.recRule.includes('FREQ=DAILY')) include = true;
      else if (event.recRule.includes('FREQ=MONTHLY')) include = current.getDate() === start.getDate();
      else if (event.recRule.includes('FREQ=WEEKLY')) {
        const byDay = event.recRule.match(/BYDAY=([^;]+)/)?.[1];
        if (!byDay) include = current.getDay() === start.getDay();
        else {
          const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          include = byDay.split(',').includes(map[current.getDay()]);
        }
      }

      if (include) {
        const instanceEnd = new Date(current.getTime() + duration);
        instances.push({ ...event, instanceStart: current.toISOString(), instanceEnd: instanceEnd.toISOString(), instanceDate: isoDate(current), isRecurringInstance: true });
      }
    }
  }
  return instances;
}

export default function CalendarClient() {
  const [mode, setMode] = useState('business');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(isoDate(new Date()));

  const days = useMemo(() => buildMonthDays(viewDate), [viewDate]);
  const instances = useMemo(() => addRecurringInstances(events, days), [events, days]);
  const eventsByDay = useMemo(() => instances.reduce((acc, event) => {
    acc[event.instanceDate] ||= [];
    acc[event.instanceDate].push(event);
    return acc;
  }, {}), [instances]);
  const selectedEvents = eventsByDay[selectedDay] || [];

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
    } finally { setLoading(false); }
  }

  function switchMode(nextMode) {
    localStorage.setItem('priorityos.mode', nextMode);
    setMode(nextMode);
    load(nextMode);
  }

  function shiftMonth(delta) {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + delta);
    setViewDate(next);
  }

  function goToday() {
    const now = new Date();
    setViewDate(now);
    setSelectedDay(isoDate(now));
  }

  if (!auth.loading && !auth.connected) {
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Calendar</div><h1 className="sh-title">Create an account to use your <span className="serif">internal calendar.</span></h1><p className="sh-sub">PriorityOS Calendar is saved to your private account dashboard.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard/calendar" style={{ display: 'inline-flex' }}>Create Account</a></section></main>;
  }

  return <>
    <section className="hero" style={{ minHeight: 'auto', paddingBottom: 36 }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="tag-pill lg"><span className="tag-new">Calendar</span><span className="tag-txt">{auth.profile?.email || 'Loading account…'}</span></div>
        <h1 className="hero-h1">PriorityOS<br /><span className="serif">Calendar.</span></h1>
        <p className="hero-sub">A native account calendar with month view, recurring events, internal-only blocks, and Google-synced commitments.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a className="hero-cta" href="/dashboard/planner" style={{ textDecoration: 'none' }}>Open Planner</a>
          <a className="btn-ghost" href="/dashboard" style={{ textDecoration: 'none' }}>Dashboard</a>
        </div>
      </div>
    </section>

    <main className="main calendar-main" style={{ paddingTop: 20, maxWidth: 1120 }}>
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
        <SmallStat label="Calendar Events" value={events.length} color="green" />
        <SmallStat label="Google Synced" value={events.filter((e) => e.googleEventId).length} color="blue" />
        <SmallStat label="Investment Blocks" value={events.filter((e) => e.quadrant === 'q2').length} color="amber" />
        <SmallStat label="Do It Now" value={events.filter((e) => e.quadrant === 'q1').length} color="red" />
      </div>

      <section className="calendar-shell card">
        <div className="calendar-toolbar">
          <div className="calendar-left"><button className="btn-ghost" onClick={goToday}>Today</button><button className="btn-ghost" onClick={() => shiftMonth(-1)}>‹</button><button className="btn-ghost" onClick={() => shiftMonth(1)}>›</button><h2>{monthTitle(viewDate)}</h2></div>
          <a className="btn-cal" href="/dashboard/planner">+ Create</a>
        </div>
        <div className="calendar-grid-head">{weekdays.map((day) => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid">
          {days.map((day) => {
            const key = isoDate(day);
            const dayEvents = eventsByDay[key] || [];
            const isCurrentMonth = day.getMonth() === viewDate.getMonth();
            const isToday = key === isoDate(new Date());
            const isSelected = key === selectedDay;
            return <button key={key} className={`calendar-day ${isCurrentMonth ? '' : 'muted-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDay(key)}>
              <span className="calendar-day-num">{day.getDate()}</span>
              <div className="calendar-events-mini">
                {dayEvents.slice(0, 3).map((event) => <span key={`${event.id}-${event.instanceStart}`} className={`calendar-pill ${qClasses[event.quadrant] || ''}`}>{eventTime(event.instanceStart)} {event.title}</span>)}
                {dayEvents.length > 3 ? <span className="calendar-more">+{dayEvents.length - 3} more</span> : null}
              </div>
            </button>;
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-hdr">Selected Day</div>
        <h2 className="sh-title" style={{ fontSize: 24 }}>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        <ul className="ilist">
          {loading ? <li className="empty">Loading calendar…</li> : selectedEvents.length ? selectedEvents.sort((a,b)=>new Date(a.instanceStart)-new Date(b.instanceStart)).map((event) => <li key={`${event.id}-${event.instanceStart}`}>
            <span className="idot" style={{ background: `var(--${event.quadrant === 'q1' ? 'green' : event.quadrant === 'q2' ? 'blue' : event.quadrant === 'q3' ? 'amber' : 'red'})` }} />
            <span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{event.title}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{eventTime(event.instanceStart)} · {qNames[event.quadrant] || 'PriorityOS'} · {event.googleEventId ? 'Google synced' : 'Internal only'}{event.recRule ? ' · Recurring' : ''}</span>{event.notes ? <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>{event.notes}</span> : null}</span>
            {event.googleLink ? <a href={event.googleLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'none' }}>Google ↗</a> : null}
          </li>) : <li className="empty">No events on this day.</li>}
        </ul>
      </section>
    </main>
  </>;
}

function SmallStat({ label, value, color }) {
  return <div className="sc"><div className="sc-n" style={{ color: `var(--${color})` }}>{value}</div><div className="sc-l">{label}</div></div>;
}
