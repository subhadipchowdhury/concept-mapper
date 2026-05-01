// Concept Map Data - Real Analysis (Math 163)
// Based on actual lecture content from Subhadip Chowdhury's lectures + HW
//
// Schema:
// Node:  { id, label, x, y, color, isStart? }
// Edge:  { id, from, to, label, answer, type: 'fillin'|'dropdown', options?, hint? }
//
// Edge-label policy (no-spoiler):
//   - Edge labels NEVER repeat the destination node's name.
//   - Each label asks for a *fact, condition, role, or hypothesis* in the relationship.
//   - Dropdowns are used only when discriminating between genuinely-confusable theorems.

const CONCEPT_MAPS = {
  sequences: {
    id: 'sequences',
    title: 'Sequences of Real Numbers',
    description: 'Module 1 — From the ε–N definition to Cauchy completeness',
    color: '#4f8ef7',
    accentColor: '#a78bfa',
    nodes: [
      // Row 0 — definitions
      { id: 'seq',          label: 'Sequence\\n\\(\\{a_n\\}: \\mathbb{N} \\to \\mathbb{R}\\)', x: 480, y: 60,  color: '#4f8ef7', isStart: true },
      { id: 'gp',           label: 'Geometric Progression\\n\\(a_n = ar^{n-1}\\)', x: 200, y: 60, color: '#4f8ef7' },
      { id: 'limpt',        label: 'Limit Point of a Set\\n\\((x-\\varepsilon, x+\\varepsilon) \\cap A \\setminus\\{x\\} \\ne \\emptyset\\)', x: 760, y: 60, color: '#4f8ef7' },

      // Row 1 — convergence basics
      { id: 'enconv',       label: 'ε–N Convergence\\n\\(\\lim a_n = L\\)', x: 480, y: 200, color: '#06b6d4' },
      { id: 'div',          label: 'Divergence', x: 760, y: 200, color: '#fb7185' },
      { id: 'unique',       label: 'Uniqueness of Limit', x: 250, y: 200, color: '#06b6d4' },

      // Row 2 — properties / order
      { id: 'algebra',      label: 'Algebra of Limits\\n(sum, product, quotient)', x: 480, y: 350, color: '#34d399' },
      { id: 'squeeze',      label: 'Squeeze Theorem', x: 760, y: 350, color: '#34d399' },
      { id: 'order',        label: 'Order Limit Theorem\\n\\(a_n \\le b_n \\Rightarrow \\lim a_n \\le \\lim b_n\\)', x: 940, y: 200, color: '#34d399' },
      { id: 'shift',        label: 'Shift Theorem\\n\\(\\lim a_{n+k} = \\lim a_n\\)', x: 940, y: 350, color: '#34d399' },
      { id: 'bdd',          label: 'Bounded Sequence\\n\\(|a_n| \\le M\\)', x: 200, y: 350, color: '#a78bfa' },

      // Row 3 — monotonicity
      { id: 'mono',         label: 'Monotone Sequence\\n(↗ or ↘)', x: 200, y: 500, color: '#a78bfa' },
      { id: 'conv_imp_bdd', label: 'Convergent ⟹ Bounded', x: 480, y: 500, color: '#34d399' },
      { id: 'completeness', label: 'Completeness of \\(\\mathbb{R}\\)\\n(LUB property)', x: 760, y: 500, color: '#f59e0b' },
      { id: 'amgm',         label: 'AM–GM Inequality\\n\\(\\sqrt{ab} \\le (a+b)/2\\)', x: 940, y: 500, color: '#fcd34d' },

      // Row 4 — MCT
      { id: 'mct',          label: 'Monotone Convergence\\nTheorem', x: 480, y: 650, color: '#f59e0b' },
      { id: 'babylonian',   label: 'Babylonian Iteration\\n\\(x_{n+1} = \\tfrac{1}{2}(x_n + c/x_n) \\to \\sqrt{c}\\)', x: 760, y: 650, color: '#fcd34d' },
      { id: 'agm',          label: 'Arithmetic–Geometric\\nMean (AGM)', x: 940, y: 650, color: '#fcd34d' },

      // Row 5 — subsequences
      { id: 'subseq',       label: 'Subsequence\\n\\(\\{a_{n_k}\\}\\)', x: 200, y: 800, color: '#f472b6' },
      { id: 'sublim',       label: 'Subsequential Limit', x: 480, y: 800, color: '#f472b6' },
      { id: 'eo',           label: 'Even–Odd\\nSubsequence Criterion', x: 760, y: 800, color: '#f472b6' },
      { id: 'cesaro',       label: 'Cesàro Mean\\n\\(\\sigma_n = \\tfrac{a_1+\\cdots+a_n}{n}\\)', x: 940, y: 800, color: '#fcd34d' },

      // Row 6 — peak / BW
      { id: 'peak',         label: 'Peak Point', x: 200, y: 950, color: '#f472b6' },
      { id: 'monlemma',     label: 'Monotone Subsequence\\nLemma', x: 480, y: 950, color: '#f59e0b' },
      { id: 'bw',           label: 'Bolzano–Weierstrass\\nTheorem', x: 760, y: 950, color: '#f59e0b' },

      // Row 7 — Cauchy
      { id: 'cauchy',       label: 'Cauchy Sequence\\n\\(|a_m - a_n| \\to 0\\)', x: 480, y: 1100, color: '#fb7185' },
      { id: 'cauchy_bdd',   label: 'Cauchy ⟹ Bounded', x: 200, y: 1100, color: '#fb7185' },

      // Row 8 — Cauchy criterion
      { id: 'cc',           label: 'Cauchy Convergence\\nCriterion', x: 480, y: 1250, color: '#f59e0b' },
    ],
    edges: [
      // ============================================================
      // FROM DEFINITION
      // ============================================================
      { id: 's_e1',  from: 'seq', to: 'gp',
        label: 'in \\(a_n = ar^{n-1}\\), the ratio between consecutive terms is \\_\\_\\_',
        answer: 'r',
        type: 'fillin',
        hint: 'Compute \\(a_{n+1}/a_n\\). The constant you get plays the role of common ___.' },

      { id: 's_e2',  from: 'seq', to: 'enconv',
        label: '"\\(\\forall \\varepsilon > 0\\,\\, \\exists N\\,\\, \\forall n>N\\,\\, |a_n - L| < \\varepsilon\\)" defines the \\_\\_\\_',
        answer: 'limit',
        type: 'fillin',
        hint: 'This formal statement is the ε–N definition of the ___.' },

      { id: 's_e3',  from: 'seq', to: 'div',
        label: 'no real \\(L\\) makes \\(|a_n - L|\\) eventually small — the seq fails to \\_\\_\\_',
        answer: 'converge',
        type: 'fillin',
        hint: 'The OPPOSITE of what we want — the seq fails to ___.' },

      { id: 's_e4',  from: 'seq', to: 'limpt',
        label: 'a point every \\(\\varepsilon\\)-nbhd of which contains \\_\\_\\_ many points of \\(A\\)',
        answer: 'infinitely',
        type: 'dropdown',
        options: ['finitely', 'infinitely', 'countably', 'uncountably'],
        hint: 'Equivalent characterization: every neighborhood contains ___ many points of \\(A\\).' },

      // ============================================================
      // UNIQUENESS / ALGEBRA / ORDER
      // ============================================================
      { id: 's_e5',  from: 'enconv', to: 'unique',
        label: 'a convergent sequence has \\_\\_\\_ limit',
        answer: 'one',
        type: 'dropdown',
        options: ['no', 'one', 'two', 'infinitely many'],
        hint: 'How many limits can a convergent sequence have?' },

      { id: 's_e6',  from: 'enconv', to: 'algebra',
        label: '\\(\\lim(a_n + b_n) = \\lim a_n + \\lim b_n\\) is the \\_\\_\\_ rule',
        answer: 'sum',
        type: 'dropdown',
        options: ['sum', 'product', 'quotient', 'power'],
        hint: 'Which limit law is this?' },

      { id: 's_e7',  from: 'algebra', to: 'squeeze',
        label: 'if \\(b_n \\le a_n \\le c_n\\) and \\(b_n, c_n \\to L\\), then \\(a_n \\to\\) \\_\\_\\_',
        answer: 'L',
        type: 'fillin',
        hint: 'The two outer sequences pin down the middle one.' },

      { id: 's_e8',  from: 'enconv', to: 'order',
        label: 'if \\(a_n \\le b_n\\) for all \\(n\\), then \\(\\lim a_n\\) \\_\\_\\_ \\(\\lim b_n\\)',
        answer: '≤',
        type: 'dropdown',
        options: ['<', '≤', '=', '≥'],
        hint: 'Strict inequality is NOT preserved in the limit; only the weak one is.' },

      { id: 's_e9',  from: 'enconv', to: 'shift',
        label: 'dropping the first \\(k\\) terms \\_\\_\\_ the limit',
        answer: 'preserves',
        type: 'dropdown',
        options: ['changes', 'preserves', 'doubles', 'negates'],
        hint: 'Finitely many terms cannot affect the tail behavior.' },

      // ============================================================
      // BOUNDEDNESS
      // ============================================================
      { id: 's_e10', from: 'enconv', to: 'conv_imp_bdd',
        label: 'past some \\(N\\), every \\(a_n\\) lies in \\((L-1, L+1)\\) — so \\(\\{a_n\\}\\) is \\_\\_\\_',
        answer: 'bounded',
        type: 'fillin',
        hint: 'There is a single \\(M\\) with \\(|a_n| \\le M\\) for all \\(n\\) — call this property ___.' },

      { id: 's_e11', from: 'conv_imp_bdd', to: 'bdd',
        label: 'so it satisfies \\(|a_n| \\le\\) \\_\\_\\_',
        answer: 'M',
        type: 'fillin',
        hint: 'A constant upper bound — call it \\(M\\).' },

      { id: 's_e12', from: 'bdd', to: 'mono',
        label: 'always-increasing OR always-decreasing — one Greek word for "one direction": \\_\\_\\_',
        answer: 'monotone',
        type: 'fillin',
        hint: 'mono- = "one", -tone = "direction/tension".' },

      // ============================================================
      // MCT
      // ============================================================
      { id: 's_e13', from: 'completeness', to: 'mct',
        label: 'every nonempty bounded-above subset of \\(\\mathbb{R}\\) has a \\_\\_\\_',
        answer: 'supremum',
        type: 'dropdown',
        options: ['minimum', 'maximum', 'supremum', 'infimum'],
        hint: 'AKA "least upper bound".' },

      { id: 's_e14', from: 'bdd', to: 'mct',
        label: 'MCT conclusion: bounded + monotone \\(\\Rightarrow\\) \\_\\_\\_',
        answer: 'convergent',
        type: 'fillin',
        hint: 'What MCT GIVES us, given the two hypotheses.' },

      { id: 's_e15', from: 'mono', to: 'mct',
        label: 'MCT hypothesis: monotone \\(+\\) \\_\\_\\_ \\(\\Rightarrow\\) convergent',
        answer: 'bounded',
        type: 'fillin',
        hint: 'The OTHER hypothesis MCT needs.' },

      // ============================================================
      // BABYLONIAN / AGM (HW 3005, 3006)
      // ============================================================
      { id: 's_e16', from: 'amgm', to: 'babylonian',
        label: 'AM–GM forces \\(x_{n+1} \\ge\\) \\_\\_\\_',
        answer: '√c',
        type: 'fillin',
        hint: 'Apply AM–GM to \\(x_n\\) and \\(c/x_n\\): their geometric mean is \\(\\sqrt{c}\\).' },

      { id: 's_e17', from: 'mct', to: 'babylonian',
        label: 'iteration converges because it is decreasing and bounded \\_\\_\\_',
        answer: 'below',
        type: 'dropdown',
        options: ['above', 'below', 'on both sides', 'nowhere'],
        hint: 'It\'s bounded below by \\(\\sqrt{c}\\) — so MCT applies.' },

      { id: 's_e18', from: 'amgm', to: 'agm',
        label: 'iterating arith. and geom. means of \\(a_1,b_1\\) gives sequences with the \\_\\_\\_ limit',
        answer: 'same',
        type: 'dropdown',
        options: ['same', 'reciprocal', 'opposite', 'unrelated'],
        hint: '\\(b_{n+1} - a_{n+1} \\to 0\\), so they share their limit.' },

      // ============================================================
      // SUBSEQUENCES
      // ============================================================
      { id: 's_e19', from: 'seq', to: 'subseq',
        label: 'pick STRICTLY \\_\\_\\_ indices \\(n_1 < n_2 < \\cdots\\) to extract a subsequence',
        answer: 'increasing',
        type: 'fillin',
        hint: 'The indices must go in one direction only — strictly ___.' },

      { id: 's_e20', from: 'subseq', to: 'sublim',
        label: 'a sequence may have \\_\\_\\_ subsequential limits, e.g. \\((-1)^n\\) has two',
        answer: 'multiple',
        type: 'dropdown',
        options: ['no', 'one', 'multiple', 'no real'],
        hint: '\\((-1)^n\\) has subsequential limits \\(+1\\) and \\(-1\\) — so a sequence can have ___ of them.' },

      { id: 's_e21', from: 'enconv', to: 'eo',
        label: '\\(\\{a_n\\}\\) converges \\(\\iff\\) \\(\\{a_{2k}\\}\\) and \\(\\{a_{2k+1}\\}\\) share the \\_\\_\\_ limit',
        answer: 'same',
        type: 'fillin',
        hint: 'Both even-indexed and odd-indexed subsequences must converge to the ___ value.' },

      { id: 's_e22', from: 'cesaro', to: 'enconv',
        label: 'if \\(a_n \\to L\\), then \\(\\sigma_n \\to\\) \\_\\_\\_',
        answer: 'L',
        type: 'fillin',
        hint: 'Averaging preserves the limit (HW 2004, Cesàro).' },

      // ============================================================
      // PEAK / BW
      // ============================================================
      { id: 's_e23', from: 'subseq', to: 'peak',
        label: 'index \\(n\\) such that NO later term exceeds \\(a_n\\) — visualize a mountain \\_\\_\\_',
        answer: 'peak',
        type: 'fillin',
        hint: 'Highest point with nothing taller to its right — a mountain ___.' },

      { id: 's_e24', from: 'peak', to: 'monlemma',
        label: 'inf-many peaks ⟹ ↘ subseq; finitely many ⟹ ↗ subseq — so EVERY seq has one going \\_\\_\\_',
        answer: 'one direction',
        type: 'dropdown',
        options: ['nowhere', 'one direction', 'both directions', 'in circles'],
        hint: 'Either way, you get a subsequence that consistently goes ___.' },

      { id: 's_e25', from: 'monlemma', to: 'bw',
        label: 'monotone subseq + boundedness + \\_\\_\\_ \\(\\Rightarrow\\) BW',
        answer: 'MCT',
        type: 'dropdown',
        options: ['MCT', 'Squeeze', 'Cauchy Criterion', 'Order Limit'],
        hint: 'Apply this theorem to the monotone subsequence to extract a convergent one.' },

      { id: 's_e26', from: 'bdd', to: 'bw',
        label: 'BW hypothesis: every \\_\\_\\_ sequence has a convergent subsequence',
        answer: 'bounded',
        type: 'fillin',
        hint: 'The single hypothesis BW needs.' },

      // ============================================================
      // CAUCHY
      // ============================================================
      { id: 's_e27', from: 'enconv', to: 'cauchy',
        label: 'if \\(a_n \\to L\\), then \\(|a_m - a_n|\\) can be made \\_\\_\\_',
        answer: 'arbitrarily small',
        type: 'dropdown',
        options: ['zero', 'arbitrarily small', 'less than 1', 'bounded'],
        hint: 'Both terms hug \\(L\\), so their distance is at most \\(2\\varepsilon\\).' },

      { id: 's_e28', from: 'cauchy', to: 'cauchy_bdd',
        label: 'fix \\(\\varepsilon=1\\) and \\(N\\): all terms past \\(N\\) lie in an interval of length \\_\\_\\_',
        answer: '2',
        type: 'fillin',
        hint: 'Centered at \\(a_N\\), radius \\(1\\) — total length is ___.' },

      { id: 's_e29', from: 'cauchy_bdd', to: 'bw',
        label: 'so we can extract a \\_\\_\\_ subsequence',
        answer: 'convergent',
        type: 'fillin',
        hint: 'BW guarantees this kind of subsequence from a bounded sequence.' },

      { id: 's_e30', from: 'bw', to: 'cc',
        label: 'if subseq \\(a_{n_k} \\to L\\) AND seq is Cauchy, the FULL seq has limit \\_\\_\\_',
        answer: 'L',
        type: 'fillin',
        hint: 'Triangle inequality: \\(|a_n - L| \\le |a_n - a_{n_k}| + |a_{n_k} - L|\\). Both small ⟹ \\(a_n \\to\\) ___.' },

      { id: 's_e31', from: 'cauchy', to: 'cc',
        label: 'in \\(\\mathbb{R}\\): Cauchy \\(\\iff\\) \\_\\_\\_',
        answer: 'convergent',
        type: 'fillin',
        hint: 'The two notions coincide in \\(\\mathbb{R}\\).' },
    ]
  },

  series: {
    id: 'series',
    title: 'Infinite Series',
    description: 'Module 2 — Convergence tests, absolute & conditional convergence',
    color: '#f59e0b',
    accentColor: '#fb923c',
    nodes: [
      // Definitions
      { id: 'seq',       label: 'Sequence \\(\\{a_n\\}\\)', x: 200, y: 60,  color: '#4f8ef7', isStart: true },
      { id: 'series',    label: 'Infinite Series\\n\\(\\sum a_n\\)', x: 480, y: 60,  color: '#f59e0b', isStart: true },
      { id: 'partial',   label: 'Partial Sums\\n\\(s_n = \\sum_{k=1}^{n} a_k\\)', x: 480, y: 200, color: '#fb923c' },

      // Convergence
      { id: 'conv',      label: 'Convergent Series', x: 250, y: 350, color: '#34d399' },
      { id: 'div',       label: 'Divergent Series', x: 710, y: 350, color: '#fb7185' },

      // Necessary conditions
      { id: 'divtest',   label: 'Divergence Test\\n\\(a_n \\not\\to 0\\)', x: 880, y: 200, color: '#fb7185' },
      { id: 'cauchyser', label: 'Cauchy Criterion\\nfor Series', x: 100, y: 200, color: '#a78bfa' },

      // Special families
      { id: 'geom',      label: 'Geometric Series\\n\\(\\sum ar^n\\)', x: 100, y: 500, color: '#34d399' },
      { id: 'harmonic',  label: 'Harmonic Series\\n\\(\\sum 1/n\\)', x: 880, y: 500, color: '#fb7185' },
      { id: 'pseries',   label: 'p-Series\\n\\(\\sum 1/n^p\\)', x: 480, y: 500, color: '#06b6d4' },

      // Tests for nonneg series
      { id: 'mctser',    label: 'MCT for\\nNonneg Series', x: 250, y: 650, color: '#a78bfa' },
      { id: 'integral',  label: 'Integral Test', x: 480, y: 650, color: '#f59e0b' },
      { id: 'directcmp', label: 'Direct\\nComparison Test', x: 100, y: 800, color: '#f59e0b' },
      { id: 'limcmp',    label: 'Limit\\nComparison Test', x: 280, y: 800, color: '#f59e0b' },

      // Ratio / Root
      { id: 'ratio',     label: 'Ratio Test\\n\\(L = \\lim |a_{n+1}/a_n|\\)', x: 720, y: 800, color: '#f472b6' },
      { id: 'root',      label: 'Root Test\\n\\(L = \\limsup |a_n|^{1/n}\\)', x: 900, y: 800, color: '#f472b6' },

      // Alternating / abs-cond
      { id: 'alt',       label: 'Alternating Series\\n\\(\\sum (-1)^n b_n\\)', x: 250, y: 950,  color: '#a78bfa' },
      { id: 'leibniz',   label: 'Leibniz Test\\n(Alternating Series Test)', x: 480, y: 1100, color: '#f59e0b' },
      { id: 'abs',       label: 'Absolute Convergence\\n\\(\\sum |a_n| < \\infty\\)', x: 720, y: 950, color: '#34d399' },
      { id: 'cond',      label: 'Conditional\\nConvergence', x: 900, y: 1100, color: '#f472b6' },
      { id: 'abstest',   label: 'Absolute Convergence\\nTest', x: 720, y: 1100, color: '#f59e0b' },

      // Dirichlet
      { id: 'dirichlet', label: "Dirichlet's Test", x: 250, y: 1250, color: '#a78bfa' },
    ],
    edges: [
      // ============================================================
      // BUILD-UP
      // ============================================================
      { id: 'r_e1',  from: 'seq', to: 'series',
        label: 'a series \\(\\sum a_n\\) is built by formally \\_\\_\\_ all terms of \\(\\{a_n\\}\\)',
        answer: 'adding',
        type: 'dropdown',
        options: ['adding', 'multiplying', 'dividing', 'composing'],
        hint: 'The Σ symbol indicates this operation.' },

      { id: 'r_e2',  from: 'series', to: 'partial',
        label: 'truncating after \\(n\\) terms (only PART of the sum) gives \\(s_n\\), the \\_\\_\\_ sum',
        answer: 'partial',
        type: 'fillin',
        hint: 'Latin: "of a part". Adjective form: ___.' },

      { id: 'r_e3',  from: 'partial', to: 'conv',
        label: '\\(\\sum a_n\\) converges \\(\\iff\\) \\(\\{s_n\\}\\) \\_\\_\\_',
        answer: 'converges',
        type: 'fillin',
        hint: 'The series convergence is DEFINED by behavior of partial sums.' },

      { id: 'r_e4',  from: 'partial', to: 'div',
        label: '\\(\\sum a_n\\) diverges \\(\\iff\\) \\(\\{s_n\\}\\) \\_\\_\\_',
        answer: 'diverges',
        type: 'fillin',
        hint: '' },

      // ============================================================
      // NECESSARY CONDITIONS
      // ============================================================
      { id: 'r_e5',  from: 'series', to: 'divtest',
        label: 'if \\(a_n \\not\\to 0\\), then \\(\\sum a_n\\) \\_\\_\\_',
        answer: 'diverges',
        type: 'fillin',
        hint: 'Contrapositive: convergence forces \\(a_n \\to 0\\).' },

      { id: 'r_e6',  from: 'series', to: 'cauchyser',
        label: '\\(\\sum a_n\\) converges \\(\\iff\\) \\(\\forall \\varepsilon > 0\\, \\exists N\\) such that \\(|a_{m+1}+\\cdots+a_n|\\) \\_\\_\\_',
        answer: '< ε',
        type: 'dropdown',
        options: ['= 0', '< ε', '> ε', 'is bounded'],
        hint: 'Cauchy condition for the partial-sum sequence.' },

      // ============================================================
      // SPECIAL FAMILIES
      // ============================================================
      { id: 'r_e7',  from: 'conv', to: 'geom',
        label: '\\(\\sum ar^n\\) converges precisely when \\(|r|\\) \\_\\_\\_ \\(1\\)',
        answer: '<',
        type: 'dropdown',
        options: ['<', '≤', '=', '>'],
        hint: 'Strict inequality matters here.' },

      { id: 'r_e8',  from: 'div', to: 'harmonic',
        label: '\\(\\sum 1/n\\) diverges, even though \\(1/n\\) \\_\\_\\_ to \\(0\\)',
        answer: 'tends',
        type: 'dropdown',
        options: ['tends', 'fails', 'jumps', 'oscillates'],
        hint: '\\(a_n \\to 0\\) is necessary but NOT sufficient — harmonic is the textbook example.' },

      { id: 'r_e9',  from: 'harmonic', to: 'pseries',
        label: '\\(\\sum 1/n^p\\) converges \\(\\iff\\) \\(p\\) \\_\\_\\_ \\(1\\)',
        answer: '>',
        type: 'dropdown',
        options: ['<', '≤', '=', '>'],
        hint: 'Harmonic (\\(p=1\\)) is the boundary case — diverges.' },

      // ============================================================
      // TESTS (NONNEG)
      // ============================================================
      { id: 'r_e10', from: 'partial', to: 'mctser',
        label: 'for nonneg terms, \\(\\{s_n\\}\\) is automatically \\_\\_\\_',
        answer: 'monotone',
        type: 'fillin',
        hint: 'Adding nonneg numbers can only make \\(s_n\\) go ↑.' },

      { id: 'r_e11', from: 'mctser', to: 'integral',
        label: 'compare \\(\\sum f(n)\\) with \\(\\int_1^\\infty f(x)\\,dx\\) when \\(f\\) is positive and \\_\\_\\_',
        answer: 'decreasing',
        type: 'dropdown',
        options: ['continuous', 'increasing', 'decreasing', 'bounded'],
        hint: 'Need monotone behavior to box the sum between two integrals.' },

      { id: 'r_e12', from: 'integral', to: 'pseries',
        label: '\\(\\int_1^\\infty x^{-p}\\,dx\\) converges precisely when \\(p\\) \\_\\_\\_ \\(1\\)',
        answer: '>',
        type: 'dropdown',
        options: ['<', '≤', '=', '>'],
        hint: 'The improper integral is finite iff the exponent makes the antiderivative tend to a constant.' },

      { id: 'r_e13', from: 'mctser', to: 'directcmp',
        label: 'if \\(0 \\le a_n \\le b_n\\) and \\(\\sum b_n\\) converges, then \\(\\sum a_n\\) \\_\\_\\_',
        answer: 'converges',
        type: 'fillin',
        hint: 'Smaller nonneg terms inherit the convergence.' },

      { id: 'r_e14', from: 'directcmp', to: 'limcmp',
        label: 'if \\(\\lim a_n/b_n = L \\in (0, \\infty)\\), the two series share the \\_\\_\\_ behavior',
        answer: 'same',
        type: 'dropdown',
        options: ['same', 'opposite', 'unrelated', 'reciprocal'],
        hint: 'Both converge or both diverge.' },

      // ============================================================
      // RATIO / ROOT
      // ============================================================
      { id: 'r_e15', from: 'geom', to: 'ratio',
        label: 'mimics geometric: if \\(\\lim |a_{n+1}/a_n| < 1\\), then \\(\\sum a_n\\) \\_\\_\\_',
        answer: 'converges',
        type: 'fillin',
        hint: 'The behavior is exactly that of \\(\\sum r^n\\) with this ratio playing the role of \\(r\\).' },

      { id: 'r_e16', from: 'geom', to: 'root',
        label: 'also mimics geometric: if \\(\\limsup |a_n|^{1/n} < 1\\), then \\(\\sum a_n\\) \\_\\_\\_',
        answer: 'converges',
        type: 'fillin',
        hint: 'Take \\(n\\)-th root instead of consecutive ratios.' },

      // ============================================================
      // ALTERNATING
      // ============================================================
      { id: 'r_e17', from: 'series', to: 'alt',
        label: 'a \\((-1)^n\\) factor makes the signs \\_\\_\\_ each term',
        answer: 'flip',
        type: 'dropdown',
        options: ['repeat', 'flip', 'cancel', 'vanish'],
        hint: '\\(+, -, +, -, \\ldots\\) — the signs ___ at each step.' },

      { id: 'r_e18', from: 'alt', to: 'leibniz',
        label: 'Leibniz: if \\(b_n\\) is decreasing AND \\(b_n \\to\\) \\_\\_\\_, the alternating series converges',
        answer: '0',
        type: 'fillin',
        hint: 'The terms must shrink all the way to ___.' },

      // ============================================================
      // ABSOLUTE / CONDITIONAL
      // ============================================================
      { id: 'r_e19', from: 'conv', to: 'abs',
        label: 'requiring \\(\\sum |a_n| < \\infty\\) is a STRICTLY \\_\\_\\_ condition than ordinary convergence',
        answer: 'stronger',
        type: 'dropdown',
        options: ['weaker', 'equivalent', 'stronger', 'unrelated'],
        hint: 'Implies ordinary convergence, but not the other way — so it is ___.' },

      { id: 'r_e20', from: 'abs', to: 'abstest',
        label: 'if \\(\\sum |a_n|\\) converges, then \\(\\sum a_n\\) automatically \\_\\_\\_',
        answer: 'converges',
        type: 'fillin',
        hint: 'Absolute convergence is the stronger condition — the original series inherits convergence.' },

      { id: 'r_e21', from: 'abstest', to: 'cond',
        label: 'a series that converges but \\(\\sum |a_n|\\) does NOT — is called \\_\\_\\_ convergent',
        answer: 'conditionally',
        type: 'fillin',
        hint: 'The convergence depends on cancellation between positive and negative terms.' },

      { id: 'r_e22', from: 'leibniz', to: 'cond',
        label: 'classic case: \\(\\sum (-1)^n / n\\) is \\_\\_\\_ convergent',
        answer: 'conditionally',
        type: 'fillin',
        hint: 'It converges (Leibniz) but \\(\\sum 1/n\\) does not — so the convergence is ___.' },

      { id: 'r_e23', from: 'abstest', to: 'ratio',
        label: 'if \\(\\lim |a_{n+1}/a_n| = L < 1\\), then \\(\\sum a_n\\) converges \\_\\_\\_',
        answer: 'absolutely',
        type: 'dropdown',
        options: ['conditionally', 'absolutely', 'pointwise', 'never'],
        hint: 'L < 1 gives the strongest form of convergence.' },

      { id: 'r_e24', from: 'abstest', to: 'root',
        label: 'if \\(\\limsup |a_n|^{1/n} = L\\), the test is \\_\\_\\_ when \\(L = 1\\)',
        answer: 'inconclusive',
        type: 'dropdown',
        options: ['conclusive', 'inconclusive', 'positive', 'divergent'],
        hint: 'The boundary case \\(L=1\\) gives no information either way.' },

      // ============================================================
      // DIRICHLET
      // ============================================================
      { id: 'r_e25', from: 'leibniz', to: 'dirichlet',
        label: 'replacing \\((-1)^n\\) by any sequence with bounded \\_\\_\\_ sums generalizes Leibniz',
        answer: 'partial',
        type: 'dropdown',
        options: ['partial', 'absolute', 'geometric', 'harmonic'],
        hint: 'Dirichlet only needs \\(\\{B_n = \\sum b_k\\}\\) to be bounded.' },
    ]
  },

  funcSequences: {
    id: 'funcSequences',
    title: 'Sequences & Series of Functions',
    description: 'Module 3 — Pointwise vs uniform convergence, power & Taylor series',
    color: '#34d399',
    accentColor: '#06b6d4',
    nodes: [
      { id: 'fseq',     label: 'Sequence of Functions\\n\\(\\{f_n\\}\\)', x: 480, y: 60, color: '#34d399', isStart: true },
      { id: 'pw',       label: 'Pointwise\\nConvergence', x: 250, y: 200, color: '#06b6d4' },
      { id: 'unif',     label: 'Uniform\\nConvergence \\(f_n \\rightrightarrows f\\)', x: 720, y: 200, color: '#34d399' },
      { id: 'limf',     label: 'Limit Function \\(f\\)', x: 250, y: 360, color: '#a78bfa' },
      { id: 'cont',     label: 'Preserves\\nContinuity', x: 720, y: 360, color: '#34d399' },
      { id: 'integ',    label: 'Preserves\\nIntegrability', x: 560, y: 510, color: '#34d399' },
      { id: 'diff',     label: 'Preserves\\nDifferentiability', x: 880, y: 510, color: '#f59e0b' },
      { id: 'fseries',  label: 'Series of Functions\\n\\(\\sum f_n(x)\\)', x: 250, y: 510, color: '#06b6d4' },
      { id: 'mtest',    label: 'Weierstrass M-Test', x: 100, y: 660, color: '#f59e0b' },
      { id: 'power',    label: 'Power Series\\n\\(\\sum a_n x^n\\)', x: 480, y: 660, color: '#f472b6' },
      { id: 'roc',      label: 'Radius of Convergence \\(R\\)', x: 280, y: 800, color: '#fb7185' },
      { id: 'ioc',      label: 'Interval of Convergence', x: 560, y: 800, color: '#fb7185' },
      { id: 'taylor',   label: 'Taylor Series', x: 800, y: 800, color: '#a78bfa' },
      { id: 'analytic', label: 'Analytic Function', x: 800, y: 940, color: '#a78bfa' },
    ],
    edges: [
      // (Module 3 left as-is until more PDF content is provided.)
      // Module 3 — polish pending more lecture content from instructor.
      { id: 'f_e1',  from: 'fseq', to: 'pw',     label: 'fix \\(x\\) first, THEN take \\(\\lim_{n\\to\\infty} f_n(x)\\) — this is \\_\\_\\_ convergence', answer: 'pointwise', type: 'fillin', hint: 'Convergence at each individual point separately.' },
      { id: 'f_e2',  from: 'fseq', to: 'unif',   label: 'one \\(N\\) works for ALL \\(x\\) — stronger than pointwise; called \\_\\_\\_', answer: 'uniform', type: 'fillin', hint: 'The same \\(N\\) works ___ly across all \\(x\\).' },
      { id: 'f_e3',  from: 'pw', to: 'limf',     label: 'the function \\(f(x) := \\lim_n f_n(x)\\) is the \\_\\_\\_ of \\(\\{f_n\\}\\)', answer: 'limit', type: 'fillin', hint: 'It is the pointwise ___ of the sequence.' },
      { id: 'f_e4',  from: 'unif', to: 'cont',   label: 'uniform limit of continuous functions: is the limit \\(f\\) automatically continuous?', answer: 'yes', type: 'dropdown', options: ['yes', 'no', 'only on closed intervals', 'only if differentiable'], hint: 'Uniform convergence preserves this property — ___.' },
      { id: 'f_e5',  from: 'unif', to: 'integ',  label: 'under uniform conv, \\(\\int (\\lim f_n) = \\lim \\int f_n\\) — the two operations \\_\\_\\_', answer: 'commute', type: 'dropdown', options: ['commute', 'cancel', 'multiply', 'fail'], hint: 'You can swap their order — they ___.' },
      { id: 'f_e6',  from: 'unif', to: 'diff',   label: 'preserving derivatives needs uniform conv of \\(\\{f_n\'\\}\\) too — NOT just of \\(\\{f_n\\}\\); answer Y/N: works?', answer: 'no', type: 'dropdown', options: ['yes', 'no'], hint: 'Uniform conv of \\(f_n\\) ALONE is not enough — ___.' },
      { id: 'f_e7',  from: 'fseq', to: 'fseries', label: 'form partial sums \\(S_N(x) = \\sum_{n=1}^N f_n(x)\\); their limit is a \\_\\_\\_ of functions', answer: 'series', type: 'fillin', hint: '\\(\\sum f_n(x)\\) is the analog of \\(\\sum a_n\\) but each term is now a function.' },
      { id: 'f_e8',  from: 'fseries', to: 'mtest', label: 'if \\(|f_n(x)| \\le M_n\\) and \\(\\sum M_n < \\infty\\), \\(\\sum f_n\\) converges \\_\\_\\_', answer: 'uniformly', type: 'dropdown', options: ['pointwise', 'uniformly', 'absolutely', 'conditionally'], hint: 'The M-test gives the STRONGEST type of convergence — ___.' },
      { id: 'f_e9',  from: 'fseries', to: 'power', label: 'special form \\(\\sum a_n x^n\\) — each term is \\(x\\) raised to a \\_\\_\\_', answer: 'power', type: 'fillin', hint: '\\(x^n\\) is \\(x\\) to the \\(n\\)-th ___.' },
      { id: 'f_e10', from: 'power', to: 'roc',   label: 'a power series converges for \\(|x| < R\\); this \\(R\\) is the \\_\\_\\_ of convergence', answer: 'radius', type: 'fillin', hint: 'Geometrically, \\(R\\) measures the half-width of the convergence region — its ___.' },
      { id: 'f_e11', from: 'roc', to: 'ioc',     label: 'the set of all \\(x\\) where \\(\\sum a_n x^n\\) converges is an \\_\\_\\_ centered at \\(0\\)', answer: 'interval', type: 'fillin', hint: 'A connected piece of \\(\\mathbb{R}\\), possibly with endpoints — an ___.' },
      { id: 'f_e12', from: 'power', to: 'taylor', label: 'with coefficients \\(a_n = f^{(n)}(c)/n!\\), the power series equals \\(f\\) on a \\_\\_\\_ around \\(c\\)', answer: 'neighborhood', type: 'dropdown', options: ['point', 'line', 'neighborhood', 'half-plane'], hint: 'Local agreement between \\(f\\) and its expansion holds in some open ___ of \\(c\\).' },
      { id: 'f_e13', from: 'taylor', to: 'analytic', label: 'a function that equals its Taylor series in a nbhd of every point of its domain is called \\_\\_\\_', answer: 'analytic', type: 'fillin', hint: 'Greek root meaning "to break apart" — such a function is ___.' }
    ]
  }
};

if (typeof module !== 'undefined') module.exports = CONCEPT_MAPS;
