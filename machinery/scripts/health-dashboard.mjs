#!/usr/bin/env node
/**
 * health-dashboard.mjs — the governance ladder, on one page.
 *
 * Runs the three gates and renders their JSON into a single self-contained HTML
 * file: no external requests, no dependencies, no build step. Every token, its
 * Figma variable, aligned or drifted, both values side by side, and the schema
 * and contrast gates beside them.
 *
 * It never re-implements a check. Each gate is run as its own process with
 * `--json`, exactly as selftest.mjs runs them, so the page can only ever say
 * what the gates said.
 *
 * The page is a report, not a merge tool. Figma is a display, never a source,
 * so every remedy on it runs outward — regenerate the variables from the token
 * JSON. There is no affordance anywhere on the page for taking a Figma value
 * back into the source, because that repair does not exist in this system.
 *
 * Brand-agnostic. The title is a parameter, the mode and dimension names are
 * discovered from the token root, and the page's own palette is *resolved from
 * the token set being reported on* — the declared foreground/background pairs
 * pick the roles, and `lib/tokens.mjs` resolves them per mode combination. The
 * report is therefore built from the system it reports on: change a colour in
 * the source, and the next dashboard is that colour. Only the pass/drift hues
 * belong to the report itself, and those are the report's semantics rather than
 * anybody's brand.
 *
 * Usage:
 *   node machinery/scripts/health-dashboard.mjs [--root <dir>] [--snapshot <file>]
 *                                               [--file-key <key>] [--bridge]
 *                                               [--bridge-port <n>] [--bridge-timeout <s>]
 *                                               [--out <file>]
 *                                               [--title <str>] [--strict] [--quiet]
 *
 *   --root <dir>      token root. Defaults to $TOKENS_ROOT, then content/tokens.
 *   --snapshot <file> Figma variables snapshot, passed straight to check-drift.
 *   --file-key <key>  live Figma file key, passed straight to check-drift.
 *   --bridge          read the live variables through the running Mizan Sync
 *                     plugin, passed straight to check-drift. This is the only
 *                     live read available below Enterprise, and it is what makes
 *                     the page say ALIGNED rather than ALIGNED AS OBSERVED.
 *   --bridge-port <n>      forwarded to check-drift. Default 8791.
 *   --bridge-timeout <s>   forwarded to check-drift. Default 60.
 *   --out <file>      where to write the page. Default .tokens-build/health.html.
 *   --title <str>     page title. A name is a brand decision, so there is no
 *                     default beyond a generic one.
 *   --strict          exit 1 when any gate failed. Off by default: generating
 *                     the report succeeded even when the news is bad, and the
 *                     gates already own the build's exit code.
 *   --quiet           suppress the summary; failures still print.
 *
 * Exits 1 if the page could not be generated, or if --strict and a gate failed.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Diagnostics,
  PAIRS_FILE,
  combinationLabel,
  composeModes,
  defaultTokensRoot,
  displayPath,
  isPlainObject,
  loadTokenSet,
  parseArgs,
  parseColor,
  readJson,
  relativeLuminance,
  resolveTokens,
} from './lib/tokens.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

/** Where the page lands unless told otherwise — build output, like the rest. */
const DEFAULT_OUT = join('.tokens-build', 'health.html');

/** A name is a brand decision, so machinery only supplies a generic one. */
const DEFAULT_TITLE = 'Design System Health';

/**
 * The report's own semantics, in two sets: one for a light ground, one for a
 * dark one, chosen per mode combination by the resolved page colour's
 * luminance. These are the only colours on the page that do not come from the
 * token set, because "this token agrees" and "this token has drifted" are
 * claims the report makes, not decisions the design system took.
 */
const STATUS_HUES = Object.freeze({
  light: { ok: '#166b45', drift: '#a12a1c', warn: '#7d5300', mutedLine: '#00000014' },
  dark: { ok: '#5fcb9c', drift: '#f0907f', warn: '#dcb15c', mutedLine: '#ffffff1a' },
});

/**
 * The two roles the page cannot render without, for a token set that declares
 * no usable pairs to derive them from. Everything else is computed from these.
 */
const FALLBACK_PALETTE = Object.freeze({ page: '#ffffff', text: '#1a1a1a' });

/* ------------------------------------------------------------------ *
 * Running the gates
 * ------------------------------------------------------------------ */

function runGate(script, extraArgs) {
  const result = spawnSync(process.execPath, [join(SCRIPTS_DIR, script), '--json', ...extraArgs], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    payload = null;
  }
  return { script, status: result.status, payload, stderr: result.stderr };
}

/* ------------------------------------------------------------------ *
 * The page's palette, resolved from the token set it reports on
 * ------------------------------------------------------------------ */

/** Distance from grey, 0–1. The only thing the role picker needs about hue. */
function saturationOf(color) {
  return Math.max(...color.components) - Math.min(...color.components);
}

/** Above this, a colour is carrying meaning rather than being a neutral. */
const NEUTRAL_SATURATION = 0.08;

