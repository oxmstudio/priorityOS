'use client';
import {useRef,useState,useEffect} from 'react';

const qNames={q1:'Do It Now',q2:'Investment',q3:'Delegate It',q4:'Delete It'};
const qColors={q1:'green',q2:'blue',q3:'amber',q4:'red'};
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function time(v){try{return new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch{return''}}
function fdate(v){try{return new Date(v).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return v||'Not scheduled'}}
function eventOnDay(event,day){if(!event?.start)return false;const s=new Date(event.start),d=new Date(`${day}T00:00:00`);if(iso(s)===day)return true;if(!event.recRule)return false;if(d<new Date(s.getFullYear(),s.getMonth(),s.getDate()))return false;if(event.recRule.includes('FREQ=DAILY'))return true;if(event.recRule.includes('FREQ=MONTHLY'))return d.getDate()===s.getDate();if(event.recRule.includes('FREQ=WEEKLY')){const by=event.recRule.match(/BYDAY=([^;]+)/)?.[1],map=['SU','MO','TU','WE','TH','FR','SA'];return by?by.split(',').includes(map[d.getDay()]):d.getDay()===s.getDay()}return false}
function isRecurring(t){return !!(t?.recRule||t?.type==='op')}

export default function WorkboardDashboard({s,events,next,loading,setView,habitScore,habitCount,mode}){
 const wrap=useRef(null),drag=useRef(null),widthRef=useRef(45);
 const[width,setWidth]=useState(45),[selectedDay,setSelectedDay]=useState(iso(new Date()));
 useEffect(()=>{widthRef.current=width},[width]);
 useEffect(()=>{function move(e){if(!drag.current||!wrap.current)return;const rect=wrap.current.getBoundingClientRect();setWidth(Math.max(28,Math.min(72,((e.clientX-rect.left)/rect.width)*100)))}function up(){drag.current=null;document.body.classList.remove('resizing')}window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}},[]);
 function start(){drag.current=true;document.body.classList.add('resizing')}
 const dayEvents=(events||[]).filter(e=>eventOnDay(e,selectedDay)).sort((a,b)=>new Date(a.start)-new Date(b.start));
 return <div className="workboard-wrap">
  <section className="workboard-stats"><Metric icon="✧" label="Values" value={s.values.length} color="green"/><Metric icon="◆" label="Goals" value={s.goals.length} color="blue"/><Metric icon="◴" label="Calendar" value={events.length} color="amber"/></section>
  <section ref={wrap} className="workboard" style={{gridTemplateColumns:`minmax(230px,${width}fr) 9px minmax(320px,${100-width}fr)`}}>
   <TaskPane s={s} habitScore={habitScore} habitCount={habitCount} setView={setView} mode={mode}/>
   <div className="pane-resizer" onPointerDown={start}/>
   <DayPane events={dayEvents} selected={selectedDay} setSelected={setSelectedDay} next={next} loading={loading} setView={setView}/>
  </section>
 </div>
}
function TaskPane({s,habitScore,habitCount,setView,mode}){const tasks=s.tasks||[],q1=tasks.filter(t=>t.quadrant==='q1'),q2=tasks.filter(t=>t.quadrant==='q2'),ops=tasks.filter(isRecurring),loose=tasks.filter(t=>!t.quadrant&&!isRecurring(t));return <article className="workspace-pane task-pane"><PaneHead kicker="Inbox" title="Tasks & Checklist" action="Plan" href={`/dashboard/planner?mode=${mode}`}/><TaskSection title="Do It Now" color="green" items={q1}/><TaskSection title="Investment" color="blue" items={q2}/><TaskSection title="Operational Habits" color="amber" items={ops}/>{loose.length?<TaskSection title="Unsorted" color="red" items={loose}/>:null}<div className="pane-mini-card"><strong>{habitScore}% consistency</strong><span>{habitCount} recurring task{habitCount===1?'':'s'} tracked.</span><button onClick={()=>setView('habits')}>Open Habits</button></div></article>}
function TaskSection({title,color,items}){return <div className="task-sec"><div className="task-sec-head"><span className={`dot ${color}`}/><strong>{title}</strong><em>{items.length}</em></div>{items.length?items.slice(0,8).map((t,i)=><label className="check-row" key={t.id||`${title}-${i}`}><input type="checkbox" readOnly checked={false}/><span>{t.name||t.title||t}</span>{isRecurring(t)?<b>recurs</b>:null}</label>):<p className="empty">Nothing here yet.</p>}</div>}
function DayPane({events,selected,setSelected,next,loading,setView}){const d=new Date(`${selected}T12:00:00`),hours=Array.from({length:15},(_,i)=>i+6);function shift(n){const x=new Date(`${selected}T12:00:00`);x.setDate(x.getDate()+n);setSelected(iso(x))}return <article className="workspace-pane day-pane"><div className="pane-head day-head"><div><span className="pane-kicker">Specific Day</span><h2>{d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}</h2></div><div className="day-controls"><button onClick={()=>shift(-1)}>‹</button><button onClick={()=>setSelected(iso(new Date()))}>Today</button><button onClick={()=>shift(1)}>›</button><input type="date" value={selected} onChange={e=>setSelected(e.target.value)}/></div></div>{loading?<p className="empty">Loading calendar...</p>:<div className="day-timeline">{hours.map(h=>{const slot=events.filter(e=>new Date(e.start).getHours()===h);return <div className="hour-row" key={h}><span>{formatHour(h)}</span><div>{slot.length?slot.map(e=><div key={`${e.id}-${e.start}`} className={`event-pill ${qColors[e.quadrant]||'blue'}`}><strong>{e.title}</strong><em>{time(e.start)} · {qNames[e.quadrant]||'PriorityOS'}</em></div>):null}</div></div>})}</div>}<div className="pane-mini-card next-card"><strong>{next?.title||'No next commitment'}</strong><span>{next?fdate(next.start):'Use the planner to schedule one.'}</span><button onClick={()=>setView('calendar')}>Open Month Calendar</button></div></article>}
function formatHour(h){const suffix=h>=12?'PM':'AM',hr=h%12||12;return `${hr} ${suffix}`}
function PaneHead({kicker,title,action,href,onClick}){return <div className="pane-head"><div><span className="pane-kicker">{kicker}</span><h2>{title}</h2></div>{href?<a className="pane-action" href={href}>{action}</a>:<button className="pane-action" onClick={onClick}>{action}</button>}</div>}
function Metric({icon,label,value,color}){return <div className="metric-card compact"><div className="metric-icon" style={{color:`var(--${color})`}}>{icon}</div><div className="metric-value" style={{color:`var(--${color})`}}>{value}</div><div className="metric-label">{label}</div></div>}
