// Admin Canvas — visual drag-and-drop concept map builder
// Exposes: AdminCanvas, MapsManager

const { useState: useStateA, useRef: useRefA, useEffect: useEffectA, useMemo: useMemoA } = React;

const NODE_COLOR_PALETTE = [
  '#4f8ef7', // blue
  '#34d399', // teal
  '#f59e0b', // amber
  '#fb7185', // rose
  '#a78bfa', // purple
  '#06b6d4', // cyan
  '#f472b6', // pink
];

function adminMapPublishPath(mapData) {
  const subjectId = typeof mapData?.subjectId === 'string' && mapData.subjectId.trim()
    ? mapData.subjectId.trim()
    : 'general';
  return `data/maps/${subjectId}/${mapData.id}.json`;
}

// Validate graph reachability so authoring mistakes are visible in admin.
function auditUnlockGraph(mapData) {
  const nodes = Array.isArray(mapData?.nodes) ? mapData.nodes : [];
  const edges = Array.isArray(mapData?.edges) ? mapData.edges : [];
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const startIds = nodes.filter((node) => node.isStart).map((node) => node.id);
  const seedIds = startIds.length > 0 ? startIds : (nodes[0] ? [nodes[0].id] : []);

  const invalidEdges = edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to));
  const validEdges = edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  const reachable = new Set(seedIds);
  const queue = [...seedIds];
  while (queue.length > 0) {
    const current = queue.shift();
    validEdges.forEach((edge) => {
      if (edge.from !== current || reachable.has(edge.to)) return;
      reachable.add(edge.to);
      queue.push(edge.to);
    });
  }

  const unreachableNodes = nodes.filter((node) => !reachable.has(node.id));
  const likelyReversedEdges = validEdges.filter((edge) => reachable.has(edge.to) && !reachable.has(edge.from));

  const issues = [];
  if (nodes.length > 0 && startIds.length === 0) {
    issues.push('No start node is marked. Students can still begin from the first node, but marking a start node is recommended.');
  }
  if (invalidEdges.length > 0) {
    issues.push(`${invalidEdges.length} edge(s) reference missing node ids and will be ignored.`);
  }
  if (unreachableNodes.length > 0) {
    issues.push(`Unreachable node(s): ${unreachableNodes.map((node) => node.label || node.id).join(', ')}.`);
  }
  if (likelyReversedEdges.length > 0) {
    const sample = likelyReversedEdges.slice(0, 4).map((edge) => {
      const fromLabel = nodeById[edge.from]?.label?.split('\\n')[0] || edge.from;
      const toLabel = nodeById[edge.to]?.label?.split('\\n')[0] || edge.to;
      return `${edge.id}: ${fromLabel} -> ${toLabel}`;
    }).join(' | ');
    issues.push(`Possible reversed arrow direction on: ${sample}${likelyReversedEdges.length > 4 ? ' | ...' : ''}`);
  }

  return { issues, unreachableNodes, invalidEdges, likelyReversedEdges };
}

function getUnlockBlockingIssues(audit) {
  const blockers = [];
  if ((audit?.unreachableNodes || []).length > 0) {
    blockers.push('Map has unreachable nodes.');
  }
  if ((audit?.invalidEdges || []).length > 0) {
    blockers.push('Map has edge(s) pointing to missing node ids.');
  }
  return blockers;
}

