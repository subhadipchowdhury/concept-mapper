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

  // Reset camera transform in admin editor.
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
            onClick={() => onExport(mapData.id, mapData)}
            title="Download this map as a JSON file so it can be added to the repository"
          >
            ⭳ Export JSON
          </button>
        )}
        <span style={{ fontSize: 11, opacity: 0.72 }}>
          Publish path: data/maps/{mapData.id}.json
        </span>
        {typeof onTogglePublish === 'function' && (
          <button
            className={`admin-tool-btn ${mapData._published ? 'active' : ''}`}
            onClick={() => onTogglePublish(!mapData._published)}
            title="Choose whether this local map appears in the student sidebar"
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
          fitToScreen={fitToScreen}
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
  const [dragOverSubjectId, setDragOverSubjectId] = useStateA(null);

  const displayOrder = (Array.isArray(orderedMapIds) ? orderedMapIds : Object.keys(allMaps || {}))
    .filter(id => !!allMaps[id]);

  const folderSeed = (Array.isArray(subjects) && subjects.length > 0)
    ? subjects
    : [{ id: 'general', title: 'General' }];

  const sectionsById = {};
  const sectionOrder = [];

  folderSeed.forEach((folder) => {
    if (!folder || typeof folder.id !== 'string') return;
    sectionsById[folder.id] = {
      id: folder.id,
      title: folder.title || folder.id,
      mapIds: [],
    };
    sectionOrder.push(folder.id);
  });

  displayOrder.forEach((mapId) => {
    const mapData = allMaps[mapId];
    if (!mapData) return;
    const subjectId = typeof mapData.subjectId === 'string' && mapData.subjectId.trim()
      ? mapData.subjectId.trim()
      : 'general';
    if (!sectionsById[subjectId]) {
      sectionsById[subjectId] = {
        id: subjectId,
        title: mapData.subjectTitle || subjectId,
        mapIds: [],
      };
      sectionOrder.push(subjectId);
    }
    sectionsById[subjectId].mapIds.push(mapId);
  });

  const sections = sectionOrder
    .map((id) => sectionsById[id])
    .filter(Boolean);

  // Prompt for a new subject folder name and create it.
  function createFolderFromPrompt() {
    if (typeof onCreateSubject !== 'function') return;
    const title = prompt('Enter a folder name for this subject group:');
    if (title === null) return;
    const cleaned = title.trim();
    if (!cleaned) return;
    onCreateSubject(cleaned);
  }

  return (
    <div className="maps-manager">
      <div className="maps-manager-header">
        <div>
          <div className="maps-manager-title">Admin · Concept Maps</div>
          <div className="maps-manager-sub">Organize maps by subject folder, open any card to edit it, and drag cards to reorder or move them. When you are ready to publish changes, export the map JSON and, if folders changed, export the manifest too.</div>
        </div>
        <div className="maps-manager-actions">
          <button className="btn btn-ghost btn-sm" onClick={onImportMap}>Import Map JSON</button>
          {typeof onExportManifest === 'function' && (
            <button className="btn btn-ghost btn-sm" onClick={onExportManifest}>Export Folder Manifest</button>
          )}
          {typeof onCreateSubject === 'function' && (
            <button className="btn btn-ghost btn-sm" onClick={createFolderFromPrompt}>New Subject Folder</button>
          )}
        </div>
      </div>
      <div className="folder-sections">
        {sections.map((section) => (
          <div
            key={section.id}
            className={`folder-section ${dragOverSubjectId === section.id ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverSubjectId !== section.id) setDragOverSubjectId(section.id);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              if (dragOverSubjectId === section.id) setDragOverSubjectId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId && typeof onMoveToSubject === 'function') {
                onMoveToSubject(draggedId, section.id);
              }
              setDragOverSubjectId(null);
              setDragOverId(null);
              setDraggedId(null);
            }}
          >
            <div className="folder-section-header">
              <div>
                <div className="folder-section-title">{section.title}</div>
                <div className="folder-section-meta">{section.mapIds.length} map{section.mapIds.length === 1 ? '' : 's'}</div>
              </div>
              {typeof onCreate === 'function' && (
                <button className="btn btn-ghost btn-sm" onClick={() => onCreate(section.id)}>
                  New Map
                </button>
              )}
            </div>

            <div className="maps-grid">
              {section.mapIds.map((mapId) => {
                const m = allMaps[mapId];
                if (!m) return null;
                const isCustom = !!customMaps[m.id];
                const hasBuiltInVersion = !!builtInMaps?.[m.id];
                return (
                  <div
                    key={m.id}
                    className="maps-grid-card"
                    style={{
                      '--card-color': m.color,
                      outline: dragOverId === m.id ? '2px dashed var(--accent-amber)' : 'none',
                      opacity: draggedId === m.id ? 0.55 : 1,
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
                      if (draggedId && draggedId !== m.id) {
                        if (typeof onMoveToSubject === 'function') {
                          onMoveToSubject(draggedId, section.id);
                        }
                        if (typeof onReorderMap === 'function') {
                          onReorderMap(draggedId, m.id);
                        }
                      }
                      setDragOverSubjectId(null);
                      setDragOverId(null);
                      setDraggedId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                      setDragOverSubjectId(null);
                    }}
                    onClick={() => onEdit(m.id)}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        marginBottom: 6,
                        userSelect: 'none',
                        letterSpacing: 0.2,
                      }}
                      title="Drag to reorder or move maps between folders"
                    >
                      ⋮⋮ Drag to reorder or move between folders
                    </div>
                    <div className="maps-grid-card-title">{m.title}</div>
                    <div className="maps-grid-card-meta">{m.description}</div>
                    <div className="maps-grid-card-stats">
                      <div className="maps-grid-card-stat"><span>{m.nodes.length}</span> nodes</div>
                      <div className="maps-grid-card-stat"><span>{m.edges.length}</span> edges</div>
                      {isCustom && <div className="maps-grid-card-stat" style={{color: 'var(--accent-amber)'}}>● local map</div>}
                      {isCustom && (
                        <div className="maps-grid-card-stat" style={{color: m._published ? 'var(--accent-teal)' : 'var(--text-muted)'}}>
                          {m._published ? '● published' : '● draft'}
                        </div>
                      )}
                    </div>
                    {isCustom && (
                      <div className="maps-grid-card-actions">
                        {typeof onTogglePublish === 'function' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePublish(m.id, !m._published);
                            }}
                          >
                            {m._published ? 'Unpublish' : 'Publish'}
                          </button>
                        )}
                        {hasBuiltInVersion && typeof onRevertToBuiltIn === 'function' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRevertToBuiltIn(m.id);
                            }}
                          >
                            Revert to built-in
                          </button>
                        )}
                        {typeof onExportMap === 'function' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportMap(m.id);
                            }}
                          >
                            Export Map JSON
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {section.mapIds.length === 0 && (
                <div className="maps-grid-empty">Drop a map here, or create a new map directly inside this folder.</div>
              )}
            </div>
          </div>
        ))}

        <div className="maps-grid-new" onClick={() => onCreate(sectionOrder[0] || 'general')}>
          <div className="maps-grid-new-icon">+</div>
          <div>Create a new concept map</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminCanvas, MapsManager, NODE_COLOR_PALETTE });
