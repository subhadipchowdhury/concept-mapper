// Main App
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

const ADMIN_PIN_KEY = 'conceptmapper_teacher_pin_v1';
const ADMIN_UNLOCK_KEY = 'conceptmapper_teacher_unlocked_v1';

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

function App() {
  const [view, setView] = useStateApp('student'); // 'student' | 'admin' | 'admin-edit'
  const [activeMapId, setActiveMapId] = useStateApp('sequences');
  const [editingMapId, setEditingMapId] = useStateApp(null);
  const [allProgress, setAllProgress] = useStateApp(() => loadProgress());
  const [customMaps, setCustomMaps] = useStateApp(() => loadCustomMaps());
  const [positions, setPositions] = useStateApp(() => loadPositions());
  const [isAdminUnlocked, setIsAdminUnlocked] = useStateApp(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === '1');
  const importInputRef = useRefApp(null);

  const publishedCustomMaps = Object.fromEntries(
    Object.entries(customMaps).filter(([, m]) => !!m._published)
  );
  const studentMaps = { ...CONCEPT_MAPS, ...publishedCustomMaps };
  const adminMaps = { ...CONCEPT_MAPS, ...customMaps };

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
      _published: false,
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

  function handleTogglePublish(mapId, published) {
    const existing = customMaps[mapId];
    if (!existing) return;
    handleSaveCustomMap(mapId, { ...existing, _published: published });
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
    let pin = localStorage.getItem(ADMIN_PIN_KEY);
    if (!pin) {
      const first = prompt('Set a teacher passcode for Admin access (stored on this browser).');
      if (!first) return false;
      if (first.trim().length < 4) {
        alert('Passcode must be at least 4 characters.');
        return false;
      }
      const confirmPin = prompt('Confirm teacher passcode:');
      if (confirmPin !== first) {
        alert('Passcodes did not match.');
        return false;
      }
      localStorage.setItem(ADMIN_PIN_KEY, first);
      pin = first;
    }

    const entered = prompt('Enter teacher passcode to access Admin:');
    if (entered === null) return false;
    if (entered !== pin) {
      alert('Incorrect teacher passcode.');
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
      const fallback = Object.keys(studentMaps)[0] || 'sequences';
      setActiveMapId(fallback);
    }
  }, [view, activeMapId, studentMaps]);

  const mapData = studentMaps[activeMapId];
  const editingMap = editingMapId ? adminMaps[editingMapId] : null;

  return (
    <div className="app-shell">
      <header className="topbar">
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
        {Object.values(studentMaps).map(m => {
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
        <div className={`sidebar-item ${view.startsWith('admin') ? 'active' : ''}`} style={{'--item-color': 'var(--accent-amber)'}} onClick={openAdmin}>
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
            allMaps={adminMaps}
            customMaps={customMaps}
            onEdit={handleEditMap}
            onCreate={handleCreateNewMap}
            onDeleteCustom={handleDeleteCustomMap}
            onTogglePublish={handleTogglePublish}
          />
        )}
        {view === 'admin-edit' && editingMap && (
          <AdminCanvas
            key={editingMapId}
            mapData={editingMap}
            onChange={handleAdminMapChange}
            onBack={() => setView('admin')}
            onDelete={handleDeleteCustomMap}
            onTogglePublish={(published) => handleTogglePublish(editingMapId, published)}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
