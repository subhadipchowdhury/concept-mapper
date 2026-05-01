// Concept Map Canvas — draggable nodes, pan, zoom, edge interaction
// Exposes: ConceptMap, AdminCanvas

const { useState: useState2, useEffect: useEffect2, useRef: useRef2, useCallback: useCallback2, useLayoutEffect: useLayoutEffect2 } = React;

// ─── Estimate node size from label (so edges can route before measuring) ────
function estimateNodeSize(label) {
  const lines = (label || '').split('\\n');
  const longest = Math.max(...lines.map(l => l.replace(/\\\\\([^)]+\\\)/g, 'XXXX').length));
  const w = Math.min(220, Math.max(140, longest * 8 + 36));
  const h = 30 + lines.length * 22;
  return { w, h };
}

// ─── Custom hook for drag-on-canvas ─────────────────────────────────────────
function useNodeDrag(onMove, onEnd) {
  const stateRef = useRef2(null);
  const start = useCallback2((e, nodeId, startX, startY) => {
    e.stopPropagation();
    e.preventDefault();
    stateRef.current = {
      nodeId,
      startX, startY,
      mouseX: e.clientX, mouseY: e.clientY,
      moved: false,
    };
    function move(ev) {
      if (!stateRef.current) return;
      const dx = ev.clientX - stateRef.current.mouseX;
      const dy = ev.clientY - stateRef.current.mouseY;
      if (Math.abs(dx) + Math.abs(dy) > 3) stateRef.current.moved = true;
      onMove(nodeId, startX + dx, startY + dy);
    }
    function up() {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      const moved = stateRef.current?.moved;
      stateRef.current = null;
      if (onEnd) onEnd(nodeId, moved);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [onMove, onEnd]);
  return start;
}

// ─── Color helpers ───────────────────────────────────────────────────────────
function nodeBg(color)     { return color + '22'; }
function nodeBorder(color) { return color + 'AA'; }

// ─── Pan / Zoom hook ─────────────────────────────────────────────────────────
function usePanZoom(initial = { x: 60, y: 80, scale: 1 }) {
  const [t, setT] = useState2(initial);
  const tRef = useRef2(t);
  useEffect2(() => { tRef.current = t; }, [t]);

  const onWheel = useCallback2((e) => {
    if (!e.ctrlKey && !e.metaKey) {
      // pan with wheel
      setT(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      e.preventDefault();
    } else {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setT(prev => {
        const newScale = Math.max(0.4, Math.min(2.5, prev.scale * (1 + delta)));
        // zoom around mouse
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = (mx - prev.x) / prev.scale;
        const wy = (my - prev.y) / prev.scale;
        return {
          x: mx - wx * newScale,
          y: my - wy * newScale,
          scale: newScale,
        };
      });
    }
  }, []);

  const startPan = useCallback2((e) => {
    if (e.target.closest('.node-card') || e.target.closest('.edge-label-badge') || e.target.closest('.inspector') || e.target.closest('.admin-toolbar')) return;
    const start = { x: e.clientX, y: e.clientY, tx: tRef.current.x, ty: tRef.current.y };
    function move(ev) {
      setT(prev => ({ ...prev, x: start.tx + (ev.clientX - start.x), y: start.ty + (ev.clientY - start.y) }));
    }
    function up() {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('panning');
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    document.body.classList.add('panning');
  }, []);

  return { t, setT, onWheel, startPan };
}

// ─── ZoomControl UI ─────────────────────────────────────────────────────────
function ZoomControl({ scale, setScale, fitToScreen }) {
  return (
    <div className="zoom-control">
      <button onClick={() => setScale(s => Math.max(0.4, s * 0.85))} title="Zoom out">−</button>
      <div className="zoom-control-pct">{Math.round(scale * 100)}%</div>
      <button onClick={() => setScale(s => Math.min(2.5, s * 1.15))} title="Zoom in">+</button>
      <button onClick={fitToScreen} title="Fit to screen" style={{fontSize: 12}}>⌂</button>
    </div>
  );
}

// ─── ConceptMap (Student view) ───────────────────────────────────────────────
function ConceptMap({ mapData, progress, onProgress, positions, onPositions }) {
  const [activeEdge, setActiveEdge] = useState2(null);
  const [showComplete, setShowComplete] = useState2(false);
  const viewportRef = useRef2(null);
  const { t, setT, onWheel, startPan } = usePanZoom();

  const answeredEdges = progress.answeredEdges || new Set();

  // local node positions: positions[mapId][nodeId] = {x, y}
  const mapPositions = positions[mapData.id] || {};
  // Effective node coords: stored override, else from data
  function nodeXY(node) {
    const p = mapPositions[node.id];
    return p ? { x: p.x, y: p.y } : { x: node.x, y: node.y };
  }

  function setNodeXY(nodeId, x, y) {
    const newMapPos = { ...mapPositions, [nodeId]: { x, y } };
    onPositions({ ...positions, [mapData.id]: newMapPos });
  }

  function getUnlockedNodes(answeredSet) {
    const unlocked = new Set(mapData.nodes.filter(n => n.isStart).map(n => n.id));
    mapData.edges.forEach(e => {
      if (answeredSet.has(e.id)) unlocked.add(e.to);
    });
    return unlocked;
  }

  const unlockedNodes = getUnlockedNodes(answeredEdges);

  function handleEdgeClick(edge) {
    if (answeredEdges.has(edge.id)) return;
    if (!unlockedNodes.has(edge.from)) return;
    setActiveEdge(edge);
  }

  function handleCorrect(edgeId) {
    const newAnswered = new Set(answeredEdges);
    newAnswered.add(edgeId);
    onProgress({ answeredEdges: newAnswered });
    if (newAnswered.size === mapData.edges.length) {
      setTimeout(() => { setShowComplete(true); launchConfetti(); }, 700);
    }
  }

  // node drag
  const dragStart = useNodeDrag((id, x, y) => setNodeXY(id, x, y));

  function fitToScreen() {
    setT({ x: 60, y: 80, scale: 1 });
  }

  // Build node geometry map for edge routing
  const geom = {};
  mapData.nodes.forEach(n => {
    const xy = nodeXY(n);
    const sz = estimateNodeSize(n.label);
    geom[n.id] = { x: xy.x, y: xy.y, w: sz.w, h: sz.h };
  });

  const totalEdges = mapData.edges.length;
  const completed = answeredEdges.size;
  const progressPct = Math.round((completed / totalEdges) * 100);

  const fromNode = activeEdge ? mapData.nodes.find(n => n.id === activeEdge.from) : null;
  const toNode = activeEdge ? mapData.nodes.find(n => n.id === activeEdge.to) : null;

  return (
    <>
      <div className="map-header">
        <div className="map-title-block">
          <div className="map-title">{mapData.title}</div>
          <div className="map-desc">{mapData.description}</div>
        </div>
        <div className="map-controls">
          <div className="topbar-progress">
            <span>{completed}/{totalEdges} edges</span>
            <div className="topbar-progress-bar">
              <div className="topbar-progress-fill" style={{ width: `${progressPct}%`, background: mapData.color }}></div>
            </div>
            <span style={{color: mapData.color, fontWeight: 700}}>{progressPct}%</span>
          </div>
          <button className="icon-btn" onClick={fitToScreen} title="Reset view">⌂</button>
          <button
            className="icon-btn"
            onClick={() => {
              if (confirm('Reset progress for this map? Node positions will stay.')) {
                onProgress({ answeredEdges: new Set() });
              }
            }}
            title="Reset progress"
          >↺</button>
        </div>
      </div>

      <div
        className="map-viewport"
        ref={viewportRef}
        onWheel={onWheel}
        onMouseDown={startPan}
      >
        <div
          className="map-canvas"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}
        >
          {/* SVG edges */}
          <svg className="edges-svg" style={{width: 2400, height: 1500}}>
            <defs>
              <marker id="arrow-active" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="currentColor" />
              </marker>
              <marker id="arrow-locked" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.15)" />
              </marker>
            </defs>

            {mapData.edges.map(edge => {
              const f = geom[edge.from], to = geom[edge.to];
              if (!f || !to) return null;
              const isAnswered = answeredEdges.has(edge.id);
              const fromUnlocked = unlockedNodes.has(edge.from);
              const path = computeEdgePath(f, to);
              const fromN = mapData.nodes.find(n => n.id === edge.from);
              const stroke = !fromUnlocked ? 'rgba(255,255,255,0.08)'
                           : isAnswered ? (fromN.color || '#34d399')
                           : (fromN.color || '#818cf8');
              return (
                <g key={edge.id} style={{color: stroke}}>
                  <path
                    d={path.d}
                    className={`edge-path ${!fromUnlocked ? 'locked' : isAnswered ? 'correct' : 'answering'}`}
                    stroke={stroke}
                    markerEnd={fromUnlocked ? 'url(#arrow-active)' : 'url(#arrow-locked)'}
                  />
                </g>
              );
            })}
          </svg>

          {/* Edge labels */}
          {mapData.edges.map(edge => {
            const f = geom[edge.from], to = geom[edge.to];
            if (!f || !to) return null;
            const isAnswered = answeredEdges.has(edge.id);
            const fromUnlocked = unlockedNodes.has(edge.from);
            if (!fromUnlocked && !isAnswered) return null;
            const path = computeEdgePath(f, to);
            return (
              <div
                key={edge.id}
                className="edge-label-wrap"
                style={{ left: path.midX, top: path.midY }}
              >
                <div
                  className={`edge-label-badge ${isAnswered ? 'correct' : 'answering'}`}
                  onMouseDown={e => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); if (!isAnswered) handleEdgeClick(edge); }}
                  title={isAnswered ? '' : 'Click to answer'}
                >
                  {isAnswered
                    ? <>✓ <span>{edge.label} {edge.answer}</span></>
                    : <><span>{edge.label}</span> <span style={{opacity: 0.7}}>___</span> <span style={{fontSize: 11, marginLeft: 2}}>✏️</span></>
                  }
                </div>
              </div>
            );
          })}

          {/* Nodes */}
          {mapData.nodes.map(node => {
            const xy = nodeXY(node);
            const sz = estimateNodeSize(node.label);
            const unlocked = unlockedNodes.has(node.id);
            return (
              <div
                key={node.id}
                className="node"
                style={{
                  left: xy.x - sz.w/2,
                  top: xy.y - sz.h/2,
                }}
                onMouseDown={(e) => {
                  if (!unlocked) return;
                  dragStart(e, node.id, xy.x, xy.y);
                }}
              >
                <div
                  className={`node-card ${unlocked ? 'unlocked' : 'locked'} ${node.isStart ? 'start' : ''}`}
                  style={{
                    background: unlocked ? nodeBg(node.color) : undefined,
                    borderColor: unlocked ? nodeBorder(node.color) : undefined,
                    width: sz.w,
                  }}
                >
                  <MathNode text={unlocked ? node.label : '████ ████\\n████████'} />
                </div>
              </div>
            );
          })}
        </div>

        <ZoomControl scale={t.scale} setScale={(fn) => setT(prev => ({...prev, scale: typeof fn === 'function' ? fn(prev.scale) : fn}))} fitToScreen={fitToScreen} />

        <div className="mini-help">
          <strong>How to use:</strong> Click any glowing label to fill in the relationship. Drag nodes to rearrange. Use mouse wheel to pan, <kbd>⌘/Ctrl</kbd>+wheel to zoom.
        </div>
      </div>

      {activeEdge && fromNode && toNode && (
        <AnswerPopup
          edge={activeEdge}
          fromNode={fromNode}
          toNode={toNode}
          onClose={() => setActiveEdge(null)}
          onCorrect={(id) => { handleCorrect(id); setActiveEdge(null); }}
        />
      )}

      {showComplete && (
        <div className="completion-overlay" onClick={() => setShowComplete(false)}>
          <div className="completion-card">
            <span className="completion-emoji">🎉</span>
            <div className="completion-title">Map Complete!</div>
            <div className="completion-sub">
              You've connected all {totalEdges} relationships in<br/>
              <strong>{mapData.title}</strong>
            </div>
            <div className="stars">
              <span className="star">⭐</span>
              <span className="star">⭐</span>
              <span className="star">⭐</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowComplete(false)}>Continue Exploring</button>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ConceptMap, estimateNodeSize, useNodeDrag, usePanZoom, ZoomControl, nodeBg, nodeBorder });
