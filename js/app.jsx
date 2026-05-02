// Main App
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

const ADMIN_UNLOCK_KEY = 'conceptmapper_teacher_unlocked_v1';
const ADMIN_STATIC_PASSPHRASE = 'SECRETPHRASE';
const SUBJECTS_KEY = 'conceptmapper_subjects_v1';
const SUBJECT_ORDER_KEY = 'conceptmapper_subject_order_v1';
const SIDEBAR_FOLDER_COLLAPSE_KEY = 'conceptmapper_sidebar_folder_collapse_v1';
const DEFAULT_SUBJECT_ID = 'general';
const DEFAULT_SUBJECT_TITLE = 'General';

function normalizeSubjectId(subjectId) {
  if (typeof subjectId !== 'string') return DEFAULT_SUBJECT_ID;
  const cleaned = subjectId.trim();
  return cleaned || DEFAULT_SUBJECT_ID;
}

function fallbackSubjectTitleFromId(subjectId) {
  const source = normalizeSubjectId(subjectId);
  if (source === DEFAULT_SUBJECT_ID) return DEFAULT_SUBJECT_TITLE;
  const words = source
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') || DEFAULT_SUBJECT_TITLE;
}

function getSubjectInfo(mapData) {
  const id = normalizeSubjectId(mapData?.subjectId);
  const title = typeof mapData?.subjectTitle === 'string' && mapData.subjectTitle.trim()
    ? mapData.subjectTitle.trim()
    : fallbackSubjectTitleFromId(id);
  return { id, title };
}

function slugifySubjectId(title) {
  const raw = (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-');
  return raw || 'subject';
}

function uniqueSubjectId(baseId, existingIds) {
  if (!existingIds.has(baseId)) return baseId;
  let n = 2;
  while (existingIds.has(`${baseId}-${n}`)) n += 1;
  return `${baseId}-${n}`;
}

function loadCustomSubjects() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCustomSubjects(subjects) {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects || {}));
}

