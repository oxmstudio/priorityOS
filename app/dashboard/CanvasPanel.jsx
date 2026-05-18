'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const palette = {
  ink: { label: 'Ink', bg: 'rgba(255,255,255,.075)', border: 'rgba(255,255,255,.16)' },
  blue: { label: 'Blue', bg: 'var(--blue-d)', border: 'rgba(96,165,250,.38)' },
  green: { label: 'Green', bg: 'var(--green-d)', border: 'rgba(34,197,94,.38)' },
  amber: { label: 'Amber', bg: 'var(--amber-d)', border: 'rgba(251,191,36,.38)' },
  red: { label: 'Red', bg: 'var(--red-d)', border: 'rgba(248,113,113,.38)' }
};
const now = () => new Date().toISOString();
const newId = (p = 'canvas') => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function makeNode(type = 'note', x = 120, y = 120) {
  const base = { id: newId('node'), type, x, y, w: type === 'column' ? 310 : 260, h: type === 'image' ? 260 : 170, color: type === 'todo' ? 'green' : type === 'link' ? 'blue' : type === 'column' ? 'amber' : 'ink', title: type === 'note' ? 'New note' : type === 'todo' ? 'Checklist' : type === 'link' ? 'Resource' : type === 'image' ? 'Image' : 'Column', body: '', url: '', items: [], createdAt: now(), updatedAt: now() };
  if (type === 'note') base.body = 'Capture an idea, project note, or brief here.';
  if (type === 'todo') base.items = [{ id: newId('item'), text: 'First step', done: false }];
  if (type === 'link') { base.url = 'https://'; base.body = 'Add context for this resource.'; }
  if (type === 'image') base.url = '';
  if (type === 'column') base.body = 'Drop related thoughts into this section.';
  return base;
}
function makeBoard(name = 'Main Board') {
  return { id: newId('board'), name, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [makeNode('note', 120, 140), makeNode('todo', 430, 210), makeNode('column', 760, 120)] };
}
function normalizeNode(node) {
  return { id: typeof node?.id === 'string' ? node.id : newId('node'), type: ['note', 'todo', 'link', 'image', 'column'].includes(node?.type) ? node.type : 'note', x: Number.isFinite(Number(node?.x)) ? Number(node.x) : 120, y: Number.isFinite(Number(node?.y)) ? Number(node.y) : 120, w: Math.max(180, Number(node?.w) || 260), h: Math.max(120, Number(node?.h) || 170), color: palette[node?.color] ? node.color : 'ink', title: typeof node?.title === 'string' ? node.title : 'Untitled', body: typeof node?.body === 'string' ? node.body : '', url: typeof node?.url === 'string' ? node.url : '', items: Array.isArray(node?.items) ? node.items.map((item) => ({ id: typeof item?.id === 'string' ? item.id : newId('item'), text: typeof item?.text === 'string' ? item.text : '', done: !!item?.done })) : [], createdAt: node?.createdAt || now(), updatedAt: node?.updatedAt || now() };
}
function normalizeBoard(board) {
  return { id: typeof board?.id === 'string' ? board.id : newId('board'), name: typeof board?.name === 'string' && board.name ? board.name : 'Untitled Board', viewport: { x: Number(board?.viewport?.x) || 0, y: Number(board?.viewport?.y) || 0, zoom: Math.min(2, Math.max(.35, Number(board?.viewport?.zoom) || 1)) }, nodes: Array.isArray(board?.nodes) ? board.nodes.map(normalizeNode) : [] };
}
function normalizeCanvas(canvas) {
  if (Array.isArray(canvas?.boards) && canvas.boards.length) {
    const boards = canvas.boards.map(normalizeBoard);
    return { boards, activeBoardId: boards.some((board) => board.id === canvas.activeBoardId) ? canvas.activeBoardId : boards[0].id };
  }
  const board = makeBoard();
  return { boards: [board], activeBoardId: board.id };
}

