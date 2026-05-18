'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const palette = {
  ink: { label: 'Ink', bg: 'rgba(255,255,255,.08)', border: 'rgba(255,255,255,.16)' },
  blue: { label: 'Blue', bg: 'var(--blue-d)', border: 'rgba(96,165,250,.38)' },
  green: { label: 'Green', bg: 'var(--green-d)', border: 'rgba(34,197,94,.38)' },
  amber: { label: 'Amber', bg: 'var(--amber-d)', border: 'rgba(251,191,36,.38)' },
  red: { label: 'Red', bg: 'var(--red-d)', border: 'rgba(248,113,113,.38)' }
};
const now = () => new Date().toISOString();
const id = (p = 'canvas') => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function node(type = 'note', x = 140, y = 140) {
  const base = { id: id('node'), type, x, y, w: type === 'section' ? 340 : 280, h: type === 'image' ? 280 : 180, color: type === 'todo' ? 'green' : type === 'link' ? 'blue' : type === 'section' ? 'amber' : 'ink', title: type === 'note' ? 'New note' : type === 'todo' ? 'Checklist' : type === 'link' ? 'Resource' : type === 'image' ? 'Image' : 'Section', body: '', url: '', items: [], createdAt: now(), updatedAt: now() };
  if (type === 'note') base.body = 'Capture an idea, project note, or brief here.';
  if (type === 'todo') base.items = [{ id: id('item'), text: 'First step', done: false }];
  if (type === 'link') { base.url = 'https://'; base.body = 'Add context for this resource.'; }
  if (type === 'section') base.body = 'Group related ideas, research, tasks, or creative direction.';
  return base;
}
function board(name = 'Main Board') {
  return { id: id('board'), name, viewport: { x: 80, y: 40, zoom: 1 }, nodes: [node('note', 80, 100), node('todo', 400, 180), node('section', 760, 95)] };
}
function nNode(n) {
  return { id: typeof n?.id === 'string' ? n.id : id('node'), type: ['note', 'todo', 'link', 'image', 'section'].includes(n?.type) ? n.type : (n?.type === 'column' ? 'section' : 'note'), x: Number.isFinite(Number(n?.x)) ? Number(n.x) : 120, y: Number.isFinite(Number(n?.y)) ? Number(n.y) : 120, w: Math.max(200, Number(n?.w) || 280), h: Math.max(130, Number(n?.h) || 180), color: palette[n?.color] ? n.color : 'ink', title: typeof n?.title === 'string' ? n.title : 'Untitled', body: typeof n?.body === 'string' ? n.body : '', url: typeof n?.url === 'string' ? n.url : '', items: Array.isArray(n?.items) ? n.items.map((item) => ({ id: typeof item?.id === 'string' ? item.id : id('item'), text: typeof item?.text === 'string' ? item.text : '', done: !!item?.done })) : [], createdAt: n?.createdAt || now(), updatedAt: n?.updatedAt || now() };
}
function nBoard(b) {
  return { id: typeof b?.id === 'string' ? b.id : id('board'), name: typeof b?.name === 'string' && b.name ? b.name : 'Untitled Board', viewport: { x: Number(b?.viewport?.x) || 0, y: Number(b?.viewport?.y) || 0, zoom: Math.min(2, Math.max(.35, Number(b?.viewport?.zoom) || 1)) }, nodes: Array.isArray(b?.nodes) ? b.nodes.map(nNode) : [] };
}
function nCanvas(c) {
  if (Array.isArray(c?.boards) && c.boards.length) { const boards = c.boards.map(nBoard); return { boards, activeBoardId: boards.some((b) => b.id === c.activeBoardId) ? c.activeBoardId : boards[0].id }; }
  const first = board();
  return { boards: [first], activeBoardId: first.id };
}

