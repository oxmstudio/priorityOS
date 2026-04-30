'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = { values: [], goals: [], tasks: [], calendarEvents: [], quads: { q1: [], q2: [], q3: [], q4: [] }, synced: 0 };
const WEEKDAYS = [['MO','Mon'],['TU','Tue'],['WE','Wed'],['TH','Thu'],['FR','Fri'],['SA','Sat'],['SU','Sun']];
const weekdayValues = ['MO','TU','WE','TH','FR'];
const qLabels = { q1: 'Do It Now', q2: 'Investment', q3: 'Delegate It', q4: 'Delete It' };
const qDescriptions = {
  q1: 'Important + urgent. Schedule today or tomorrow.',
  q2: 'Important + not urgent. This is growth work. Protect it.',
  q3: 'Urgent but not important. Delegate or contain it.',
  q4: 'Not urgent and not important. Delete or defer.'
};

const pad = (value) => String(value).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const addMinutes = (start, minutes) => {
  const d = new Date(start);
  d.setMinutes(d.getMinutes() + minutes);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
const normalize = (state) => ({
  values: Array.isArray(state?.values) ? state.values : [],
  goals: Array.isArray(state?.goals) ? state.goals : [],
  tasks: Array.isArray(state?.tasks) ? state.tasks : [],
  calendarEvents: Array.isArray(state?.calendarEvents) ? state.calendarEvents : [],
  quads: {
    q1: Array.isArray(state?.quads?.q1) ? state.quads.q1 : [],
    q2: Array.isArray(state?.quads?.q2) ? state.quads.q2 : [],
    q3: Array.isArray(state?.quads?.q3) ? state.quads.q3 : [],
    q4: Array.isArray(state?.quads?.q4) ? state.quads.q4 : []
  },
  synced: Number.isFinite(Number(state?.synced)) ? Number(state.synced) : 0
});

function buildQuads(tasks) {
  return Object.fromEntries(['q1','q2','q3','q4'].map((q) => [q, tasks.filter((task) => task.quadrant === q).map((task) => task.name)]));
}

function eventFromTask(task) {
  return {
    id: task.internalEventId,
    taskId: task.id,
    googleEventId: task.eventId || null,
    googleLink: task.calLink || null,
    title: task.name,
    notes: task.notes || '',
    type: task.type,
    quadrant: task.quadrant,
    recRule: task.recRule || null,
    start: task.start,
    end: task.end,
    tz: task.tz,
    source: task.eventId ? 'priorityos+google' : 'priorityos',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export default function TypeformPlanner() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('business');
  const [auth, setAuth] = useState({ loading: true, connected: false, profile: null });
  const [state, setState] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [valueText, setValueText] = useState('');
  const [goalText, setGoalText] = useState('');
  const [taskName, setTaskName] = useState('');
  const [urgency, setUrgency] = useState('urgent');
  const [importance, setImportance] = useState('important');
  const [scheduleType, setScheduleType] = useState('op');
  const [recurrence, setRecurrence] = useState('daily');
  const [weeklyDays, setWeeklyDays] = useState(['MO']);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [projectEnd, setProjectEnd] = useState('10:00');
  const [notes, setNotes] = useState('');

  const quadrant = useMemo(() => {
    if (urgency === 'urgent' && importance === 'important') return 'q1';
    if (urgency === 'not-urgent' && importance === 'important') return 'q2';
    if (urgency === 'urgent') return 'q3';
    return 'q4';
  }, [urgency, importance]);

  const steps = [
    { eyebrow: 'Workspace', title: 'Where should this priority live?', sub: 'Keep Business and Personal in separate account dashboards.' },
    { eyebrow: 'Values', title: 'What matters most right now?', sub: 'Add the values this work should serve.' },
    { eyebrow: 'SMART Goal', title: 'What result are you moving toward?', sub: 'Write the measurable outcome this task should support.' },
    { eyebrow: 'Task', title: 'What do you need to do?', sub: 'Capture one clear task at a time.' },
    { eyebrow: 'Matrix', title: 'How should this be handled?', sub: 'Decide urgency and importance before scheduling.' },
    { eyebrow: 'Calendar', title: 'When should it happen?', sub: 'Save it to your PriorityOS calendar, and optionally sync to Google Calendar.' },
    { eyebrow: 'Done', title: 'Your priority is scheduled.', sub: 'From here, review your internal calendar or keep planning.' }
  ];

  useEffect(() => {
    const storedMode = localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business';
    setMode(storedMode);
    load(storedMode);
  }, []);

  async function load(nextMode) {
    try {
      const authResult = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json());
      setAuth({ loading: false, connected: !!authResult.connected, profile: authResult.profile || null });
      if (!authResult.connected) return;
      const result = await fetch(`/api/state?mode=${nextMode}`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { state: EMPTY });
      setState(normalize(result.state));
    } catch {
      setAuth({ loading: false, connected: false, profile: null });
    }
  }

  async function persist(nextState, nextMode = mode) {
    if (!auth.connected) return;
    const clean = normalize(nextState);
    setState(clean);
    await fetch(`/api/state?mode=${nextMode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode, state: clean })
    });
  }

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2800);
  }

  function switchMode(nextMode) {
    localStorage.setItem('priorityos.mode', nextMode);
    setMode(nextMode);
    load(nextMode);
  }

  async function addValue() {
    const value = valueText.trim();
    if (!value) return;
    const next = { ...state, values: [...state.values, value] };
    setValueText('');
    await persist(next);
    notify('Value added');
  }

  async function addGoal() {
    const goal = goalText.trim();
    if (!goal) return;
    const next = { ...state, goals: [...state.goals, goal] };
    setGoalText('');
    await persist(next);
    notify('Goal added');
  }

  function recurrenceRule() {
    if (scheduleType !== 'op') return null;
    if (recurrence === 'daily') return 'RRULE:FREQ=DAILY';
    if (recurrence === 'monthly') return 'RRULE:FREQ=MONTHLY';
    if (recurrence === 'weekdays') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    if (!weeklyDays.length) throw new Error('Choose at least one weekday.');
    return `RRULE:FREQ=WEEKLY;BYDAY=${weeklyDays.join(',')}`;
  }

  function buildTask() {
    if (!taskName.trim()) throw new Error('Enter a task name first.');
    if (quadrant === 'q1' && date !== today() && date !== tomorrow()) throw new Error('Q1 tasks must be scheduled today or tomorrow.');
    const id = crypto.randomUUID?.() || String(Date.now());
    const start = `${date}T${time}:00`;
    const end = scheduleType === 'op' ? addMinutes(start, Number.parseInt(duration, 10) || 60) : `${date}T${projectEnd}:00`;
    return {
      id,
      internalEventId: crypto.randomUUID?.() || `evt-${id}`,
      name: taskName.trim(),
      notes: notes.trim(),
      type: scheduleType,
      recRule: recurrenceRule(),
      start,
      end,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      quadrant,
      eventId: null,
      calLink: null
    };
  }

  async function saveInternalOnly() {
    setSaving(true);
    try {
      const task = buildTask();
      const tasks = [...state.tasks, task];
      const calendarEvents = [...state.calendarEvents, eventFromTask(task)];
      await persist({ ...state, tasks, calendarEvents, quads: buildQuads(tasks) });
      setStep(6);
      notify('Saved to PriorityOS Calendar');
    } catch (error) {
      notify(error.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSyncGoogle() {
    if (!auth.connected) return window.location.href = '/api/auth/google?returnTo=/dashboard/planner';
    setSaving(true);
    try {
      let task = buildTask();
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context: { values: state.values, goals: state.goals } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Google sync failed.');
      task = { ...task, eventId: data.eventId, calLink: data.link };
      const tasks = [...state.tasks, task];
      const calendarEvents = [...state.calendarEvents, eventFromTask(task)];
      await persist({ ...state, tasks, calendarEvents, quads: buildQuads(tasks), synced: state.synced + 1 });
      setStep(6);
      notify('Saved and synced to Google Calendar');
    } catch (error) {
      notify(error.message || 'Could not sync');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 3 && !taskName.trim()) return notify('Add a task before continuing');
    if (step < steps.length - 1) setStep(step + 1);
  }
  function back() { if (step > 0) setStep(step - 1); }

  if (!auth.loading && !auth.connected) {
    return <main className="main" style={{ paddingTop: 130 }}><section className="card"><div className="sh-tag lg" style={{ color: 'var(--blue)' }}><span className="sh-dot" style={{ background: 'var(--blue)' }} /> Planner</div><h1 className="sh-title">Create an account to use the <span className="serif">planner.</span></h1><p className="sh-sub">The Typeform-style planner saves to your private PriorityOS dashboard and internal calendar.</p><a className="btn-cal" href="/api/auth/google?returnTo=/dashboard/planner" style={{ display: 'inline-flex' }}>Create Account</a></section></main>;
  }

  return <>
    <section className="hero" style={{ minHeight: 'auto', paddingBottom: 34 }}>
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="tag-pill lg"><span className="tag-new">Planner</span><span className="tag-txt">Step {step + 1} of {steps.length}</span></div>
        <h1 className="hero-h1">One priority<br /><span className="serif">at a time.</span></h1>
        <p className="hero-sub">A guided flow that preserves the original Priority Manager sequence without making every step shout at once.</p>
      </div>
    </section>

    <main className="main" style={{ paddingTop: 16 }}>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.07)', marginBottom: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((step + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg,var(--blue),var(--green))', transition: 'width .25s ease' }} /></div>

      <section className="card" style={{ minHeight: 430, padding: '30px 32px' }}>
        <div className="sh-tag lg" style={{ color: step < 2 ? 'var(--green)' : step < 4 ? 'var(--blue)' : 'var(--amber)' }}><span className="sh-dot" style={{ background: step < 2 ? 'var(--green)' : step < 4 ? 'var(--blue)' : 'var(--amber)' }} />{steps[step].eyebrow}</div>
        <h2 className="sh-title" style={{ fontSize: 38 }}>{steps[step].title}</h2>
        <p className="sh-sub">{steps[step].sub}</p>

        {step === 0 ? <WorkspaceStep mode={mode} switchMode={switchMode} auth={auth} /> : null}
        {step === 1 ? <ListStep value={valueText} setValue={setValueText} add={addValue} items={state.values} placeholder="Family, cash flow, health, creativity…" button="Add value" color="green" /> : null}
        {step === 2 ? <ListStep value={goalText} setValue={setGoalText} add={addGoal} items={state.goals} placeholder="Grow monthly income by 20% by Q3…" button="Add SMART goal" color="blue" textarea /> : null}
        {step === 3 ? <TaskStep taskName={taskName} setTaskName={setTaskName} /> : null}
        {step === 4 ? <MatrixStep urgency={urgency} setUrgency={setUrgency} importance={importance} setImportance={setImportance} quadrant={quadrant} /> : null}
        {step === 5 ? <ScheduleStep scheduleType={scheduleType} setScheduleType={setScheduleType} recurrence={recurrence} setRecurrence={setRecurrence} weeklyDays={weeklyDays} setWeeklyDays={setWeeklyDays} date={date} setDate={setDate} time={time} setTime={setTime} duration={duration} setDuration={setDuration} projectEnd={projectEnd} setProjectEnd={setProjectEnd} notes={notes} setNotes={setNotes} quadrant={quadrant} saveInternalOnly={saveInternalOnly} saveAndSyncGoogle={saveAndSyncGoogle} saving={saving} /> : null}
        {step === 6 ? <DoneStep /> : null}
      </section>

      <div className="nav-row">
        <button className="btn-ghost" onClick={back} disabled={step === 0}>← Back</button>
        {step < 5 ? <button className="btn" onClick={next}>Continue →</button> : null}
        {step === 6 ? <div style={{ display: 'flex', gap: 8 }}><a className="btn-ghost" href="/dashboard/calendar" style={{ textDecoration: 'none' }}>Open Calendar</a><button className="btn" onClick={() => { setTaskName(''); setNotes(''); setStep(3); }}>Add another task</button></div> : null}
      </div>
    </main>

    {toast ? <div className="toast-wrap"><div className="toast success show"><span className="toast-icon">✓</span><div><div className="toast-title">PriorityOS</div><div className="toast-msg">{toast}</div></div></div></div> : null}
  </>;
}

function WorkspaceStep({ mode, switchMode, auth }) {
  return <div><div className="ttog" style={{ maxWidth: 420 }}><button className={`ttbtn ${mode === 'business' ? 'op' : ''}`} onClick={() => switchMode('business')}>Business</button><button className={`ttbtn ${mode === 'personal' ? 'pr' : ''}`} onClick={() => switchMode('personal')}>Personal</button></div><p className="sync-note" style={{ marginTop: 18 }}>Signed in as <strong>{auth.profile?.email}</strong>. Your selected workspace is saved separately.</p></div>;
}
function ListStep({ value, setValue, add, items, placeholder, button, color, textarea }) {
  const Input = textarea ? 'textarea' : 'input';
  return <div><div className="irow" style={{ alignItems: textarea ? 'stretch' : 'center' }}><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (!textarea && e.key === 'Enter') add(); }} /><button className="btn" onClick={add}>{button}</button></div><ul className="ilist" style={{ marginTop: 18 }}>{items.length ? items.map((item, index) => <li key={`${item}-${index}`}><span className="idot" style={{ background: `var(--${color})` }} /><span>{item}</span></li>) : <li className="empty">Nothing added yet. You can continue and add more later.</li>}</ul></div>;
}
function TaskStep({ taskName, setTaskName }) {
  return <div><input autoFocus value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. Practice DJing for 2 hours" style={{ fontSize: 18, padding: 16 }} /><p className="sh-sub" style={{ marginTop: 16 }}>Make it specific enough that Future You does not need to decode a cryptic cave painting.</p></div>;
}
function MatrixStep({ urgency, setUrgency, importance, setImportance, quadrant }) {
  return <div><div className="g2"><Choice title="Urgency" value={urgency} setValue={setUrgency} options={[['urgent','Urgent'],['not-urgent','Not urgent']]} /><Choice title="Importance" value={importance} setValue={setImportance} options={[['important','Important'],['not-important','Not important']]} /></div><div className={`qd ${quadrant}`} style={{ marginTop: 20 }}><div className="qey">Result</div><div className="qnm">{qLabels[quadrant]}</div><ul className="qi"><li>{qDescriptions[quadrant]}</li></ul></div></div>;
}
function Choice({ title, value, setValue, options }) {
  return <div><div className="field-lbl">{title}</div><div className="ttog">{options.map(([v, label]) => <button key={v} className={`ttbtn ${value === v ? 'op' : ''}`} onClick={() => setValue(v)}>{label}</button>)}</div></div>;
}
function ScheduleStep(props) {
  const toggleDay = (day) => props.setWeeklyDays(props.weeklyDays.includes(day) ? props.weeklyDays.filter((x) => x !== day) : [...props.weeklyDays, day]);
  return <div><div className="ttog"><button className={`ttbtn ${props.scheduleType === 'op' ? 'op' : ''}`} onClick={() => props.setScheduleType('op')}>Operational recurring</button><button className={`ttbtn ${props.scheduleType === 'pr' ? 'pr' : ''}`} onClick={() => props.setScheduleType('pr')}>Project one-time</button></div>{props.scheduleType === 'op' ? <><div className="field-lbl">Recurrence</div><div className="rec-opts">{[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['weekdays','Weekdays']].map(([value, label]) => <button key={value} className={`rec-btn ${props.recurrence === value ? 'active' : ''}`} onClick={() => { props.setRecurrence(value); if (value === 'weekdays') props.setWeeklyDays(weekdayValues); }}>{label}</button>)}</div>{props.recurrence === 'weekly' ? <div className="rec-opts">{WEEKDAYS.map(([value,label]) => <button key={value} className={`rec-btn ${props.weeklyDays.includes(value) ? 'active' : ''}`} onClick={() => toggleDay(value)}>{label}</button>)}</div> : null}<div className="g2"><div><div className="field-lbl">Start date</div><input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} /></div><div><div className="field-lbl">Time</div><input type="time" value={props.time} onChange={(e) => props.setTime(e.target.value)} /></div></div><div style={{ marginTop: 10 }}><div className="field-lbl">Duration minutes</div><input value={props.duration} onChange={(e) => props.setDuration(e.target.value)} /></div></> : <div className="g2"><div><div className="field-lbl">Date</div><input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} /></div><div><div className="field-lbl">Start</div><input type="time" value={props.time} onChange={(e) => props.setTime(e.target.value)} /></div><div><div className="field-lbl">End</div><input type="time" value={props.projectEnd} onChange={(e) => props.setProjectEnd(e.target.value)} /></div></div>}<div style={{ marginTop: 14 }}><div className="field-lbl">Notes</div><textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder="Context, links, next actions, delegation notes…" /></div>{props.quadrant === 'q1' ? <p className="sync-note" style={{ marginTop: 12 }}>Q1 rule: this must be scheduled today or tomorrow.</p> : null}<div className="g2" style={{ marginTop: 16 }}><button className="btn-ghost btn-full" onClick={props.saveInternalOnly} disabled={props.saving}>{props.saving ? 'Saving…' : 'Save to PriorityOS Calendar'}</button><button className="btn-cal btn-full" onClick={props.saveAndSyncGoogle} disabled={props.saving} style={{ justifyContent: 'center' }}>{props.saving ? 'Syncing…' : 'Save + Sync Google'}</button></div></div>;
}
function DoneStep() {
  return <div><div className="hint"><h4>Saved</h4><p>Your task is now part of your account workspace. Review it on the internal calendar, or add the next task while the momentum engine is still warm.</p></div></div>;
}
