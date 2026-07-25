// Helpers and shared components
// Exposes: MathNode, launchConfetti, AnswerPopup

const { useState, useEffect, useRef, useMemo } = React;

// ─── Node palette ───────────────────────────────────────────────────────────
// The single source of truth for node colours, shared by the builder swatches
// and the authored maps in data/. Previously the data used 17 ad-hoc Tailwind
// values while the builder offered a different 7-colour set, so opening a
// built-in map in the editor forced a recolour. tools/recolor_maps.py records
// how the old values were folded onto these.
//
// Nodes render as `hex + '22'` fill with a darkened border (see shadeForPaper),
// so these read as tints on the paper background.
const NODE_PALETTE = [
  { name: 'Lake',            hex: '#007396' },
  { name: 'Light Lake',      hex: '#3EB1C8' },
  { name: 'Ivy',             hex: '#A9C47F' },
  { name: 'Forest',          hex: '#9CAF88' },
  { name: 'Goldenrod',       hex: '#EAAA00' },
  { name: 'Light Goldenrod', hex: '#F6D25A' },
  { name: 'Terracotta',      hex: '#ECA154' },
  { name: 'Brick',           hex: '#A4343A' },
  { name: 'Light Brick',     hex: '#B46A55' },
  { name: 'Violet',          hex: '#A78BBF' },
  { name: 'Plum',            hex: '#C98AA8' },
  { name: 'Greystone',       hex: '#A6A6A6' },
];

const DEFAULT_NODE_COLOR = '#3EB1C8';

// Normalize display text so authored escape sequences render consistently.
function normalizeDisplayText(rawText) {
  return String(rawText || '')
    // Support JSON-authored escaped newlines.
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    // Tolerate accidental standalone /n tokens in author text.
    .replace(/(^|\s)\/n(?=\s|$)/g, '$1\n')
    .replace(/(?:\\_){2,}/g, (m) => '_'.repeat(m.length / 2));
}

// Flatten authored text to a bare phrase for accessible names and tooltips,
// where raw LaTeX would be read out character by character. Best effort: drops
// the \( \) delimiters and control words, keeping the variables between them.
function plainLabel(text) {
  return String(text || '')
    .replace(/\\r\\n|\\n/g, ' ')
    .replace(/\\[()[\]]/g, ' ')
    .replace(/\\(?:mathbb|mathcal|mathrm|text|left|right|displaystyle)\b/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, ' $1 ')
    .replace(/[{}$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// MathJax-rendered text (handles \n as <br>)
function MathNode({ text, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function typesetWhenReady() {
      if (cancelled || !ref.current) return;
      if (window.MathJax && window.MathJax.typesetPromise) {
        // Clear prior MathJax artifacts before re-typesetting updated content.
        if (window.MathJax.typesetClear) window.MathJax.typesetClear([ref.current]);
        window.MathJax.typesetPromise([ref.current]).catch(() => {});
        return;
      }
      if (attempts < 40) {
        attempts += 1;
        setTimeout(typesetWhenReady, 100);
      }
    }

    typesetWhenReady();
    return () => { cancelled = true; };
  }, [text]);
  const normalizedText = normalizeDisplayText(text);
  return (
    <span
      ref={ref}
      className={`node-label-text ${className}`}
      style={{ whiteSpace: 'pre-line' }}
    >
      {normalizedText}
    </span>
  );
}

// Confetti
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = NODE_PALETTE.map((c) => c.hex);
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    r: Math.random() * 9 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 5 + 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.25,
  }));
  let opacity = 1;
  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = opacity;
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
    });
    opacity -= 0.0025;
    if (opacity > 0) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  draw();
}

