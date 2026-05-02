// Concept Map Canvas — draggable nodes, pan, zoom, edge interaction
// Exposes: ConceptMap

const { useState: useState2, useEffect: useEffect2, useRef: useRef2, useCallback: useCallback2, useMemo: useMemo2 } = React;

// ─── Estimate node size from label (so edges can route before measuring) ────
function estimateNodeSize(label) {
  const lines = (label || '').split('\\n');
  const longest = Math.max(...lines.map(l => l.replace(/\\\\\([^)]+\\\)/g, 'XXXX').length));
  const w = Math.min(220, Math.max(140, longest * 8 + 36));
  const h = 30 + lines.length * 22;
  return { w, h };
}

// Fast deterministic string hash used for layout seeding.
function hashStringToUint32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small deterministic PRNG so auto-layout is stable across refreshes.
function createSeededRandom(seedString) {
  let seed = hashStringToUint32(seedString) || 1;
  return function rand() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Clamp values into a closed range.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const EDGE_LABEL_T_STOPS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

function getClosestEdgeLabelTStop(value) {
  return EDGE_LABEL_T_STOPS.reduce((closest, candidate) => (
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  ), EDGE_LABEL_T_STOPS[0]);
}

// Resolve label anchor position along edges for the active map.
function getMapEdgeLabelT(mapData) {
  const raw = Number(mapData && mapData.edgeLabelT);
  return Number.isFinite(raw) ? getClosestEdgeLabelTStop(clamp(raw, 0.2, 0.8)) : 0.4;
}

function resolveInitialEdgeLabelT(mapData, savedValue) {
  const saved = Number(savedValue);
  if (Number.isFinite(saved)) {
    const hasMapOverride = Number.isFinite(Number(mapData && mapData.edgeLabelT));
    // Legacy migration: old default (0.2) was persisted automatically.
    if (!hasMapOverride && saved === 0.2) return 0.4;
    return getClosestEdgeLabelTStop(clamp(saved, 0.2, 0.8));
  }
  return getMapEdgeLabelT(mapData);
}

// Compute a force-directed fallback layout when no manual positions are saved.
function computeAutoNodeLayout(mapData, edgeLabelT = getMapEdgeLabelT(mapData)) {
  const nodes = (mapData.nodes || []).filter((n) => (
    n &&
    typeof n.id === 'string' &&
    Number.isFinite(n.x) &&
    Number.isFinite(n.y)
  ));
  if (!nodes.length) return {};

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const validEdges = (mapData.edges || []).filter((e) => nodeById[e.from] && nodeById[e.to]);
  const edgeDirectionSet = new Set(validEdges.map((e) => `${e.from}->${e.to}`));

  const rng = createSeededRandom(`${mapData.id || 'map'}|${nodes.map((n) => n.id).sort().join('|')}`);
  const n = nodes.length;
  const canvas = { minX: 140, maxX: 2260, minY: 120, maxY: 1380 };
  const center = { x: 1200, y: 760 };

  const cx = nodes.reduce((acc, node) => acc + node.x, 0) / n;
  const cy = nodes.reduce((acc, node) => acc + node.y, 0) / n;

  const pos = {};
  const vel = {};
  nodes.forEach((node, idx) => {
    const baseAngle = (idx / n) * Math.PI * 2 + (rng() - 0.5) * 0.85;
    const ringRadius = 100 + Math.sqrt(n) * 38 + rng() * 140;
    const hasBase = Number.isFinite(node.x) && Number.isFinite(node.y);
    const bx = hasBase ? center.x + (node.x - cx) * 1.25 : center.x + Math.cos(baseAngle) * ringRadius;
    const by = hasBase ? center.y + (node.y - cy) * 1.25 : center.y + Math.sin(baseAngle) * ringRadius;
    pos[node.id] = {
      x: clamp(bx + (rng() - 0.5) * 60, canvas.minX, canvas.maxX),
      y: clamp(by + (rng() - 0.5) * 60, canvas.minY, canvas.maxY),
    };
    vel[node.id] = { x: 0, y: 0 };
  });

  const sizes = Object.fromEntries(nodes.map((node) => [node.id, estimateNodeSize(node.label)]));
  const edgeLabelDesiredGap = 150;
  const iterations = Math.min(280, Math.max(160, 110 + n * 10));

  for (let step = 0; step < iterations; step += 1) {
    const alpha = 1 - (step / iterations);
    const repulsion = 260000 * (0.35 + alpha * 0.85);
    const springK = 0.0032 + alpha * 0.0012;
    const gravityK = 0.001 + (1 - alpha) * 0.0014;

    const force = {};
    nodes.forEach((node) => {
      force[node.id] = { x: 0, y: 0 };
    });

    for (let i = 0; i < nodes.length; i += 1) {
      const ni = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const nj = nodes[j];
        const pi = pos[ni.id];
        const pj = pos[nj.id];
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const distSq = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(distSq);
        const ux = dx / dist;
        const uy = dy / dist;

        const minNodeGap = (sizes[ni.id].w + sizes[nj.id].w) * 0.36 + 44;
        let f = repulsion / distSq;
        if (dist < minNodeGap) f += (minNodeGap - dist) * 0.58;

        force[ni.id].x -= ux * f;
        force[ni.id].y -= uy * f;
        force[nj.id].x += ux * f;
        force[nj.id].y += uy * f;
      }
    }

    validEdges.forEach((edge) => {
      const p1 = pos[edge.from];
      const p2 = pos[edge.to];
      if (!p1 || !p2) return;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const ux = dx / dist;
      const uy = dy / dist;
      const hasReverseEdge = edge.from !== edge.to && edgeDirectionSet.has(`${edge.to}->${edge.from}`);
      const targetLen = hasReverseEdge ? 335 : 285;
      const f = (dist - targetLen) * springK;
      force[edge.from].x += ux * f;
      force[edge.from].y += uy * f;
      force[edge.to].x -= ux * f;
      force[edge.to].y -= uy * f;
    });

    const labelAnchors = validEdges.map((edge) => {
      const from = pos[edge.from];
      const to = pos[edge.to];
      const fromSize = sizes[edge.from];
      const toSize = sizes[edge.to];
      const path = computeEdgePath(
        { x: from.x, y: from.y, w: fromSize.w, h: fromSize.h },
        { x: to.x, y: to.y, w: toSize.w, h: toSize.h },
        { labelT: edgeLabelT }
      );
      return { edge, x: path.midX, y: path.midY };
    });

    for (let i = 0; i < labelAnchors.length; i += 1) {
      const a = labelAnchors[i];
      for (let j = i + 1; j < labelAnchors.length; j += 1) {
        const b = labelAnchors[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= edgeLabelDesiredGap) continue;

        const overlap = edgeLabelDesiredGap - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const push = overlap * 0.12;

        const aNodes = [a.edge.from, a.edge.to];
        const bNodes = [b.edge.from, b.edge.to];
        aNodes.forEach((id) => {
          if (!force[id]) return;
          force[id].x -= ux * push * 0.5;
          force[id].y -= uy * push * 0.5;
        });
        bNodes.forEach((id) => {
          if (!force[id]) return;
          force[id].x += ux * push * 0.5;
          force[id].y += uy * push * 0.5;
        });
      }
    }

    nodes.forEach((node) => {
      const p = pos[node.id];
      force[node.id].x += (center.x - p.x) * gravityK;
      force[node.id].y += (center.y - p.y) * gravityK;

      vel[node.id].x = vel[node.id].x * 0.84 + force[node.id].x;
      vel[node.id].y = vel[node.id].y * 0.84 + force[node.id].y;
      const maxStep = 18 * (0.45 + alpha * 0.7);
      const speed = Math.hypot(vel[node.id].x, vel[node.id].y);
      if (speed > maxStep) {
        vel[node.id].x = (vel[node.id].x / speed) * maxStep;
        vel[node.id].y = (vel[node.id].y / speed) * maxStep;
      }

      p.x = clamp(p.x + vel[node.id].x, canvas.minX, canvas.maxX);
      p.y = clamp(p.y + vel[node.id].y, canvas.minY, canvas.maxY);
    });
  }

  return pos;
}

