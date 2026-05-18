'use client';

import { useMemo, useState } from 'react';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const qNames = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };

function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function timeLabel(value) { try { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }
function monthTitle(value) { return value.toLocaleDateString([], { month: 'long', year: 'numeric' }); }
function monthDays(viewDate) { const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }
function colorFor(q) { if (q === 'q1') return 'var(--green)'; if (q === 'q2') return 'var(--blue)'; if (q === 'q3') return 'var(--amber)'; if (q === 'q4') return 'var(--red)'; return 'rgba(255,255,255,.78)'; }
function bgFor(q) { if (q === 'q1') return 'var(--green-d)'; if (q === 'q2') return 'var(--blue-d)'; if (q === 'q3') return 'var(--amber-d)'; if (q === 'q4') return 'var(--red-d)'; return 'rgba(255,255,255,.08)'; }

function expandEvents(events, days) {
  const result = [];
  for (const event of events || []) {
    if (!event?.start || !event?.end) continue;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = Math.max(15 * 60 * 1000, end - start);
    if (!event.recRule) {
      result.push({ ...event, instanceStart: event.start, instanceEnd: event.end, instanceDate: isoDate(start) });
      continue;
    }
    for (const day of days) {
      const current = new Date(day);
      current.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (current < new Date(start.getFullYear(), start.getMonth(), start.getDate())) continue;
      let include = false;
      if (event.recRule.includes('FREQ=DAILY')) include = true;
      if (event.recRule.includes('FREQ=MONTHLY')) include = current.getDate() === start.getDate();
      if (event.recRule.includes('FREQ=WEEKLY')) {
        const byDay = event.recRule.match(/BYDAY=([^;]+)/)?.[1];
        const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        include = byDay ? byDay.split(',').includes(map[current.getDay()]) : current.getDay() === start.getDay();
      }
      if (include) {
        const instanceEnd = new Date(current.getTime() + duration);
        result.push({ ...event, instanceStart: current.toISOString(), instanceEnd: instanceEnd.toISOString(), instanceDate: isoDate(current), recurring: true });
      }
    }
  }
  return result;
}

export default function DashboardCalendarPanel({ mode, events = [], setView }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(isoDate(new Date()));
  const days = useMemo(() => monthDays(viewDate), [viewDate]);
  const instances = useMemo(() => expandEvents(events, days), [events, days]);
  const byDay = useMemo(() => instances.reduce((acc, event) => { acc[event.instanceDate] ||= []; acc[event.instanceDate].push(event); return acc; }, {}), [instances]);
  const selectedEvents = byDay[selectedDay] || [];
  const googleSynced = events.filter((event) => event.googleEventId).length;

  function shift(delta) { const next = new Date(viewDate); next.setMonth(next.getMonth() + delta); setViewDate(next); }
  function today() { const now = new Date(); setViewDate(now); setSelectedDay(isoDate(now)); }

  return <>
    <section className="dash-panel calendar-workspace-panel">
      <div className="dash-section-head">
        <div><h2>Calendar Workspace</h2><p className="panel-sub">Showing {mode} events inside your dashboard.</p></div>
        <a className="btn-cal" href={`/dashboard/planner?mode=${mode}`}>Launch Guided Planner</a>
      </div>
      <div className="dash-cards mini-cards">
        <MiniStat label="Calendar Events" value={events.length} color="green" />
        <MiniStat label="Google Synced" value={googleSynced} color="blue" />
        <MiniStat label="Investment Blocks" value={events.filter((e) => e.quadrant === 'q2').length} color="amber" />
        <MiniStat label="Do It Now" value={events.filter((e) => e.quadrant === 'q1').length} color="red" />
      </div>
      <div className="calendar-card-native">
        <div className="calendar-toolbar-native">
          <div><button className="btn-ghost" onClick={today}>Today</button><button className="btn-ghost" onClick={() => shift(-1)}>‹</button><button className="btn-ghost" onClick={() => shift(1)}>›</button></div>
          <h2>{monthTitle(viewDate)}</h2>
        </div>
        <div className="calendar-head-native">{weekdays.map((day) => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid-native">{days.map((day) => {
          const key = isoDate(day);
          const dayEvents = byDay[key] || [];
          const currentMonth = day.getMonth() === viewDate.getMonth();
          const isToday = key === isoDate(new Date());
          const selected = key === selectedDay;
          return <button key={key} onClick={() => setSelectedDay(key)} className={`calendar-cell-native ${selected ? 'selected' : ''} ${currentMonth ? '' : 'muted'}`}>
            <span className={isToday ? 'today-dot' : ''}>{day.getDate()}</span>
            <div>{dayEvents.slice(0, 3).map((event) => <em key={`${event.id}-${event.instanceStart}`} style={{ background: bgFor(event.quadrant), color: colorFor(event.quadrant) }}>{timeLabel(event.instanceStart)} {event.title}</em>)}{dayEvents.length > 3 ? <small>+{dayEvents.length - 3} more</small> : null}</div>
          </button>;
        })}</div>
      </div>
    </section>
    <section className="dash-panel">
      <div className="dash-section-head"><h2>Selected Day</h2><span className="panel-sub">{new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
      <ul className="ilist">{selectedEvents.length ? selectedEvents.sort((a, b) => new Date(a.instanceStart) - new Date(b.instanceStart)).map((event) => <li key={`${event.id}-${event.instanceStart}`}><span className="idot" style={{ background: colorFor(event.quadrant) }} /><span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{event.title}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeLabel(event.instanceStart)} · {qNames[event.quadrant] || 'PriorityOS'} · {event.googleEventId ? 'Google synced' : 'Internal only'}{event.recRule ? ' · Recurring' : ''}</span>{event.notes ? <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>{event.notes}</span> : null}</span></li>) : <li className="empty">No events on this day.</li>}</ul>
    </section>
    <style jsx global>{calendarCss}</style>
  </>;
}

