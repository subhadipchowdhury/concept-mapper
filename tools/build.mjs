/**
 * Produce a deploy-ready copy of the site in ./build.
 *
 * WHY THIS IS A DEPLOY-TIME STEP AND NOT A DEV REQUIREMENT
 *
 * index.html is checked in as a working, tooling-free page: React from a CDN,
 * @babel/standalone transpiling the JSX in the browser. That means the repo can
 * be previewed by opening index.html — no Node, no install, nothing. That
 * property is worth keeping.
 *
 * The cost is that visitors pay for it: ~2.7 MB of Babel plus React's
 * development build, re-transpiling ~4,600 lines of JSX on every page load,
 * unminified and uncacheable.
 *
 * So this script builds the fast version at deploy time instead. It precompiles
 * the JSX, swaps in React's production build, vendors React locally (one less
 * third-party origin, and no subresource-integrity hash to keep in sync), and
 * emits a self-contained ./build that the Pages workflow uploads.
 *
 * The two paths must stay behaviourally identical, which is why the JSX is only
 * *transformed*, never bundled or module-rewired: the four scripts still run in
 * order in global scope and still hand things to each other via window, exactly
 * as they do under Babel. Identifier minification is deliberately off, since
 * these files depend on their top-level names surviving.
 *
 * If this script throws, the workflow fails and the previous deploy stays live.
 */

import { rm, mkdir, cp, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(REPO, 'build');

// Order matters: helpers defines the shared palette and components, canvas the
// map view, admin the builder, app the root. Same order as index.html.
const SCRIPTS = ['helpers', 'canvas', 'admin', 'app'];

// Copied verbatim into the artifact.
const STATIC = ['styles.css', 'assets', 'data'];

const VENDOR = [
  { from: 'node_modules/react/umd/react.production.min.js', to: 'vendor/react.js' },
  { from: 'node_modules/react-dom/umd/react-dom.production.min.js', to: 'vendor/react-dom.js' },
];

/** Replace exactly once, failing loudly rather than silently producing a broken page. */
function replaceOnce(text, needle, replacement, label) {
  const count = text.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(
      `build: expected exactly one occurrence of ${label} in index.html, found ${count}.\n`
      + `index.html and tools/build.mjs have drifted apart — update the build script.\n`
      + `Looked for: ${needle.slice(0, 120)}`
    );
  }
  return text.replace(needle, replacement);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  for (const { from } of VENDOR) {
    if (!(await exists(path.join(REPO, from)))) {
      throw new Error(`build: missing ${from}. Run \`npm install\` first.`);
    }
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // ── Precompile JSX ────────────────────────────────────────────────────────
  // --jsx=transform emits React.createElement against the global React, which is
  // what the UMD build provides. No bundling, so no import graph to get wrong.
  await esbuild.build({
    entryPoints: SCRIPTS.map((name) => path.join(REPO, 'js', `${name}.jsx`)),
    outdir: path.join(OUT, 'js'),
    loader: { '.jsx': 'jsx' },
    jsx: 'transform',
    target: 'es2020',
    charset: 'utf8',
    // Whitespace and syntax only. minifyIdentifiers would rename the top-level
    // functions these files share with each other through global scope.
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    sourcemap: true,
    logLevel: 'info',
  });

  // ── Static assets ─────────────────────────────────────────────────────────
  for (const entry of STATIC) {
    await cp(path.join(REPO, entry), path.join(OUT, entry), { recursive: true });
  }

  // ── Vendor React locally ──────────────────────────────────────────────────
  await mkdir(path.join(OUT, 'vendor'), { recursive: true });
  for (const { from, to } of VENDOR) {
    await cp(path.join(REPO, from), path.join(OUT, to));
  }

  // ── Rewrite index.html for production ─────────────────────────────────────
  let html = await readFile(path.join(REPO, 'index.html'), 'utf8');

  // React/ReactDOM development CDN builds -> local production builds.
  html = replaceOnce(
    html,
    '<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>',
    '<script src="vendor/react.js"></script>',
    'the React development script tag'
  );
  html = replaceOnce(
    html,
    '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>',
    '<script src="vendor/react-dom.js"></script>',
    'the ReactDOM development script tag'
  );

  // Babel is only needed to transpile in the browser; the JSX is compiled now.
  html = replaceOnce(
    html,
    '<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>',
    '<!-- @babel/standalone not needed: JSX is precompiled by tools/build.mjs -->',
    'the Babel standalone script tag'
  );

  for (const name of SCRIPTS) {
    html = replaceOnce(
      html,
      `<script type="text/babel" src="js/${name}.jsx"></script>`,
      `<script src="js/${name}.js" defer></script>`,
      `the js/${name}.jsx script tag`
    );
  }

  // Self-check: catch a silent partial rewrite before it ships.
  const mustBeGone = ['text/babel', 'babel.min.js', 'react.development', 'react-dom.development', '.jsx"'];
  const leftovers = mustBeGone.filter((s) => html.includes(s));
  if (leftovers.length) {
    throw new Error(`build: production index.html still references ${leftovers.join(', ')}`);
  }
  for (const name of SCRIPTS) {
    if (!html.includes(`js/${name}.js"`)) {
      throw new Error(`build: production index.html is missing the js/${name}.js tag`);
    }
  }

  await writeFile(path.join(OUT, 'index.html'), html, 'utf8');

  console.log(`\nbuild: wrote ${path.relative(REPO, OUT)}/ (index.html, js/, vendor/, ${STATIC.join(', ')})`);
}

await main();
