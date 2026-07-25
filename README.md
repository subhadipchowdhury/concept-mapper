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

Every map row shows where its current version actually lives:

| Badge | Meaning |
|-------|---------|
| **In repo** | Loaded from `data/maps/`, no local override |
| **Exported** | Local copy matches what you last exported or copied |
| **Not exported** | Local edits that are in no file yet — a cleared cache loses them |

Use the **Not exported** filter to see what still needs publishing.

To publish a change to the shared repository:

1. **Copy** the map (clipboard, ready to paste into the file) or **Export** it
   (downloads `{mapId}.json`).
2. Write it to `data/maps/{subjectId}/{mapId}.json`.
3. If you added, removed, or moved a map, export the folder manifest too and
   replace `data/maps/manifest.json`.
4. Run `python tools/validate_maps.py` — CI runs it too, and a failure blocks the
   deploy.
5. Commit and push. The Pages workflow builds and deploys from `main`.

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
├── index.html            # tooling-free entry point (Babel in the browser)
├── styles.css
├── package.json
├── data/maps/
│   ├── manifest.json
│   └── <subject-id>/
│       └── *.json
├── js/                   # load order: helpers → canvas → admin → app
│   ├── helpers.jsx       # palette, storage, map loading, math rendering, answer popup
│   ├── canvas.jsx        # map canvas — nodes, edges, pan/zoom, measured sizing
│   ├── admin.jsx         # builder UI — maps manager and map editor
│   └── app.jsx           # root component — layout, state, sidebar, routing
└── tools/
    ├── build.mjs         # produces ./build for deployment
    ├── validate_maps.py  # schema + reachability + palette gate (runs in CI)
    └── recolor_maps.py   # one-shot palette migration; kept as a record
```

The four scripts are plain scripts, not modules: each declares top-level
functions and publishes them with `Object.assign(window, …)` at the bottom, and
later files use what earlier ones defined. The production build only
*transpiles* them, preserving that arrangement, which is why identifier
minification is switched off in `tools/build.mjs`.

### Node colours

`NODE_PALETTE` in `js/helpers.jsx` is the single source of truth. The builder
swatches derive from it, and `tools/validate_maps.py` reads it out of the JS and
rejects any map using a colour outside it — so the data and the editor cannot
drift apart.

**Stack:** React 18, MathJax, vanilla CSS.

---

## Development and deployment

There are two ways the site runs, and they are deliberately different.

**Locally — no tooling at all.** Open `index.html`. React comes from a CDN and
`@babel/standalone` transpiles the JSX in the browser, so there is nothing to
install and nothing to build. Edit a `.jsx` file and reload.

Serve over HTTP rather than `file://` if you can, since the app `fetch`es
`data/maps/manifest.json`:

```sh
python -m http.server 8000    # then open http://localhost:8000
```

**In production — precompiled.** `tools/build.mjs` writes a self-contained
`./build`: JSX precompiled by esbuild, React's *production* build vendored
locally, and no Babel. The Pages workflow uploads that directory. Visitors get
none of the in-browser transpilation cost.

```sh
npm install
npm run build         # -> ./build
python tools/validate_maps.py
```

Because `index.html` stays tooling-free, the build script has to rewrite its
script tags. It asserts on each replacement and fails loudly if `index.html`
changes shape, rather than silently shipping a half-rewritten page. If you edit
those script tags, update `tools/build.mjs` to match.

CI validates map data, then builds; if either step fails the deploy is skipped
and the previous site stays live.

---

## Known limitations

- **Dev and production load differently.** Local preview transpiles in the
  browser; production is precompiled. A JSX error surfaces in the browser
  console locally and as a failed CI build on push.
- **Authoring is browser-local.** Builder edits live in `localStorage` until
  exported and committed by hand. Two people cannot author the same map, and
  clearing site data discards anything the builder marks *Not exported*.