function MiniStat({ label, value, color }) { return <div className="metric-card mini-metric"><div className="metric-value" style={{ color: `var(--${color})` }}>{value}</div><div className="metric-label">{label}</div></div>; }

const calendarCss = `.calendar-workspace-panel{overflow:hidden}.mini-cards{gap:18px;margin-bottom:26px}.mini-metric{min-height:138px;padding:24px}.calendar-card-native{overflow:hidden;border:.5px solid var(--border);border-radius:18px;background:#0b0c0f}.calendar-toolbar-native{display:flex;align-items:center;justify-content:space-between;padding:14px;border-bottom:.5px solid var(--border)}.calendar-toolbar-native>div{display:flex;gap:8px}.calendar-toolbar-native h2{font-size:24px}.calendar-head-native,.calendar-grid-native{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.calendar-head-native div{padding:10px;text-align:center;font-size:11px;color:var(--muted);font-weight:800;border-right:.5px solid var(--border);border-bottom:.5px solid var(--border)}.calendar-cell-native{min-height:112px;background:rgba(255,255,255,.015);border:none;border-right:.5px solid var(--border);border-bottom:.5px solid var(--border);color:var(--fg);text-align:left;padding:8px;cursor:pointer;overflow:hidden;font-family:Inter,sans-serif}.calendar-cell-native:hover{background:rgba(255,255,255,.035)}.calendar-cell-native.selected{outline:1px solid rgba(96,165,250,.55);outline-offset:-1px;background:rgba(96,165,250,.08)}.calendar-cell-native.muted{opacity:.38}.calendar-cell-native span{font-size:12px;color:var(--muted)}.calendar-cell-native .today-dot{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;background:var(--blue);color:#000;font-weight:800}.calendar-cell-native em{display:block;margin-top:5px;border-radius:5px;padding:3px 6px;font-size:10px;font-style:normal;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.calendar-cell-native small{display:block;color:var(--muted);font-size:10px;margin-top:5px}@media(max-width:760px){.calendar-toolbar-native{align-items:flex-start;gap:12px;flex-direction:column}.calendar-cell-native{min-height:86px;padding:6px}.calendar-cell-native em{font-size:9px;padding:2px 4px}.calendar-head-native div{font-size:10px;padding:8px 4px}}`;