export default function CanvasPanel({ canvas, onSave }) {
  const [workspace, setWorkspace] = useState(() => normalizeCanvas(canvas));
  const [status, setStatus] = useState('Canvas ready.');
  const [selectedId, setSelectedId] = useState(null);
  const dragRef = useRef(null);
  const canvasRef = useRef(null);
  const latest = useRef(workspace);
  const dirty = useRef(false);
  const hydrated = useRef(false);
  const saveSeq = useRef(0);

  useEffect(() => { latest.current = workspace; }, [workspace]);
  useEffect(() => { if (dirty.current) return; setWorkspace(normalizeCanvas(canvas)); hydrated.current = true; }, [canvas]);
  useEffect(() => { if (!hydrated.current || !dirty.current) return; const seq = ++saveSeq.current; setStatus('Saving canvas...'); const t = setTimeout(() => { const snap = latest.current; Promise.resolve(onSave?.(snap)).then(() => { if (seq === saveSeq.current) { dirty.current = false; setStatus('Canvas saved.'); } }).catch(() => { if (seq === saveSeq.current) setStatus('Saved locally. Cloud sync failed.'); }); }, 650); return () => clearTimeout(t); }, [workspace, onSave]);

  const board = useMemo(() => workspace.boards.find((item) => item.id === workspace.activeBoardId) || workspace.boards[0], [workspace]);
  const selected = board?.nodes.find((node) => node.id === selectedId) || null;
  const viewport = board?.viewport || { x: 0, y: 0, zoom: 1 };

  function commit(next) { dirty.current = true; setWorkspace(next); }
  function updateBoard(update) { commit((w) => ({ ...w, boards: w.boards.map((b) => b.id === w.activeBoardId ? (typeof update === 'function' ? update(b) : { ...b, ...update }) : b) })); }
  function updateNode(id, update) { updateBoard((b) => ({ ...b, nodes: b.nodes.map((n) => n.id === id ? normalizeNode(typeof update === 'function' ? update(n) : { ...n, ...update, updatedAt: now() }) : n) })); }
  function addBoard() { const board = makeBoard(`Board ${workspace.boards.length + 1}`); commit((w) => ({ boards: [...w.boards, board], activeBoardId: board.id })); setSelectedId(null); }
  function deleteBoard(id) { commit((w) => { if (w.boards.length <= 1) return w; const boards = w.boards.filter((b) => b.id !== id); return { boards, activeBoardId: w.activeBoardId === id ? boards[0].id : w.activeBoardId }; }); setSelectedId(null); }
  function addNode(type) { const x = Math.round((120 - viewport.x) / viewport.zoom); const y = Math.round((130 - viewport.y) / viewport.zoom); const node = makeNode(type, x, y); updateBoard((b) => ({ ...b, nodes: [...b.nodes, node] })); setSelectedId(node.id); }
  function deleteNode(id) { updateBoard((b) => ({ ...b, nodes: b.nodes.filter((node) => node.id !== id) })); if (selectedId === id) setSelectedId(null); }
  function duplicateNode(node) { const copy = normalizeNode({ ...node, id: newId('node'), title: `${node.title} Copy`, x: node.x + 34, y: node.y + 34, createdAt: now(), updatedAt: now() }); updateBoard((b) => ({ ...b, nodes: [...b.nodes, copy] })); setSelectedId(copy.id); }
  function setViewport(viewport) { updateBoard((b) => ({ ...b, viewport })); }
  function zoom(delta) { const z = Math.min(2, Math.max(.35, viewport.zoom + delta)); setViewport({ ...viewport, zoom: Number(z.toFixed(2)) }); }
  function resetView() { setViewport({ x: 0, y: 0, zoom: 1 }); }

  function pointerDownCanvas(e) {
    if (e.target !== canvasRef.current) return;
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, vx: viewport.x, vy: viewport.y };
  }
  function pointerDownNode(e, node) {
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) return;
    e.stopPropagation();
    setSelectedId(node.id);
    dragRef.current = { type: 'node', id: node.id, startX: e.clientX, startY: e.clientY, x: node.x, y: node.y };
  }
  function pointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'pan') setViewport({ ...viewport, x: drag.vx + e.clientX - drag.startX, y: drag.vy + e.clientY - drag.startY });
    if (drag.type === 'node') updateNode(drag.id, { x: Math.round(drag.x + (e.clientX - drag.startX) / viewport.zoom), y: Math.round(drag.y + (e.clientY - drag.startY) / viewport.zoom) });
  }
  function pointerUp() { dragRef.current = null; }
  function onWheel(e) { if (!e.metaKey && !e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? -.08 : .08); }
  function exportJson() { const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'priorityos-canvas.json'; a.click(); URL.revokeObjectURL(a.href); }

  return <section className="canvas-native">
    <div className="dash-section-head canvas-head"><div><h2>Canvas Workspace</h2><p className="panel-sub">A savable infinite planning board for notes, links, checklists, sections, and visual research.</p><p className="canvas-save">{status}</p></div><div className="canvas-actions"><button className="btn-ghost" onClick={exportJson}>Export JSON</button><button className="btn-cal" onClick={() => addNode('note')}>+ Note</button></div></div>
    <div className="canvas-tabs">{workspace.boards.map((item) => <button key={item.id} className={`canvas-tab ${item.id === workspace.activeBoardId ? 'active' : ''}`} onClick={() => { commit((w) => ({ ...w, activeBoardId: item.id })); setSelectedId(null); }}><span>{item.name}</span><i onClick={(e) => { e.stopPropagation(); deleteBoard(item.id); }}>×</i></button>)}<button className="canvas-tab add" onClick={addBoard}>+ Board</button></div>
    <div className="canvas-layout">
      <aside className="dash-panel canvas-tools"><h3>Add to board</h3><div className="tool-grid"><button onClick={() => addNode('note')}>Note</button><button onClick={() => addNode('todo')}>Checklist</button><button onClick={() => addNode('link')}>Link</button><button onClick={() => addNode('image')}>Image</button><button onClick={() => addNode('column')}>Section</button></div><div className="canvas-zoom"><button className="btn-ghost" onClick={() => zoom(-.1)}>−</button><span>{Math.round(viewport.zoom * 100)}%</span><button className="btn-ghost" onClick={() => zoom(.1)}>+</button><button className="btn-ghost" onClick={resetView}>Reset</button></div>{selected ? <Inspector node={selected} updateNode={updateNode} deleteNode={deleteNode} duplicateNode={duplicateNode} /> : <div className="canvas-empty"><strong>No card selected.</strong><p>Click a card to edit it. Drag the empty board to pan. Hold Ctrl/Cmd and scroll to zoom.</p></div>}</aside>
      <main className="dash-panel canvas-stage-panel"><div className="canvas-board" ref={canvasRef} onPointerDown={pointerDownCanvas} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp} onWheel={onWheel}><div className="canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>{board.nodes.map((node) => <CanvasNode key={node.id} node={node} selected={node.id === selectedId} onPointerDown={pointerDownNode} updateNode={updateNode} deleteNode={deleteNode} duplicateNode={duplicateNode} />)}</div></div></main>
    </div>
    <style jsx global>{canvasCss}</style>
  </section>;
}

