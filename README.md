# Concept Mapper

Concept Mapper is a browser-based study and authoring tool for concept maps. Students can work through maps by answering relationship prompts, and admins can organize maps by subject, edit content, and export files for publishing.

---

## At a glance

Each map is a network of concept nodes connected by labeled relationships. Students reveal more of the map as they answer correctly. Their progress and custom node layout are saved in the browser.

Maps are grouped into subject folders such as Real Analysis or Differential Equations. The sidebar keeps those folders organized and shows overall completion progress.

---

## Quick guide

1. Open a map from the sidebar.
2. Click or tap a glowing relationship label to answer it.
3. Drag nodes to rearrange the layout while studying.
4. Use the top-right controls to pan, zoom, spread, compact, or reset the layout.
5. Adjust the **Label** slider to move arrow labels along the edge. It snaps in discrete `0.1` steps from `0.2` to `0.8`, and the setting is saved per map in your browser.

---

## Student workflow

1. Open a topic from the sidebar.
2. Click or tap a glowing relationship label to answer it.
3. Drag nodes if you want to reorganize the map while studying.
4. Pan and zoom to focus on one region at a time.
5. Use **Save Progress** and **Load Progress** if you want to move your work between browsers or computers.

The breadcrumb at the top shows your current folder and map, for example `Real Analysis › Sequences`.

---

## Admin workflow

Open **Admin** and enter the passphrase (`SECRET`) to unlock the builder tools.

Use **Admin · Concept Maps** to:

- create subject folders
- create new maps inside a folder
- drag cards to reorder maps or move them between folders
- import a saved map JSON file
- export the folder manifest after reorganizing subjects

Open any map card to use the editor.

Inside the editor you can:

- add nodes, connect them, and drag them into position
- edit prompt text, answers, hints, colors, and start nodes
- mark a local map as draft or published for the student sidebar
- export the current map as `{mapId}.json`

To publish a change to the shared repository:

1. Export the map JSON.
2. If you changed folder organization, export the folder manifest too.
3. Replace the matching file in its subject folder under `data/maps/{subjectId}/`.
4. Commit and push the updated files.

---

## Data structure

### Files

```
data/maps/
├── manifest.json          # loading order + subject metadata for all built-in maps
├── real-analysis/
│   ├── sequences.json
│   ├── series.json
│   └── funcSequences.json
├── differential-equations/
│   ├── firstOrderDE.json
│   ├── secondOrderLaplace.json
│   ├── systemsFirstOrder.json
│   └── pdeHeatEquation.json
└── chemical-reactions/
  └── reactionKinetics.json
```

### manifest.json

```json
{
  "maps": [
    {
      "id": "sequences",
      "title": "Sequences",
      "description": "Convergence, limits, and properties",
      "file": "data/maps/real-analysis/sequences.json",
      "subjectId": "real-analysis",
      "subjectTitle": "Real Analysis"
    }
  ]
}
```

### Map file schema

```json
{
  "id": "sequences",
  "title": "Sequences",
  "description": "...",
  "color": "#34d399",
  "accentColor": "#10b981",
  "nodes": [
    { "id": "start", "label": "Sequence", "x": 100, "y": 100, "isStart": true, "color": "#34d399" }
  ],
  "edges": [
    { "id": "edge1", "from": "start", "to": "limit", "label": "approaches a single value", "answer": "converges" }
  ]
}
```

### localStorage keys

Version suffixes (`_v1`, `_v2`, etc.) indicate persisted-data schema versions. When a stored shape changes, a new key version prevents old browser data from breaking newer code.

| Key | Contents |
|-----|----------|
| `conceptmapper_progress_v2` | answered edges per map |
| `conceptmapper_positions_v2` | node positions per map |
| `conceptmapper_maps_v2` | custom (unpublished) maps |
| `conceptmapper_map_order_v1` | map ordering in sidebar |
| `conceptmapper_subjects_v1` | custom-created subject folders |
| `conceptmapper_subject_order_v1` | folder order |
| `conceptmapper_sidebar_folder_collapse_v1` | which folders are collapsed |
| `conceptmapper_teacher_unlocked_v1` (sessionStorage) | admin-mode unlocked flag |

---

## Publishing rules

- Do not change a published map's `id`; it is the stable key used for progress, ordering, and exports.
- Keep the filename matched to the map id, for example `sequences.json` for id `"sequences"`.
- Keep map files inside `data/maps/{subjectId}/` so the manifest and folder layout stay aligned.
- Keep `subjectId` and `subjectTitle` aligned between the manifest and the map file metadata.

---

## Project structure

```
concept-mapper/
├── index.html
├── styles.css
├── data/maps/
│   ├── manifest.json
│   └── <subject-id>/
│       └── *.json
└── js/
    ├── app.jsx       # main component — layout, state, sidebar, routing
    ├── canvas.jsx    # map canvas — nodes, edges, pan/zoom, interaction
    ├── admin.jsx     # admin UI — maps manager and map editor
    └── helpers.jsx   # storage, map loading, math rendering
```

**Stack:** React (CDN), MathJax, vanilla CSS, no build tools.

---

## Changelog

### 2026-05-02

- Normalized built-in map storage to subject folders: `data/maps/{subjectId}/{mapId}.json`.
- Updated `data/maps/manifest.json` to point every map entry to the subject-folder path.
- Updated admin manifest export logic to emit subject-folder file paths.
- Updated admin editor publish-path hint to show subject-folder destinations.
- Updated README examples and data-structure documentation to match the normalized layout.