// Compute orthogonal bezier path between two points (anchored on box edges)
function computeEdgePath(from, to, options = {}) {
  const portOffset = Number.isFinite(options.portOffset) ? options.portOffset : 0;
  const labelT = Number.isFinite(options.labelT) ? Math.max(0, Math.min(1, options.labelT)) : 0.4;
  // from / to: { x, y, w, h }  -- center coords
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Choose anchors: bottom of from, top of to (vertical preferred)
  const verticalDominant = Math.abs(dy) > Math.abs(dx) * 0.4;
  let sx, sy, ex, ey, c1x, c1y, c2x, c2y;
  if (verticalDominant) {
    sx = from.x;
    sy = dy > 0 ? from.y + from.h/2 : from.y - from.h/2;
    ex = to.x;
    ey = dy > 0 ? to.y - to.h/2 : to.y + to.h/2;
    if (portOffset !== 0) {
      sx += portOffset;
      ex += portOffset;
    }
    const midY = (sy + ey) / 2;
    c1x = sx; c1y = midY;
    c2x = ex; c2y = midY;
  } else {
    sx = dx > 0 ? from.x + from.w/2 : from.x - from.w/2;
    sy = from.y;
    ex = dx > 0 ? to.x - to.w/2 : to.x + to.w/2;
    ey = to.y;
    if (portOffset !== 0) {
      sy += portOffset;
      ey += portOffset;
    }
    const midX = (sx + ex) / 2;
    c1x = midX; c1y = sy;
    c2x = midX; c2y = ey;
  }

  const omt = 1 - labelT;
  const labelX = (omt * omt * omt * sx)
    + (3 * omt * omt * labelT * c1x)
    + (3 * omt * labelT * labelT * c2x)
    + (labelT * labelT * labelT * ex);
  const labelY = (omt * omt * omt * sy)
    + (3 * omt * omt * labelT * c1y)
    + (3 * omt * labelT * labelT * c2y)
    + (labelT * labelT * labelT * ey);

  return {
    d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
    midX: labelX,
    midY: labelY,
    sx, sy, ex, ey
  };
}

// Fold an answer to a canonical form: lowercase, single-spaced, with common
// math spellings unified so "leq"/"<="/"less than or equal to" all compare equal.
// Applied to both the student's input and every accepted answer.
function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    // strip trailing punctuation
    .replace(/[.,;:!?]+$/g, '')
    // unify common math glyph spellings (order matters: "or equal" before bare
    // "less than", so "less than or equal to" is not chopped in half)
    .replace(/<=|≤|=<|\bleq\b|less than or equal( to)?/g, '≤')
    .replace(/>=|≥|=>|\bgeq\b|greater than or equal( to)?/g, '≥')
    .replace(/less than/g, '<')
    .replace(/greater than/g, '>')
    .replace(/sqrt\(([^)]+)\)/g, '√$1')
    .replace(/sqrt\s*([a-z0-9])/g, '√$1')
    // \b guards keep this from mangling unrelated words ("steps" -> "st<eps>")
    .replace(/\b(?:epsilon|eps)\b/g, 'ε')
    .replace(/\bzero\b/g, '0')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2');
}

