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

> The passphrase is a hardcoded constant in `js/app.jsx`, compared in the
> browser. It keeps the builder out of a student's way; it does not protect
> anything. Map answer keys are plain JSON served from `data/maps/`, so they are
> readable by anyone regardless. Treat this as a study aid, not an assessment
> tool.

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
├── manifest.json          # loading order + subject metadata for all published maps
├── real-analysis/         # the only subject currently in the manifest
│   ├── sequences.json
│   ├── series.json
│   └── funcSequences.json
├── chemical-reactions/    # present in the repo, NOT in the manifest
│   └── reactionKinetics.json
└── future-plans/          # drafts; not loaded by the app
    └── differential-equations/
        ├── firstOrderDE.json
        ├── secondOrderLaplace.json
        ├── systemsFirstOrder.json
        └── pdeHeatEquation.json
```

Only files listed in `manifest.json` are loaded. Anything else under
`data/maps/` is inert as far as the app is concerned, but it is still published
by the Pages workflow, so answer keys in draft maps are publicly readable.

### manifest.json

A **bare JSON array** — `loadBuiltInMaps` throws `Map manifest must be an
array.` on anything else. Note there is no `description` field here; map
descriptions come from the map file itself.

```json
[
  {
    "id": "sequences",
    "title": "Sequences of Real Numbers",
    "file": "data/maps/real-analysis/sequences.json",
    "subjectId": "real-analysis",
    "subjectTitle": "Real Analysis"
  }
]
```

### Map file schema

```json
{
  "id": "sequences",
  "title": "Sequences",
  "description": "...",
  "color": "#A9C47F",
  "accentColor": "#9CAF88",
  "nodes": [
    { "id": "start", "label": "Sequence", "x": 100, "y": 100, "isStart": true, "color": "#A9C47F" }
  ],
  "edges": [
    {
      "id": "edge1",
      "from": "start",
      "to": "limit",
      "label": "approaches a single value",
      "type": "fillin",
      "answer": "converges",
      "acceptedAnswers": ["is convergent"],
      "hint": "Optional; shown after 2 wrong attempts."
    }
  ]
}
```

`type` is `"fillin"` or `"dropdown"`; dropdown edges also need an `options`
array containing the correct answer. `acceptedAnswers` is optional — alternate
phrasings that also count as correct. `answer` is always accepted and is the
wording revealed on the map once solved.

**Escaping.** Inside JSON string values, write `\\n` for a line break in a
label and `\\(…\\)` for inline math, so the parsed JavaScript string holds a
single backslash. Node sizing, line splitting, and MathJax all assume that
convention.

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
| `conceptmapper_active_map_v1` | last opened map, restored on reload |
| `cm:edgeLabelT:{mapId}` | edge-label anchor position, per map |
| `conceptmapper_teacher_unlocked_v1` (sessionStorage) | admin-mode unlocked flag |

All authoring lives in these keys until it is exported and committed. Clearing
site data, switching browsers, or using a private window loses unexported work.

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

## Known limitations

- **No build step.** `index.html` loads React's *development* build plus
  `@babel/standalone` (~2.7 MB) and transpiles ~4,200 lines of JSX in the
  browser on every page load. Nothing is minified or cached.
- **Answering requires a mouse or touch.** Edge labels are click-only `div`s, so
  a keyboard-only student cannot complete a map. Node dragging has no keyboard
  equivalent either.
- **Node boxes are estimated, not measured.** `estimateNodeSize` guesses width
  from label text; MathJax then renders into a fixed-width box, so long
  expressions can overflow and edges can anchor away from the visible edge.
- **Authoring is browser-local.** Admin edits live in `localStorage` until
  exported and committed by hand. Two people cannot author the same map.
- **The map colours in `data/` do not match the editor palette.** Published maps
  use `#0f766e`, `#06b6d4`, `#fb7185`; the builder offers a different
  seven-colour UChicago set, so editing a built-in map forces a recolour.
- **No tests or linting**, and no `package.json`.

---

## Changelog

### 2026-07-25

- Fixed four regexes that expected doubled backslashes and so never matched
  authored LaTeX, including the one that made every math node clamp to maximum
  width.
- Added optional `acceptedAnswers` per edge, with an editor field.
- Added a per-row subject-folder picker in Admin, wiring up the previously
  documented but unimplemented move-between-folders behaviour.
- Built-in maps now load concurrently instead of one round-trip at a time.
- Dragging the label-anchor slider no longer re-runs the auto-layout.
- Corrected the documented `manifest.json` shape (a bare array, not
  `{ "maps": [...] }`) and the `data/maps/` tree.
- Stopped tracking `temp/`, which the Pages workflow was publishing.

### 2026-05-02

- Normalized built-in map storage to subject folders: `data/maps/{subjectId}/{mapId}.json`.
- Updated `data/maps/manifest.json` to point every map entry to the subject-folder path.
- Updated admin manifest export logic to emit subject-folder file paths.
- Updated admin editor publish-path hint to show subject-folder destinations.
- Updated README examples and data-structure documentation to match the normalized layout.
