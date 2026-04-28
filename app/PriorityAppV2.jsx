'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = { values: [], goals: [], tasks: [], quads: { q1: [], q2: [], q3: [], q4: [] }, synced: 0 };
const LOCAL_KEY = 'priorityos.localState';
const WEEKDAYS = [
  ['MO', 'Mon'], ['TU', 'Tue'], ['WE', 'Wed'], ['TH', 'Thu'], ['FR', 'Fri'], ['SA', 'Sat'], ['SU', 'Sun']
];

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const pad = (v) => String(v).padStart(2, '0');
const localDateTime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const addMinutes = (start, minutes) => { const d = new Date(start); d.setMinutes(d.getMinutes() + minutes); return localDateTime(d); };
const qLabel = (q) => ({ q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' }[q] || 'Needs priority');
const normalize = (s) => ({
  values: Array.isArray(s?.values) ? s.values : [],
  goals: Array.isArray(s?.goals) ? s.goals : [],
  tasks: Array.isArray(s?.tasks) ? s.tasks : [],
  quads: {
    q1: Array.isArray(s?.quads?.q1) ? s.quads.q1 : [],
    q2: Array.isArray(s?.quads?.q2) ? s.quads.q2 : [],
    q3: Array.isArray(s?.quads?.q3) ? s.quads.q3 : [],
    q4: Array.isArray(s?.quads?.q4) ? s.quads.q4 : []
  },
  synced: Number.isFinite(Number(s?.synced)) ? Number(s.synced) : 0
});

function recurrenceLabel(rule) {
  if (!rule) return 'Once';
  if (rule.includes('BYMONTHDAY=')) return `Monthly on ${rule.split('BYMONTHDAY=')[1]}`;
  if (rule.includes('BYDAY=')) return `Weekly on ${rule.split('BYDAY=')[1]}`;
  if (rule.includes('DAILY')) return 'Daily';
  if (rule.includes('WEEKLY')) return 'Weekly';
  if (rule.includes('MONTHLY')) return 'Monthly';
  return rule;
}

function parseMonthDays(value) {
  const unique = new Set(String(value || '').split(',').map((v) => Number.parseInt(v.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31));
  return [...unique].sort((a, b) => a - b);
}

export default function PriorityAppV2() {
  const [phase, setPhase] = useState('deciding');
  const [state, setState] = useState(EMPTY);
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [scheduleType, setScheduleType] = useState('op');
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [weeklyDays, setWeeklyDays] = useState(['MO']);
  const [monthlyDays, setMonthlyDays] = useState('1');

  const synced = useMemo(() => state.tasks.filter((t) => t.eventId).length, [state.tasks]);
  const unassigned = state.tasks.map((task, index) => ({ task, index })).filter(({ task }) => !task.quadrant);
  const scheduleCandidates = state.tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.quadrant && !task.eventId);

  useEffect(() => {
    (async () => {
      try {
        const authResult = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json());
        setAuth({ loading: false, connected: !!authResult.connected, profile: authResult.profile || null });
        if (authResult.connected) {
          const saved = await fetch('/api/state', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: EMPTY });
          setState(normalize(saved.state));
        } else {
          const local = localStorage.getItem(LOCAL_KEY);
          if (local) setState(normalize(JSON.parse(local)));
        }
        const params = new URLSearchParams(location.search);
        if (params.get('auth') === 'connected') toast('success', 'Google Calendar connected', 'Blob saving and calendar sync are ready.');
        if (params.get('auth') === 'failed') toast('error', 'Google connection failed', 'Check OAuth credentials and redirect URI.');
        if (params.has('auth')) history.replaceState({}, document.title, '/');
      } catch {
        setAuth({ loading: false, connected: false, profile: null });
      }
    })();
  }, []);

  function toast(type, title, msg) {
    const id = crypto.randomUUID?.() || String(Date.now());
    setToasts((items) => [...items, { id, type, title, msg, show: true }]);
    setTimeout(() => {
      setToasts((items) => items.map((t) => t.id === id ? { ...t, show: false } : t));
      setTimeout(() => setToasts((items) => items.filter((t) => t.id !== id)), 400);
    }, 4500);
  }

  function go(next) {
    setPhase(next);
    document.getElementById('app')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function persist(next) {
    const clean = normalize({ ...next, synced: next.tasks.filter((t) => t.eventId).length });
    setState(clean);
    if (!auth.connected) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(clean));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: clean })
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Blob save failed.');
    } catch (error) {
      toast('error', 'Blob save failed', error.message);
    } finally {
      setSaving(false);
    }
  }

  function addList(kind, id) {
    const el = document.getElementById(id);
    const value = el.value.trim();
    if (!value) return;
    el.value = '';
    persist({ ...state, [kind]: [...state[kind], value] });
  }

  function deleteList(kind, index) {
    persist({ ...state, [kind]: state[kind].filter((_, i) => i !== index) });
  }

  function addTask() {
    const el = document.getElementById('t-inp');
    const name = el.value.trim();
    if (!name) return toast('error', 'Missing task name', 'Please enter a task description.');
    el.value = '';
    const task = {
      id: crypto.randomUUID?.() || String(Date.now()),
      name,
      type: null,
      recRule: null,
      start: null,
      end: null,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      eventId: null,
      calLink: null,
      quadrant: null
    };
    persist({ ...state, tasks: [...state.tasks, task] });
    toast('success', 'Task captured', 'Assign it to the matrix before scheduling.');
  }

  async function deleteTask(index) {
    const task = state.tasks[index];
    const tasks = state.tasks.filter((_, i) => i !== index);
    const quads = buildQuads(tasks);
    if (task?.eventId && auth.connected) {
      fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: task.eventId })
      }).catch(() => null);
    }
    await persist({ ...state, tasks, quads });
  }

  function buildQuads(tasks) {
    return Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((q) => [q, tasks.filter((t) => t.quadrant === q).map((t) => t.name)]));
  }

  async function assignQuadrant() {
    const index = Number.parseInt(document.getElementById('del-sel').value, 10);
    if (Number.isNaN(index) || !state.tasks[index]) return;
    const urgency = document.getElementById('del-urg').value;
    const importance = document.getElementById('del-imp').value;
    const quadrant = urgency === 'urgent' && importance === 'important' ? 'q1' : urgency === 'not-urgent' && importance === 'important' ? 'q2' : urgency === 'urgent' ? 'q3' : 'q4';
    const tasks = state.tasks.map((t, i) => i === index ? { ...t, quadrant } : t);
    await persist({ ...state, tasks, quads: buildQuads(tasks) });
    toast('success', `Assigned to ${qLabel(quadrant)}`, quadrant === 'q1' ? 'Q1 tasks must be scheduled today or tomorrow.' : 'This task can now be scheduled freely.');
  }

  function makeRecurrenceRule() {
    if (recurrenceType === 'daily') return 'RRULE:FREQ=DAILY';
    if (recurrenceType === 'weekdays') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    if (recurrenceType === 'weekly') {
      if (!weeklyDays.length) throw new Error('Choose at least one weekday for weekly recurrence.');
      return `RRULE:FREQ=WEEKLY;BYDAY=${weeklyDays.join(',')}`;
    }
    if (recurrenceType === 'monthly') {
      const days = parseMonthDays(monthlyDays);
      if (!days.length) throw new Error('Enter at least one month day from 1 to 31.');
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${days.join(',')}`;
    }
    return 'RRULE:FREQ=DAILY';
  }

  function buildScheduledTask(base) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (scheduleType === 'op') {
      const date = document.getElementById('sch-op-date').value || today();
      const time = document.getElementById('sch-op-time').value || '09:00';
      const duration = Number.parseInt(document.getElementById('sch-op-dur').value, 10) || 60;
      const start = `${date}T${time}:00`;
      return { ...base, type: 'op', recRule: makeRecurrenceRule(), start, end: addMinutes(start, duration), tz };
    }

    const date = document.getElementById('sch-pr-date').value || today();
    const startTime = document.getElementById('sch-pr-start').value || '09:00';
    const endTime = document.getElementById('sch-pr-end').value || '10:00';
    const duration = Number.parseInt(document.getElementById('sch-pr-dur').value, 10);
    const start = `${date}T${startTime}:00`;
    return { ...base, type: 'pr', recRule: null, start, end: Number.isFinite(duration) && duration > 0 ? addMinutes(start, duration) : `${date}T${endTime}:00`, tz };
  }

  async function scheduleTask() {
    const index = Number.parseInt(document.getElementById('sch-task-sel').value, 10);
    if (Number.isNaN(index) || !state.tasks[index]) return toast('error', 'Choose a task', 'Select a prioritized task to schedule.');
    if (!auth.connected) return toast('error', 'Calendar not connected', 'Connect Google Calendar first.');

    const base = state.tasks[index];
    if (!base.quadrant) return toast('error', 'Prioritize first', 'Assign this task to the matrix before scheduling.');

    let task;
    try {
      task = buildScheduledTask(base);
    } catch (error) {
      return toast('error', 'Recurrence needs details', error.message);
    }

    const date = task.start?.slice(0, 10);
    if (base.quadrant === 'q1' && date !== today() && date !== tomorrow()) {
      return toast('error', 'Q1 scheduling rule', 'Urgent + important tasks must be scheduled for today or tomorrow.');
    }

    setSyncing(true);
    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context: { goals: state.goals, values: state.values } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Calendar sync failed.');
      const tasks = state.tasks.map((t, i) => i === index ? { ...task, eventId: data.eventId, calLink: data.link } : t);
      await persist({ ...state, tasks });
      toast('success', 'Scheduled to Google Calendar', `"${task.name}" is now scheduled.`);
    } catch (error) {
      toast('error', 'Calendar sync failed', error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  }

  return <>
    <Nav auth={auth} logout={logout} />
    <Hero saving={saving} state={state} synced={synced} />
    <main id="app" className="main">
      <div className="stats">
        <SmallStat label="Values" value={state.values.length} color="green" />
        <SmallStat label="Goals" value={state.goals.length} color="blue" />
        <SmallStat label="Tasks" value={state.tasks.length} color="amber" />
        <SmallStat label="Synced to Calendar" value={synced} color="green" />
      </div>
      <div className="sync-note"><strong>Storage:</strong> connected users save to Vercel Blob under their Google account. {auth.connected ? `Signed in as ${auth.profile?.email}.` : 'Connect Google Calendar to enable cloud saving and calendar sync. Until then, this uses local browser storage.'}</div>
      <div className="ptabs"><Tab p="deciding" n="1" phase={phase} go={go}>Deciding</Tab><Tab p="doing" n="2" phase={phase} go={go}>Doing</Tab><Tab p="delivering" n="3" phase={phase} go={go}>Delivering</Tab></div>
      <Deciding active={phase === 'deciding'} go={go} state={state} addList={addList} deleteList={deleteList} />
      <Doing active={phase === 'doing'} go={go} state={state} addTask={addTask} deleteTask={deleteTask} />
      <Delivering active={phase === 'delivering'} go={go} state={state} unassigned={unassigned} scheduleCandidates={scheduleCandidates} assignQuadrant={assignQuadrant} scheduleTask={scheduleTask} auth={auth} syncing={syncing} scheduleType={scheduleType} setScheduleType={setScheduleType} recurrenceType={recurrenceType} setRecurrenceType={setRecurrenceType} weeklyDays={weeklyDays} setWeeklyDays={setWeeklyDays} monthlyDays={monthlyDays} setMonthlyDays={setMonthlyDays} />
    </main>
    <ToastStack toasts={toasts} />
  </>;
}

function Nav({ auth, logout }) {
  return <nav><a className="logo" href="#"><div className="logo-icon">P</div><span className="logo-name">PriorityOS</span></a><div className="nav-r"><div className={`cal-status ${auth.connected ? 'connected' : 'disconnected'}`}><div className="cal-dot" />{auth.loading ? 'Checking Google Calendar…' : auth.connected ? 'Google Calendar connected' : 'Google Calendar not connected'}</div>{auth.connected ? <button className="btn-ghost" onClick={logout}>Disconnect</button> : <a className="btn-cal" href="/api/auth/google">Connect Calendar</a>}</div></nav>;
}

function Hero({ saving, state, synced }) {
  return <section className="hero"><div className="hero-bg" /><div className="hero-content"><div className="tag-pill lg"><span className="tag-new">Live</span><span className="tag-txt">Prioritize first, then schedule to Google Calendar</span></div><h1 className="hero-h1">Your Priorities.<br />Your <span className="serif">Calendar.</span></h1><p className="hero-sub">Capture work in Phase 2. Decide what it means in Phase 3. Then schedule it with rules that keep the calendar beast polite.</p><button className="hero-cta" onClick={() => document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' })}>Open Priority Manager</button></div><div className="dash-wrap"><div className="dash-mock"><div className="dash-bar"><div className="d-dot" style={{ background: '#ff5f57' }} /><div className="d-dot" style={{ background: '#febc2e' }} /><div className="d-dot" style={{ background: '#28c840' }} /><span className="dash-bar-txt">PriorityOS — Calendar Sync View</span><span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>{saving ? '● SAVING' : '● LIVE'}</span></div><div className="dash-grid"><Stat label="GOALS" value={state.goals.length} color="green" sub="SMART objectives" /><Stat label="TASKS" value={state.tasks.length} color="blue" sub="In pipeline" /><Stat label="SYNCED" value={synced} color="amber" sub="On Google Calendar" /><Stat label="DO IT NOW" value={state.quads.q1.length} color="red" sub="Urgent & important" /></div></div></div><div className="hero-fade" /></section>;
}

function Deciding({ active, go, state, addList, deleteList }) {
  return <section className={`psec ${active ? 'active' : ''}`}><Header color="green" tag="Phase 1 — Transformation" title={<>Who are you? What do you <span className="serif">value?</span></>} sub="Define your values and roles first. Then write SMART goals aligned to that foundation." /><div className="card"><div className="card-hdr">Values, Mission & Roles</div><div className="irow"><input id="v-inp" placeholder="e.g. Family, Financial freedom, Health, Creativity…" onKeyDown={(e) => e.key === 'Enter' && addList('values', 'v-inp')} /><button className="btn" onClick={() => addList('values', 'v-inp')}>Add</button></div><List items={state.values} empty="No values yet." color="green" del={(i) => deleteList('values', i)} /></div><div className="card"><div className="card-hdr">SMART Goals & Objectives</div><div className="smart">{['Specific', 'Measurable', 'Attainable', 'Relevant', 'Trackable'].map((x) => <div className="sm-cell" key={x}><div className="sm-l">{x[0]}</div><div className="sm-w">{x}</div></div>)}</div><textarea id="g-inp" placeholder="e.g. Publish 2 articles/month by Q3 to grow audience by 30%" /><div style={{ marginTop: 9 }}><button className="btn btn-full" onClick={() => addList('goals', 'g-inp')}>Add SMART Goal</button></div><div style={{ marginTop: 12 }}><List items={state.goals} empty="No goals yet." color="blue" del={(i) => deleteList('goals', i)} /></div></div><div className="nav-row"><span /><button className="btn" onClick={() => go('doing')}>Continue to Doing →</button></div></section>;
}

function Doing({ active, go, state, addTask, deleteTask }) {
  return <section className={`psec ${active ? 'active' : ''}`}><Header color="blue" tag="Phase 2 — Performance" title={<>Capture your work.<br /><span className="serif">Prepare to prioritize.</span></>} sub="Phase 2 is your intake lane. Add the task first, then decide its quadrant and schedule it in Phase 3." /><div className="cmp"><Compare kind="ops" title="Operational Work" rows={[[ 'Nature', 'Independent' ], [ 'Planning', 'Usually simple' ], [ 'Duration', 'Ongoing' ], [ 'Calendar', 'After priority' ]]} /><Compare kind="prj" title="Project" rows={[[ 'Nature', 'Dependent' ], [ 'Planning', 'Often complex' ], [ 'Duration', 'Temporary' ], [ 'Calendar', 'After priority' ]]} /></div><div className="card"><div className="card-hdr">Add Task to Priority Queue</div><div className="irow"><input id="t-inp" placeholder="Describe your task or activity…" onKeyDown={(e) => e.key === 'Enter' && addTask()} /><button className="btn" onClick={addTask}>Add Task</button></div><Tasks tasks={state.tasks} del={deleteTask} /></div><div className="nav-row"><button className="btn-ghost" onClick={() => go('deciding')}>← Back to Deciding</button><button className="btn" onClick={() => go('delivering')}>Continue to Delivering →</button></div></section>;
}

function Delivering(props) {
  return <section className={`psec ${props.active ? 'active' : ''}`}><Header color="amber" tag="Phase 3 — Accountability" title={<>Decide, then <span className="serif">schedule.</span></>} sub="Assign each task to the Eisenhower Matrix first. Only then schedule it to Google Calendar. Q1 tasks must land today or tomorrow." /><div className="card"><div className="card-hdr">Assign Task to Priority Quadrant</div><div style={{ marginBottom: 10 }}><div className="field-lbl">Task</div><select id="del-sel" disabled={!props.unassigned.length}>{props.unassigned.length ? props.unassigned.map(({ task, index }) => <option key={task.id} value={index}>{task.name}</option>) : <option>No unassigned tasks yet</option>}</select></div><div className="g2" style={{ marginBottom: 12 }}><div><div className="field-lbl">Urgency</div><select id="del-urg"><option value="urgent">Urgent</option><option value="not-urgent">Not urgent</option></select></div><div><div className="field-lbl">Importance</div><select id="del-imp"><option value="important">Important</option><option value="not-important">Not important</option></select></div></div><button className="btn btn-full" onClick={props.assignQuadrant} disabled={!props.unassigned.length}>Assign to Matrix</button></div><div className="mx-hdrs"><div className="mx-hdr" style={{ color: 'var(--green)' }}>URGENT</div><div className="mx-hdr" style={{ color: 'var(--blue)' }}>NOT URGENT</div></div><div className="mx"><Quad id="q1" t="Do It Now" e="Important + Urgent" items={props.state.quads.q1} /><Quad id="q2" t="Investment" e="Important + Not Urgent" items={props.state.quads.q2} /><Quad id="q3" t="Delegate It" e="Not Important + Urgent" items={props.state.quads.q3} /><Quad id="q4" t="Delete It" e="Not Important + Not Urgent" items={props.state.quads.q4} /></div><ScheduleCard {...props} /><div className="hint"><h4>Q1 Rule + Q2 Focus</h4><p>Urgent and important tasks must be scheduled today or tomorrow. Everything else can be scheduled freely once the priority decision is clear.</p><ul><li>Weekly recurrence can target exact weekdays</li><li>Monthly recurrence can target exact days of the month</li><li>Q2 investment work should get a deliberate calendar block</li></ul></div><div className="nav-row"><button className="btn-ghost" onClick={() => props.go('doing')}>← Back to Doing</button></div></section>;
}

function ScheduleCard(props) {
  return <div className="card" style={{ marginTop: 16 }}><div className="card-hdr">Schedule Prioritized Task to Google Calendar</div><div style={{ marginBottom: 10 }}><div className="field-lbl">Prioritized task</div><select id="sch-task-sel" disabled={!props.scheduleCandidates.length}>{props.scheduleCandidates.length ? props.scheduleCandidates.map(({ task, index }) => <option key={task.id} value={index}>{task.name} — {qLabel(task.quadrant)}</option>) : <option>Assign a task to the matrix first</option>}</select></div><div className="ttog"><button className={`ttbtn ${props.scheduleType === 'op' ? 'op' : ''}`} onClick={() => props.setScheduleType('op')}>Operational (recurring)</button><button className={`ttbtn ${props.scheduleType === 'pr' ? 'pr' : ''}`} onClick={() => props.setScheduleType('pr')}>Project (specific date)</button></div>{props.scheduleType === 'op' ? <OperationalSchedule {...props} /> : <ProjectSchedule />}<div style={{ marginTop: 12 }}><button className="btn-cal btn-full" onClick={props.scheduleTask} disabled={props.syncing || !props.auth.connected || !props.scheduleCandidates.length} style={{ justifyContent: 'center' }}>{props.syncing ? <><span className="spin" /> Syncing to Google Calendar…</> : 'Schedule Task & Sync to Google Calendar'}</button></div><p className="sh-sub" style={{ margin: '12px 0 0' }}>Q1 tasks can only be scheduled today or tomorrow. All other quadrants are open-schedule.</p></div>;
}

function OperationalSchedule({ recurrenceType, setRecurrenceType, weeklyDays, setWeeklyDays, monthlyDays, setMonthlyDays }) {
  const toggleDay = (day) => setWeeklyDays(weeklyDays.includes(day) ? weeklyDays.filter((d) => d !== day) : [...weeklyDays, day]);
  return <div><div className="field-lbl">Recurrence</div><div className="rec-opts">{[['daily','Daily'], ['weekly','Weekly'], ['monthly','Monthly'], ['weekdays','Weekdays']].map(([value, label]) => <button key={value} className={`rec-btn ${recurrenceType === value ? 'active' : ''}`} onClick={() => setRecurrenceType(value)}>{label}</button>)}</div>{recurrenceType === 'weekly' ? <div style={{ marginBottom: 10 }}><div className="field-lbl">Specific weekdays</div><div className="rec-opts">{WEEKDAYS.map(([value, label]) => <button key={value} className={`rec-btn ${weeklyDays.includes(value) ? 'active' : ''}`} onClick={() => toggleDay(value)}>{label}</button>)}</div></div> : null}{recurrenceType === 'monthly' ? <div style={{ marginBottom: 10 }}><div className="field-lbl">Specific days of month</div><input value={monthlyDays} onChange={(e) => setMonthlyDays(e.target.value)} placeholder="e.g. 1, 15, 30" /></div> : null}<div className="g2" style={{ marginBottom: 10 }}><div><div className="field-lbl">Start date</div><input type="date" id="sch-op-date" defaultValue={today()} /></div><div><div className="field-lbl">Time</div><input type="time" id="sch-op-time" defaultValue="09:00" /></div></div><div><div className="field-lbl">Duration (minutes)</div><input id="sch-op-dur" defaultValue="60" /></div></div>;
}

function ProjectSchedule() {
  return <div><div className="g2" style={{ marginBottom: 10 }}><div><div className="field-lbl">Date</div><input type="date" id="sch-pr-date" defaultValue={today()} /></div><div><div className="field-lbl">Start time</div><input type="time" id="sch-pr-start" defaultValue="09:00" /></div></div><div className="g2"><div><div className="field-lbl">End time</div><input type="time" id="sch-pr-end" defaultValue="10:00" /></div><div><div className="field-lbl">Duration (min, auto)</div><input id="sch-pr-dur" placeholder="or set end time above" /></div></div></div>;
}

function Stat({ label, value, color, sub }) { return <div className="ds"><div className="ds-lbl">{label}</div><div className="ds-val" style={{ color: `var(--${color})` }}>{value}</div><div className="ds-sub">{sub}</div></div>; }
function SmallStat({ label, value, color }) { return <div className="sc"><div className="sc-n" style={{ color: `var(--${color})` }}>{value}</div><div className="sc-l">{label}</div></div>; }
function Tab({ p, n, phase, go, children }) { return <button className={`ptab p${n} ${phase === p ? 'active' : ''}`} onClick={() => go(p)}><span className="pn">Phase {n}</span>{children}</button>; }
function Header({ color, tag, title, sub }) { return <><div className="sh-tag lg" style={{ color: `var(--${color})` }}><span className="sh-dot" style={{ background: `var(--${color})` }} />{tag}</div><h2 className="sh-title">{title}</h2><p className="sh-sub">{sub}</p></>; }
function List({ items, empty, color, del }) { return <ul className="ilist">{items.length ? items.map((x, i) => <li key={`${x}-${i}`}><span className="idot" style={{ background: `var(--${color})` }} /><span style={{ flex: 1 }}>{x}</span><button className="del" onClick={() => del(i)}>×</button></li>) : <li className="empty">{empty}</li>}</ul>; }
function Compare({ kind, title, rows }) { return <div className={`cmp-col ${kind}`}><h4>{title}</h4>{rows.map(([k, v]) => <div className="cr" key={k}><span className="ck">{k}</span><span className="cv">{v}</span></div>)}</div>; }
function Tasks({ tasks, del }) { return <ul className="ilist" style={{ marginTop: 14 }}>{tasks.length ? tasks.map((t, i) => <li key={t.id || `${t.name}-${i}`}><span className="idot" style={{ background: `var(--${t.quadrant === 'q1' ? 'red' : t.quadrant ? 'amber' : 'blue'})` }} /><span style={{ flex: 1 }}><span style={{ display: 'block', marginBottom: 3 }}>{t.name}</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.eventId ? `${t.type === 'op' ? '🔄 ' + recurrenceLabel(t.recRule) : '📅 ' + t.start.slice(0, 10)}` : t.quadrant ? `⚡ ${qLabel(t.quadrant)} — ready to schedule` : 'Needs matrix assignment'}</span></span>{t.quadrant ? <span className="tag pr" style={{ marginRight: 6 }}>{qLabel(t.quadrant)}</span> : null}{t.type ? <span className={`tag ${t.type}`} style={{ marginRight: 6 }}>{t.type === 'op' ? 'Operational' : 'Project'}</span> : null}{t.eventId ? <span className="tag synced">✓ Synced</span> : null}{t.calLink ? <a href={t.calLink} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: 'var(--blue)', fontSize: 11, textDecoration: 'none' }}>↗</a> : null}<button className="del" onClick={() => del(i)}>×</button></li>) : <li className="empty">No tasks yet — add work in Phase 2.</li>}</ul>; }
function Quad({ id, t, e, items }) { return <div className={`qd ${id}`}><div className="qey">{e}</div><div className="qnm">{t}</div><ul className="qi">{items.length ? items.map((x, i) => <li key={`${x}-${i}`}><span style={{ fontSize: 9, flexShrink: 0 }}>▸</span>{x}</li>) : <li className="qe">Empty</li>}</ul></div>; }
function ToastStack({ toasts }) { return <div className="toast-wrap">{toasts.map((t) => <div key={t.id} className={`toast ${t.type} ${t.show ? 'show' : ''}`}><span className="toast-icon">{t.type === 'success' ? '✓' : '✕'}</span><div><div className="toast-title">{t.title}</div><div className="toast-msg">{t.msg}</div></div></div>)}</div>; }
