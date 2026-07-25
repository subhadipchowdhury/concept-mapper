#!/usr/bin/env python3
"""Validate data/maps/ against the schema the app actually enforces at runtime.

Run locally with `python tools/validate_maps.py`; CI runs it on every push.

This mirrors normalizeMapData() and auditUnlockGraph() in the app, so anything
this script rejects would have been silently dropped or flagged in the browser.
Exits non-zero on any error. Warnings do not fail the build.
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MAPS_DIR = REPO / "data" / "maps"
MANIFEST = MAPS_DIR / "manifest.json"

MANIFEST_FIELDS = ("id", "title", "file", "subjectId", "subjectTitle")
VALID_EDGE_TYPES = ("fillin", "dropdown")


def load_palette() -> set[str]:
    """Read the allowed node colours straight out of js/helpers.jsx, so the
    palette is declared in exactly one place and cannot drift from the data."""
    source = (REPO / "js" / "helpers.jsx").read_text(encoding="utf-8")
    block = re.search(r"const NODE_PALETTE = \[(.*?)\];", source, re.S)
    if not block:
        print("ERROR:   could not find NODE_PALETTE in js/helpers.jsx")
        sys.exit(1)
    return set(re.findall(r"hex:\s*'(#[0-9A-Fa-f]{6})'", block.group(1)))


PALETTE = load_palette()

errors: list[str] = []
warnings: list[str] = []


def err(where: str, msg: str) -> None:
    errors.append(f"{where}: {msg}")


def warn(where: str, msg: str) -> None:
    warnings.append(f"{where}: {msg}")


def load_json(path: Path, where: str):
    """Read JSON, rejecting a UTF-8 BOM. JSON.parse() tolerates one only
    because the app happens to .trim() first; other tooling does not."""
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        err(where, "file starts with a UTF-8 BOM; save it as UTF-8 without BOM")
        raw = raw[3:]
    try:
        return json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        err(where, f"is not valid JSON ({exc})")
        return None


def reachable_from_starts(nodes, edges):
    """BFS from start nodes, matching the app's unlock rule."""
    starts = [n["id"] for n in nodes if n.get("isStart")]
    if not starts and nodes:
        starts = [nodes[0]["id"]]
    seen, queue = set(starts), list(starts)
    while queue:
        current = queue.pop(0)
        for edge in edges:
            if edge.get("from") == current and edge.get("to") not in seen:
                seen.add(edge["to"])
                queue.append(edge["to"])
    return seen


