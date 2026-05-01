// Main App
const { useState: useStateApp, useEffect: useEffectApp } = React;

function App() {
  const [view, setView] = useStateApp('student'); // 'student' | 'admin' | 'admin-edit'
  const [activeMapId, setActiveMapId] = useStateApp('sequences');
  const [editingMapId, setEditingMapId] = useStateApp(null);
  const [allProgress, setAllProgress] = useStateApp(() => loadProgress());
  const [customMaps, setCustomMaps] = useStateApp(() => loadCustomMaps());
  const [positions, setPositions] = useStateApp(() => loadPositions());

  const allMaps = { ...CONCEPT_MAPS, ...customMaps };

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

  function handleEditMap(mapId) {
    setEditingMapId(mapId);
    setView('admin-edit');
  }

  function handleAdminMapChange(updatedMap) {
    handleSaveCustomMap(updatedMap.id, updatedMap);
  }

  const mapData = allMaps[activeMapId];
  const editingMap = editingMapId ? allMaps[editingMapId] : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-mark">∑</div>
          Concept Mapper
        </div>
        <div className="topbar-sub">Math 163 · Real Analysis</div>
        <div className="topbar-spacer"></div>
        <button className={`topbar-btn ${view === 'student' ? 'active' : ''}`} onClick={() => setView('student')}>
          📚 Student
        </button>
        <button className={`topbar-btn ${view.startsWith('admin') ? 'active' : ''}`} onClick={() => setView('admin')}>
          ⚙ Admin
        </button>
      </header>

      <aside className="sidebar">
        <div className="sidebar-section-title">Topics</div>
        {Object.values(allMaps).map(m => {
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
        <div className="sidebar-divider"></div>
        <div className="sidebar-section-title">Admin</div>
        <div className={`sidebar-item ${view.startsWith('admin') ? 'active' : ''}`} style={{'--item-color': 'var(--accent-amber)'}} onClick={() => setView('admin')}>
          <div className="sidebar-item-title">
            <div className="sidebar-item-dot" style={{background: 'var(--accent-amber)'}}></div>
            Map Builder
          </div>
          <div className="sidebar-item-desc">Create and edit concept maps</div>
        </div>
      </aside>

      <main className="map-area">
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
            allMaps={allMaps}
            customMaps={customMaps}
            onEdit={handleEditMap}
            onCreate={handleCreateNewMap}
          />
        )}
        {view === 'admin-edit' && editingMap && (
          <AdminCanvas
            key={editingMapId}
            mapData={editingMap}
            onChange={handleAdminMapChange}
            onBack={() => setView('admin')}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
