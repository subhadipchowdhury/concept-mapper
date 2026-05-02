# Concept Mapper

A browser-based tool for building and solving concept maps, organized by subject across multiple courses. 

---

## How it works

Maps are graphs of concept nodes connected by labeled edges. Each edge represents a relationship between two concepts and has a fill-in-the-blank question attached. Students unlock nodes progressively by answering correctly. Progress is saved to localStorage.

Maps are grouped into subject folders (e.g., Real Analysis, Differential Equations). Folders collapse and expand, and the sidebar shows overall completion across all maps.

---

## Student view

Select a map from the sidebar. The breadcrumb at the top shows where you are (e.g., `Real Analysis › Sequences`). Nodes and edges become active as you answer questions. You can drag nodes around and pan/zoom the canvas. Progress persists between sessions.

Export and import your progress as JSON if you want to move it between browsers.

---

## Admin mode

Click "Admin" and enter the passphrase (`SECRETPHRASE`) to unlock. From there:

- **Maps Manager** — all maps grouped by subject folder. Drag maps between folders to reassign them. Create new folders and maps from here.
- **Map Editor** — add/edit nodes and edges, set labels and answers, adjust colors and positions.
- **Export JSON** — downloads the current map as `{mapId}.json` for publishing to the repo.
- **Export Manifest** — downloads `manifest.json` with current folder structure and metadata, for when you've reorganized subjects.

To publish a map, export it and drop it in `data/maps/`, update the manifest if needed, and commit.

---

## Data structure

### Files

```
data/maps/
├── manifest.json          # loading order + subject metadata for all built-in maps
├── sequences.json
├── series.json
├── funcSequences.json
├── firstOrderDE.json
├── secondOrderLaplace.json
├── systemsFirstOrder.json
└── pdeHeatEquation.json
```

### manifest.json

```json
{
  "maps": [
    {
      "id": "sequences",
      "title": "Sequences",
      "description": "Convergence, limits, and properties",
      "filePath": "data/maps/sequences.json",
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

| Key | Contents |
|-----|----------|
| `conceptmapper_progress_v2` | answered edges per map |
| `conceptmapper_positions_v2` | node positions per map |
| `conceptmapper_maps_v2` | custom (unpublished) maps |
| `conceptmapper_subjects_v1` | custom-created subject folders |
| `conceptmapper_subject_order_v1` | folder order |
| `conceptmapper_sidebar_folder_collapse_v1` | which folders are collapsed |

---

## Publishing maps

1. Build or edit a map in admin mode
2. Click "Export JSON" — saves `{mapId}.json`
3. If you changed folder assignments, also click "Export Manifest"
4. Drop the files into `data/maps/`
5. Commit and push — students get the update on next refresh

Rules:
- Don't change a map's `id` after it's published (it's used as the primary key everywhere)
- Filename must match the id: `sequences.json` for id `"sequences"`
- Keep `subjectId` / `subjectTitle` in the manifest consistent with what's in the map files

---

## Project structure

```
concept-mapper/
├── index.html
├── styles.css
├── data/maps/
│   ├── manifest.json
│   └── *.json
└── js/
    ├── app.jsx       # main component — layout, state, sidebar, routing
    ├── canvas.jsx    # map canvas — nodes, edges, pan/zoom, interaction
    ├── admin.jsx     # admin UI — maps manager and map editor
    └── helpers.jsx   # storage, map loading, math rendering
```

**Stack:** React (CDN), KaTeX, vanilla CSS, no build tools.
