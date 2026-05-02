// Main App
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

const ADMIN_UNLOCK_KEY = 'conceptmapper_teacher_unlocked_v1';
const ADMIN_STATIC_PASSPHRASE = 'SECRETPHRASE';

function serializeProgress(progressObj) {
  const serializable = {};
  Object.entries(progressObj || {}).forEach(([mapId, p]) => {
    serializable[mapId] = {
      answeredEdges: [...(p?.answeredEdges || [])],
    };
  });
  return serializable;
}

function deserializeProgress(progressObj) {
  const restored = {};
  Object.entries(progressObj || {}).forEach(([mapId, p]) => {
    restored[mapId] = {
      answeredEdges: new Set(p?.answeredEdges || []),
    };
  });
  return restored;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildOrderedIds(preferredOrder, mapsObj) {
  const ids = [];
  const seen = new Set();
  const mapIds = Object.keys(mapsObj || {});

  (preferredOrder || []).forEach((id) => {
    if (mapsObj[id] && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });

  mapIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });

  return ids;
}

function App() {
  const [view, setView] = useStateApp('student'); // 'student' | 'admin' | 'admin-edit'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useStateApp(false);
  const [activeMapId, setActiveMapId] = useStateApp(null);
  const [editingMapId, setEditingMapId] = useStateApp(null);
  const [builtInMaps, setBuiltInMaps] = useStateApp({});
  const [mapsLoading, setMapsLoading] = useStateApp(true);
  const [mapsLoadError, setMapsLoadError] = useStateApp('');
  const [allProgress, setAllProgress] = useStateApp(() => loadProgress());
  const [customMaps, setCustomMaps] = useStateApp(() => loadCustomMaps());
  const [mapOrder, setMapOrder] = useStateApp(() => loadMapOrder());
  const [manifestOrder, setManifestOrder] = useStateApp([]);
  const [positions, setPositions] = useStateApp(() => loadPositions());
  const [isAdminUnlocked, setIsAdminUnlocked] = useStateApp(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === '1');
  const importInputRef = useRefApp(null);

  const studentMaps = { ...builtInMaps };
  const adminMaps = { ...builtInMaps, ...customMaps };

  useEffectApp(() => {
    let cancelled = false;
    async function hydrateBuiltInMaps() {
      try {
        const { maps, failures, order } = await loadBuiltInMaps();
        if (cancelled) return;
        setBuiltInMaps(maps);
        setManifestOrder(order || []);
        if (failures.length > 0) {
          setMapsLoadError(`Some maps failed to load: ${failures.join(' | ')}`);
        }
      } catch (err) {
        if (cancelled) return;
        setMapsLoadError(err?.message || 'Failed to load built-in maps.');
      } finally {
        if (!cancelled) setMapsLoading(false);
      }
    }
    hydrateBuiltInMaps();
    return () => { cancelled = true; };
  }, []);

  useEffectApp(() => {
    const nextOrder = buildOrderedIds(
      mapOrder.length > 0 ? mapOrder : manifestOrder,
      { ...builtInMaps, ...customMaps }
    );
    if (!arraysEqual(nextOrder, mapOrder)) {
      setMapOrder(nextOrder);
      saveMapOrder(nextOrder);
    }
  }, [builtInMaps, customMaps, manifestOrder, mapOrder]);

  function getProgress(mapId) {
    if (!allProgress[mapId]) return { answeredEdges: new Set() };
    return allProgress[mapId];
  }

  function handleProgress(mapId, prog) {
    const updated = { ...allProgress, [mapId]: prog };
    setAllProgress(updated);
    saveProgress(updated);
  }

  function handlePositions(p) {
    setPositions(p);
    savePositions(p);
  }

  function handleSaveCustomMap(mapId, mapData) {
    const updated = { ...customMaps, [mapId]: mapData };
    setCustomMaps(updated);
    saveCustomMaps(updated);
  }

  function handleCreateNewMap() {
    const id = 'custom_' + Date.now().toString(36);
    const newMap = {
      id,
      title: 'New Concept Map',
      description: 'Click "Edit" to add a description',
      color: '#4f8ef7',
      accentColor: '#a78bfa',
      nodes: [],
      edges: [],
    };
    handleSaveCustomMap(id, newMap);
    setEditingMapId(id);
    setView('admin-edit');
  }

  function handleExportMapJSON(mapId) {
    const m = adminMaps[mapId];
    if (!m) return;
    downloadMapJSON(mapId, m);
  }

  function handleReorderMaps(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setMapOrder((prev) => {
      const ordered = buildOrderedIds(prev, { ...builtInMaps, ...customMaps });
      const from = ordered.indexOf(draggedId);
      const to = ordered.indexOf(targetId);
      if (from < 0 || to < 0) return ordered;
      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveMapOrder(next);
      return next;
    });
  }

  function handleEditMap(mapId) {
    setEditingMapId(mapId);
    setView('admin-edit');
  }

  function handleAdminMapChange(updatedMap) {
    handleSaveCustomMap(updatedMap.id, updatedMap);
  }

  function handleDeleteCustomMap(mapId) {
    if (!customMaps[mapId]) return;
    if (!confirm('Delete this custom map permanently? This removes student progress for this map too.')) return;

    const updatedCustomMaps = { ...customMaps };
    delete updatedCustomMaps[mapId];
    setCustomMaps(updatedCustomMaps);
    saveCustomMaps(updatedCustomMaps);

    const updatedProgress = { ...allProgress };
    delete updatedProgress[mapId];
    setAllProgress(updatedProgress);
    saveProgress(updatedProgress);

    const updatedPositions = { ...positions };
    delete updatedPositions[mapId];
    setPositions(updatedPositions);
    savePositions(updatedPositions);

    if (activeMapId === mapId) setActiveMapId('sequences');
    if (editingMapId === mapId) {
      setEditingMapId(null);
      setView('admin');
    }
  }

  function requestAdminAccess() {
    const entered = prompt('Enter teacher passphrase to access Admin:');
    if (entered === null) return false;
    if (entered !== ADMIN_STATIC_PASSPHRASE) {
      alert('Incorrect teacher passphrase.');
      return false;
    }
    sessionStorage.setItem(ADMIN_UNLOCK_KEY, '1');
    setIsAdminUnlocked(true);
    return true;
  }

  function openAdmin() {
    if (isAdminUnlocked || requestAdminAccess()) {
      setView('admin');
    }
  }

  function lockAdmin() {
    sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    setIsAdminUnlocked(false);
    if (view.startsWith('admin')) setView('student');
  }

  function exportStudentData() {
    const payload = {
      app: 'Concept Mapper',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: serializeProgress(allProgress),
      positions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `concept-mapper-progress-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function triggerImportStudentData() {
    if (importInputRef.current) importInputRef.current.click();
  }

  function handleImportStudentData(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');

        const importedProgress = deserializeProgress(parsed.progress || {});
        const importedPositions = parsed.positions && typeof parsed.positions === 'object' ? parsed.positions : {};

        setAllProgress(importedProgress);
        saveProgress(importedProgress);
        setPositions(importedPositions);
        savePositions(importedPositions);

        alert('Progress imported successfully.');
      } catch {
        alert('Could not import file. Please choose a valid Concept Mapper export JSON file.');
      }
    };
    reader.readAsText(file);
  }

  useEffectApp(() => {
    if (view === 'student' && !studentMaps[activeMapId]) {
      const fallback = buildOrderedIds(mapOrder, studentMaps)[0] || null;
      setActiveMapId(fallback);
    }
  }, [view, activeMapId, studentMaps, mapOrder]);

  const mapData = studentMaps[activeMapId];
  const editingMap = editingMapId ? adminMaps[editingMapId] : null;
  const orderedStudentMaps = buildOrderedIds(mapOrder, studentMaps)
    .map((id) => studentMaps[id])
    .filter(Boolean);
  const orderedAdminMapIds = buildOrderedIds(mapOrder, adminMaps);

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <button
          className="topbar-btn"
          onClick={() => setIsSidebarCollapsed(v => !v)}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? '▸ Topics' : '◂ Topics'}
        </button>
        <div className="topbar-logo">
          <div className="topbar-logo-mark">∑</div>
          Concept Mapper
        </div>
        <div className="topbar-sub">Math 163 · Real Analysis</div>
        <div className="topbar-spacer"></div>
        {view === 'student' && (
          <>
            <button className="topbar-btn" onClick={exportStudentData} title="Download your progress JSON">
              ⭳ Export Progress
            </button>
            <button className="topbar-btn" onClick={triggerImportStudentData} title="Import progress from a JSON file">
              ⭱ Import Progress
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportStudentData}
            />
          </>
        )}
        <button className={`topbar-btn ${view === 'student' ? 'active' : ''}`} onClick={() => setView('student')}>
          📚 Student
        </button>
        <button className={`topbar-btn ${view.startsWith('admin') ? 'active' : ''}`} onClick={openAdmin}>
          ⚙ Admin
        </button>
        {isAdminUnlocked && (
          <button className="topbar-btn" onClick={lockAdmin} title="Lock teacher mode for this tab">
            🔒 Lock
          </button>
        )}
      </header>

      <aside className="sidebar">
        <div className="sidebar-section-title">Topics</div>
        {orderedStudentMaps.map(m => {
          const prog = getProgress(m.id);
          const total = m.edges.length;
          const done = (prog.answeredEdges || new Set()).size;
          const pct = total > 0 ? (done / total) * 100 : 0;
          return (
            <div
              key={m.id}
              className={`sidebar-item ${activeMapId === m.id && view === 'student' ? 'active' : ''}`}
              style={{'--item-color': m.color}}
              onClick={() => { setActiveMapId(m.id); setView('student'); }}
            >
              <div className="sidebar-item-title">
                <div className="sidebar-item-dot" style={{background: m.color}}></div>
                {m.title}
              </div>
              <div className="sidebar-item-desc">{m.description}</div>
              <div className="sidebar-item-progress">
                <div
                  className="sidebar-item-progress-fill"
                  style={{ width: `${pct}%`, background: m.color }}
                ></div>
              </div>
              <div className="sidebar-item-stats">
                <span>{done}/{total} edges</span>
                <span>{Math.round(pct)}%</span>
              </div>
            </div>
          );
        })}
        {isAdminUnlocked && (
          <>
            <div className="sidebar-divider"></div>
            <div className="sidebar-section-title">Admin</div>
            <div className={`sidebar-item ${view.startsWith('admin') ? 'active' : ''}`} style={{'--item-color': 'var(--accent-amber)'}} onClick={openAdmin}>
              <div className="sidebar-item-title">
                <div className="sidebar-item-dot" style={{background: 'var(--accent-amber)'}}></div>
                Map Builder
              </div>
              <div className="sidebar-item-desc">Create and edit concept maps</div>
            </div>
          </>
        )}
      </aside>

      <main className="map-area">
        {mapsLoading && (
          <div className="empty-canvas-hint">
            <div className="empty-canvas-hint-title">Loading maps...</div>
            <div>Fetching chapter files from manifest.</div>
          </div>
        )}
        {!mapsLoading && mapsLoadError && (
          <div className="empty-canvas-hint">
            <div className="empty-canvas-hint-title">Map load warning</div>
            <div>{mapsLoadError}</div>
          </div>
        )}
        {view === 'student' && mapData && (
          <ConceptMap
            key={activeMapId}
            mapData={mapData}
            progress={getProgress(activeMapId)}
            onProgress={(p) => handleProgress(activeMapId, p)}
            positions={positions}
            onPositions={handlePositions}
          />
        )}
        {view === 'admin' && (
          <MapsManager
            allMaps={adminMaps}
            orderedMapIds={orderedAdminMapIds}
            customMaps={customMaps}
            onEdit={handleEditMap}
            onCreate={handleCreateNewMap}
            onDeleteCustom={handleDeleteCustomMap}
            onExportMap={handleExportMapJSON}
            onReorderMap={handleReorderMaps}
          />
        )}
        {view === 'admin-edit' && editingMap && (
          <AdminCanvas
            key={editingMapId}
            mapData={editingMap}
            onChange={handleAdminMapChange}
            onBack={() => setView('admin')}
            onDelete={handleDeleteCustomMap}
            onExport={handleExportMapJSON}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
