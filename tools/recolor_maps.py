#!/usr/bin/env python3
"""One-shot remap of map node colours onto the shared UChicago palette.

The authored maps used 17 ad-hoc Tailwind hex values while the builder offered
a different 7-colour UChicago set, so opening a built-in map in the editor
forced a recolour. This maps every value in the data onto js/palette.js by hue
family, and refuses to run if any two colours that co-occur within a single map
would collapse onto the same target (which would erase a distinction the author
was drawing).

Kept in the repo as the record of how the mapping was chosen. Re-running it on
already-migrated data is a no-op.
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MAPS = sorted((REPO / "data" / "maps").glob("*/*.json"))

# Old Tailwind value -> new brand value. Grouped by hue so that the author's
# colour *coding* survives even though the specific hex changes.
REMAP = {
    # deep blues / dark teal -> Lake
    "#0f766e": "#007396",
    "#3b82f6": "#007396",
    "#4f8ef7": "#007396",
    "#0ea5e9": "#007396",
    "#0284c7": "#007396",
    "#1d4ed8": "#007396",
    # cyan -> Light Lake
    "#06b6d4": "#3EB1C8",
    # greens -> Ivy / Forest (kept distinct: several maps use both)
    "#22c55e": "#A9C47F",
    "#16a34a": "#A9C47F",
    "#34d399": "#9CAF88",
    # ambers -> Goldenrod / Light Goldenrod
    "#f59e0b": "#EAAA00",
    "#fcd34d": "#F6D25A",
    # orange -> Terracotta
    "#fb923c": "#ECA154",
    # reds / roses -> Brick / Light Brick (kept distinct: reactionKinetics uses
    # a stronger red for its root node than for downstream mechanism steps)
    "#ef4444": "#A4343A",
    "#b91c1c": "#A4343A",
    "#fb7185": "#B46A55",
    "#f43f5e": "#B46A55",
    # purples -> Violet
    "#a78bfa": "#A78BBF",
    "#8b5cf6": "#A78BBF",
    "#a855f7": "#A78BBF",
    "#7c3aed": "#A78BBF",
    # pink -> Plum
    "#f472b6": "#C98AA8",
}


def check_collisions() -> list[str]:
    """Refuse to merge two colours the author used side by side in one map."""
    problems = []
    for path in MAPS:
        data = json.loads(path.read_text(encoding="utf-8"))
        buckets = defaultdict(set)
        for node in data.get("nodes", []):
            old = node.get("color")
            if old in REMAP:
                buckets[REMAP[old]].add(old)
        for new, olds in buckets.items():
            if len(olds) > 1:
                problems.append(
                    f"{path.name}: {sorted(olds)} would all become {new}"
                )
    return problems


def main() -> int:
    problems = check_collisions()
    if problems:
        print("Refusing to recolour — these merges would erase a distinction:")
        for p in problems:
            print(f"  {p}")
        return 1

    unknown: set[str] = set()
    total = 0
    for path in MAPS:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)

        present = {n.get("color") for n in data.get("nodes", [])}
        present |= {data.get("color"), data.get("accentColor")}
        unknown |= {c for c in present if c and c not in REMAP and c not in REMAP.values()}

        # Textual replacement keeps the diff to colour lines only, preserving
        # each file's existing formatting and line endings.
        changed = 0
        for old, new in REMAP.items():
            for quoted_old, quoted_new in ((f'"{old}"', f'"{new}"'), (f'"{old.upper()}"', f'"{new}"')):
                if quoted_old in text:
                    changed += text.count(quoted_old)
                    text = text.replace(quoted_old, quoted_new)
        if changed:
            path.write_text(text, encoding="utf-8", newline="")
            total += changed
            print(f"{path.name}: {changed} colour value(s) remapped")

    if unknown:
        print(f"\nWARNING: unmapped colours still present: {sorted(unknown)}")
    print(f"\n{total} colour value(s) remapped across {len(MAPS)} maps")
    return 0


if __name__ == "__main__":
    sys.exit(main())