// ─── Custom hook for drag-on-canvas ─────────────────────────────────────────
function useNodeDrag(onMove, onEnd) {
  const stateRef = useRef2(null);
  const start = useCallback2((e, nodeId, startX, startY) => {
    e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const isTouchEvent = !!e.touches;
    const point = isTouchEvent ? e.touches[0] : e;
    if (!point) return;
    stateRef.current = {
      nodeId,
      startX, startY,
      mouseX: point.clientX, mouseY: point.clientY,
      moved: false,
    };
    function applyMove(clientX, clientY) {
      if (!stateRef.current) return;
      const dx = clientX - stateRef.current.mouseX;
      const dy = clientY - stateRef.current.mouseY;
      if (Math.abs(dx) + Math.abs(dy) > 3) stateRef.current.moved = true;
      onMove(nodeId, startX + dx, startY + dy);
    }

    function move(ev) {
      applyMove(ev.clientX, ev.clientY);
    }

    function touchMove(ev) {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      ev.preventDefault();
      applyMove(t.clientX, t.clientY);
    }

    function up() {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      const moved = stateRef.current?.moved;
      stateRef.current = null;
      if (onEnd) onEnd(nodeId, moved);
    }

    if (isTouchEvent) {
      window.addEventListener('touchmove', touchMove, { passive: false });
      window.addEventListener('touchend', up);
      window.addEventListener('touchcancel', up);
      return;
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
  const touchStateRef = useRef2(null);
  useEffect2(() => { tRef.current = t; }, [t]);

  const onWheel = useCallback2((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (!e.ctrlKey && !e.metaKey) {
      // pan with wheel
      setT(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      e.preventDefault();
    } else {
      e.preventDefault();
      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      setT(prev => {
        const baseScale = Number.isFinite(prev.scale) && prev.scale > 0 ? prev.scale : 1;
        const newScale = Math.max(0.4, Math.min(2.5, baseScale * zoomFactor));
        // zoom around mouse
        const wx = (mx - prev.x) / baseScale;
        const wy = (my - prev.y) / baseScale;
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

  function getTouchCenter(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }

  function getTouchDistance(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  const onTouchStart = useCallback2((e) => {
    if (e.target.closest('.node-card') || e.target.closest('.edge-label-badge') || e.target.closest('.inspector') || e.target.closest('.admin-toolbar')) return;
    if (e.touches.length === 2) {
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      touchStateRef.current = {
        mode: 'pinch',
        startDist: getTouchDistance(e.touches[0], e.touches[1]),
        startScale: tRef.current.scale,
        startX: tRef.current.x,
        startY: tRef.current.y,
        center,
      };
      return;
    }

    if (e.touches.length === 1) {
      touchStateRef.current = {
        mode: 'pan',
        startTouchX: e.touches[0].clientX,
        startTouchY: e.touches[0].clientY,
        startX: tRef.current.x,
        startY: tRef.current.y,
      };
    }
  }, []);

  const onTouchMove = useCallback2((e) => {
    const touchState = touchStateRef.current;
    if (!touchState) return;

    if (touchState.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches[0], e.touches[1]);
      const ratio = touchState.startDist > 0 ? (newDist / touchState.startDist) : 1;
      const newScale = Math.max(0.4, Math.min(2.5, touchState.startScale * ratio));
      const scaleRatio = newScale / touchState.startScale;
      setT({
        scale: newScale,
        x: touchState.center.x - (touchState.center.x - touchState.startX) * scaleRatio,
        y: touchState.center.y - (touchState.center.y - touchState.startY) * scaleRatio,
      });
      return;
    }

    if (touchState.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - touchState.startTouchX;
      const dy = e.touches[0].clientY - touchState.startTouchY;
      setT({
        ...tRef.current,
        x: touchState.startX + dx,
        y: touchState.startY + dy,
      });
    }
  }, []);

  const onTouchEnd = useCallback2((e) => {
    if (e.touches.length === 0) {
      touchStateRef.current = null;
      return;
    }

    if (e.touches.length === 1) {
      touchStateRef.current = {
        mode: 'pan',
        startTouchX: e.touches[0].clientX,
        startTouchY: e.touches[0].clientY,
        startX: tRef.current.x,
        startY: tRef.current.y,
      };
      return;
    }

    if (e.touches.length === 2) {
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      touchStateRef.current = {
        mode: 'pinch',
        startDist: getTouchDistance(e.touches[0], e.touches[1]),
        startScale: tRef.current.scale,
        startX: tRef.current.x,
        startY: tRef.current.y,
        center,
      };
    }
  }, []);

  return { t, setT, onWheel, startPan, onTouchStart, onTouchMove, onTouchEnd };
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

function formatEdgeLabelT(value) {
  return Number(value).toFixed(2).replace(/0+$/,'').replace(/\.$/, '');
}

// ─── ConceptMap (Student view) ───────────────────────────────────────────────
function ConceptMap({ mapData, progress, onProgress, positions, onPositions }) {
  const [activeEdge, setActiveEdge] = useState2(null);
  const [showComplete, setShowComplete] = useState2(false);
  const [isHelpOpen, setIsHelpOpen] = useState2(false);
  const [edgeLabelT, setEdgeLabelT] = useState2(() => {
    const saved = window.localStorage.getItem(`cm:edgeLabelT:${mapData.id}`);
    return resolveInitialEdgeLabelT(mapData, saved);
  });
  const viewportRef = useRef2(null);
  const { t, setT, onWheel, startPan, onTouchStart, onTouchMove, onTouchEnd } = usePanZoom();

  const answeredEdges = progress.answeredEdges || new Set();
  const validNodes = mapData.nodes.filter((n) => (
    n &&
    typeof n.id === 'string' &&
    Number.isFinite(n.x) &&
    Number.isFinite(n.y)
  ));

  // local node positions: positions[mapId][nodeId] = {x, y}
  const mapPositions = positions[mapData.id] || {};
  const autoLayout = useMemo2(() => computeAutoNodeLayout(mapData, edgeLabelT), [mapData, edgeLabelT]);
  // Effective node coords: stored override, else from data
  function nodeXY(node) {
    const p = mapPositions[node.id];
    const a = autoLayout[node.id];
    return p ? { x: p.x, y: p.y } : a ? { x: a.x, y: a.y } : { x: node.x, y: node.y };
  }

  // Persist a node drag result for this map only.
  function setNodeXY(nodeId, x, y) {
    const newMapPos = { ...mapPositions, [nodeId]: { x, y } };
    onPositions({ ...positions, [mapData.id]: newMapPos });
  }

  // Compute unlocked nodes from starts + correctly answered inbound relationships.
  function getUnlockedNodes(answeredSet) {
    const unlocked = new Set(validNodes.filter(n => n.isStart).map(n => n.id));
    mapData.edges.forEach(e => {
      if (answeredSet.has(e.id)) unlocked.add(e.to);
    });
    return unlocked;
  }

  const unlockedNodes = getUnlockedNodes(answeredEdges);

  // Open question popup only when relationship is available and unanswered.
  function handleEdgeClick(edge) {
    if (answeredEdges.has(edge.id)) return;
    if (!unlockedNodes.has(edge.from)) return;
    setActiveEdge(edge);
  }

  // Mark an edge as answered and trigger completion celebration when done.
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

  // Reset camera transform to default framing.
  function fitToScreen() {
    setT({ x: 60, y: 80, scale: 1 });
  }

  // Push nodes outward from centroid to quickly increase spacing.
  function spreadNodes() {
    if (!validNodes.length) return;
    const points = validNodes.map((n) => {
      const xy = nodeXY(n);
      return { id: n.id, x: xy.x, y: xy.y };
    });
    const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;
    const factor = 1.45;
    const fallbackRadius = 200;
    const nextPos = { ...mapPositions };
    points.forEach((p, i) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.hypot(dx, dy) < 1) {
        const angle = (i / points.length) * Math.PI * 2;
        nextPos[p.id] = { x: cx + Math.cos(angle) * fallbackRadius, y: cy + Math.sin(angle) * fallbackRadius };
      } else {
        nextPos[p.id] = { x: cx + dx * factor, y: cy + dy * factor };
      }
    });
    onPositions({ ...positions, [mapData.id]: nextPos });
  }

  // Pull nodes inward toward centroid while keeping minimum spacing.
  function compactNodes() {
    if (!validNodes.length) return;
    const points = validNodes.map((n) => {
      const xy = nodeXY(n);
      return { id: n.id, x: xy.x, y: xy.y };
    });
    const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;
    const factor = 0.68;
    const minDist = 25;
    const fallbackRadius = 25;
    const nextPos = { ...mapPositions };
    points.forEach((p, i) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        const angle = (i / points.length) * Math.PI * 2;
        nextPos[p.id] = { x: cx + Math.cos(angle) * fallbackRadius, y: cy + Math.sin(angle) * fallbackRadius };
      } else {
        const newDist = Math.max(minDist, dist * factor);
        nextPos[p.id] = { x: cx + (dx / dist) * newDist, y: cy + (dy / dist) * newDist };
      }
    });
    onPositions({ ...positions, [mapData.id]: nextPos });
  }

  // Remove manual node positions so auto-layout takes over again.
  function resetLayout() {
    const next = { ...positions };
    delete next[mapData.id];
    onPositions(next);
  }

  // Build node geometry map for edge routing
  const geom = {};
  validNodes.forEach(n => {
    const xy = nodeXY(n);
    const sz = estimateNodeSize(n.label);
    geom[n.id] = { x: xy.x, y: xy.y, w: sz.w, h: sz.h };
  });
  const edgeDirectionSet = new Set(mapData.edges.map(e => `${e.from}->${e.to}`));

  const totalEdges = mapData.edges.length;
  const completed = answeredEdges.size;
  const progressPct = Math.round((completed / totalEdges) * 100);

  const fromNode = activeEdge ? validNodes.find(n => n.id === activeEdge.from) : null;
  const toNode = activeEdge ? validNodes.find(n => n.id === activeEdge.to) : null;

  useEffect2(() => {
    const saved = window.localStorage.getItem(`cm:edgeLabelT:${mapData.id}`);
    const next = resolveInitialEdgeLabelT(mapData, saved);
    setEdgeLabelT(next);
  }, [mapData.id]);

  useEffect2(() => {
    window.localStorage.setItem(`cm:edgeLabelT:${mapData.id}`, String(edgeLabelT));
  }, [mapData.id, edgeLabelT]);

  useEffect2(() => {
    let cancelled = false;
    let attempts = 0;

    function typesetViewport() {
      if (cancelled || !viewportRef.current) return;
      if (window.MathJax && window.MathJax.typesetPromise) {
        if (window.MathJax.typesetClear) window.MathJax.typesetClear([viewportRef.current]);
        window.MathJax.typesetPromise([viewportRef.current]).catch(() => {});
        return;
      }
      if (attempts < 300) {
        attempts += 1;
        setTimeout(typesetViewport, 100);
      }
    }

    const raf = requestAnimationFrame(typesetViewport);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [mapData.id, validNodes.length, mapData.edges.length, answeredEdges.size]);

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
          <button className="icon-btn" onClick={spreadNodes} title="Spread nodes apart">⊕</button>
          <button className="icon-btn" onClick={compactNodes} title="Pull nodes inward">⊖</button>
          <button className="icon-btn" onClick={resetLayout} title="Reset node layout to auto placement">⟲</button>
          <label className="edge-label-slider" title={`Label anchor: ${edgeLabelT.toFixed(2)}`}>
            <span className="edge-label-slider-text">Label</span>
            <input
              type="range"
              min="0"
              max={String(EDGE_LABEL_T_STOPS.length - 1)}
              step="1"
              value={String(EDGE_LABEL_T_STOPS.findIndex((stop) => stop === edgeLabelT))}
              onChange={(e) => {
                const index = clamp(Number(e.target.value), 0, EDGE_LABEL_T_STOPS.length - 1);
                setEdgeLabelT(EDGE_LABEL_T_STOPS[index]);
              }}
            />
            <span className="edge-label-slider-value">{formatEdgeLabelT(edgeLabelT)}</span>
          </label>
        </div>
      </div>

      <div
        className="map-viewport"
        ref={viewportRef}
        onWheel={onWheel}
        onMouseDown={startPan}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
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
              const path = computeEdgePath(f, to, { labelT: edgeLabelT });
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
            const path = computeEdgePath(f, to, { labelT: edgeLabelT });
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
                    ? <>✓ <MathNode text={`${edge.label} ${edge.answer}`} /></>
                    : <><MathNode text={edge.label} /> <span style={{fontSize: 11, marginLeft: 6}}>✏️</span></>
                  }
                </div>
              </div>
            );
          })}

          {/* Nodes */}
          {validNodes.map(node => {
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
                onTouchStart={(e) => {
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

        <div
          className={`mini-help ${isHelpOpen ? 'open' : 'collapsed'}`}
          role="button"
          tabIndex={0}
          aria-expanded={isHelpOpen}
          onClick={() => setIsHelpOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsHelpOpen((v) => !v);
            }
          }}
        >
          <div className="mini-help-title-row">
            <strong>Quick guide</strong>
            <span className="mini-help-caret">{isHelpOpen ? '▾' : '▸'}</span>
          </div>
          <div className="mini-help-body">
            Select a topic from the sidebar, then tap any glowing relationship label to answer it. Drag nodes to arrange the map in a way that helps you study. On touch devices, drag the background to pan and pinch to zoom. On desktop, use the mouse wheel to pan and <kbd>Ctrl</kbd>+wheel to zoom. Use the Label slider to move arrow labels along edges in discrete 0.1 steps. Use <kbd>⊕</kbd> to spread nodes out, <kbd>⊖</kbd> to bring them closer together, and <kbd>⟲</kbd> to rebuild the automatic layout.
          </div>
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
              You completed all {totalEdges} relationships in<br/>
              <strong>{mapData.title}</strong>
            </div>
            <div className="stars">
              <span className="star">⭐</span>
              <span className="star">⭐</span>
              <span className="star">⭐</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowComplete(false)}>Keep exploring</button>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ConceptMap, estimateNodeSize, useNodeDrag, usePanZoom, ZoomControl, nodeBg, nodeBorder });