export default function CanvasPanel({ canvas, onSave }) {
  const [workspace, setWorkspace] = useState(() => nCanvas(canvas));
  const [status, setStatus] = useState('Canvas ready.');
  const [selectedId, setSelectedId] = useState(null);
  const drag = useRef(null);
  const latest = useRef(workspace);
  const dirty = useRef(false);
  const hydrated = useRef(false);
  const saveSeq = useRef(0);

  useEffect(() => { latest.current = workspace; }, [workspace]);
  useEffect(() => { if (dirty.current) return; setWorkspace(nCanvas(canvas)); hydrated.current = true; }, [canvas]);
  useEffect(() => {
    if (!hydrated.current || !dirty.current) return;
    const seq = ++saveSeq.current;
    setStatus('Saving canvas...');
    const t = setTimeout(() => {
      Promise.resolve(onSave?.(latest.current)).then(() => {
        if (seq === saveSeq.current) { dirty.current = false; setStatus('Canvas saved.'); }
      }).catch(() => { if (seq === saveSeq.current) setStatus('Saved locally. Cloud sync failed.'); });
    }, 650);
    return () => clearTimeout(t);
  }, [workspace, onSave]);

  const activeBoard = useMemo(() => workspace.boards.find((b) => b.id === workspace.activeBoardId) || workspace.boards[0], [workspace]);
  const selected = activeBoard?.nodes.find((n) => n.id === selectedId) || null;
  const vp = activeBoard?.viewport || { x: 0, y: 0, zoom: 1 };

  function commit(next) { dirty.current = true; setWorkspace(next); }
  function boardPatch(fn) { commit((w) => ({ ...w, boards: w.boards.map((b) => b.id === w.activeBoardId ? fn(b) : b) })); }
  function patchNode(nodeId, update) { boardPatch((b) => ({ ...b, nodes: b.nodes.map((n) => n.id === nodeId ? nNode(typeof update === 'function' ? update(n) : { ...n, ...update, updatedAt: now() }) : n) })); }
  function patchViewport(viewport) { boardPatch((b) => ({ ...b, viewport })); }
  function addBoard() { const b = board(`Board ${workspace.boards.length + 1}`); commit((w) => ({ boards: [...w.boards, b], activeBoardId: b.id })); setSelectedId(null); }
  function removeBoard(boardId) { commit((w) => { if (w.boards.length <= 1) return w; const boards = w.boards.filter((b) => b.id !== boardId); return { boards, activeBoardId: w.activeBoardId === boardId ? boards[0].id : w.activeBoardId }; }); setSelectedId(null); }
  function addNode(type) { const n = node(type, Math.round((180 - vp.x) / vp.zoom), Math.round((160 - vp.y) / vp.zoom)); boardPatch((b) => ({ ...b, nodes: [...b.nodes, n] })); setSelectedId(n.id); }
  function removeNode(nodeId) { boardPatch((b) => ({ ...b, nodes: b.nodes.filter((n) => n.id !== nodeId) })); if (selectedId === nodeId) setSelectedId(null); }
  function duplicateNode(n) { const copy = nNode({ ...n, id: id('node'), title: `${n.title} Copy`, x: n.x + 36, y: n.y + 36, createdAt: now(), updatedAt: now() }); boardPatch((b) => ({ ...b, nodes: [...b.nodes, copy] })); setSelectedId(copy.id); }
  function zoom(delta) { const z = Math.min(2, Math.max(.35, vp.zoom + delta)); patchViewport({ ...vp, zoom: Number(z.toFixed(2)) }); }
  function resetView() { patchViewport({ x: 80, y: 40, zoom: 1 }); }

  function startPan(e) {
    if (e.target.closest?.('.canvas-node,.canvas-control')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, x: vp.x, y: vp.y };
    setSelectedId(null);
  }
  function startDrag(e, n) {
    if (e.target.closest?.('input,textarea,select,button,a')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSelectedId(n.id);
    drag.current = { type: 'node', id: n.id, sx: e.clientX, sy: e.clientY, x: n.x, y: n.y };
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    if (d.type === 'pan') patchViewport({ ...vp, x: d.x + e.clientX - d.sx, y: d.y + e.clientY - d.sy });
    if (d.type === 'node') patchNode(d.id, { x: Math.round(d.x + (e.clientX - d.sx) / vp.zoom), y: Math.round(d.y + (e.clientY - d.sy) / vp.zoom) });
  }
  function end() { drag.current = null; }
  function wheel(e) { if (!e.metaKey && !e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? -.08 : .08); }
  function exportJson() { const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'priorityos-canvas.json'; a.click(); URL.revokeObjectURL(a.href); }

  return <section className="canvas-native">
    <div className="canvas-topbar dash-panel">
      <div><h2>Canvas Workspace</h2><p className="panel-sub">Drag cards, pan the board, zoom with controls or Ctrl/Cmd + scroll. Everything autosaves.</p><p className="canvas-save">{status}</p></div>
      <div className="canvas-actions canvas-control"><button className="btn-ghost" onClick={exportJson}>Export JSON</button><button className="btn-cal" onClick={() => addNode('note')}>+ Note</button></div>
    </div>
    <div className="canvas-tabs canvas-control">{workspace.boards.map((b) => <button key={b.id} className={`canvas-tab ${b.id === workspace.activeBoardId ? 'active' : ''}`} onClick={() => { commit((w) => ({ ...w, activeBoardId: b.id })); setSelectedId(null); }}><span>{b.name}</span><i onClick={(e) => { e.stopPropagation(); removeBoard(b.id); }}>×</i></button>)}<button className="canvas-tab add" onClick={addBoard}>+ Board</button></div>
    <div className="canvas-shell">
      <div className="canvas-toolbar canvas-control"><button onClick={() => addNode('note')}>Note</button><button onClick={() => addNode('todo')}>Checklist</button><button onClick={() => addNode('link')}>Link</button><button onClick={() => addNode('image')}>Image</button><button onClick={() => addNode('section')}>Section</button><span className="canvas-divider" /><button onClick={() => zoom(-.1)}>−</button><strong>{Math.round(vp.zoom * 100)}%</strong><button onClick={() => zoom(.1)}>+</button><button onClick={resetView}>Reset</button></div>
      <div className="canvas-board" onPointerDown={startPan} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onWheel={wheel}>
        <div className="canvas-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>{activeBoard.nodes.map((n) => <CanvasNode key={n.id} node={n} selected={n.id === selectedId} startDrag={startDrag} patchNode={patchNode} removeNode={removeNode} duplicateNode={duplicateNode} />)}</div>
      </div>
      <aside className={`canvas-inspector ${selected ? 'open' : ''}`}>{selected ? <Inspector node={selected} patchNode={patchNode} removeNode={removeNode} duplicateNode={duplicateNode} /> : <div><h3>No card selected</h3><p>Click any card to edit its title, color, URL, or content.</p></div>}</aside>
    </div>
  </section>;
}

function Inspector({ node, patchNode, removeNode, duplicateNode }) {
  return <><h3>Card Settings</h3><label><span>Title</span><input value={node.title} onChange={(e) => patchNode(node.id, { title: e.target.value })} /></label><label><span>Color</span><select value={node.color} onChange={(e) => patchNode(node.id, { color: e.target.value })}>{Object.entries(palette).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}</select></label>{['link', 'image'].includes(node.type) ? <label><span>{node.type === 'image' ? 'Image URL' : 'URL'}</span><input value={node.url} onChange={(e) => patchNode(node.id, { url: e.target.value })} placeholder="https://" /></label> : null}<div className="canvas-inspector-actions"><button className="btn-ghost" onClick={() => duplicateNode(node)}>Duplicate</button><button className="btn-ghost danger" onClick={() => removeNode(node.id)}>Delete</button></div></>;
}
function CanvasNode({ node, selected, startDrag, patchNode, removeNode, duplicateNode }) {
  const style = { left: node.x, top: node.y, width: node.w, minHeight: node.h, background: palette[node.color]?.bg, borderColor: selected ? 'var(--blue)' : palette[node.color]?.border };
  return <article className={`canvas-node ${node.type} ${selected ? 'selected' : ''}`} style={style} onPointerDown={(e) => startDrag(e, node)}><div className="canvas-node-top"><input value={node.title} onChange={(e) => patchNode(node.id, { title: e.target.value })} /><div><button onClick={() => duplicateNode(node)}>⧉</button><button onClick={() => removeNode(node.id)}>×</button></div></div>{node.type === 'todo' ? <Checklist node={node} patchNode={patchNode} /> : node.type === 'image' ? <ImageCard node={node} patchNode={patchNode} /> : node.type === 'link' ? <LinkCard node={node} patchNode={patchNode} /> : <textarea value={node.body} onChange={(e) => patchNode(node.id, { body: e.target.value })} />}</article>;
}
function Checklist({ node, patchNode }) { function upd(itemId, update) { patchNode(node.id, { items: node.items.map((it) => it.id === itemId ? { ...it, ...update } : it) }); } return <div className="checklist">{node.items.map((it) => <label key={it.id}><input type="checkbox" checked={it.done} onChange={(e) => upd(it.id, { done: e.target.checked })} /><input value={it.text} onChange={(e) => upd(it.id, { text: e.target.value })} /></label>)}<button onClick={() => patchNode(node.id, { items: [...node.items, { id: id('item'), text: 'New item', done: false }] })}>+ item</button></div>; }
function LinkCard({ node, patchNode }) { return <div className="link-card"><input value={node.url} onChange={(e) => patchNode(node.id, { url: e.target.value })} placeholder="https://" /><textarea value={node.body} onChange={(e) => patchNode(node.id, { body: e.target.value })} />{node.url?.startsWith('http') ? <a href={node.url} target="_blank" rel="noreferrer">Open link ↗</a> : null}</div>; }
function ImageCard({ node, patchNode }) { return <div className="image-card"><input value={node.url} onChange={(e) => patchNode(node.id, { url: e.target.value })} placeholder="Paste image URL" />{node.url ? <img src={node.url} alt={node.title} /> : <div className="image-placeholder">Paste an image URL</div>}<textarea value={node.body} onChange={(e) => patchNode(node.id, { body: e.target.value })} placeholder="Caption or notes" /></div>; }
