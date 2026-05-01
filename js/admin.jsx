// Admin Canvas — visual drag-and-drop concept map builder
// Exposes: AdminCanvas, MapsManager

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useCallback: useCallbackA } = React;

const NODE_COLOR_PALETTE = [
  '#4f8ef7', // blue
  '#34d399', // teal
  '#f59e0b', // amber
  '#fb7185', // rose
  '#a78bfa', // purple
  '#06b6d4', // cyan
  '#f472b6', // pink
];

// ─── AdminCanvas: Visual builder for one concept map ──────────────────────────
function AdminCanvas({ mapData, onChange, onBack, onDelete }) {
  const [tool, setTool] = useStateA('select'); // 'select' | 'addNode' | 'connect'
  const [selectedNodeId, setSelectedNodeId] = useStateA(null);
  const [selectedEdgeId, setSelectedEdgeId] = useStateA(null);
  const [connectSource, setConnectSource] = useStateA(null);
  const [hoverNode, setHoverNode] = useStateA(null);
  const [activeColor, setActiveColor] = useStateA(NODE_COLOR_PALETTE[0]);
  const viewportRef = useRefA(null);
  const { t, setT, onWheel, startPan } = usePanZoom();

  // ── Update helpers ──
  function updateNode(id, patch) {
    const newNodes = mapData.nodes.map(n => n.id === id ? { ...n, ...patch } : n);
    onChange({ ...mapData, nodes: newNodes });
  }
  function deleteNode(id) {
    const newNodes = mapData.nodes.filter(n => n.id !== id);
    const newEdges = mapData.edges.filter(e => e.from !== id && e.to !== id);
    onChange({ ...mapData, nodes: newNodes, edges: newEdges });
    setSelectedNodeId(null);
  }
  function addNode(x, y) {
    const id = 'n' + Date.now().toString(36);
    const newNode = {
      id, label: 'New Concept', x, y,
      color: activeColor,
      isStart: mapData.nodes.length === 0,
    };
    onChange({ ...mapData, nodes: [...mapData.nodes, newNode] });
    setSelectedNodeId(id);
    setTool('select');
  }
  function updateEdge(id, patch) {
    const newEdges = mapData.edges.map(e => e.id === id ? { ...e, ...patch } : e);
    onChange({ ...mapData, edges: newEdges });
  }
  function deleteEdge(id) {
    onChange({ ...mapData, edges: mapData.edges.filter(e => e.id !== id) });
    setSelectedEdgeId(null);
  }
  function addEdge(fromId, toId) {
    if (fromId === toId) return;
    if (mapData.edges.some(e => e.from === fromId && e.to === toId)) return;
    const id = 'e' + Date.now().toString(36);
    onChange({
      ...mapData,
      edges: [...mapData.edges, {
        id, from: fromId, to: toId,
        label: 'leads to',
        answer: 'something',
        type: 'fillin',
        hint: '',
      }]
    });
    setSelectedEdgeId(id);
  }

  // ── Node drag ──
  const dragStart = useNodeDrag((id, x, y) => {
    updateNode(id, { x, y });
  });

  // ── Click handlers ──
  function onCanvasClick(e) {
    if (tool === 'addNode') {
      const rect = viewportRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - t.x) / t.scale;
      const y = (e.clientY - rect.top - t.y) / t.scale;
      addNode(x, y);
    } else if (tool === 'select') {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } else if (tool === 'connect') {
      setConnectSource(null);
    }
  }

  function onNodeClick(e, node) {
    e.stopPropagation();
    if (tool === 'connect') {
      if (!connectSource) {
        setConnectSource(node.id);
      } else if (connectSource !== node.id) {
        addEdge(connectSource, node.id);
        setConnectSource(null);
      }
    } else {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    }
  }

  function fitToScreen() {
    setT({ x: 60, y: 80, scale: 1 });
  }

  // ── Geometry ──
  const geom = {};
  mapData.nodes.forEach(n => {
    const sz = estimateNodeSize(n.label);
    geom[n.id] = { x: n.x, y: n.y, w: sz.w, h: sz.h };
  });

  const selectedNode = selectedNodeId ? mapData.nodes.find(n => n.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? mapData.edges.find(e => e.id === selectedEdgeId) : null;

  return (
    <>
      <div className="map-header">
        <div className="map-title-block">
          <div className="map-title">{mapData.title} <span style={{fontSize: 12, fontWeight: 500, color: 'var(--accent-amber)', marginLeft: 8}}>● Editing</span></div>
          <div className="map-desc">{mapData.description}</div>
        </div>
        <div className="map-controls">
          <button className="icon-btn" onClick={onBack} title="Back to maps">←</button>
        </div>
      </div>

      {/* Admin toolbar */}
      <div className="admin-toolbar" onMouseDown={e => e.stopPropagation()}>
        <button className={`admin-tool-btn ${tool === 'select' ? 'active' : ''}`} onClick={() => { setTool('select'); setConnectSource(null); }}>↖ Select</button>
        <button className={`admin-tool-btn ${tool === 'addNode' ? 'active' : ''}`} onClick={() => { setTool('addNode'); setSelectedNodeId(null); setConnectSource(null); }}>+ Node</button>
        <button className={`admin-tool-btn ${tool === 'connect' ? 'active' : ''}`} onClick={() => { setTool('connect'); setSelectedNodeId(null); }}>→ Connect</button>
        <div className="admin-tool-divider"></div>
        <div className="color-swatches">
          {NODE_COLOR_PALETTE.map(c => (
            <div
              key={c}
              className={`color-swatch ${activeColor === c ? 'active' : ''}`}
              style={{background: c}}
              onClick={() => {
                setActiveColor(c);
                if (selectedNode) updateNode(selectedNode.id, { color: c });
              }}
              title="Color (applies to new nodes; or to selected node)"
            ></div>
          ))}
        </div>
        <div className="admin-tool-divider"></div>
        <button className="admin-tool-btn" onClick={() => onChange({...mapData, _published: true})} title="Save & exit">💾 Save</button>
      </div>

      <div
        className={`map-viewport ${tool === 'addNode' ? 'placing-node' : ''}`}
        ref={viewportRef}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (tool === 'select' || tool === 'connect') startPan(e);
        }}
        onClick={onCanvasClick}
      >
        <div
          className="map-canvas"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}
        >
          {/* Edges */}
          <svg className="edges-svg" style={{width: 2400, height: 1500}}>
            <defs>
              <marker id="arrow-edit" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="currentColor" />
              </marker>
            </defs>
            {mapData.edges.map(edge => {
              const f = geom[edge.from], to = geom[edge.to];
              if (!f || !to) return null;
              const path = computeEdgePath(f, to);
              const fromN = mapData.nodes.find(n => n.id === edge.from);
              const stroke = selectedEdgeId === edge.id ? 'var(--accent-amber)' : (fromN.color || '#818cf8');
              return (
                <g key={edge.id} style={{color: stroke}}>
                  <path
                    d={path.d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={selectedEdgeId === edge.id ? 3 : 2.2}
                    markerEnd="url(#arrow-edit)"
                  />
                  <path
                    d={path.d}
                    className="edge-hit"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Edge labels */}
          {mapData.edges.map(edge => {
            const f = geom[edge.from], to = geom[edge.to];
            if (!f || !to) return null;
            const path = computeEdgePath(f, to);
            return (
              <div
                key={edge.id}
                className="edge-label-wrap"
                style={{ left: path.midX, top: path.midY }}
              >
                <div
                  className={`edge-label-badge ${selectedEdgeId === edge.id ? 'answering' : 'correct'}`}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                  style={{cursor: 'pointer'}}
                >
                  <span>{edge.label}</span>
                  <span style={{color: 'var(--accent-teal)'}}>✓ {edge.answer}</span>
                  <span style={{fontSize: 10, opacity: 0.6}}>{edge.type === 'dropdown' ? '▼' : '✏️'}</span>
                </div>
              </div>
            );
          })}

          {/* Nodes */}
          {mapData.nodes.map(node => {
            const sz = estimateNodeSize(node.label);
            const isSelected = selectedNodeId === node.id;
            const isConnectSource = connectSource === node.id;
            return (
              <div
                key={node.id}
                className="node"
                style={{
                  left: node.x - sz.w/2,
                  top: node.y - sz.h/2,
                }}
                onMouseDown={(e) => {
                  if (tool === 'select') {
                    dragStart(e, node.id, node.x, node.y);
                  }
                }}
                onClick={(e) => onNodeClick(e, node)}
                onMouseEnter={() => setHoverNode(node.id)}
                onMouseLeave={() => setHoverNode(null)}
              >
                <div
                  className={`node-card unlocked ${node.isStart ? 'start' : ''} ${isSelected ? 'selected' : ''} ${isConnectSource ? 'connect-source' : ''} ${hoverNode === node.id && connectSource && connectSource !== node.id ? 'connect-target-hover' : ''}`}
                  style={{
                    background: nodeBg(node.color || '#4f8ef7'),
                    borderColor: nodeBorder(node.color || '#4f8ef7'),
                    width: sz.w,
                  }}
                >
                  <MathNode text={node.label} />
                  {isSelected && (
                    <button
                      className="node-delete-btn"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      title="Delete node"
                    >×</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mapData.nodes.length === 0 && (
          <div className="empty-canvas-hint">
            <div className="empty-canvas-hint-title">Empty map</div>
            <div>Click <strong>+ Node</strong> in the toolbar, then click anywhere on the canvas to add concepts.</div>
          </div>
        )}

        <ZoomControl
          scale={t.scale}
          setScale={(fn) => setT(prev => ({...prev, scale: typeof fn === 'function' ? fn(prev.scale) : fn}))}
          fitToScreen={fitToScreen}
        />

        <div className="mini-help">
          <strong>Builder tips:</strong> <kbd>+ Node</kbd> then click canvas to add. <kbd>→ Connect</kbd> then click two nodes to draw an arrow. <kbd>↖ Select</kbd> to drag, edit & delete. Click an edge to edit its question.
        </div>
      </div>

      {/* Inspector — node */}
      {selectedNode && (
        <div className="inspector" onMouseDown={e => e.stopPropagation()}>
          <div className="inspector-title">
            <span>Node Properties</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNodeId(null)}>✕</button>
          </div>
          <div className="field">
            <div className="field-label">Label (LaTeX OK)</div>
            <textarea
              className="field-textarea"
              value={selectedNode.label}
              onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
              rows={3}
            />
            <div className="field-help">Use <code>\(…\)</code> for inline math, <code>\\n</code> for line break.</div>
          </div>
          <div className="field-row">
            <div className="field" style={{flex: 0.6}}>
              <div className="field-label">Color</div>
              <div className="color-swatches" style={{padding: 0}}>
                {NODE_COLOR_PALETTE.map(c => (
                  <div
                    key={c}
                    className={`color-swatch ${selectedNode.color === c ? 'active' : ''}`}
                    style={{background: c, width: 24, height: 24}}
                    onClick={() => updateNode(selectedNode.id, { color: c })}
                  ></div>
                ))}
              </div>
            </div>
            <div className="field" style={{flex: 0.4}}>
              <div className="field-label">Start node</div>
              <button
                className={`admin-tool-btn ${selectedNode.isStart ? 'active' : ''}`}
                onClick={() => updateNode(selectedNode.id, { isStart: !selectedNode.isStart })}
                style={{width: '100%', justifyContent: 'center'}}
              >
                {selectedNode.isStart ? '★ Start' : '☆ Mark as start'}
              </button>
            </div>
          </div>
          <div className="field-help">
            Position: ({Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}) — drag to move
          </div>
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={() => deleteNode(selectedNode.id)} style={{flex: 1, color: 'var(--accent-rose)'}}>Delete node</button>
          </div>
        </div>
      )}

      {/* Inspector — edge */}
      {selectedEdge && (
        <div className="inspector" onMouseDown={e => e.stopPropagation()}>
          <div className="inspector-title">
            <span>Edge Question</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedEdgeId(null)}>✕</button>
          </div>
          <div className="field-help" style={{marginBottom: 12, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6}}>
            <strong>{mapData.nodes.find(n => n.id === selectedEdge.from)?.label.split('\\n')[0]}</strong>
            {' → '}
            <strong>{mapData.nodes.find(n => n.id === selectedEdge.to)?.label.split('\\n')[0]}</strong>
          </div>
          <div className="field">
            <div className="field-label">Edge label (text shown before blank)</div>
            <input
              className="field-input"
              value={selectedEdge.label}
              onChange={e => updateEdge(selectedEdge.id, { label: e.target.value })}
              placeholder="e.g. 'is an example of'"
            />
          </div>
          <div className="field">
            <div className="field-label">Question type</div>
            <select
              className="field-select"
              value={selectedEdge.type}
              onChange={e => updateEdge(selectedEdge.id, { type: e.target.value })}
            >
              <option value="fillin">Fill in the blank</option>
              <option value="dropdown">Dropdown choice</option>
            </select>
          </div>
          <div className="field">
            <div className="field-label">Correct answer</div>
            <input
              className="field-input"
              value={selectedEdge.answer}
              onChange={e => updateEdge(selectedEdge.id, { answer: e.target.value })}
              placeholder="The correct word/phrase"
            />
          </div>
          {selectedEdge.type === 'dropdown' && (
            <div className="field">
              <div className="field-label">Options (one per line, include correct answer)</div>
              <textarea
                className="field-textarea"
                rows={4}
                value={(selectedEdge.options || []).join('\n')}
                onChange={e => updateEdge(selectedEdge.id, { options: e.target.value.split('\n').filter(o => o.trim()) })}
              />
            </div>
          )}
          <div className="field">
            <div className="field-label">Hint (shown after 2 wrong attempts)</div>
            <textarea
              className="field-textarea"
              rows={2}
              value={selectedEdge.hint || ''}
              onChange={e => updateEdge(selectedEdge.id, { hint: e.target.value })}
              placeholder="Optional hint with LaTeX"
            />
          </div>
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={() => deleteEdge(selectedEdge.id)} style={{flex: 1, color: 'var(--accent-rose)'}}>Delete edge</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── MapsManager: list + create ───────────────────────────────────────────────
function MapsManager({ allMaps, customMaps, onEdit, onCreate, onDeleteCustom }) {
  return (
    <div className="maps-manager">
      <div className="maps-manager-header">
        <div>
          <div className="maps-manager-title">Admin · Concept Maps</div>
          <div className="maps-manager-sub">Create and edit chapter maps with the visual builder.</div>
        </div>
      </div>
      <div className="maps-grid">
        {Object.values(allMaps).map(m => {
          const isCustom = !!customMaps[m.id];
          return (
            <div
              key={m.id}
              className="maps-grid-card"
              style={{'--card-color': m.color}}
              onClick={() => onEdit(m.id)}
            >
              <div className="maps-grid-card-title">{m.title}</div>
              <div className="maps-grid-card-meta">{m.description}</div>
              <div className="maps-grid-card-stats">
                <div className="maps-grid-card-stat"><span>{m.nodes.length}</span> nodes</div>
                <div className="maps-grid-card-stat"><span>{m.edges.length}</span> edges</div>
                {isCustom && <div className="maps-grid-card-stat" style={{color: 'var(--accent-amber)'}}>● custom</div>}
              </div>
            </div>
          );
        })}
        <div className="maps-grid-new" onClick={onCreate}>
          <div className="maps-grid-new-icon">+</div>
          <div>New concept map</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminCanvas, MapsManager, NODE_COLOR_PALETTE });
