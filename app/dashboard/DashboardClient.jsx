'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = { values: [], goals: [], tasks: [], calendarEvents: [], quads: { q1: [], q2: [], q3: [], q4: [] }, synced: 0 };
const modes = ['business', 'personal'];
const views = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'planner', label: 'Planner', icon: '✦' },
  { key: 'calendar', label: 'Calendar', icon: '◴' },
  { key: 'matrix', label: 'Matrix', icon: '◇' }
];
const legalViews = [
  { key: 'privacy', label: 'Privacy', icon: '◌' },
  { key: 'terms', label: 'Terms', icon: '□' }
];
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

function selectedModeFromUrl() {
  if (typeof window === 'undefined') return 'business';
  const p = new URLSearchParams(window.location.search);
  const m = p.get('mode') || localStorage.getItem('priorityos.mode');
  return m === 'personal' ? 'personal' : 'business';
}

function selectedViewFromUrl() {
  if (typeof window === 'undefined') return 'dashboard';
  const p = new URLSearchParams(window.location.search);
  const v = p.get('view');
  const allowed = [...views, ...legalViews].map((item) => item.key);
  return allowed.includes(v) ? v : 'dashboard';
}

export default function DashboardClient() {
  const [mode, setMode] = useState('business');
  const [activeView, setActiveView] = useState('dashboard');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const calendarEvents = useMemo(() => state.calendarEvents || [], [state.calendarEvents]);
  const unscheduledTasks = useMemo(() => state.tasks.filter((task) => !task.internalEventId && !task.eventId && !task.start), [state.tasks]);
  const q1Tasks = useMemo(() => state.tasks.filter((task) => task.quadrant === 'q1'), [state.tasks]);
  const q2Tasks = useMemo(() => state.tasks.filter((task) => task.quadrant === 'q2'), [state.tasks]);
  const nextCommitment = useMemo(() => calendarEvents.filter((event) => event.start).slice().sort((a, b) => new Date(a.start) - new Date(b.start))[0], [calendarEvents]);
  const recent = calendarEvents.slice(-8).reverse();
  const upcoming = calendarEvents.filter((event) => event.start).slice().sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 8);

  useEffect(() => {
    const m = selectedModeFromUrl();
    const v = selectedViewFromUrl();
    localStorage.setItem('priorityos.mode', m);
    setMode(m);
    setActiveView(v);
    load(m);
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
      const result = await fetch(`/api/state?mode=${nextMode}&t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: EMPTY });
      setState(normalize(result.state));
    } finally {
      setLoading(false);
    }
  }

  function setView(nextView) {
    setActiveView(nextView);
    window.history.replaceState({}, '', `/dashboard?mode=${mode}&view=${nextView}`);
  }

  function switchMode(nextMode) {
    localStorage.setItem('priorityos.mode', nextMode);
    setMode(nextMode);
    window.history.replaceState({}, '', `/dashboard?mode=${nextMode}&view=${activeView}`);
    load(nextMode);
  }

  if (!auth.loading && !auth.connected) {
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Account</div><h1 className="sh-title">Connect to open your <span className="serif">dashboard.</span></h1><p className="sh-sub">Your dashboard becomes available after connecting Google Calendar and creating your PriorityOS account.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard" style={{ display: 'inline-flex' }}>Create Account & Connect Calendar</a></section></main>;
  }

  return <main className="dash-app-shell">
    <aside className="dash-side">
      <div className="dash-brand"><div className="logo-icon">P</div><span>PriorityOS</span></div>
      {views.map((item) => <button key={item.key} className={`dash-nav ${activeView === item.key ? 'active' : ''}`} onClick={() => setView(item.key)}><span>{item.icon}</span>{item.label}</button>)}
      <div className="dash-side-line" />
      {legalViews.map((item) => <button key={item.key} className={`dash-nav ${activeView === item.key ? 'active' : ''}`} onClick={() => setView(item.key)}><span>{item.icon}</span>{item.label}</button>)}
    </aside>

    <section className="dash-main">
      <div className="dash-top">
        <div><h1>{viewTitle(activeView)}</h1><p>Your {mode === 'business' ? 'Business' : 'Personal'} PriorityOS command center</p></div>
        <div className="dash-search">⌕ <span>Search priorities, events, goals...</span></div>
        <div className="ttog dash-mode">{modes.map((item) => <button key={item} className={`ttbtn ${mode === item ? (item === 'business' ? 'op' : 'pr') : ''}`} onClick={() => switchMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      </div>

      {activeView === 'dashboard' ? <OverviewView state={state} calendarEvents={calendarEvents} unscheduledTasks={unscheduledTasks} q1Tasks={q1Tasks} q2Tasks={q2Tasks} nextCommitment={nextCommitment} loading={loading} mode={mode} setView={setView} /> : null}
      {activeView === 'planner' ? <EmbeddedView title="Planner" subtitle="Create priorities without leaving the dashboard." src={`/dashboard/planner?mode=${mode}&embed=1`} /> : null}
      {activeView === 'calendar' ? <EmbeddedView title="Calendar" subtitle="Your PriorityOS calendar, opened inside the dashboard shell." src={`/dashboard/calendar?mode=${mode}&embed=1`} /> : null}
      {activeView === 'matrix' ? <MatrixView state={state} setView={setView} /> : null}
      {activeView === 'privacy' ? <EmbeddedView title="Privacy Policy" subtitle="Public privacy policy, shown without leaving your account dashboard." src="/privacy?embed=1" /> : null}
      {activeView === 'terms' ? <EmbeddedView title="Terms of Service" subtitle="Public terms of service, shown without leaving your account dashboard." src="/terms?embed=1" /> : null}
    </section>

    <aside className="dash-right">
      <div className="dash-user"><div className="logo-icon">{auth.profile?.email?.[0]?.toUpperCase() || 'P'}</div><div><strong>{auth.profile?.email?.split('@')[0]}</strong><span>{auth.profile?.email}</span></div></div>
      <div className="dash-right-section"><h3>History</h3>{recent.length ? recent.map((event) => <MiniEvent key={event.id} event={event} />) : <p className="empty">No recent events yet.</p>}</div>
      <div className="dash-right-section"><h3>Upcoming</h3>{upcoming.length ? upcoming.map((event) => <MiniEvent key={`${event.id}-up`} event={event} />) : <p className="empty">No upcoming events.</p>}</div>
    </aside>

    <style jsx global>{`
      .dash-app-shell{min-height:100vh;display:grid;grid-template-columns:210px minmax(0,1fr)280px;background:#050506;color:var(--fg)}.dash-side{background:#111116;border-right:.5px solid var(--border);padding:32px 16px;position:sticky;top:0;height:100vh}.dash-brand{display:flex;align-items:center;gap:10px;font-weight:800;margin-bottom:34px}.dash-nav{width:100%;display:flex;align-items:center;gap:12px;color:var(--muted);text-decoration:none;padding:12px 14px;border-radius:10px;font-size:14px;margin-bottom:8px;background:transparent;border:none;font-family:Inter,sans-serif;cursor:pointer;text-align:left}.dash-nav:hover,.dash-nav.active{background:linear-gradient(135deg,rgba(96,165,250,.22),rgba(34,197,94,.08));color:#fff}.dash-side-line{height:1px;background:var(--border2);margin:70px 14px 28px}.dash-main{padding:42px 38px 60px;min-width:0}.dash-top{display:grid;grid-template-columns:1fr minmax(220px,420px)240px;align-items:center;gap:20px;margin-bottom:32px}.dash-top h1{font-size:32px;letter-spacing:-.8px}.dash-top p,.dash-user span{color:var(--muted);font-size:13px}.dash-search{background:#171a20;border:.5px solid var(--border);height:52px;border-radius:999px;display:flex;align-items:center;gap:16px;padding:0 22px;color:var(--muted);font-size:13px}.dash-mode{margin:0}.dash-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin-bottom:32px}.metric-card{background:#17191f;border:.5px solid var(--border);border-radius:20px;padding:26px 24px;min-height:155px;position:relative}.metric-icon{font-size:36px;margin-bottom:20px}.metric-value{font-size:28px;font-weight:800;margin-bottom:8px}.metric-label{font-size:14px;color:#fff}.metric-menu{position:absolute;right:18px;top:18px;color:var(--muted);font-size:24px}.dash-chart-card,.dash-panel,.embedded-card{background:#0f1013;border:.5px solid var(--border);border-radius:20px;padding:24px;margin-bottom:24px}.dash-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.dash-section-head h2{font-size:22px;letter-spacing:-.4px}.dash-link{color:var(--blue);font-size:12px;text-decoration:none;background:transparent;border:none;cursor:pointer;font-family:Inter,sans-serif}.dash-legend{display:flex;gap:22px;color:#fff;font-size:12px}.dash-legend span{display:flex;align-items:center;gap:8px}.dash-legend i{width:10px;height:10px;border-radius:50%;display:block}.flow-grid{height:280px;border-bottom:.5px solid var(--border2);background:repeating-linear-gradient(to bottom,transparent 0,transparent 54px,rgba(255,255,255,.06) 55px);display:grid;grid-template-columns:repeat(6,1fr);align-items:end;gap:18px;position:relative;padding:0 20px 28px}.flow-line{border-radius:14px 14px 0 0;min-height:34px;opacity:.75;box-shadow:0 0 30px currentColor}.flow-line.green{background:linear-gradient(to top,var(--green-d),transparent);border-top:2px solid var(--green);color:var(--green)}.flow-line.blue{background:linear-gradient(to top,var(--blue-d),transparent);border-top:2px solid var(--blue);color:var(--blue)}.flow-line.amber{background:linear-gradient(to top,var(--amber-d),transparent);border-top:2px solid var(--amber);color:var(--amber)}.flow-grid span{font-size:12px;color:var(--muted);text-align:center}.dash-lower{display:grid;grid-template-columns:1fr 1fr;gap:24px}.commitment{display:flex;flex-direction:column;gap:8px}.commitment strong{font-size:20px}.commitment span{color:var(--muted);font-size:13px}.matrix-mini{display:grid;grid-template-columns:1fr 1fr;gap:10px}.matrix-full{display:grid;grid-template-columns:1fr 1fr;gap:14px}.dash-right{background:#0f1013;border-left:.5px solid var(--border);padding:32px 18px;position:sticky;top:0;height:100vh;overflow:auto}.dash-user{display:flex;align-items:center;gap:12px;margin-bottom:28px}.dash-user strong{display:block;font-size:13px}.dash-right-section{margin-bottom:28px}.dash-right-section h3{font-size:17px;margin-bottom:14px}.mini-event{display:flex;gap:10px;align-items:center;margin-bottom:14px}.mini-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);font-size:14px}.mini-event strong{display:block;font-size:12px}.mini-event span{display:block;font-size:10px;color:var(--muted);margin-top:3px}.mini-event em{margin-left:auto;font-style:normal;font-size:11px}.mini-event.green em{color:var(--green)}.mini-event.blue em{color:var(--blue)}.mini-event.amber em{color:var(--amber)}.mini-event.red em{color:var(--red)}.embedded-card{padding:0;overflow:hidden}.embedded-head{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:20px 22px;border-bottom:.5px solid var(--border)}.embedded-head h2{font-size:24px}.embedded-head p{font-size:13px;color:var(--muted);margin-top:4px}.embedded-frame{width:100%;height:78vh;border:0;background:#050506;display:block}@media(max-width:1100px){.dash-app-shell{grid-template-columns:1fr}.dash-side,.dash-right{position:relative;height:auto}.dash-side{display:flex;overflow:auto;gap:8px;padding:14px}.dash-brand,.dash-side-line{display:none}.dash-nav{width:auto;white-space:nowrap}.dash-main{padding:24px}.dash-top,.dash-cards,.dash-lower,.matrix-full{grid-template-columns:1fr}.dash-right{border-left:none;border-top:.5px solid var(--border)}}
    `}</style>
  </main>;
}

function viewTitle(view) {
  return { dashboard: 'Dashboard', planner: 'Planner', calendar: 'Calendar', matrix: 'Matrix', privacy: 'Privacy', terms: 'Terms' }[view] || 'Dashboard';
}

function OverviewView({ state, calendarEvents, unscheduledTasks, q1Tasks, q2Tasks, nextCommitment, loading, setView }) {
  return <>
    <div className="dash-cards">
      <Metric icon="✧" label="Values" value={state.values.length} color="green" />
      <Metric icon="◆" label="Goals" value={state.goals.length} color="blue" />
      <Metric icon="◴" label="Calendar Events" value={calendarEvents.length} color="amber" />
      <Metric icon="!" label="Needs Scheduling" value={unscheduledTasks.length} color="red" />
    </div>
    <section className="dash-chart-card">
      <div className="dash-section-head"><h2>Priority Flow</h2><div className="dash-legend"><span><i style={{ background: 'var(--green)' }} />Do It Now</span><span><i style={{ background: 'var(--blue)' }} />Investment</span><span><i style={{ background: 'var(--amber)' }} />Events</span></div></div>
      <div className="flow-grid"><div className="flow-line green" style={{ height: `${Math.max(18, q1Tasks.length * 18)}%` }} /><div className="flow-line blue" style={{ height: `${Math.max(24, q2Tasks.length * 18)}%` }} /><div className="flow-line amber" style={{ height: `${Math.max(22, calendarEvents.length * 12)}%` }} />{['Values', 'Goals', 'Tasks', 'Matrix', 'Calendar', 'Review'].map((x) => <span key={x}>{x}</span>)}</div>
    </section>
    <section className="dash-lower">
      <div className="dash-panel"><div className="dash-section-head"><h2>Next Commitment</h2><button className="dash-link" onClick={() => setView('calendar')}>Open Calendar</button></div>{loading ? <p className="empty">Loading dashboard…</p> : nextCommitment ? <div className="commitment"><strong>{nextCommitment.title}</strong><span>{formatDate(nextCommitment.start)} · {qNames[nextCommitment.quadrant] || 'PriorityOS Calendar'}</span></div> : <p className="empty">No scheduled task yet. Use the planner to schedule your first priority.</p>}</div>
      <div className="dash-panel"><div className="dash-section-head"><h2>Matrix Snapshot</h2><button className="dash-link" onClick={() => setView('planner')}>Add Task</button></div><div className="matrix-mini">{['q1', 'q2', 'q3', 'q4'].map((q) => <div className={`qd ${q}`} key={q}><div className="qey">{q}</div><div className="qnm">{qNames[q]}</div><div className="sc-n" style={{ fontSize: 24 }}>{state.quads[q]?.length || 0}</div></div>)}</div></div>
    </section>
  </>;
}

function EmbeddedView({ title, subtitle, src }) {
  return <section className="embedded-card"><div className="embedded-head"><div><h2>{title}</h2><p>{subtitle}</p></div><a className="btn-ghost" href={src.replace('&embed=1', '').replace('?embed=1', '')} target="_blank" rel="noreferrer">Open full page</a></div><iframe className="embedded-frame" src={src} title={title} /></section>;
}

function MatrixView({ state, setView }) {
  return <section className="dash-panel"><div className="dash-section-head"><h2>Priority Matrix</h2><button className="dash-link" onClick={() => setView('planner')}>Add another task</button></div><div className="matrix-full">{['q1', 'q2', 'q3', 'q4'].map((q) => <div className={`qd ${q}`} key={q}><div className="qey">{q}</div><div className="qnm">{qNames[q]}</div><ul className="qi">{state.quads[q]?.length ? state.quads[q].map((name, index) => <li key={`${name}-${index}`}><span style={{ fontSize: 9, flexShrink: 0 }}>▸</span>{name}</li>) : <li className="qe">Empty</li>}</ul></div>)}</div></section>;
}

function Metric({ icon, label, value, color }) {
  return <div className="metric-card"><div className="metric-menu">⋮</div><div className="metric-icon" style={{ color: `var(--${color})` }}>{icon}</div><div className="metric-value" style={{ color: `var(--${color})` }}>{value}</div><div className="metric-label">{label}</div></div>;
}

function MiniEvent({ event }) {
  const c = qColors[event.quadrant] || 'blue';
  return <div className={`mini-event ${c}`}><div className="mini-icon">◴</div><div><strong>{event.title}</strong><span>{formatDate(event.start)}</span></div><em>{event.googleEventId ? '+G' : '+P'}</em></div>;
}