function colorOfToken(resolved, path) {
  if (!path) return null;
  const token = resolved.get(path);
  if (!token || token.type !== 'color') return null;
  const parsed = parseColor(token.value);
  return parsed.ok ? parsed.color : null;
}

function hexOfToken(resolved, path) {
  return colorOfToken(resolved, path)?.hex ?? null;
}

/**
 * Pick the roles the page needs out of the declared pairs.
 *
 * Nothing here names a token. The pairs file already says which foregrounds are
 * meant to sit on which backgrounds and in what context, and the resolved values
 * say which of them are neutral and which are carrying meaning. Between the two
 * there is enough to choose a page ground, two text tiers, a hairline and an
 * accent without knowing what any of them are called:
 *
 *   page       the background the most pairings are declared against
 *   text       the highest-contrast *neutral* foreground on it
 *   textMuted  the next neutral foreground down
 *   line       a foreground declared in a non-text context on it
 *   accent     the most saturated *other* background, and its declared foreground
 *   panel      the least saturated other background
 *
 * The neutrality test is what keeps a semantic red — a discount, a safety
 * warning — out of the body-text role it would otherwise win on contrast alone.
 *
 * Every test is applied across *all* mode combinations at once — worst contrast,
 * highest saturation — because a role that only works in one theme is not a
 * role, and the page has to hold up in each of them.
 */
function deriveRoles(root, resolvedByCombo) {
  const pairsPath = join(root, PAIRS_FILE);
  if (!existsSync(pairsPath)) return null;
  const data = readJson(pairsPath, new Diagnostics());
  if (!isPlainObject(data) || !Array.isArray(data.pairs) || data.pairs.length === 0) return null;

  const pairs = data.pairs.filter((pair) => isPlainObject(pair)
    && typeof pair.foreground === 'string' && typeof pair.background === 'string');
  if (pairs.length === 0) return null;

  const frequency = new Map();
  for (const pair of pairs) frequency.set(pair.background, (frequency.get(pair.background) ?? 0) + 1);
  let page = pairs[0].background;
  for (const [path, count] of frequency) {
    if (count > (frequency.get(page) ?? 0)) page = path;
  }

  const colors = (path) => resolvedByCombo.map((resolved) => colorOfToken(resolved, path)).filter(Boolean);
  const exists = (path) => colors(path).length === resolvedByCombo.length;
  const worstContrast = (path) => {
    const ratios = resolvedByCombo.map((resolved) => contrastAgainst(
      colorOfToken(resolved, path), colorOfToken(resolved, page),
    ));
    return ratios.length === 0 ? 0 : Math.min(...ratios);
  };
  const peakSaturation = (path) => {
    const values = colors(path).map(saturationOf);
    return values.length === 0 ? 1 : Math.max(...values);
  };

  const onPage = pairs.filter((pair) => pair.background === page);
  const neutralTexts = [...new Set(onPage
    .filter((pair) => pair.context === 'text' || pair.context === 'large-text')
    .map((pair) => pair.foreground))]
    .filter((path) => exists(path) && peakSaturation(path) <= NEUTRAL_SATURATION)
    .sort((a, b) => worstContrast(b) - worstContrast(a));

  /* A hairline first, a control edge second. A divider is what the page's own
   * rules and card borders are, so `decorative` is the right context — unless
   * the set's decorative line is one nobody can see in some mode, in which case
   * the gated one is taken instead. 1.2:1 is not a WCAG number and is not
   * pretending to be: it is the point below which a border stops drawing a box. */
  const lines = [
    ...onPage.filter((pair) => pair.context === 'decorative' && worstContrast(pair.foreground) >= 1.2),
    ...onPage.filter((pair) => pair.context === 'ui'),
    ...onPage.filter((pair) => pair.context === 'decorative'),
  ].map((pair) => pair.foreground).filter(exists);

  const elsewhere = [...new Set(pairs.filter((pair) => pair.background !== page).map((pair) => pair.background))]
    .filter(exists)
    .sort((a, b) => peakSaturation(b) - peakSaturation(a));

  const accentBg = elsewhere[0] ?? null;
  const neutralGrounds = elsewhere.filter((path) => path !== accentBg && peakSaturation(path) <= NEUTRAL_SATURATION);

  return {
    page,
    panel: neutralGrounds[neutralGrounds.length - 1] ?? null,
    text: neutralTexts[0] ?? null,
    textMuted: neutralTexts[1] ?? neutralTexts[0] ?? null,
    line: lines[0] ?? neutralTexts[neutralTexts.length - 1] ?? null,
    accentBg,
    accentFg: pairs.find((pair) => pair.background === accentBg && pair.context === 'text')?.foreground ?? null,
  };
}

