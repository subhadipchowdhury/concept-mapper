// Helpers and shared components
// Exposes: MathNode, launchConfetti, AnswerPopup, useDrag

const { useState, useEffect, useRef, useCallback, useLayoutEffect } = React;

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
  const normalizedText = (text || '').replace(/(?:\\_){2,}/g, (m) => '_'.repeat(m.length / 2));
  const html = normalizedText.replace(/\\n/g, '<br/>');
  return (
    <span
      ref={ref}
      className={`node-label-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Confetti
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#4f8ef7','#34d399','#f59e0b','#fb7185','#a78bfa','#06b6d4','#f472b6'];
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
function computeEdgePath(from, to) {
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
    const midY = (sy + ey) / 2;
    c1x = sx; c1y = midY;
    c2x = ex; c2y = midY;
  } else {
    sx = dx > 0 ? from.x + from.w/2 : from.x - from.w/2;
    sy = from.y;
    ex = dx > 0 ? to.x - to.w/2 : to.x + to.w/2;
    ey = to.y;
    const midX = (sx + ex) / 2;
    c1x = midX; c1y = sy;
    c2x = midX; c2y = ey;
  }
  return {
    d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
    midX: (sx + ex) / 2 + (c1x + c2x - sx - ex) * 0.15,
    midY: (sy + ey) / 2 + (c1y + c2y - sy - ey) * 0.15,
    sx, sy, ex, ey
  };
}

// AnswerPopup — handles fill-in or dropdown
function AnswerPopup({ edge, fromNode, toNode, onClose, onCorrect }) {
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | 'giveaway' | null
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (edge.type === 'fillin' && inputRef.current) inputRef.current.focus();
    setTimeout(() => {
      if (window.MathJax && window.MathJax.typesetPromise && cardRef.current) {
        window.MathJax.typesetPromise([cardRef.current]).catch(()=>{});
      }
    }, 80);
  }, [edge.id]);

  function checkAnswer() {
    // Robust normalizer: lowercase, fold smart quotes, equivalent symbols & spellings
    const norm = (s) => (s || '')
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      // strip trailing punctuation
      .replace(/[.,;:!?]+$/g, '')
      // unify common math glyph spellings
      .replace(/<=|≤|=<|leq|less than or equal( to)?/g, '≤')
      .replace(/>=|≥|=>|geq|greater than or equal( to)?/g, '≥')
      .replace(/less than/g, '<')
      .replace(/greater than/g, '>')
      .replace(/sqrt\(([^)]+)\)/g, '√$1')
      .replace(/sqrt\s*([a-z0-9])/g, '√$1')
      .replace(/epsilon|eps/g, 'ε')
      .replace(/\bzero\b/g, '0')
      .replace(/\bone\b/g, '1')
      .replace(/\btwo\b/g, '2');
    const userAns = norm(value);
    const correct = norm(edge.answer);
    const isCorrect =
      userAns === correct ||
      // accept singular/plural variants for length >=4
      (correct.length >= 4 && (userAns === correct + 's' || userAns + 's' === correct)) ||
      // accept "ly" adverb variants ("conditional"/"conditionally")
      (correct.length >= 5 && (userAns === correct + 'ly' || userAns + 'ly' === correct));
    if (isCorrect) {
      setFeedback('correct');
      setTimeout(() => { onCorrect(edge.id); onClose(); }, 800);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setFeedback('wrong');
      // Hint only after 2 wrong attempts (per user request: no tooltip until multiple errors)
      if (newAttempts >= 2 && edge.hint) setShowHint(true);
      if (newAttempts >= 4) {
        setTimeout(() => {
          setFeedback('giveaway');
          setTimeout(() => { onCorrect(edge.id); onClose(); }, 1800);
        }, 700);
      } else {
        // Quick clear so they can retype
        setTimeout(() => setFeedback(null), 1200);
      }
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && value.trim()) checkAnswer();
    if (e.key === 'Escape') onClose();
  }

  const canRevealHint = attempts >= 2 && edge.hint;
  const displayLabel = (edge.label || '').replace(/(?:\\_){2,}/g, (m) => '_'.repeat(m.length / 2));

  return (
    <div className="answer-popup" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="answer-popup-card" ref={cardRef}>
        <div className="popup-relationship">Fill in the relationship</div>

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
          The label reads: <em>"{displayLabel} ___"</em>
        </div>

        {edge.type === 'fillin' ? (
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
        ) : (
          <select
            className="popup-select"
            value={value}
            onChange={e => { setValue(e.target.value); setFeedback(null); }}
          >
            <option value="">— choose one —</option>
            {(edge.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {feedback === 'correct' && (
          <div className="popup-feedback correct">✓ Correct! Unlocking next concepts…</div>
        )}
        {feedback === 'wrong' && (
          <div className="popup-feedback wrong">
            ✗ Not quite — {attempts >= 2 ? 'check the hint above' : 'try again'}
          </div>
        )}
        {feedback === 'giveaway' && (
          <div className="popup-feedback hint">
            Answer: <strong>{edge.answer}</strong> — moving on…
          </div>
        )}

        <div className="popup-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {feedback !== 'correct' && feedback !== 'giveaway' && (
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
const STORAGE_KEY = 'conceptmapper_progress_v2';
const MAPS_KEY = 'conceptmapper_maps_v2';
const POSITIONS_KEY = 'conceptmapper_positions_v2';
const MAP_MANIFEST_PATH = 'data/maps/manifest.json';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const result = {};
    Object.entries(parsed).forEach(([mapId, p]) => {
      result[mapId] = {
        answeredEdges: new Set(p.answeredEdges || []),
      };
    });
    return result;
  } catch { return {}; }
}

function saveProgress(allProgress) {
  const serializable = {};
  Object.entries(allProgress).forEach(([mapId, p]) => {
    serializable[mapId] = {
      answeredEdges: [...(p.answeredEdges || [])],
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

function loadCustomMaps() {
  try {
    const raw = localStorage.getItem(MAPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomMaps(maps) {
  localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
}

function parseMapDataText(rawText, sourcePath = '') {
  const text = (rawText || '').trim();
  if (!text) throw new Error(`Map file is empty: ${sourcePath}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Could not parse map file: ${sourcePath}`);
  }
}

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

  await Promise.all(manifest.map(async (entry) => {
    if (!entry || !entry.id || !entry.file) return;
    try {
      const resp = await fetch(entry.file, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rawText = await resp.text();
      const parsed = parseMapDataText(rawText, entry.file);
      const mapId = parsed?.id || entry.id;
      loadedMaps[mapId] = { ...parsed, id: mapId };
    } catch (err) {
      failures.push(`${entry.id}: ${err.message}`);
    }
  }));

  return { maps: loadedMaps, failures };
}

function downloadMapJSON(mapId, mapData) {
  if (!mapId || !mapData) return;
  const payload = {
    ...mapData,
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

function loadPositions() {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePositions(p) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(p));
}

// Expose to other Babel scripts
Object.assign(window, {
  MathNode,
  launchConfetti,
  computeEdgePath,
  AnswerPopup,
  loadBuiltInMaps,
  downloadMapJSON,
  loadProgress, saveProgress,
  loadCustomMaps, saveCustomMaps,
  loadPositions, savePositions,
});