- **Answer keys are public.** Every map under `data/maps/` is served as plain
  JSON, including maps not listed in the manifest. This is a study aid, not an
  assessment tool.
- **Answer matching is heuristic.** Beyond an edge's `answer` and
  `acceptedAnswers`, correctness relies on a fixed normalizer (case, spacing,
  plurals, `-ly`, common math spellings). Add `acceptedAnswers` rather than
  hoping the heuristics cover a phrasing.
- **Long math can still overflow a node.** Boxes are now measured rather than
  guessed, so edges anchor correctly, but `.node-card` caps at `max-width:
  220px` and MathJax output does not wrap.
- **No tests and no linting.**

---

## Changelog

### 2026-07-25

**Content**

- Published the five authored-but-unreferenced maps: four under
  `differential-equations` (moved out of `future-plans/`) and `reactionKinetics`.
  The manifest listed 3 of 8 maps; it now lists all 8, adding 50 edges.
- Stripped a UTF-8 BOM from `reactionKinetics.json`, which the app tolerated only
  because `parseMapDataText` trims first.

**Correctness**

- Fixed four regexes that expected doubled backslashes and so never matched
  authored LaTeX — including the one in `estimateNodeSize` that made every math
  node clamp to maximum width, and `mathLikeLabel`'s `\\b` (a literal
  backslash-`b`, not a word boundary).
- Node boxes are now measured with `ResizeObserver` instead of guessed, so edges
  anchor to the visible border even after MathJax typesets.
- `normalizeForCompare` now ignores `_published`, which had prevented any
  previously-published override from ever comparing equal to its built-in
  version.
- `downloadMapJSON` no longer writes `_published` into exported files. The
  validator rejects it — and found it already committed in `sequences.json` and
  `series.json`.
- Guarded the progress percentage against a zero-edge map (`NaN%`).
- Fixed the answer popup heading on dropdown questions (most edges are
  dropdowns).

**Accessibility**

- Maps are completable by keyboard: answerable edge labels are real buttons with
  descriptive accessible names, revealed nodes are focusable and arrow-key
  movable, the popup is a proper modal (focus management, focus trap, Escape),
  and answer feedback is announced.

**Authoring**

- Added optional `acceptedAnswers` per edge, with an editor field.
- Added a per-row subject-folder picker, wiring up the previously documented but
  unimplemented move-between-folders behaviour.
- The builder now shows which maps are **Not exported**, states its local-only
  storage model, and offers **Copy** for pasting straight into a repo file.
- One shared `NODE_PALETTE` across `data/` and the builder, replacing 17 ad-hoc
  Tailwind values; enforced by the validator. Removed the dead `accentColor`
  field.

**Infrastructure**

- Added `tools/validate_maps.py` and wired it into CI: schema, id/path agreement,
  finite coordinates, dropdown options, palette, and full reachability from the
  start node.
- Added a deploy-time esbuild build (`tools/build.mjs`) that precompiles the JSX
  and vendors React's production build, removing `@babel/standalone` and the
  React development build from what visitors download. `index.html` stays
  tooling-free for local preview.
- Progress backups are plain JSON instead of XOR-obfuscated `.cmpr`; the old
  format still imports.
- Built-in maps load concurrently instead of one round-trip at a time.
- Dragging the label-anchor slider no longer re-runs the auto-layout.
- Corrected the documented `manifest.json` shape (a bare array, not
  `{ "maps": [...] }`) and the `data/maps/` tree.
- Stopped tracking `temp/`, which the Pages workflow was publishing — including a
  4.3 MB internal PDF.

### 2026-05-02

- Normalized built-in map storage to subject folders: `data/maps/{subjectId}/{mapId}.json`.
- Updated `data/maps/manifest.json` to point every map entry to the subject-folder path.
- Updated admin manifest export logic to emit subject-folder file paths.
- Updated admin editor publish-path hint to show subject-folder destinations.
- Updated README examples and data-structure documentation to match the normalized layout.