// AnswerPopup — handles fill-in or dropdown
function AnswerPopup({ edge, fromNode, toNode, onClose, onCorrect }) {
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | 'giveaway' | null
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);

  // Shuffle dropdown options once per popup open (Fisher-Yates with seeded RNG from edge.id)
  const shuffledOptions = useMemo(() => {
    const opts = [...(edge.options || [])];
    // Simple seeded PRNG (mulberry32) so the order is stable for this edge instance
    let seed = [...(edge.id || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [edge.id]);
  const cardRef = useRef(null);
  const selectRef = useRef(null);
  // Remember what opened the dialog so focus can go back there on close;
  // otherwise a keyboard user is dumped at the top of the document.
  const returnFocusRef = useRef(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    const target = edge.type === 'fillin' ? inputRef.current : selectRef.current;
    if (target) target.focus();
    setTimeout(() => {
      if (window.MathJax && window.MathJax.typesetPromise && cardRef.current) {
        window.MathJax.typesetPromise([cardRef.current]).catch(()=>{});
      }
    }, 80);
    return () => {
      const back = returnFocusRef.current;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    };
  }, [edge.id]);

  // Escape closes from anywhere in the dialog, and Tab is trapped inside it.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll(
        'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  function checkAnswer() {
    const userAns = normalizeAnswer(value);
    // Authors may list alternate phrasings in `acceptedAnswers`; `answer` is
    // always accepted and is the one revealed on the map once solved.
    const accepted = [edge.answer, ...(Array.isArray(edge.acceptedAnswers) ? edge.acceptedAnswers : [])]
      .map(normalizeAnswer)
      .filter(Boolean);
    const isCorrect = accepted.some((correct) => (
      userAns === correct ||
      // accept singular/plural variants for length >=4
      (correct.length >= 4 && (userAns === correct + 's' || userAns + 's' === correct)) ||
      // accept "ly" adverb variants ("conditional"/"conditionally")
      (correct.length >= 5 && (userAns === correct + 'ly' || userAns + 'ly' === correct))
    ));
    if (isCorrect) {
      setFeedback('correct');
      setTimeout(() => { onCorrect(edge.id); onClose(); }, 800);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setFeedback('wrong');
      // Hint only after 2 wrong attempts (per user request: no tooltip until multiple errors)
      if (newAttempts >= 2 && edge.hint) setShowHint(true);
      // Quick clear so they can retype; do not auto-unlock on repeated misses.
      setTimeout(() => setFeedback(null), 1200);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && value.trim()) checkAnswer();
    if (e.key === 'Escape') onClose();
  }

  const displayLabel = normalizeDisplayText(edge.label || '');
  const rawAnswer = String(edge.answer || '').trim();
  // Authored text carries single-backslash LaTeX (\( … \), \sqrt, \mathbb).
  // These patterns previously required a doubled backslash and so never fired.
  const mathLikeAnswer = /sqrt|\\[a-zA-Z]+|√|ε|π|∞|≤|≥|≈|≠|[<>=+\-*/^()\[\]{}_|]|\d|^[a-zA-Z]$/i.test(rawAnswer);
  const mathLikeLabel = /\\\(|\\\)|\b(sum|lim|sup|inf|integral|series|radius|convergen|derivative)\b|\^|_/.test(String(edge.label || ''));
  const expectsMathAnswer = edge.type === 'fillin' && (mathLikeAnswer || (mathLikeLabel && rawAnswer.length <= 3));
  const answerVars = Array.from(new Set(rawAnswer.match(/[a-zA-Z]/g) || [])).slice(0, 4);
  const mathPaletteTokens = ['√()', 'ε', 'π', '∞', '≤', '≥', '<', '>', '=', '+', '-', '/', '^', '_', '{', '}', '(', ')', ...answerVars];

  function insertMathToken(token) {
    const el = inputRef.current;
    const current = value || '';
    const start = el && Number.isFinite(el.selectionStart) ? el.selectionStart : current.length;
    const end = el && Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;

    let insert = token;
    let cursorBack = 0;
    if (token === '√()') {
      insert = '√()';
      cursorBack = 1; // place cursor inside parentheses
    }

    const next = current.slice(0, start) + insert + current.slice(end);
    setValue(next);
    if (feedback === 'wrong') setFeedback(null);

    requestAnimationFrame(() => {
      const inputEl = inputRef.current;
      if (!inputEl) return;
      inputEl.focus();
      const pos = start + insert.length - cursorBack;
      inputEl.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="answer-popup" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="answer-popup-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="answer-popup-heading"
      >
        <div className="popup-relationship" id="answer-popup-heading">
          {edge.type === 'fillin' ? 'Fill in the relationship' : 'Choose the relationship'}
        </div>

        <div className="popup-nodes">
          <div className="popup-node-label">
            <MathNode text={fromNode.label} />
          </div>
          <div className="popup-arrow">→</div>
          <div className="popup-node-label">
            <MathNode text={toNode.label} />
          </div>
        </div>

        {attempts > 0 && (
          <div className="attempt-dots">
            {Array.from({ length: Math.min(attempts, 4) }).map((_, i) => (
              <div key={i} className="attempt-dot wrong"></div>
            ))}
            {Array.from({ length: Math.max(0, 4 - attempts) }).map((_, i) => (
              <div key={'r'+i} className="attempt-dot"></div>
            ))}
          </div>
        )}

        {showHint && edge.hint && (
          <div className="popup-hint">
            <strong>Hint:</strong> <MathNode text={edge.hint} />
          </div>
        )}

        <div className="popup-label">
            The label reads: <em><MathNode text={displayLabel} /></em>
        </div>

        {edge.type === 'fillin' ? (
          <>
            <input
              ref={inputRef}
              className={`popup-input ${feedback === 'correct' ? 'correct' : feedback === 'wrong' ? 'wrong' : ''}`}
              type="text"
              placeholder="Type your answer…"
              value={value}
              onChange={e => { setValue(e.target.value); if (feedback === 'wrong') setFeedback(null); }}
              onKeyDown={handleKey}
              autoComplete="off"
              spellCheck="false"
            />
            {expectsMathAnswer && (
              <div className="math-palette" aria-label="Math palette">
                {mathPaletteTokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    className="math-token-btn"
                    onClick={() => insertMathToken(token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <select
            ref={selectRef}
            className="popup-select"
            value={value}
            onChange={e => { setValue(e.target.value); setFeedback(null); }}
            onKeyDown={e => { if (e.key === 'Enter' && value.trim()) checkAnswer(); }}
            aria-label="Choose the relationship"
          >
            <option value="">— choose one —</option>
            {shuffledOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {/* Announced to screen readers, since the only other signal that an
            answer was wrong is a colour change on the input. */}
        <div role="status" aria-live="polite">
          {feedback === 'correct' && (
            <div className="popup-feedback correct">✓ Correct! Unlocking next concepts…</div>
          )}
          {feedback === 'wrong' && (
            <div className="popup-feedback wrong">
              ✗ Not quite — {attempts >= 2 ? 'check the hint above' : 'try again'}
            </div>
          )}
        </div>
        <div className="popup-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {feedback !== 'correct' && (
            <button
              className="btn btn-primary"
              onClick={checkAnswer}
              disabled={!value.trim()}
            >
              Check
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage helpers
const PROGRESS_STORAGE_KEY = 'conceptmapper_progress_v2';
const CUSTOM_MAPS_STORAGE_KEY = 'conceptmapper_maps_v2';
const POSITIONS_STORAGE_KEY = 'conceptmapper_positions_v2';
const MAP_ORDER_STORAGE_KEY = 'conceptmapper_map_order_v1';
const MAP_MANIFEST_PATH = 'data/maps/manifest.json';
const LEGACY_SEQUENCES_MAP_ID = 'sequencesConceptual';
const CANONICAL_SEQUENCES_MAP_ID = 'sequences';
const RETIRED_SERIES_V2_MAP_ID = 'seriesV2';

// Normalize map ordering by migrating legacy ids and removing retired entries.
function migrateLegacyMapIdInOrder(order) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(order) ? order : []).forEach((id) => {
    const nextId = id === LEGACY_SEQUENCES_MAP_ID ? CANONICAL_SEQUENCES_MAP_ID : id;
    if (nextId === RETIRED_SERIES_V2_MAP_ID) return;
    if (!seen.has(nextId)) {
      seen.add(nextId);
      normalized.push(nextId);
    }
  });
  return normalized;
}

// Read student progress from local storage and migrate legacy map ids.
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const migrated = { ...(parsed || {}) };
    let mutated = false;
    const legacyEntry = migrated[LEGACY_SEQUENCES_MAP_ID];
    if (legacyEntry) {
      const canonicalEdges = Array.isArray(migrated[CANONICAL_SEQUENCES_MAP_ID]?.answeredEdges)
        ? migrated[CANONICAL_SEQUENCES_MAP_ID].answeredEdges
        : [];
      const legacyEdges = Array.isArray(legacyEntry.answeredEdges) ? legacyEntry.answeredEdges : [];
      migrated[CANONICAL_SEQUENCES_MAP_ID] = {
        answeredEdges: [...new Set([...canonicalEdges, ...legacyEdges])],
      };
      delete migrated[LEGACY_SEQUENCES_MAP_ID];
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(migrated, RETIRED_SERIES_V2_MAP_ID)) {
      delete migrated[RETIRED_SERIES_V2_MAP_ID];
      mutated = true;
    }

    if (mutated) {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
    }

    const result = {};
    Object.entries(migrated).forEach(([mapId, p]) => {
      result[mapId] = {
        answeredEdges: new Set(p.answeredEdges || []),
      };
    });
    return result;
  } catch { return {}; }
}

// Persist student progress (Set -> array serialization).
function saveProgress(allProgress) {
  const serializable = {};
  Object.entries(allProgress).forEach(([mapId, p]) => {
    serializable[mapId] = {
      answeredEdges: [...(p.answeredEdges || [])],
    };
  });
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(serializable));
}

// Read custom maps from local storage and remove retired map records.
function loadCustomMaps() {
  try {
    const raw = localStorage.getItem(CUSTOM_MAPS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, RETIRED_SERIES_V2_MAP_ID)) {
      const migrated = { ...parsed };
      delete migrated[RETIRED_SERIES_V2_MAP_ID];
      localStorage.setItem(CUSTOM_MAPS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

// Persist custom map dictionary.
function saveCustomMaps(maps) {
  localStorage.setItem(CUSTOM_MAPS_STORAGE_KEY, JSON.stringify(maps));
}

// Read map ordering preference with legacy id migration.
function loadMapOrder() {
  try {
    const raw = localStorage.getItem(MAP_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const normalized = migrateLegacyMapIdInOrder(parsed);
    if (raw && JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      localStorage.setItem(MAP_ORDER_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch { return []; }
}

// Persist map ordering preference after migration normalization.
function saveMapOrder(order) {
  localStorage.setItem(MAP_ORDER_STORAGE_KEY, JSON.stringify(migrateLegacyMapIdInOrder(order)));
}

// Parse raw map-file text and surface readable source-context errors.
function parseMapDataText(rawText, sourcePath = '') {
  const text = (rawText || '').trim();
  if (!text) throw new Error(`Map file is empty: ${sourcePath}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Could not parse map file: ${sourcePath}`);
  }
}

// Enforce a safe runtime map schema (drop malformed nodes/edges, fill defaults).
function normalizeMapData(rawMap, fallbackId) {
  const map = rawMap && typeof rawMap === 'object' ? rawMap : {};
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];

  const safeNodes = nodes.filter((n) => (
    n &&
    typeof n.id === 'string' &&
    Number.isFinite(n.x) &&
    Number.isFinite(n.y)
  ));
  const nodeIds = new Set(safeNodes.map((n) => n.id));

  const safeEdges = edges.filter((e) => (
    e &&
    typeof e.id === 'string' &&
    typeof e.from === 'string' &&
    typeof e.to === 'string' &&
    nodeIds.has(e.from) &&
    nodeIds.has(e.to)
  ));

  return {
    ...map,
    id: typeof map.id === 'string' ? map.id : fallbackId,
    title: typeof map.title === 'string' ? map.title : 'Untitled Map',
    description: typeof map.description === 'string' ? map.description : '',
    color: typeof map.color === 'string' ? map.color : DEFAULT_NODE_COLOR,
    subjectId: typeof map.subjectId === 'string' ? map.subjectId : 'general',
    subjectTitle: typeof map.subjectTitle === 'string' ? map.subjectTitle : 'General',
    nodes: safeNodes,
    edges: safeEdges,
  };
}

// Load all built-in maps from manifest and normalize each map payload.
async function loadBuiltInMaps(manifestPath = MAP_MANIFEST_PATH) {
  const manifestResp = await fetch(manifestPath, { cache: 'no-store' });
  if (!manifestResp.ok) {
    throw new Error(`Failed to load map manifest (${manifestResp.status})`);
  }

  const manifest = await manifestResp.json();
  if (!Array.isArray(manifest)) {
    throw new Error('Map manifest must be an array.');
  }

  const loadedMaps = {};
  const failures = [];
  const order = [];

  // Fetch every map concurrently — these were previously awaited one at a time,
  // so first paint cost one serial round-trip per map in the manifest.
  const entries = manifest.filter((entry) => entry && entry.id && entry.file);
  const results = await Promise.all(entries.map(async (entry) => {
    try {
      const resp = await fetch(entry.file, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rawText = await resp.text();
      return { entry, parsed: parseMapDataText(rawText, entry.file) };
    } catch (err) {
      return { entry, error: err };
    }
  }));

  // Apply results in manifest order so sidebar ordering stays deterministic.
  for (const { entry, parsed, error } of results) {
    if (error) {
      failures.push(`${entry.id}: ${error.message}`);
      continue;
    }
    const normalized = normalizeMapData(parsed, entry.id);
    const mapId = normalized.id || entry.id;
    const subjectId = typeof entry.subjectId === 'string' && entry.subjectId.trim()
      ? entry.subjectId.trim()
      : (typeof normalized.subjectId === 'string' && normalized.subjectId.trim() ? normalized.subjectId.trim() : 'general');
    const subjectTitle = typeof entry.subjectTitle === 'string' && entry.subjectTitle.trim()
      ? entry.subjectTitle.trim()
      : (typeof normalized.subjectTitle === 'string' && normalized.subjectTitle.trim() ? normalized.subjectTitle.trim() : 'General');

    loadedMaps[mapId] = {
      ...normalized,
      subjectId,
      subjectTitle,
    };
    order.push(mapId);
  }

  return { maps: loadedMaps, failures, order };
}

// Download one map payload as {mapId}.json for repo promotion.
function downloadMapJSON(mapId, mapData) {
  if (!mapId || !mapData) return;
  // `_published` is local sidebar state, not part of the published map file.
  const { _published, ...publishable } = mapData;
  const payload = {
    ...publishable,
    id: mapId,
    updatedAt: new Date().toISOString(),
    exportedBy: 'admin',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${mapId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Download manifest.json from current ordered entry list.
function downloadManifestJSON(entries) {
  if (!Array.isArray(entries)) return;
  const payload = entries
    .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.file === 'string')
    .map((entry) => ({
      id: entry.id,
      title: typeof entry.title === 'string' ? entry.title : entry.id,
      file: entry.file,
      subjectId: typeof entry.subjectId === 'string' ? entry.subjectId : 'general',
      subjectTitle: typeof entry.subjectTitle === 'string' ? entry.subjectTitle : 'General',
    }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manifest.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Read per-map node positions from local storage with legacy id migration.
function loadPositions() {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && parsed[LEGACY_SEQUENCES_MAP_ID]) {
      const migrated = { ...parsed };
      const legacyPos = migrated[LEGACY_SEQUENCES_MAP_ID];
      migrated[CANONICAL_SEQUENCES_MAP_ID] = {
        ...(legacyPos || {}),
        ...(migrated[CANONICAL_SEQUENCES_MAP_ID] || {}),
      };
      delete migrated[LEGACY_SEQUENCES_MAP_ID];
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

// Persist per-map node positions.
function savePositions(p) {
  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(p));
}

// Expose to other Babel scripts
Object.assign(window, {
  MathNode,
  launchConfetti,
  NODE_PALETTE,
  DEFAULT_NODE_COLOR,
  plainLabel,
  computeEdgePath,
  AnswerPopup,
  normalizeAnswer,
  loadBuiltInMaps,
  downloadMapJSON,
  downloadManifestJSON,
  loadProgress, saveProgress,
  loadCustomMaps, saveCustomMaps,
  loadMapOrder, saveMapOrder,
  loadPositions, savePositions,
});
