#!/usr/bin/env python3
"""Catch JS string literals that run off the end of a line.

Run with `python tools/check_js_strings.py`; CI runs it before the build.

WHY THIS EXISTS

A single- or double-quoted JavaScript string cannot contain a raw newline. When
one does, the file is a syntax error, Babel refuses to compile it in the browser,
and the whole app renders nothing — a blank page, with the cause only visible in
the console. That is exactly how a broken `prompt(...)` string shipped once: an
intended `\\n` escape became a literal newline.

esbuild catches this during the production build, but that only happens in CI
after `npm install`. This check needs no Node, so it can run anywhere Python is
available — including a machine with no JS toolchain at all.

It is deliberately a scanner, not a parser. Regex literals containing quote
characters can produce a false positive, so read each hit rather than trusting
the exit code blindly.
"""

import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
SOURCES = sorted((REPO / "js").glob("*.jsx"))


def scan(path: pathlib.Path) -> list[tuple[int, str, str]]:
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    found: list[tuple[int, str, str]] = []

    i = 0
    line = 1
    state = None  # None | "'" | '"' | '`' | '//' | '/*'
    open_line = 0
    n = len(src)

    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if c == "\n":
            if state in ("'", '"'):
                text = lines[open_line - 1].strip() if open_line - 1 < len(lines) else ""
                found.append((open_line, state, text))
                state = None  # resync, so one bug is not reported for every later line
            elif state == "//":
                state = None
            line += 1
            i += 1
            continue

        if state in ("'", '"', "`"):
            if c == "\\":
                i += 2
                continue
            if c == state:
                state = None
            i += 1
            continue

        if state == "//":
            i += 1
            continue

        if state == "/*":
            if c == "*" and nxt == "/":
                state = None
                i += 2
                continue
            i += 1
            continue

        # Outside any string or comment.
        if c == "/" and nxt == "/":
            state = "//"
            i += 2
            continue
        if c == "/" and nxt == "*":
            state = "/*"
            i += 2
            continue
        if c in ("'", '"', "`"):
            state = c
            open_line = line
            i += 1
            continue
        i += 1

    return found


def main() -> int:
    total = 0
    for path in SOURCES:
        for open_line, quote, text in scan(path):
            rel = path.relative_to(REPO).as_posix()
            print(f"ERROR: {rel}:{open_line}: {quote} string is still open at end of line")
            print(f"       {text[:120]}")
            total += 1

    if total:
        print()
        print(f"{total} unterminated string literal(s).")
        print("A raw newline inside '...' or \"...\" is a syntax error — use \\n instead.")
        return 1

    print(f"{len(SOURCES)} file(s) checked, no unterminated string literals.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