// ─── AdminCanvas: Visual builder for one concept map ──────────────────────────
function AdminCanvas({ mapData, onChange, onBack, onDelete, onExport, onTogglePublish }) {
  const [tool, setTool] = useStateA('select'); // 'select' | 'addNode' | 'connect'
  const [selectedNodeId, setSelectedNodeId] = useStateA(null);
  const [selectedEdgeId, setSelectedEdgeId] = useStateA(null);
  const [connectSource, setConnectSource] = useStateA(null);
  const [hoverNode, setHoverNode] = useStateA(null);
  const [isHelpOpen, setIsHelpOpen] = useStateA(false);
  const [activeColor, setActiveColor] = useStateA(NODE_COLOR_PALETTE[0]);
  const viewportRef = useRefA(null);
  const { t, setT, onWheel, startPan, onTouchStart, onTouchMove, onTouchEnd } = usePanZoom();
  const unlockAudit = useMemoA(() => auditUnlockGraph(mapData), [mapData]);
  const unlockBlockingIssues = useMemoA(() => getUnlockBlockingIssues(unlockAudit), [unlockAudit]);
  const isPublishExportBlocked = unlockBlockingIssues.length > 0;

  // ── Update helpers ──
  // Patch one node and push updated map to parent state.
  function updateNode(id, patch) {
    const newNodes = mapData.nodes.map(n => n.id === id ? { ...n, ...patch } : n);
    onChange({ ...mapData, nodes: newNodes });
  }
  // Delete node and any edges connected to it.
  function deleteNode(id) {
    const newNodes = mapData.nodes.filter(n => n.id !== id);
    const newEdges = mapData.edges.filter(e => e.from !== id && e.to !== id);
    onChange({ ...mapData, nodes: newNodes, edges: newEdges });
    setSelectedNodeId(null);
  }
  // Add a brand-new node at canvas coordinates.
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
  // Patch one edge and push updated map to parent state.
  function updateEdge(id, patch) {
    const newEdges = mapData.edges.map(e => e.id === id ? { ...e, ...patch } : e);
    onChange({ ...mapData, edges: newEdges });
  }
  // Delete one edge from map.
  function deleteEdge(id) {
    onChange({ ...mapData, edges: mapData.edges.filter(e => e.id !== id) });
    setSelectedEdgeId(null);
  }
  // Create a directed edge between two nodes if valid and non-duplicate.
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
  // Handle empty-canvas clicks based on active admin tool.
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

  // Handle node clicks for select/connect workflows.
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
          <button className="icon-btn" onClick={onBack} title="Return to the admin map list">←</button>
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
              title="Choose a color for new nodes, or recolor the selected node"
            ></div>
          ))}
        </div>
        <div className="admin-tool-divider"></div>
        <button className="admin-tool-btn" onClick={onBack} title="Save this map and return to the admin map list">💾 Save & Exit</button>
        {typeof onExport === 'function' && (
          <button
            className="admin-tool-btn"
            onClick={() => {
              if (isPublishExportBlocked) {
                window.alert(`Cannot export this map yet:\n\n- ${unlockBlockingIssues.join('\n- ')}`);
                return;
              }
              onExport(mapData.id, mapData);
            }}
            title="Download this map as a JSON file so it can be added to the repository"
            disabled={isPublishExportBlocked}
          >
            ⭳ Export JSON
          </button>
        )}
        <span style={{ fontSize: 11, opacity: 0.72 }}>
          Publish path: {adminMapPublishPath(mapData)}
        </span>
        {typeof onTogglePublish === 'function' && (
          <button
            className={`admin-tool-btn ${mapData._published ? 'active' : ''}`}
            onClick={() => {
              const nextPublished = !mapData._published;
              if (nextPublished && isPublishExportBlocked) {
                window.alert(`Cannot publish this map yet:\n\n- ${unlockBlockingIssues.join('\n- ')}`);
                return;
              }
              onTogglePublish(nextPublished);
            }}
            title="Choose whether this local map appears in the student sidebar"
            disabled={!mapData._published && isPublishExportBlocked}
          >
            {mapData._published ? '📣 Published' : '📝 Draft'}
          </button>
        )}
        {typeof onDelete === 'function' && (
          <button
            className="admin-tool-btn"
            onClick={() => onDelete(mapData.id)}
            title="Delete this custom map from local admin storage"
            style={{ color: 'var(--accent-rose)' }}
          >
            🗑 Delete Map
          </button>
        )}
      </div>

      {unlockAudit.issues.length > 0 && (
        <div
          className="admin-unlock-audit"
          style={{
            margin: '8px 14px 0',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(245, 158, 11, 0.55)',
            background: 'rgba(245, 158, 11, 0.12)',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Unlock graph warnings</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.35 }}>
            {unlockAudit.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`map-viewport ${tool === 'addNode' ? 'placing-node' : ''}`}
        ref={viewportRef}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (tool === 'select' || tool === 'connect') startPan(e);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
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
                  <MathNode text={edge.label} />
                  <span style={{color: 'var(--accent-teal)'}}><MathNode text={`✓ ${edge.answer}`} /></span>
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
                onTouchStart={(e) => {
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
            <div>Choose <strong>+ Node</strong>, then click anywhere on the canvas to place your first concept.</div>
          </div>
        )}

        <ZoomControl
          scale={t.scale}
          setScale={(fn) => setT(prev => ({...prev, scale: typeof fn === 'function' ? fn(prev.scale) : fn}))}
        />

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
            <strong>Builder guide</strong>
            <span className="mini-help-caret">{isHelpOpen ? '▾' : '▸'}</span>
          </div>
          <div className="mini-help-body">
            Start with <kbd>+ Node</kbd>, then click the canvas to add concepts. Use <kbd>→ Connect</kbd>, then click two nodes to draw a relationship. Switch back to <kbd>↖ Select</kbd> to drag items, open node details, or delete something. Click any edge label to edit the prompt, answer, and hint students will see.
          </div>
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
            <div className="field-help">Use <code>\(…\)</code> for inline math and <code>\\n</code> to split the label across lines.</div>
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
            Position: ({Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}) - drag the node on the canvas to reposition it
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
            <div className="field-label">Prompt text (shown before the blank)</div>
            <input
              className="field-input"
              value={selectedEdge.label}
              onChange={e => updateEdge(selectedEdge.id, { label: e.target.value })}
              placeholder="Example: is an example of"
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
              placeholder="Enter the correct word or phrase"
            />
          </div>
          {selectedEdge.type === 'dropdown' && (
            <div className="field">
              <div className="field-label">Dropdown options (one per line, including the correct answer)</div>
              <textarea
                className="field-textarea"
                rows={4}
                value={(selectedEdge.options || []).join('\n')}
                onChange={e => updateEdge(selectedEdge.id, { options: e.target.value.split('\n').filter(o => o.trim()) })}
              />
            </div>
          )}
          <div className="field">
            <div className="field-label">Hint (shown after 2 incorrect attempts)</div>
            <textarea
              className="field-textarea"
              rows={2}
              value={selectedEdge.hint || ''}
              onChange={e => updateEdge(selectedEdge.id, { hint: e.target.value })}
              placeholder="Optional hint; LaTeX is supported"
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
function MapsManager({
  allMaps,
  builtInMaps,
  orderedMapIds,
  subjects,
  selectedSubjectId,
  customMaps,
  onEdit,
  onCreate,
  onCreateSubject,
  onExportMap,
  onExportManifest,
  onReorderMap,
  onMoveToSubject,
  onImportMap,
  onTogglePublish,
  onRevertToBuiltIn,
}) {
  const [draggedId, setDraggedId] = useStateA(null);
  const [dragOverId, setDragOverId] = useStateA(null);
  const [activeFilter, setActiveFilter] = useStateA('all'); // all | builtin | custom | draft
  const [isOverflowOpen, setIsOverflowOpen] = useStateA(false);
  const overflowWrapRef = useRefA(null);

  const activeSubjectId = selectedSubjectId || 'all';
  const allSubjects = Array.isArray(subjects) ? subjects : [];
  const subjectById = Object.fromEntries(allSubjects.map((subject) => [subject.id, subject]));

  const displayOrder = (Array.isArray(orderedMapIds) ? orderedMapIds : Object.keys(allMaps || {}))
    .filter(id => !!allMaps[id])
    .filter((id) => {
      if (activeSubjectId === 'all') return true;
      const mapData = allMaps[id];
      const mapSubjectId = typeof mapData?.subjectId === 'string' && mapData.subjectId.trim()
        ? mapData.subjectId.trim()
        : 'general';
      return mapSubjectId === activeSubjectId;
    });

  const visibleMapIds = displayOrder.filter((mapId) => {
    const mapData = allMaps[mapId];
    if (!mapData) return false;
    const isCustom = !!customMaps?.[mapId];
    if (activeFilter === 'builtin') return !isCustom;
    if (activeFilter === 'custom') return isCustom;
    if (activeFilter === 'draft') return isCustom && !mapData._published;
    return true;
  });

  const selectedTitle = activeSubjectId === 'all'
    ? 'All Maps'
    : (subjectById[activeSubjectId]?.title || allMaps[displayOrder[0]]?.subjectTitle || 'Subject');

  const selectionStats = displayOrder.reduce((acc, mapId) => {
    const isCustom = !!customMaps?.[mapId];
    if (isCustom) acc.local += 1;
    else acc.builtIn += 1;
    return acc;
  }, { builtIn: 0, local: 0 });

  const subjectIcon = activeSubjectId === 'all' ? '≡' : '•';

  useEffectA(() => {
    if (!isOverflowOpen) return undefined;

    function handlePointerDown(event) {
      if (!overflowWrapRef.current) return;
      if (!overflowWrapRef.current.contains(event.target)) {
        setIsOverflowOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOverflowOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOverflowOpen]);

  function handleCreateForCurrentSubject() {
    if (typeof onCreate !== 'function') return;
    const createSubjectId = activeSubjectId === 'all'
      ? (allMaps[displayOrder[0]]?.subjectId || 'general')
      : activeSubjectId;
    onCreate(createSubjectId);
  }

  return (
    <div className="maps-manager option-b">
      <div className="maps-manager-subject-header">
        <div className="maps-manager-subject-left">
          <div className="maps-manager-subject-icon" aria-hidden="true">{subjectIcon}</div>
          <div>
            <div className="maps-manager-subject-title">{selectedTitle}</div>
            <div className="maps-manager-subject-meta">
              {displayOrder.length} maps · {selectionStats.builtIn} built-in · {selectionStats.local} local
            </div>
          </div>
        </div>
        <div className="maps-manager-actions">
          <button className="btn btn-ghost btn-sm" onClick={onImportMap}>Import Map JSON</button>
          <button className="btn btn-primary btn-sm" onClick={handleCreateForCurrentSubject}>+ New Map</button>
          <div className="maps-manager-overflow-wrap" ref={overflowWrapRef}>
            <button
              className="btn btn-ghost btn-sm maps-manager-overflow-btn"
              onClick={() => setIsOverflowOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
              title="More actions"
            >
              ⋯
            </button>
            {isOverflowOpen && (
              <div className="maps-manager-overflow-menu" role="menu">
                {typeof onExportManifest === 'function' && (
                  <button
                    className="maps-manager-overflow-item"
                    role="menuitem"
                    onClick={() => {
                      onExportManifest();
                      setIsOverflowOpen(false);
                    }}
                  >
                    Export Folder Manifest
                  </button>
                )}
                <div className="maps-manager-overflow-divider" aria-hidden="true"></div>
                <button
                  className="maps-manager-overflow-item danger"
                  role="menuitem"
                  onClick={() => {
                    const confirmed = window.confirm(
                      'Reset local storage for this site?\n\nThis will erase all saved progress, custom maps, and settings stored by Concept Mapper in this browser — simulating a first-time visit. Only data for this site is affected.\n\nThis cannot be undone.'
                    );
                    if (confirmed) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                >
                  Reset Local Storage
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="maps-manager-filter-bar">
        <span className="maps-manager-filter-label">Show:</span>
        <button
          className={`maps-manager-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          className={`maps-manager-filter-chip ${activeFilter === 'builtin' ? 'active' : ''}`}
          onClick={() => setActiveFilter('builtin')}
        >
          Built-in
        </button>
        <button
          className={`maps-manager-filter-chip ${activeFilter === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveFilter('custom')}
        >
          Custom
        </button>
        <button
          className={`maps-manager-filter-chip ${activeFilter === 'draft' ? 'active' : ''}`}
          onClick={() => setActiveFilter('draft')}
        >
          Draft
        </button>
      </div>

      <div className="maps-manager-rows">
        {visibleMapIds.map((mapId) => {
          const m = allMaps[mapId];
          if (!m) return null;
          const rowAudit = auditUnlockGraph(m);
          const rowBlockers = getUnlockBlockingIssues(rowAudit);
          const isRowPublishExportBlocked = rowBlockers.length > 0;
          const isCustom = !!customMaps?.[m.id];
          const hasBuiltInVersion = !!builtInMaps?.[m.id];
          return (
            <div
              key={m.id}
              className="maps-manager-row"
              style={{
                '--row-color': m.color,
                outline: dragOverId === m.id ? '2px dashed var(--accent-amber)' : 'none',
                opacity: draggedId === m.id ? 0.58 : 1,
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDraggedId(m.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== m.id) setDragOverId(m.id);
              }}
              onDragLeave={() => {
                if (dragOverId === m.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && draggedId !== m.id && typeof onReorderMap === 'function') {
                  onReorderMap(draggedId, m.id);
                }
                setDragOverId(null);
                setDraggedId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onClick={() => onEdit(m.id)}
            >
              <div className="maps-manager-row-drag" title="Drag to reorder maps">
                <span></span><span></span><span></span>
              </div>

              <div className="maps-manager-row-dot" style={{ background: m.color }}></div>

              <div className="maps-manager-row-info">
                <div className="maps-manager-row-title">{m.title}</div>
                <div className="maps-manager-row-desc">{m.description}</div>
              </div>

              <div className="maps-manager-row-stats" aria-label="Map stats">
                <div className="maps-manager-row-stat"><strong>{m.nodes.length}</strong> nodes</div>
                <div className="maps-manager-row-stat"><strong>{m.edges.length}</strong> edges</div>
              </div>

              <div className="maps-manager-row-badges">
                {!isCustom && <span className="maps-manager-status-badge builtin">Built-in</span>}
                {isCustom && (
                  <span className={`maps-manager-status-badge ${m._published ? 'published' : 'draft'}`}>
                    {m._published ? 'Published' : 'Draft'}
                  </span>
                )}
              </div>

              <div className="maps-manager-row-actions" onClick={(e) => e.stopPropagation()}>
                {isCustom && typeof onTogglePublish === 'function' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const nextPublished = !m._published;
                      if (nextPublished && isRowPublishExportBlocked) {
                        window.alert(`Cannot publish this map yet:\n\n- ${rowBlockers.join('\n- ')}`);
                        return;
                      }
                      onTogglePublish(m.id, nextPublished);
                    }}
                    disabled={!m._published && isRowPublishExportBlocked}
                  >
                    {m._published ? 'Unpublish' : 'Publish'}
                  </button>
                )}
                {isCustom && hasBuiltInVersion && typeof onRevertToBuiltIn === 'function' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onRevertToBuiltIn(m.id)}
                  >
                    Revert
                  </button>
                )}
                {typeof onExportMap === 'function' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (isRowPublishExportBlocked) {
                        window.alert(`Cannot export this map yet:\n\n- ${rowBlockers.join('\n- ')}`);
                        return;
                      }
                      onExportMap(m.id);
                    }}
                    disabled={isRowPublishExportBlocked}
                  >
                    Export
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m.id)}>Open</button>
              </div>
            </div>
          );
        })}

        {visibleMapIds.length === 0 && (
          <div
            className="maps-manager-empty"
          >
            No maps match this filter in the current subject.
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AdminCanvas, MapsManager, NODE_COLOR_PALETTE });