function Inspector({ node, updateNode, deleteNode, duplicateNode }) {
  return <div className="canvas-inspector"><h3>Card Settings</h3><label><span>Title</span><input value={node.title} onChange={(e) => updateNode(node.id, { title: e.target.value })} /></label><label><span>Color</span><select value={node.color} onChange={(e) => updateNode(node.id, { color: e.target.value })}>{Object.entries(palette).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}</select></label>{['link', 'image'].includes(node.type) ? <label><span>{node.type === 'image' ? 'Image URL' : 'URL'}</span><input value={node.url} onChange={(e) => updateNode(node.id, { url: e.target.value })} placeholder="https://" /></label> : null}<div className="canvas-inspector-actions"><button className="btn-ghost" onClick={() => duplicateNode(node)}>Duplicate</button><button className="btn-ghost danger" onClick={() => deleteNode(node.id)}>Delete</button></div></div>;
}
function CanvasNode({ node, selected, onPointerDown, updateNode, deleteNode, duplicateNode }) {
  const style = { left: node.x, top: node.y, width: node.w, minHeight: node.h, background: palette[node.color]?.bg, borderColor: selected ? 'var(--blue)' : palette[node.color]?.border };
  return <article className={`canvas-node ${node.type} ${selected ? 'selected' : ''}`} style={style} onPointerDown={(e) => onPointerDown(e, node)}><div className="canvas-node-top"><input value={node.title} onChange={(e) => updateNode(node.id, { title: e.target.value })} /><div><button onClick={() => duplicateNode(node)}>⧉</button><button onClick={() => deleteNode(node.id)}>×</button></div></div>{node.type === 'todo' ? <Checklist node={node} updateNode={updateNode} /> : node.type === 'image' ? <ImageCard node={node} updateNode={updateNode} /> : node.type === 'link' ? <LinkCard node={node} updateNode={updateNode} /> : <textarea value={node.body} onChange={(e) => updateNode(node.id, { body: e.target.value })} />}</article>;
}
function Checklist({ node, updateNode }) {
  function itemUpdate(id, update) { updateNode(node.id, { items: node.items.map((item) => item.id === id ? { ...item, ...update } : item) }); }
  return <div className="checklist">{node.items.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={(e) => itemUpdate(item.id, { done: e.target.checked })} /><input value={item.text} onChange={(e) => itemUpdate(item.id, { text: e.target.value })} /></label>)}<button onClick={() => updateNode(node.id, { items: [...node.items, { id: newId('item'), text: 'New item', done: false }] })}>+ item</button></div>;
}
function LinkCard({ node, updateNode }) { return <div className="link-card"><input value={node.url} onChange={(e) => updateNode(node.id, { url: e.target.value })} placeholder="https://" /><textarea value={node.body} onChange={(e) => updateNode(node.id, { body: e.target.value })} />{node.url?.startsWith('http') ? <a href={node.url} target="_blank" rel="noreferrer">Open link ↗</a> : null}</div>; }
function ImageCard({ node, updateNode }) { return <div className="image-card"><input value={node.url} onChange={(e) => updateNode(node.id, { url: e.target.value })} placeholder="Paste image URL" />{node.url ? <img src={node.url} alt={node.title} /> : <div className="image-placeholder">Paste an image URL</div>}<textarea value={node.body} onChange={(e) => updateNode(node.id, { body: e.target.value })} placeholder="Caption or notes" /></div>; }

