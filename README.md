# Concept Mapper

## Map Data Structure

Built-in chapter maps are stored as one JSON file per topic:

- `data/maps/manifest.json`
- `data/maps/sequences.json`
- `data/maps/series.json`
- `data/maps/funcSequences.json`

`manifest.json` is the source of loading order and file paths.
It may also include `subjectId` and `subjectTitle` for folder grouping.

## Admin Publish Workflow

Use this workflow to update built-in topic maps via GitHub.

1. Open Admin mode in the app.
2. Create/edit a custom map.
3. Click `Export JSON` to download the current map as `{mapId}.json`.
4. If folder assignment/order changed, click `Export Manifest`.
5. Send exported files to the repo manager.
6. Repo manager replaces matching map file(s) in `data/maps/`.
7. Repo manager replaces `data/maps/manifest.json` when provided.
8. Commit and push to GitHub.
9. Users refresh the app to load the updated built-in map structure.

## Rules

- Keep `map.id` stable once published.
- Keep file name equal to map id (`{mapId}.json`).
- Keep folder metadata in manifest (`subjectId`, `subjectTitle`) aligned with map intent.
- Keep schema consistent: `id`, `title`, `description`, `color`, `accentColor`, `nodes`, `edges`.

## Notes

- Student progress and positions are still local to each browser (`localStorage`).
- Custom maps are still local until exported and promoted into `data/maps/`.