function loadSubjectOrder() {
  try {
    const raw = localStorage.getItem(SUBJECT_ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSubjectOrder(order) {
  localStorage.setItem(SUBJECT_ORDER_KEY, JSON.stringify(Array.isArray(order) ? order : []));
}

function loadSidebarFolderCollapse() {
  try {
    const raw = localStorage.getItem(SIDEBAR_FOLDER_COLLAPSE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSidebarFolderCollapse(value) {
  localStorage.setItem(SIDEBAR_FOLDER_COLLAPSE_KEY, JSON.stringify(value || {}));
}

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

function normalizeForCompare(value) {
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (value && typeof value === 'object') {
    const ignore = new Set(['updatedAt', 'exportedBy']);
    const out = {};
    Object.keys(value).sort().forEach((k) => {
      if (ignore.has(k)) return;
      out[k] = normalizeForCompare(value[k]);
    });
    return out;
  }
  return value;
}

function mapsEquivalent(a, b) {
  try {
    return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
  } catch {
    return false;
  }
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

function buildSubjectCatalog(preferredOrder, mapsObj, customSubjects) {
  const byId = {
    [DEFAULT_SUBJECT_ID]: {
      id: DEFAULT_SUBJECT_ID,
      title: DEFAULT_SUBJECT_TITLE,
      isCustom: false,
    },
  };

  Object.values(mapsObj || {}).forEach((mapData) => {
    const subject = getSubjectInfo(mapData);
    if (!byId[subject.id]) {
      byId[subject.id] = { id: subject.id, title: subject.title, isCustom: false };
    }
  });

  Object.values(customSubjects || {}).forEach((subject) => {
    if (!subject || typeof subject.id !== 'string') return;
    const id = normalizeSubjectId(subject.id);
    const title = typeof subject.title === 'string' && subject.title.trim()
      ? subject.title.trim()
      : fallbackSubjectTitleFromId(id);
    byId[id] = { id, title, isCustom: true };
  });

  const orderedIds = buildOrderedIds(preferredOrder, byId);
  return orderedIds.map((id) => byId[id]).filter(Boolean);
}

function buildSubjectSections(orderedMapIds, mapsObj, subjects) {
  const sectionsById = {};
  const baseOrder = [];

  (subjects || []).forEach((subject) => {
    if (!subject || typeof subject.id !== 'string') return;
    sectionsById[subject.id] = {
      ...subject,
      maps: [],
    };
    baseOrder.push(subject.id);
  });

  (orderedMapIds || []).forEach((mapId) => {
    const mapData = mapsObj?.[mapId];
    if (!mapData) return;
    const subject = getSubjectInfo(mapData);
    if (!sectionsById[subject.id]) {
      sectionsById[subject.id] = {
        id: subject.id,
        title: subject.title,
        isCustom: false,
        maps: [],
      };
      baseOrder.push(subject.id);
    }
    sectionsById[subject.id].maps.push(mapData);
  });

  return baseOrder.map((id) => sectionsById[id]).filter(Boolean);
}

function App() {
  const [view, setView] = useStateApp('student'); // 'student' | 'admin' | 'admin-edit'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useStateApp(() => {
    try {
      return window.matchMedia('(max-width: 760px)').matches;
    } catch {
      return false;
    }
  });
  const [activeMapId, setActiveMapId] = useStateApp(null);
  const [editingMapId, setEditingMapId] = useStateApp(null);
  const [builtInMaps, setBuiltInMaps] = useStateApp({});
  const [mapsLoading, setMapsLoading] = useStateApp(true);
  const [mapsLoadError, setMapsLoadError] = useStateApp('');
  const [allProgress, setAllProgress] = useStateApp(() => loadProgress());
  const [customMaps, setCustomMaps] = useStateApp(() => loadCustomMaps());
  const [customSubjects, setCustomSubjects] = useStateApp(() => loadCustomSubjects());
  const [collapsedFolders, setCollapsedFolders] = useStateApp(() => loadSidebarFolderCollapse());
  const [mapOrder, setMapOrder] = useStateApp(() => loadMapOrder());
  const [subjectOrder, setSubjectOrder] = useStateApp(() => loadSubjectOrder());
  const [manifestOrder, setManifestOrder] = useStateApp([]);
  const [positions, setPositions] = useStateApp(() => loadPositions());
  const [toast, setToast] = useStateApp(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useStateApp(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === '1');
  const importInputRef = useRefApp(null);
  const importCustomMapInputRef = useRefApp(null);
  const toastTimerRef = useRefApp(null);

  const publishedCustomMaps = Object.fromEntries(
    Object.entries(customMaps).filter(([, m]) => !!m?._published)
  );
  const studentMaps = { ...builtInMaps, ...publishedCustomMaps };
  const adminMaps = { ...builtInMaps, ...customMaps };
  const allSubjects = buildSubjectCatalog(subjectOrder, adminMaps, customSubjects);
  const subjectTitleById = Object.fromEntries(allSubjects.map((s) => [s.id, s.title]));

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

  useEffectApp(() => {
    const subjectLookup = Object.fromEntries(allSubjects.map((subject) => [subject.id, true]));
    const nextOrder = buildOrderedIds(subjectOrder, subjectLookup);
    if (!arraysEqual(nextOrder, subjectOrder)) {
      setSubjectOrder(nextOrder);
      saveSubjectOrder(nextOrder);
    }
  }, [allSubjects, subjectOrder]);

  useEffectApp(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function showToast(message, type = 'info', durationMs = 2600) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, durationMs);
  }

  useEffectApp(() => {
    const staleCustomIds = Object.keys(customMaps).filter((id) => (
      builtInMaps[id] && mapsEquivalent(customMaps[id], builtInMaps[id])
    ));
    if (staleCustomIds.length === 0) return;

    const next = { ...customMaps };
    staleCustomIds.forEach((id) => {
      delete next[id];
    });
    setCustomMaps(next);
    saveCustomMaps(next);
  }, [builtInMaps, customMaps]);

  function getProgress(mapId) {
    if (!allProgress[mapId]) return { answeredEdges: new Set() };
    return allProgress[mapId];
  }

  function getCompletedMapCount() {
    return studentSections.reduce((count, section) => {
      const completedInSection = section.maps.filter(m => {
        const prog = getProgress(m.id);
        const done = (prog.answeredEdges || new Set()).size;
        const total = m.edges.length;
        return total > 0 && done === total;
      }).length;
      return count + completedInSection;
    }, 0);
  }

  function getTotalMapCount() {
    return studentSections.reduce((count, section) => count + section.maps.length, 0);
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
    const subject = getSubjectInfo(mapData);
    const resolvedTitle = subjectTitleById[subject.id] || subject.title;
    const normalized = {
      ...mapData,
      subjectId: subject.id,
      subjectTitle: resolvedTitle,
    };
    const updated = { ...customMaps, [mapId]: normalized };
    setCustomMaps(updated);
    saveCustomMaps(updated);
  }

  function handleCreateSubject(title) {
    const cleanedTitle = (title || '').trim();
    if (!cleanedTitle) return null;
    const existingIds = new Set(allSubjects.map((subject) => subject.id));
    const baseId = slugifySubjectId(cleanedTitle);
    const subjectId = uniqueSubjectId(baseId, existingIds);
    const nextSubjects = {
      ...customSubjects,
      [subjectId]: {
        id: subjectId,
        title: cleanedTitle,
      },
    };
    const nextOrder = [...subjectOrder.filter((id) => id !== subjectId), subjectId];
    setCustomSubjects(nextSubjects);
    saveCustomSubjects(nextSubjects);
    setSubjectOrder(nextOrder);
    saveSubjectOrder(nextOrder);
    showToast(`Created folder "${cleanedTitle}".`, 'success');
    return subjectId;
  }

  function handleCreateNewMap(subjectId) {
    const safeSubjectId = normalizeSubjectId(subjectId || allSubjects[0]?.id || DEFAULT_SUBJECT_ID);
    const safeSubjectTitle = subjectTitleById[safeSubjectId] || fallbackSubjectTitleFromId(safeSubjectId);
    const id = 'custom_' + Date.now().toString(36);
    const newMap = {
      id,
      title: 'New Concept Map',
      description: 'Click "Edit" to add a description',
      color: '#4f8ef7',
      accentColor: '#a78bfa',
      subjectId: safeSubjectId,
      subjectTitle: safeSubjectTitle,
      nodes: [],
      edges: [],
      _published: false,
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

  function handleMoveMapToSubject(mapId, subjectId) {
    const mapData = adminMaps[mapId];
    if (!mapData) return;
    const safeSubjectId = normalizeSubjectId(subjectId);
    const safeSubjectTitle = subjectTitleById[safeSubjectId] || fallbackSubjectTitleFromId(safeSubjectId);
    handleSaveCustomMap(mapId, {
      ...mapData,
      subjectId: safeSubjectId,
      subjectTitle: safeSubjectTitle,
    });
  }

  function handleExportManifestJSON() {
    const orderedIds = buildOrderedIds(mapOrder, adminMaps);
    const entries = orderedIds
      .map((mapId) => adminMaps[mapId])
      .filter(Boolean)
      .filter((mapData) => {
        if (!customMaps[mapData.id]) return true;
        return !!mapData._published;
      })
      .map((mapData) => {
        const subject = getSubjectInfo(mapData);
        return {
          id: mapData.id,
          title: mapData.title,
          file: `data/maps/${mapData.id}.json`,
          subjectId: subject.id,
          subjectTitle: subjectTitleById[subject.id] || subject.title,
        };
      });

    downloadManifestJSON(entries);
    showToast('Manifest exported. Repo manager should replace data/maps/manifest.json.', 'success');
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
    handleSaveCustomMap(mapId, { ...existing, _published: !!published });
    showToast(published ? 'Map published to student sidebar.' : 'Map moved to draft.', 'info');
  }

  function triggerImportCustomMap() {
    if (importCustomMapInputRef.current) importCustomMapInputRef.current.click();
  }

  function isValidMapPayload(map) {
    return !!(
      map &&
      typeof map === 'object' &&
      typeof map.id === 'string' &&
      typeof map.title === 'string' &&
      typeof map.description === 'string' &&
      Array.isArray(map.nodes) &&
      Array.isArray(map.edges)
    );
  }

  function handleImportCustomMap(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidMapPayload(parsed)) {
          throw new Error('Invalid map JSON');
        }

        if (builtInMaps[parsed.id]) {
          const ok = confirm('This ID matches a built-in map. Import as a local override?');
          if (!ok) return;
        }

        const subject = getSubjectInfo(parsed);
        handleSaveCustomMap(parsed.id, {
          ...parsed,
          subjectId: subject.id,
          subjectTitle: subjectTitleById[subject.id] || subject.title,
          _published: false,
        });
        setEditingMapId(parsed.id);
        setView('admin-edit');
        showToast(`Imported map "${parsed.title}".`, 'success');
      } catch {
        showToast('Could not import map. Please choose a valid map JSON file.', 'error');
      }
    };
    reader.readAsText(file);
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
      try {
        if (window.matchMedia('(max-width: 760px)').matches) {
          setIsSidebarCollapsed(true);
        }
      } catch {}
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

        showToast('Progress imported successfully.', 'success');
      } catch {
        showToast('Could not import file. Please choose a valid Concept Mapper export JSON file.', 'error');
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
  const orderedStudentMapIds = buildOrderedIds(mapOrder, studentMaps);
  const orderedAdminMapIds = buildOrderedIds(mapOrder, adminMaps);
  const studentSections = buildSubjectSections(
    orderedStudentMapIds,
    studentMaps,
    allSubjects
  ).filter((section) => section.maps.length > 0);
  const studentSectionIds = studentSections.map((section) => section.id);

  useEffectApp(() => {
    const valid = new Set(studentSections.map((section) => section.id));
    const next = {};
    Object.entries(collapsedFolders || {}).forEach(([id, collapsed]) => {
      if (valid.has(id) && collapsed) next[id] = true;
    });
    if (!arraysEqual(Object.keys(next).sort(), Object.keys(collapsedFolders || {}).sort())) {
      setCollapsedFolders(next);
      saveSidebarFolderCollapse(next);
    }
  }, [studentSections, collapsedFolders]);

  function toggleFolder(sectionId) {
    setCollapsedFolders((prev) => {
      const next = { ...(prev || {}) };
      if (next[sectionId]) {
        delete next[sectionId];
      } else {
        next[sectionId] = true;
      }
      saveSidebarFolderCollapse(next);
      return next;
    });
  }

  function collapseAllFolders() {
    const next = Object.fromEntries(studentSectionIds.map((id) => [id, true]));
    setCollapsedFolders(next);
    saveSidebarFolderCollapse(next);
  }

  function expandAllFolders() {
    const next = {};
    setCollapsedFolders(next);
    saveSidebarFolderCollapse(next);
  }

  useEffectApp(() => {
    if (!activeMapId) return;
    const activeSection = studentSections.find((section) => section.maps.some((m) => m.id === activeMapId));
    if (!activeSection) return;
    if (!collapsedFolders?.[activeSection.id]) return;
    const next = { ...(collapsedFolders || {}) };
    delete next[activeSection.id];
    setCollapsedFolders(next);
    saveSidebarFolderCollapse(next);
  }, [activeMapId, studentSections, collapsedFolders]);

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <button
          className="topbar-btn"
          onClick={() => setIsSidebarCollapsed(v => !v)}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? '▸ ' : '◂ '}<span className="topbar-btn-label">{isSidebarCollapsed ? 'Topics' : 'Topics'}</span>
        </button>
        <div className="topbar-logo">
          <div className="topbar-logo-mark">∑</div>
          <span className="topbar-logo-text">Concept Mapper</span>
        </div>
        <div className="topbar-spacer"></div>
        {view === 'student' && (
          <>
            <button className="topbar-btn" onClick={exportStudentData} title="Download your progress JSON">
              ⭳ <span className="topbar-btn-label">Export Progress</span>
            </button>
            <button className="topbar-btn" onClick={triggerImportStudentData} title="Import progress from a JSON file">
              ⭱ <span className="topbar-btn-label">Import Progress</span>
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
          📚 <span className="topbar-btn-label">Student</span>
        </button>
        <button className={`topbar-btn ${view.startsWith('admin') ? 'active' : ''}`} onClick={openAdmin}>
          ⚙ <span className="topbar-btn-label">Admin</span>
        </button>
        {isAdminUnlocked && (
          <button className="topbar-btn" onClick={lockAdmin} title="Lock teacher mode for this tab">
            🔒 <span className="topbar-btn-label">Lock</span>
          </button>
        )}
      </header>

      {!isSidebarCollapsed && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarCollapsed(true)} aria-hidden="true" />
      )}

      <aside className="sidebar">
        <div className="sidebar-header-row">
          <div className="sidebar-section-title">Topics</div>
          <div className="sidebar-folder-controls">
            <button type="button" className="sidebar-folder-control-btn" onClick={collapseAllFolders}>Collapse all</button>
            <button type="button" className="sidebar-folder-control-btn" onClick={expandAllFolders}>Expand all</button>
          </div>
        </div>
        {studentSections.length > 0 && (
          <div className="sidebar-progress-summary">
            {getCompletedMapCount()}/{getTotalMapCount()} maps complete
          </div>
        )}
        {studentSections.map((section) => (
          <React.Fragment key={section.id}>
            <button
              className="sidebar-folder-title"
              type="button"
              onClick={() => toggleFolder(section.id)}
              aria-expanded={!collapsedFolders[section.id]}
            >
              <span>{section.title} ({section.maps.length})</span>
              <span className={`sidebar-folder-caret ${collapsedFolders[section.id] ? 'collapsed' : ''}`}>▾</span>
            </button>
            {!collapsedFolders[section.id] && section.maps.map((m) => {
              const prog = getProgress(m.id);
              const total = m.edges.length;
              const done = (prog.answeredEdges || new Set()).size;
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <div
                  key={m.id}
                  className={`sidebar-item ${activeMapId === m.id && view === 'student' ? 'active' : ''}`}
                  style={{'--item-color': m.color}}
                  onClick={() => {
                    setActiveMapId(m.id);
                    setView('student');
                    try {
                      if (window.matchMedia('(max-width: 760px)').matches) {
                        setIsSidebarCollapsed(true);
                      }
                    } catch {}
                  }}
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
          </React.Fragment>
        ))}
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
        {toast && (
          <div className={`app-toast ${toast.type || 'info'}`}>
            {toast.message}
          </div>
        )}
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
          <div className="student-view-wrapper">
            {activeMapId && (
              <div className="breadcrumb">
                {studentSections.find(s => s.maps.some(m => m.id === activeMapId))?.title || 'Maps'} › {mapData.title}
              </div>
            )}
            <div className="map-canvas-area">
              <ConceptMap
                key={activeMapId}
                mapData={mapData}
                progress={getProgress(activeMapId)}
                onProgress={(p) => handleProgress(activeMapId, p)}
                positions={positions}
                onPositions={handlePositions}
              />
            </div>
          </div>
        )}
        {view === 'admin' && (
          <MapsManager
            allMaps={adminMaps}
            subjects={allSubjects}
            orderedMapIds={orderedAdminMapIds}
            customMaps={customMaps}
            onEdit={handleEditMap}
            onCreate={handleCreateNewMap}
            onCreateSubject={handleCreateSubject}
            onExportMap={handleExportMapJSON}
            onExportManifest={handleExportManifestJSON}
            onReorderMap={handleReorderMaps}
            onMoveToSubject={handleMoveMapToSubject}
            onImportMap={triggerImportCustomMap}
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
            onExport={handleExportMapJSON}
            onTogglePublish={customMaps[editingMapId] ? ((published) => handleTogglePublish(editingMapId, published)) : undefined}
          />
        )}
        <input
          ref={importCustomMapInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleImportCustomMap}
        />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