const canvasCss = `.canvas-native{display:block}.canvas-save{font-size:11px;color:var(--green);margin-top:5px}.canvas-actions,.canvas-inspector-actions{display:flex;gap:10px;flex-wrap:wrap}.canvas-tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}.canvas-tab{border:.5px solid var(--border);background:#17191f;color:var(--fg);border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:12px;cursor:pointer}.canvas-tab.active{background:linear-gradient(135deg,rgba(96,165,250,.2),rgba(34,197,94,.08));border-color:rgba(96,165,250,.45)}.canvas-tab i{font-style:normal;color:var(--muted)}.canvas-tab.add{color:var(--blue)}.canvas-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px}.canvas-tools{align-self:start;position:sticky;top:110px}.canvas-tools h3,.canvas-inspector h3{font-size:17px;margin-bottom:12px}.tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px}.tool-grid button{border:.5px solid var(--border);background:rgba(255,255,255,.04);color:var(--fg);border-radius:12px;padding:11px;cursor:pointer}.canvas-zoom{display:flex;align-items:center;gap:8px;margin-bottom:14px}.canvas-zoom span{font-size:12px;color:var(--muted);min-width:48px;text-align:center}.canvas-empty{border:.5px dashed var(--border);border-radius:14px;padding:16px;color:var(--muted);font-size:12px;line-height:1.55}.canvas-empty strong{display:block;color:var(--fg);margin-bottom:6px}.canvas-inspector label{display:grid;gap:6px;margin-bottom:10px}.canvas-inspector span{font-size:10px;text-transform:uppercase;color:var(--muted);letter-spacing:.7px;font-weight:800}.canvas-inspector input,.canvas-inspector select{background:rgba(255,255,255,.04);border:.5px solid var(--border);border-radius:10px;color:var(--fg);padding:10px}.btn-ghost.danger{color:var(--red)}.canvas-stage-panel{padding:0;overflow:hidden}.canvas-board{height:72vh;min-height:620px;position:relative;overflow:hidden;cursor:grab;background-color:#08090c;background-image:radial-gradient(rgba(255,255,255,.075) 1px, transparent 1px);background-size:26px 26px;border-radius:20px;touch-action:none}.canvas-board:active{cursor:grabbing}.canvas-world{position:absolute;left:0;top:0;width:5000px;height:5000px;transform-origin:0 0}.canvas-node{position:absolute;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:12px;box-shadow:0 20px 50px rgba(0,0,0,.28);backdrop-filter:blur(14px);cursor:grab;color:var(--fg)}.canvas-node.selected{box-shadow:0 0 0 1px rgba(96,165,250,.55),0 24px 60px rgba(0,0,0,.35)}.canvas-node-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.canvas-node-top input{font-weight:800;font-size:14px;color:var(--fg);background:transparent;border:none;outline:none;min-width:0;width:100%}.canvas-node-top div{display:flex;gap:4px}.canvas-node-top button{background:rgba(0,0,0,.18);border:.5px solid var(--border);color:var(--muted);border-radius:8px;width:26px;height:26px;cursor:pointer}.canvas-node textarea{width:100%;min-height:96px;resize:vertical;background:transparent;border:none;outline:none;color:rgba(255,255,255,.82);font:13px Inter,sans-serif;line-height:1.5}.checklist{display:grid;gap:8px}.checklist label{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center}.checklist input[type=text],.checklist label input:last-child,.link-card input,.image-card input{background:rgba(255,255,255,.06);border:.5px solid var(--border);border-radius:9px;color:var(--fg);padding:8px;width:100%}.checklist button,.link-card a{border:.5px solid var(--border);background:rgba(255,255,255,.05);color:var(--blue);border-radius:10px;padding:9px;text-decoration:none;text-align:center;cursor:pointer}.link-card,.image-card{display:grid;gap:8px}.image-card img{width:100%;max-height:170px;object-fit:cover;border-radius:12px;border:.5px solid var(--border)}.image-placeholder{height:130px;border:.5px dashed var(--border);border-radius:12px;display:grid;place-items:center;color:var(--muted);font-size:12px}@media(max-width:1180px){.canvas-layout{grid-template-columns:1fr}.canvas-tools{position:relative;top:auto}.canvas-board{height:66vh}}`;
