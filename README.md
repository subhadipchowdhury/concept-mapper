# Concept Mapper

## Map Data Structure

Built-in chapter maps are stored as one JSON file per topic:

- `data/maps/manifest.json`
- `data/maps/sequences.json`
- `data/maps/series.json`
- `data/maps/funcSequences.json`

`manifest.json` is the source of loading order and file paths.

## Admin Publish Workflow

Use this workflow to update built-in topic maps via GitHub.

1. Open Admin mode in the app.
2. Create/edit a custom map.
3. Click `Export JSON` to download the current map as `{mapId}.json`.
4. Send that file to the repo manager.
5. Repo manager replaces the matching file in `data/maps/`.
6. Commit and push to GitHub.
7. Users refresh the app to load the updated built-in map.

## Rules

- Keep `map.id` stable once published.
- Keep file name equal to map id (`{mapId}.json`).
- Keep schema consistent: `id`, `title`, `description`, `color`, `accentColor`, `nodes`, `edges`.

## Notes

- Student progress and positions are still local to each browser (`localStorage`).
- Custom maps are still local until exported and promoted into `data/maps/`.
