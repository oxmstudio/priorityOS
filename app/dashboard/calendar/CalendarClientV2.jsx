'use client';

import { useEffect, useMemo, useState } from 'react';

const qNames = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function timeLabel(value) { try { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }
function monthTitle(value) { return value.toLocaleDateString([], { month: 'long', year: 'numeric' }); }
function selectedModeFromUrl() { if (typeof window === 'undefined') return 'business'; const p = new URLSearchParams(window.location.search); const m = p.get('mode') || localStorage.getItem('priorityos.mode'); return m === 'personal' ? 'personal' : 'business'; }
function monthDays(viewDate) { const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }
function taskEvent(task) { if (!task?.start || !task?.end) return null; return { id: task.internalEventId || task.eventId || task.id, title: task.name, start: task.start, end: task.end, recRule: task.recRule || null, quadrant: task.quadrant || null, notes: task.notes || '', googleEventId: task.eventId || null, googleLink: task.calLink || null, source: task.eventId ? 'priorityos+google' : 'priorityos' }; }
function expandEvents(events, days) {
  const result = [];
  for (const event of events) {
    if (!event?.start || !event?.end) continue;
    const start = new Date(event.start), end = new Date(event.end), duration = Math.max(15 * 60 * 1000, end - start);
    if (!event.recRule) { result.push({ ...event, instanceStart: event.start, instanceEnd: event.end, instanceDate: isoDate(start) }); continue; }
    for (const day of days) {
      const current = new Date(day); current.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (current < new Date(start.getFullYear(), start.getMonth(), start.getDate())) continue;
      let include = false;
      if (event.recRule.includes('FREQ=DAILY')) include = true;
      if (event.recRule.includes('FREQ=MONTHLY')) include = current.getDate() === start.getDate();
      if (event.recRule.includes('FREQ=WEEKLY')) { const byDay = event.recRule.match(/BYDAY=([^;]+)/)?.[1]; const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; include = byDay ? byDay.split(',').includes(map[current.getDay()]) : current.getDay() === start.getDay(); }
      if (include) { const instanceEnd = new Date(current.getTime() + duration); result.push({ ...event, instanceStart: current.toISOString(), instanceEnd: instanceEnd.toISOString(), instanceDate: isoDate(current), recurring: true }); }
    }
  }
  return result;
}
function colorFor(q) { if (q === 'q1') return 'var(--green)'; if (q === 'q2') return 'var(--blue)'; if (q === 'q3') return 'var(--amber)'; if (q === 'q4') return 'var(--red)'; return 'rgba(255,255,255,.78)'; }
function bgFor(q) { if (q === 'q1') return 'var(--green-d)'; if (q === 'q2') return 'var(--blue-d)'; if (q === 'q3') return 'var(--amber-d)'; if (q === 'q4') return 'var(--red-d)'; return 'rgba(255,255,255,.08)'; }

export default function CalendarClientV2() {
  const [mode, setMode] = useState('business');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [events, setEvents] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(isoDate(new Date()));
  const [loading, setLoading] = useState(true);
  const days = useMemo(() => monthDays(viewDate), [viewDate]);
  const instances = useMemo(() => expandEvents(events, days), [events, days]);
  const byDay = useMemo(() => instances.reduce((acc, event) => { acc[event.instanceDate] ||= []; acc[event.instanceDate].push(event); return acc; }, {}), [instances]);
  const selectedEvents = byDay[selectedDay] || [];

  useEffect(() => { const m = selectedModeFromUrl(); localStorage.setItem('priorityos.mode', m); setMode(m); load(m); }, []);
  async function load(nextMode) {
    setLoading(true);
    try {
      const authResult = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json());
      setAuth({ loading: false, connected: !!authResult.connected, profile: authResult.profile || null });
      if (!authResult.connected) return;
      const stateResult = await fetch(`/api/state?mode=${nextMode}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: {} });
      const workspace = stateResult.state || {};
      const explicit = Array.isArray(workspace.calendarEvents) ? workspace.calendarEvents : [];
      const fromTasks = Array.isArray(workspace.tasks) ? workspace.tasks.map(taskEvent).filter(Boolean) : [];
      const seen = new Set();
      setEvents([...explicit, ...fromTasks].filter((event) => { const key = event.id || `${event.title}-${event.start}`; if (seen.has(key)) return false; seen.add(key); return true; }));
    } finally { setLoading(false); }
  }
  function switchMode(next) { localStorage.setItem('priorityos.mode', next); setMode(next); window.history.replaceState({}, '', `/dashboard/calendar?mode=${next}`); load(next); }
  function shift(delta) { const next = new Date(viewDate); next.setMonth(next.getMonth() + delta); setViewDate(next); }
  function today() { const now = new Date(); setViewDate(now); setSelectedDay(isoDate(now)); }

  if (!auth.loading && !auth.connected) return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Calendar</div><h1 className="sh-title">Create an account to use your <span className="serif">internal calendar.</span></h1><p className="sh-sub">PriorityOS Calendar is saved to your private account dashboard.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard/calendar" style={{ display: 'inline-flex' }}>Create Account</a></section></main>;

  return <><section className="hero" style={{ minHeight: 'auto', paddingBottom: 36 }}><div className="hero-bg" /><div className="hero-content"><div className="tag-pill lg"><span className="tag-new">Calendar</span><span className="tag-txt">{auth.profile?.email || 'Loading account…'}</span></div><h1 className="hero-h1">PriorityOS<br /><span className="serif">Calendar.</span></h1><p className="hero-sub">A month-view account calendar for internal-only blocks and Google-synced commitments.</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}><a className="hero-cta" href="/dashboard/planner" style={{ textDecoration: 'none' }}>Open Planner</a><a className="btn-ghost" href={`/dashboard?mode=${mode}`} style={{ textDecoration: 'none' }}>Dashboard</a></div></div></section><main className="main" style={{ paddingTop: 20, maxWidth: 1180 }}><section className="lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 15, padding: '14px 16px', marginBottom: 18 }}><div><div className="card-hdr" style={{ marginBottom: 4 }}>Calendar Workspace</div><div style={{ fontSize: 13, color: 'var(--muted)' }}>Showing {mode} events. Internal events are separated by Business and Personal.</div></div><div className="ttog" style={{ minWidth: 240, marginBottom: 0 }}>{['business', 'personal'].map((item) => <button key={item} className={`ttbtn ${mode === item ? (item === 'business' ? 'op' : 'pr') : ''}`} onClick={() => switchMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></section><div className="stats"><SmallStat label="Calendar Events" value={events.length} color="green" /><SmallStat label="Google Synced" value={events.filter((e) => e.googleEventId).length} color="blue" /><SmallStat label="Investment Blocks" value={events.filter((e) => e.quadrant === 'q2').length} color="amber" /><SmallStat label="Do It Now" value={events.filter((e) => e.quadrant === 'q1').length} color="red" /></div><section className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 16, borderBottom: '.5px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><button className="btn-ghost" onClick={today}>Today</button><button className="btn-ghost" onClick={() => shift(-1)}>‹</button><button className="btn-ghost" onClick={() => shift(1)}>›</button><h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-.7px', marginLeft: 8 }}>{monthTitle(viewDate)}</h2></div><a className="btn-cal" href="/dashboard/planner">+ Create</a></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '.5px solid var(--border)', background: 'rgba(255,255,255,.025)' }}>{weekdays.map((day) => <div key={day} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 700, borderRight: '.5px solid var(--border)' }}>{day}</div>)}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>{days.map((day) => { const key = isoDate(day); const dayEvents = byDay[key] || []; const currentMonth = day.getMonth() === viewDate.getMonth(); const isToday = key === isoDate(new Date()); const selected = key === selectedDay; return <button key={key} onClick={() => setSelectedDay(key)} style={{ minHeight: 126, background: selected ? 'rgba(96,165,250,.08)' : 'rgba(255,255,255,.015)', opacity: currentMonth ? 1 : .38, border: 'none', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', color: 'var(--fg)', padding: 8, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', outline: selected ? '1px solid rgba(96,165,250,.55)' : 'none', fontFamily: 'Inter, sans-serif' }}><span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: isToday ? '#000' : 'var(--muted)', background: isToday ? 'var(--blue)' : 'transparent', fontWeight: isToday ? 800 : 500 }}>{day.getDate()}</span><div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7 }}>{dayEvents.slice(0, 3).map((event) => <span key={`${event.id}-${event.instanceStart}`} style={{ display: 'block', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRadius: 5, padding: '3px 6px', fontSize: 10, fontWeight: 700, background: bgFor(event.quadrant), color: colorFor(event.quadrant) }}>{timeLabel(event.instanceStart)} {event.title}</span>)}{dayEvents.length > 3 ? <span style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 4 }}>+{dayEvents.length - 3} more</span> : null}</div></button>; })}</div></section><section className="card" style={{ marginTop: 14 }}><div className="card-hdr">Selected Day</div><h2 className="sh-title" style={{ fontSize: 24 }}>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2><ul className="ilist">{loading ? <li className="empty">Loading calendar…</li> : selectedEvents.length ? selectedEvents.sort((a, b) => new Date(a.instanceStart) - new Date(b.instanceStart)).map((event) => <li key={`${event.id}-${event.instanceStart}`}><span className="idot" style={{ background: colorFor(event.quadrant) }} /><span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{event.title}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeLabel(event.instanceStart)} · {qNames[event.quadrant] || 'PriorityOS'} · {event.googleEventId ? 'Google synced' : 'Internal only'}{event.recRule ? ' · Recurring' : ''}</span>{event.notes ? <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>{event.notes}</span> : null}</span>{event.googleLink ? <a href={event.googleLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'none' }}>Google ↗</a> : null}</li>) : <li className="empty">No events on this day.</li>}</ul></section></main></>;
}
function SmallStat({ label, value, color }) { return <div className="sc"><div className="sc-n" style={{ color: `var(--${color})` }}>{value}</div><div className="sc-l">{label}</div></div>; }