function contrastAgainst(color, ground) {
  if (!color || !ground) return 0;
  const a = relativeLuminance(color);
  const b = relativeLuminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Blend two hexes, for the one role a token set is not obliged to declare. */
function mixHex(a, b, amount) {
  const from = hexToComponents(a);
  const to = hexToComponents(b);
  const channel = (i) => Math.round((from[i] * (1 - amount) + to[i] * amount) * 255).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * One palette per mode combination, plus the attribute selector that selects it.
 * The dimension and mode names come out of the token root, so a system whose
 * dimensions are named something else entirely gets those names here.
 */
function derivePalettes(root) {
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(root, diagnostics);

  const resolvedByCombo = set.combinations.map((combo) => resolveTokens(
    composeModes(set, combo, diagnostics), diagnostics, combinationLabel(combo),
  ));

  // Roles are chosen once, across every combination, and then resolved in each.
  // A role that changed token between light and dark would not be a role.
  const roles = deriveRoles(set.root, resolvedByCombo);

  const palettes = [];
  set.combinations.forEach((combo, index) => {
    const attributes = combo.map((modeId) => {
      const dimension = set.modes.get(modeId)?.dimension ?? 'mode';
      const prefix = `${dimension}.`;
      return { dimension, mode: modeId.startsWith(prefix) ? modeId.slice(prefix.length) : modeId };
    });
    const resolved = resolvedByCombo[index];

    /* Two roles are load-bearing — a ground and something legible on it — and
     * everything else is derived from them when the token set does not declare
     * a token for it. A set is under no obligation to name a second ground or a
     * hairline, and the report should not demand one to render. */
    const of = (role) => (roles ? hexOfToken(resolved, roles[role]) : null);
    const page = of('page') ?? FALLBACK_PALETTE.page;
    const text = of('text') ?? FALLBACK_PALETTE.text;
    const colors = {
      page,
      text,
      panel: of('panel') ?? mixHex(page, text, 0.06),
      textMuted: of('textMuted') ?? mixHex(text, page, 0.35),
      line: of('line') ?? mixHex(page, text, 0.2),
      accentBg: of('accentBg') ?? text,
      accentFg: of('accentFg') ?? page,
    };
    if (colors.panel === colors.page) colors.panel = mixHex(page, text, 0.06);

    const parsedPage = parseColor({ colorSpace: 'srgb', components: hexToComponents(page), alpha: 1 });
    const ground = parsedPage.ok && relativeLuminance(parsedPage.color) < 0.4 ? 'dark' : 'light';

    palettes.push({
      label: combinationLabel(combo),
      attributes,
      selector: attributes.length === 0 ? ':root' : `:root${attributes.map((a) => `[data-${a.dimension}="${a.mode}"]`).join('')}`,
      colors: { ...colors, ...STATUS_HUES[ground] },
      ground,
    });
  });

  return { set, roles, palettes, dimensions: set.dimensions };
}

function hexToComponents(hex) {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
}

/* ------------------------------------------------------------------ *
 * HTML helpers
 * ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** A colour swatch, when the value we are printing happens to be a colour. */
function swatch(hex) {
  return hex ? `<span class="swatch" style="background:${escapeHtml(hex)}"></span>` : '';
}

function statusTag(status) {
  const labels = {
    aligned: 'ALIGNED', drifted: 'DRIFTED', missing: 'MISSING', orphan: 'ORPHAN',
    'not-representable': 'NO VARIABLE FORM', unknown: 'NOT COMPARED',
  };
  return `<span class="tag tag-${escapeHtml(status)}">${escapeHtml(labels[status] ?? status)}</span>`;
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

function renderGateCard(name, ok, ran, lines) {
  const state = !ran ? 'unknown' : ok ? 'pass' : 'fail';
  const label = !ran ? 'NOT RUN' : ok ? 'PASS' : 'FAIL';
  return `
    <article class="gate gate-${state}">
      <p class="gate-name">${escapeHtml(name)}</p>
      <p class="gate-state">${label}</p>
      ${lines.map((line) => `<p class="gate-line">${escapeHtml(line)}</p>`).join('')}
    </article>`;
}

function renderStat(value, label, tone) {
  return `
    <article class="stat stat-${tone}">
      <p class="stat-value">${escapeHtml(value)}</p>
      <p class="stat-label">${escapeHtml(label)}</p>
    </article>`;
}

function renderFinding(item, classes) {
  const meta = classes[item.code] ?? { label: item.code, remedy: '' };
  const where = [];
  if (item.mode) where.push(`Figma mode: ${item.mode}`);
  if (item.tokenMode) where.push(`source mode: ${item.tokenMode}`);
  return `
    <details class="finding">
      <summary>
        <span class="finding-token">${escapeHtml(item.token ?? item.variable ?? '(unnamed)')}</span>
        <span class="finding-code">${escapeHtml(meta.label)}</span>
      </summary>
      <div class="finding-body">
        <p class="finding-message">${escapeHtml(item.message ?? '')}</p>
        ${where.length > 0 ? `<p class="finding-where">${escapeHtml(where.join('  ·  '))}</p>` : ''}
        <div class="diff">
          <div class="diff-side diff-source">
            <p class="diff-label">Source — token JSON (authoritative)</p>
            <p class="diff-value">${swatch(item.expected?.color)}<code>${escapeHtml(item.expected?.display ?? '')}</code></p>
            ${item.expected?.resolves ? `<p class="diff-note">resolves to ${escapeHtml(item.expected.resolves)}</p>` : ''}
          </div>
          <div class="diff-arrow" aria-hidden="true">&rarr;</div>
          <div class="diff-side diff-figma">
            <p class="diff-label">Figma — display only${item.variable ? ` · <code>${escapeHtml(item.variable)}</code>` : ''}</p>
            <p class="diff-value">${swatch(item.actual?.color)}<code>${escapeHtml(item.actual?.display ?? '')}</code></p>
          </div>
        </div>
        <p class="finding-remedy"><strong>Fix, outward:</strong> ${escapeHtml(meta.remedy)}</p>
      </div>
    </details>`;
}

function renderDriftSections(drift) {
  if (!drift.payload) {
    return `<p class="empty">The drift gate did not produce a result. ${escapeHtml(drift.stderr.trim() || 'No output.')}</p>`;
  }
  const findings = drift.payload.findings ?? [];
  if (findings.length === 0) {
    return `<p class="empty">No drift. Every comparable token matches its Figma variable in every mode, values and reference structure alike.</p>`;
  }
  const classes = drift.payload.classes ?? {};
  const grouped = new Map();
  for (const item of findings) {
    if (!grouped.has(item.code)) grouped.set(item.code, []);
    grouped.get(item.code).push(item);
  }
  return [...grouped.entries()].map(([code, items]) => {
    const meta = classes[code] ?? { label: code, summary: '', remedy: '' };
    return `
      <section class="drift-class">
        <h3>${escapeHtml(meta.label)} <span class="count">${items.length}</span></h3>
        <p class="drift-summary">${escapeHtml(meta.summary)}</p>
        ${items.map((item) => renderFinding(item, classes)).join('')}
      </section>`;
  }).join('');
}

function renderTokenTable(drift) {
  const tokens = drift.payload?.tokens ?? [];
  if (tokens.length === 0) return '<p class="empty">No tokens to compare.</p>';
  // An orphan has no token path to key on, so its findings are filed under the
  // variable name and the row looks under both.
  const findingsByToken = new Map();
  for (const item of drift.payload.findings ?? []) {
    const key = item.token ?? item.variable;
    if (!findingsByToken.has(key)) findingsByToken.set(key, []);
    findingsByToken.get(key).push(item);
  }
  const rows = tokens.map((token) => {
    const notes = (findingsByToken.get(token.path) ?? findingsByToken.get(token.variable) ?? [])
      .map((item) => (drift.payload.classes?.[item.code]?.label ?? item.code));
    return `
      <tr class="row-${escapeHtml(token.status)}">
        <td><code>${escapeHtml(token.path)}</code></td>
        <td>${token.variable ? `<code>${escapeHtml(token.variable)}</code>` : '<span class="none">—</span>'}</td>
        <td>${token.collection ? escapeHtml(token.collection) : '<span class="none">—</span>'}</td>
        <td>${token.type ? escapeHtml(token.type) : '<span class="none">—</span>'}</td>
        <td>${statusTag(token.status)}</td>
        <td class="notes">${escapeHtml([...new Set(notes)].join(', '))}</td>
      </tr>`;
  }).join('');
  return `
    <div class="table-scroll">
      <table class="tokens">
        <thead><tr><th>Token (source)</th><th>Variable (Figma)</th><th>Collection</th><th>Type</th><th>Status</th><th>Drift</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderContrast(contrast) {
  const results = contrast.payload?.results ?? [];
  if (results.length === 0) return '<p class="empty">No declared pairs were checked.</p>';
  const rows = results.map((result) => {
    const state = result.excepted ? 'excepted' : result.status;
    const threshold = result.threshold === null ? 'none' : `${result.threshold.toFixed(2)}:1`;
    return `
      <tr class="row-${escapeHtml(state)}">
        <td><code>${escapeHtml(result.foreground)}</code> on <code>${escapeHtml(result.background)}</code></td>
        <td>${escapeHtml(result.modeLabel)}</td>
        <td>${escapeHtml(result.context)}</td>
        <td class="numeric">${result.ratio === undefined ? '—' : `${result.ratio.toFixed(2)}:1`}</td>
        <td class="numeric">${escapeHtml(threshold)}</td>
        <td>${swatch(result.foregroundHex)}${swatch(result.backgroundHex)}</td>
        <td><span class="tag tag-${escapeHtml(state)}">${escapeHtml(state.toUpperCase())}</span></td>
      </tr>`;
  }).join('');
  return `
    <div class="table-scroll">
      <table class="contrast">
        <thead><tr><th>Pair</th><th>Mode</th><th>Context</th><th>Ratio</th><th>Required</th><th></th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderDiagnostics(entries, emptyMessage) {
  if (!entries || entries.length === 0) return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  return `<ul class="diagnostics">${entries.map((entry) => `
    <li>
      <code class="code">${escapeHtml(entry.code)}</code>
      <span>${escapeHtml(entry.message)}</span>
      ${entry.token ? `<span class="where">token: ${escapeHtml(entry.token)}</span>` : ''}
      ${entry.file ? `<span class="where">file: ${escapeHtml(displayPath(entry.file))}</span>` : ''}
    </li>`).join('')}</ul>`;
}

function renderSwitcher(dimensions, palettes) {
  if (dimensions.length === 0 || palettes.length <= 1) return '';
  const groups = dimensions.map((dimension) => {
    const attribute = palettes[0].attributes.find((a) => a.dimension === dimension.name)?.dimension ?? dimension.name;
    const buttons = dimension.modes.map((modeId) => {
      const prefix = `${dimension.name}.`;
      const short = modeId.startsWith(prefix) ? modeId.slice(prefix.length) : modeId;
      return `<button type="button" data-dimension="${escapeHtml(attribute)}" data-mode="${escapeHtml(short)}">${escapeHtml(short)}</button>`;
    }).join('');
    return `<div class="switch-group"><span class="switch-name">${escapeHtml(dimension.name)}</span>${buttons}</div>`;
  }).join('');
  return `<div class="switcher" role="group" aria-label="Mode combination">${groups}</div>`;
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

function renderCss(palettes) {
  const block = (selector, colors) => `${selector} {
${Object.entries(colors).map(([role, value]) => `  --mz-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`).join('\n')}
}`;
  const blocks = [block(':root', palettes[0].colors)];
  for (const palette of palettes) {
    if (palette.selector === ':root') continue;
    blocks.push(block(palette.selector, palette.colors));
  }
  return `${blocks.join('\n\n')}

* { box-sizing: border-box; }
html { color-scheme: light dark; }
body {
  margin: 0;
  padding: 0 0 64px;
  background: var(--mz-page);
  color: var(--mz-text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
h1 { font-size: 30px; line-height: 1.2; margin: 0 0 8px; letter-spacing: -0.01em; }
h2 { font-size: 19px; margin: 44px 0 4px; letter-spacing: -0.005em; }
h3 { font-size: 15px; margin: 24px 0 4px; display: flex; align-items: center; gap: 8px; }
p { margin: 0 0 8px; }
.lede { color: var(--mz-text-muted); margin-bottom: 24px; max-width: 68ch; }
.section-note { color: var(--mz-text-muted); margin: 0 0 16px; max-width: 78ch; }
.empty { color: var(--mz-text-muted); border: 1px dashed var(--mz-line); border-radius: 8px; padding: 16px; }
.none { color: var(--mz-text-muted); }

header.page { padding: 40px 0 8px; border-bottom: 1px solid var(--mz-line); margin-bottom: 24px; }
.eyebrow { color: var(--mz-text-muted); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px; }
.meta { color: var(--mz-text-muted); font-size: 13px; margin: 0; }
.meta code { color: var(--mz-text); }

.verdict { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin: 20px 0 8px; }
.verdict-state { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
.verdict-ok .verdict-state { color: var(--mz-ok); }
.verdict-fail .verdict-state { color: var(--mz-drift); }
.verdict-detail { color: var(--mz-text-muted); }

.direction {
  border: 1px solid var(--mz-line); border-radius: 10px; padding: 20px 20px 16px;
  background: var(--mz-panel); margin: 24px 0 8px;
}
.flow { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.flow-node { border: 1px solid var(--mz-line); border-radius: 8px; padding: 10px 14px; background: var(--mz-page); }
.flow-node strong { display: block; font-size: 14px; }
.flow-node span { color: var(--mz-text-muted); font-size: 12px; }
.flow-node.authoritative { border-color: var(--mz-ok); }
.flow-arrow { color: var(--mz-text-muted); font-size: 13px; text-align: center; }
.flow-arrow strong { display: block; font-size: 20px; color: var(--mz-text); }
.flow-blocked { color: var(--mz-drift); font-size: 13px; }

.gates, .stats { display: grid; gap: 12px; margin: 12px 0 0; }
.gates { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.gate, .stat { border: 1px solid var(--mz-line); border-radius: 10px; padding: 14px 16px; background: var(--mz-panel); }
.gate-name { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mz-text-muted); margin: 0 0 4px; }
.gate-state { font-size: 20px; font-weight: 600; margin: 0 0 6px; }
.gate-pass .gate-state { color: var(--mz-ok); }
.gate-fail .gate-state { color: var(--mz-drift); }
.gate-unknown .gate-state { color: var(--mz-warn); }
.gate-line { color: var(--mz-text-muted); font-size: 13px; margin: 0; }
.stat-value { font-size: 26px; font-weight: 600; margin: 0; letter-spacing: -0.02em; }
.stat-label { font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--mz-text-muted); margin: 0; }
.stat-ok .stat-value { color: var(--mz-ok); }
.stat-bad .stat-value { color: var(--mz-drift); }
.stat-warn .stat-value { color: var(--mz-warn); }

.drift-class { margin-top: 20px; }
.count { font-size: 12px; font-weight: 500; color: var(--mz-page); background: var(--mz-drift); border-radius: 999px; padding: 1px 8px; }
.drift-summary { color: var(--mz-text-muted); margin: 0 0 10px; max-width: 78ch; }
.finding { border: 1px solid var(--mz-line); border-radius: 8px; margin-bottom: 8px; background: var(--mz-panel); }
.finding > summary {
  cursor: pointer; padding: 10px 14px; display: flex; gap: 12px; align-items: baseline;
  justify-content: space-between; list-style: none;
}
.finding > summary::-webkit-details-marker { display: none; }
.finding > summary::before { content: "+"; color: var(--mz-text-muted); margin-inline-end: 4px; }
.finding[open] > summary::before { content: "–"; }
.finding-token { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.finding-code { color: var(--mz-drift); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
.finding-body { padding: 0 14px 14px; border-top: 1px solid var(--mz-line); }
.finding-message { margin: 12px 0 4px; max-width: 82ch; }
.finding-where { color: var(--mz-text-muted); font-size: 13px; margin: 0 0 12px; }
.diff { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; margin-bottom: 12px; }
.diff-side { flex: 1 1 260px; border: 1px solid var(--mz-line); border-radius: 8px; padding: 10px 12px; background: var(--mz-page); }
.diff-source { border-color: var(--mz-ok); }
.diff-figma { border-color: var(--mz-drift); }
.diff-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mz-text-muted); margin: 0 0 6px; }
.diff-label code { text-transform: none; letter-spacing: 0; }
.diff-value { display: flex; align-items: center; gap: 8px; margin: 0; word-break: break-word; }
.diff-note { color: var(--mz-text-muted); font-size: 12px; margin: 4px 0 0; }
.diff-arrow { align-self: center; color: var(--mz-text-muted); font-size: 20px; }
.finding-remedy { margin: 0; color: var(--mz-text-muted); max-width: 82ch; }
.finding-remedy strong { color: var(--mz-text); }

.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--mz-muted-line); flex: none; }

.table-scroll { overflow-x: auto; border: 1px solid var(--mz-line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: start; padding: 8px 12px; border-bottom: 1px solid var(--mz-muted-line); white-space: nowrap; }
th { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mz-text-muted); background: var(--mz-panel); position: sticky; top: 0; }
tbody tr:last-child td { border-bottom: 0; }
td.numeric { font-variant-numeric: tabular-nums; }
td.notes { color: var(--mz-drift); white-space: normal; }

.tag { font-size: 11px; letter-spacing: 0.05em; border-radius: 999px; padding: 2px 8px; border: 1px solid currentColor; }
.tag-aligned, .tag-pass { color: var(--mz-ok); }
.tag-drifted, .tag-fail, .tag-orphan { color: var(--mz-drift); }
.tag-missing, .tag-excepted, .tag-report { color: var(--mz-warn); }
.tag-not-representable, .tag-unknown { color: var(--mz-text-muted); }

.diagnostics { margin: 0; padding: 0; list-style: none; }
.diagnostics li { border: 1px solid var(--mz-line); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; background: var(--mz-panel); }
.diagnostics .code { color: var(--mz-drift); margin-inline-end: 8px; }
.diagnostics .where { display: block; color: var(--mz-text-muted); font-size: 12px; }

.switcher { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0 0; }
.switch-group { display: flex; align-items: center; gap: 6px; }
.switch-name { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mz-text-muted); }
.switcher button {
  font: inherit; font-size: 13px; padding: 3px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--mz-line); background: var(--mz-panel); color: var(--mz-text);
}
.switcher button[aria-pressed="true"] { background: var(--mz-accent-bg); color: var(--mz-accent-fg); border-color: var(--mz-accent-bg); }

footer.page { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--mz-line); color: var(--mz-text-muted); font-size: 13px; }

@media print {
  body { padding-bottom: 0; }
  .switcher { display: none; }
  .finding-body { display: block !important; }
}`;
}

function renderPage({ title, root, source, generatedAt, schema, contrast, drift, palettes, dimensions }) {
  const driftOk = drift.payload?.ok === true;
  const schemaOk = schema.payload?.ok === true;
  const contrastOk = contrast.payload?.ok === true;
  const allOk = driftOk && schemaOk && contrastOk;
  const counts = drift.payload?.counts ?? {};

  const first = palettes[0];
  const rootAttributes = first.attributes.map((a) => ` data-${escapeHtml(a.dimension)}="${escapeHtml(a.mode)}"`).join('');

  // A snapshot is a photograph, not a window. "Aligned" against one means the display
  // agreed when the snapshot was taken; a hand-edit since then is invisible here.
  const observed = source != null && source.kind === 'snapshot';

  /* A bridge read has no file key — it has a port and, if the plugin said so, a
   * document name. Naming the document is not decoration: every remedy on this
   * page says "re-sync outward", and a reader has to be able to check which file
   * that would write to before carrying one out. */
  const sourceLine = source === null || source === undefined
    ? 'no Figma source given'
    : source.kind === 'snapshot'
      ? `snapshot ${displayPath(source.path)}`
      : source.kind === 'bridge'
        ? source.document
          ? `"${source.document.name}" (${source.document.fileKey === null
            ? 'no file key — the document may be unsaved'
            : `file key ${source.document.fileKey}`}), read through the plugin bridge on 127.0.0.1:${source.port}`
          : `the open file (the plugin did not name the document), read through the plugin bridge on 127.0.0.1:${source.port}`
        : `Figma file ${source.fileKey} (live)`;

  return `<!doctype html>
<html lang="en"${rootAttributes}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${renderCss(palettes)}
</style>
</head>
<body>
<main>

<header class="page">
  <p class="eyebrow">Governance rung 2 · drift detector</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="lede">Every token in the source, every variable in Figma, and whether they still say the same thing. Generated by the same gates that run in CI — this page cannot claim anything the gates did not report.</p>
  <p class="meta">source: <code>${escapeHtml(displayPath(root))}</code> &nbsp;·&nbsp; figma: <code>${escapeHtml(sourceLine)}</code> &nbsp;·&nbsp; generated ${escapeHtml(generatedAt)}</p>
  ${renderSwitcher(dimensions, palettes)}
</header>

<section class="verdict ${allOk ? 'verdict-ok' : 'verdict-fail'}">
  <span class="verdict-state">${allOk ? (observed ? 'ALIGNED AS OBSERVED' : 'ALIGNED') : 'DRIFTED'}</span>
  <span class="verdict-detail">${escapeHtml(
    allOk
      ? observed
        ? 'All three gates pass against a snapshot. This says the display agreed with the source '
          + 'when the snapshot was taken — not that it agrees now. A hand-edit made since then is '
          + 'invisible to this page. Reading Figma live below Enterprise means the plugin bridge: '
          + 'run check-drift with --bridge, with the file open and Mizan Sync running. The '
          + 'variables REST API is Enterprise-only in both directions; see decisions/015 and 016.'
        : 'All three gates pass, read live. The display agrees with the source.'
      : `${[!schemaOk && 'schema', !contrastOk && 'contrast', !driftOk && 'drift'].filter(Boolean).join(', ')} failing.`,
  )}</span>
</section>

<section class="direction">
  <div class="flow">
    <div class="flow-node authoritative">
      <strong>Token source (DTCG JSON)</strong>
      <span>the only editing surface</span>
    </div>
    <div class="flow-arrow"><strong>&rarr;</strong>generate</div>
    <div class="flow-node">
      <strong>Figma variables</strong>
      <span>a display, never a source</span>
    </div>
  </div>
  <p class="flow-blocked">There is no arrow back. A Figma value is never copied into the tokens — not by this page, not by a person.</p>
  <p class="section-note">Drift means the file has been hand-edited, or the sync has not been run since the source changed. Either way the repair is the same and it runs outward: regenerate the variables from the JSON. Anything below marked ORPHAN is the one exception, and it is not an exception to the direction — it is a variable the source never asked for, so it is deleted in Figma rather than imported.</p>
</section>

<h2>Gates</h2>
<div class="gates">
  ${renderGateCard('Schema', schemaOk, schema.payload !== null, [
    `${schema.payload?.tokens ?? 0} tokens, ${schema.payload?.files ?? 0} files`,
    `${schema.payload?.errors?.length ?? 0} error(s), ${schema.payload?.warnings?.length ?? 0} warning(s)`,
  ])}
  ${renderGateCard('Contrast', contrastOk, contrast.payload !== null, [
    `${contrast.payload?.checks ?? 0} check(s) across ${contrast.payload?.combinations?.length ?? 0} combination(s)`,
    `${(contrast.payload?.results ?? []).filter((r) => r.status === 'fail' && !r.excepted).length} failing pair(s)`,
  ])}
  ${renderGateCard('Drift (Figma vs source)', driftOk, drift.payload !== null, [
    `${counts.checks ?? 0} comparison(s) over ${counts.variables ?? 0} variable(s)`,
    `${(drift.payload?.findings ?? []).length} finding(s)`,
  ])}
</div>

<h2>Alignment</h2>
<div class="stats">
  ${renderStat(counts.aligned ?? 0, 'aligned', 'ok')}
  ${renderStat(counts.drifted ?? 0, 'drifted', (counts.drifted ?? 0) > 0 ? 'bad' : 'ok')}
  ${renderStat(counts.missing ?? 0, 'missing in Figma', (counts.missing ?? 0) > 0 ? 'warn' : 'ok')}
  ${renderStat(counts.orphan ?? 0, 'orphaned in Figma', (counts.orphan ?? 0) > 0 ? 'bad' : 'ok')}
  ${renderStat(counts.notRepresentable ?? 0, 'no variable form', 'neutral')}
</div>

<h2>Drift detail</h2>
<p class="section-note">Source on the left, Figma on the right, in that order deliberately. Click a row for the values and the fix.</p>
${renderDriftSections(drift)}

<h2>Every token, Figma against code</h2>
<p class="section-note">The whole surface, aligned rows included — a detector is only worth reading if you can see what it looked at.</p>
${renderTokenTable(drift)}

<h2>Contrast — rung 1</h2>
<p class="section-note">Every declared pairing, in every mode combination. A context with no threshold is measured and printed rather than hidden.</p>
${renderContrast(contrast)}

<h2>Schema — rung 1</h2>
${renderDiagnostics(schema.payload?.errors, 'No structural errors. Every token resolves, every semantic references, every mode overrides something that exists.')}
${(schema.payload?.warnings ?? []).length > 0 ? `<h3>Warnings</h3>${renderDiagnostics(schema.payload.warnings, '')}` : ''}

${(drift.payload?.warnings ?? []).length > 0 ? `<h2>Drift warnings</h2>${renderDiagnostics(drift.payload.warnings, '')}` : ''}
${(drift.payload?.errors ?? []).length > 0 ? `<h2>Drift errors</h2>${renderDiagnostics(drift.payload.errors, '')}` : ''}

${(drift.payload?.notRepresentable ?? []).length > 0 ? `
<h2>No variable form</h2>
<p class="section-note">Figma variables hold colour, number, string and boolean. These token types have no variable representation, so their absence from the file is a fact about Figma rather than a disagreement, and they are excluded from the counts above.</p>
<div class="table-scroll"><table><thead><tr><th>Token</th><th>Type</th></tr></thead><tbody>
${drift.payload.notRepresentable.map((item) => `<tr><td><code>${escapeHtml(item.token)}</code></td><td>${escapeHtml(item.type ?? '—')}</td></tr>`).join('')}
</tbody></table></div>` : ''}

<footer class="page">
  <p>Generated by <code>machinery/scripts/health-dashboard.mjs</code> from <code>check-schema.mjs</code>, <code>check-contrast.mjs</code> and <code>check-drift.mjs</code>. Self-contained: no scripts loaded, no fonts fetched, no network at all. The page's own colours are resolved from the token set it reports on.</p>
</footer>

</main>
<script>
(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.switcher button'));
  function sync() {
    buttons.forEach(function (button) {
      var active = document.documentElement.getAttribute('data-' + button.dataset.dimension) === button.dataset.mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      document.documentElement.setAttribute('data-' + button.dataset.dimension, button.dataset.mode);
      sync();
    });
  });
  sync();
}());
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, {
    flags: ['strict', 'quiet', 'help', 'bridge'],
    values: ['root', 'snapshot', 'file-key', 'bridge-port', 'bridge-timeout', 'out', 'title'],
  });
  if (args.help) {
    process.stdout.write(
      'Usage: health-dashboard.mjs [--root <dir>] [--snapshot <file>] [--file-key <key>]\n'
      + '                            [--bridge] [--bridge-port <n>] [--bridge-timeout <s>]\n'
      + '                            [--out <file>] [--title <str>] [--strict] [--quiet]\n',
    );
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`health-dashboard: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const root = args.root ? resolve(args.root) : defaultTokensRoot();
  const rootArgs = ['--root', root];
  const driftArgs = [...rootArgs];
  /* Three sources, forwarded in check-drift's own precedence: snapshot beats
   * bridge beats file key. The bridge was missing here for as long as it has
   * existed, which meant the one live read available below Enterprise could not
   * reach the page whose whole subject is whether the display is current. */
  if (args.snapshot) driftArgs.push('--snapshot', args.snapshot);
  if (args.bridge) driftArgs.push('--bridge');
  if (args['bridge-port']) driftArgs.push('--bridge-port', args['bridge-port']);
  if (args['bridge-timeout']) driftArgs.push('--bridge-timeout', args['bridge-timeout']);
  if (args['file-key']) driftArgs.push('--file-key', args['file-key']);

  const schema = runGate('check-schema.mjs', rootArgs);
  const contrast = runGate('check-contrast.mjs', rootArgs);
  const drift = runGate('check-drift.mjs', driftArgs);

  const { palettes, dimensions } = derivePalettes(root);

  const html = renderPage({
    title: args.title ?? DEFAULT_TITLE,
    root,
    source: drift.payload?.source,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    schema,
    contrast,
    drift,
    palettes,
    dimensions,
  });

  const out = resolve(args.out ?? DEFAULT_OUT);
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
  } catch (error) {
    process.stderr.write(`health-dashboard: could not write ${displayPath(out)} — ${error.message}\n`);
    return 1;
  }

  const gates = [
    ['schema', schema.payload?.ok === true],
    ['contrast', contrast.payload?.ok === true],
    ['drift', drift.payload?.ok === true],
  ];
  const failing = gates.filter(([, ok]) => !ok).map(([name]) => name);

  const lines = [
    `Health dashboard — ${displayPath(root)}`,
    `wrote ${displayPath(out)} (${(html.length / 1024).toFixed(1)} kB, self-contained)`,
    failing.length === 0
      ? 'Gates: schema pass, contrast pass, drift pass. The display agrees with the source.'
      : `Gates: ${failing.join(', ')} failing. Open the page for the diff — the fix runs outward, source to Figma.`,
  ];
  if (!args.quiet || failing.length > 0) process.stdout.write(`${lines.join('\n')}\n`);

  return args.strict && failing.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