def validate_map(path: Path, entry: dict) -> None:
    where = str(path.relative_to(REPO)).replace("\\", "/")
    data = load_json(path, where)
    if data is None:
        return

    map_id = data.get("id")
    if map_id != entry["id"]:
        err(where, f"map id {map_id!r} does not match manifest id {entry['id']!r}")
    if path.stem != entry["id"]:
        err(where, f"filename should be {entry['id']}.json to match the map id")

    expected = f"data/maps/{entry['subjectId']}/{entry['id']}.json"
    if entry["file"] != expected:
        err(where, f"manifest path should be {expected!r}, not {entry['file']!r}")

    for field in ("subjectId", "subjectTitle"):
        if data.get(field) != entry[field]:
            err(where, f"{field} is {data.get(field)!r} but manifest says {entry[field]!r}")

    for field in ("title", "description"):
        if not isinstance(data.get(field), str) or not data[field].strip():
            err(where, f"missing a non-empty {field}")

    if data.get("color") not in PALETTE:
        err(where, f"map color {data.get('color')!r} is not in the shared palette")
    if "accentColor" in data:
        err(where, "accentColor was removed; nothing reads it")

    nodes = data.get("nodes")
    edges = data.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        err(where, "nodes and edges must both be arrays")
        return
    if not nodes:
        err(where, "has no nodes")
        return

    # ── Nodes ──
    node_ids: set[str] = set()
    for i, node in enumerate(nodes):
        at = f"{where} node[{i}]"
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id:
            err(at, "needs a non-empty string id")
            continue
        if node_id in node_ids:
            err(at, f"duplicate node id {node_id!r}")
        node_ids.add(node_id)
        # The app drops any node whose coords are not finite numbers.
        for axis in ("x", "y"):
            value = node.get(axis)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                err(at, f"{node_id!r} has non-numeric {axis} ({value!r}); the app would drop this node")
        if not isinstance(node.get("label"), str) or not node["label"].strip():
            err(at, f"{node_id!r} has no label")
        colour = node.get("color")
        if colour is not None and colour not in PALETTE:
            err(at, f"{node_id!r} colour {colour!r} is not in the shared palette (js/helpers.jsx NODE_PALETTE)")

    starts = [n.get("id") for n in nodes if n.get("isStart")]
    if not starts:
        err(where, "no node is marked isStart")
    elif len(starts) > 1:
        warn(where, f"{len(starts)} start nodes ({', '.join(map(str, starts))})")

    # ── Edges ──
    edge_ids: set[str] = set()
    for i, edge in enumerate(edges):
        at = f"{where} edge[{i}]"
        edge_id = edge.get("id")
        if not isinstance(edge_id, str) or not edge_id:
            err(at, "needs a non-empty string id")
            continue
        if edge_id in edge_ids:
            err(at, f"duplicate edge id {edge_id!r}")
        edge_ids.add(edge_id)

        for end in ("from", "to"):
            target = edge.get(end)
            if target not in node_ids:
                err(at, f"{edge_id!r} {end} references unknown node {target!r}")
        if edge.get("from") == edge.get("to"):
            err(at, f"{edge_id!r} is a self-loop")

        if not isinstance(edge.get("label"), str) or not edge["label"].strip():
            err(at, f"{edge_id!r} has no label")

        answer = edge.get("answer")
        if not isinstance(answer, str) or not answer.strip():
            err(at, f"{edge_id!r} has no answer")

        edge_type = edge.get("type")
        if edge_type not in VALID_EDGE_TYPES:
            err(at, f"{edge_id!r} type is {edge_type!r}; expected one of {VALID_EDGE_TYPES}")

        if edge_type == "dropdown":
            options = edge.get("options")
            if not isinstance(options, list) or len(options) < 2:
                err(at, f"{edge_id!r} is a dropdown but has fewer than 2 options")
            else:
                if isinstance(answer, str) and answer not in options:
                    err(at, f"{edge_id!r} answer {answer!r} is not among its options")
                if len(set(options)) != len(options):
                    err(at, f"{edge_id!r} has duplicate options")

        accepted = edge.get("acceptedAnswers")
        if accepted is not None and (
            not isinstance(accepted, list) or not all(isinstance(a, str) for a in accepted)
        ):
            err(at, f"{edge_id!r} acceptedAnswers must be an array of strings")

        if not str(edge.get("hint") or "").strip():
            warn(at, f"{edge_id!r} has no hint (shown after 2 wrong attempts)")

    # ── Reachability: an unreachable node can never be revealed by answering ──
    valid_edges = [e for e in edges if e.get("from") in node_ids and e.get("to") in node_ids]
    seen = reachable_from_starts([n for n in nodes if n.get("id") in node_ids], valid_edges)
    orphans = [n["id"] for n in nodes if n.get("id") and n["id"] not in seen]
    if orphans:
        err(where, f"unreachable from the start node: {', '.join(orphans)}")


def main() -> int:
    manifest = load_json(MANIFEST, "data/maps/manifest.json")
    if manifest is None:
        print_report()
        return 1
    if not isinstance(manifest, list):
        err("data/maps/manifest.json", "must be a bare JSON array")
        print_report()
        return 1

    seen_ids: set[str] = set()
    listed: set[Path] = set()

    for i, entry in enumerate(manifest):
        at = f"manifest[{i}]"
        if not isinstance(entry, dict):
            err(at, "is not an object")
            continue
        missing = [f for f in MANIFEST_FIELDS if not str(entry.get(f) or "").strip()]
        if missing:
            err(at, f"missing required field(s): {', '.join(missing)}")
            continue
        if entry["id"] in seen_ids:
            err(at, f"duplicate map id {entry['id']!r}")
        seen_ids.add(entry["id"])

        path = REPO / entry["file"]
        if not path.is_file():
            err(at, f"file not found: {entry['file']}")
            continue
        listed.add(path.resolve())
        validate_map(path, entry)

    # Anything under data/maps/ is deployed publicly whether or not it is
    # listed, so an unlisted map still leaks its answer key.
    for path in sorted(MAPS_DIR.rglob("*.json")):
        if path.resolve() == MANIFEST.resolve() or path.resolve() in listed:
            continue
        rel = str(path.relative_to(REPO)).replace("\\", "/")
        warn(rel, "is not in the manifest, so the app never loads it — but Pages still publishes it")

    print_report()
    return 1 if errors else 0


def print_report() -> None:
    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"ERROR:   {e}")
    print()
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")


if __name__ == "__main__":
    sys.exit(main())
