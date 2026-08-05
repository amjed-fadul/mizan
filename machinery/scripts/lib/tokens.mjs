/**
 * tokens.mjs — DTCG 2025.10 token loading, resolution and colour maths.
 *
 * Brand-agnostic. Nothing in this file knows the name of a colour, a product,
 * or a mode. Everything specific is discovered from the token root it is
 * pointed at, which means another company can point it at their own tokens
 * and get the same guarantees.
 *
 * Vocabulary this file *does* own, because it is DTCG/layering structure
 * rather than anybody's values:
 *
 *   <root>/primitive/**.json   raw values, no aliases expected
 *   <root>/semantic/**.json    named concepts, must alias
 *   <root>/component/**.json   component concepts, must alias
 *   <root>/modes/*.json        per-mode overrides of existing token paths
 *   <root>/modes.json          optional mode manifest (see discoverModes)
 *   <root>/pairs.json          declared foreground/background pairs
 *
 * Any other directory under the root is treated as a plain base layer.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** Directory under the token root that holds per-mode override files. */
export const MODES_DIR = 'modes';

/** Optional mode manifest, sitting beside the modes directory. */
export const MODES_MANIFEST = 'modes.json';

/** Default filename for the declared foreground/background pairs. */
export const PAIRS_FILE = 'pairs.json';

/** Default filename for the declared control footprints the tap-target gate reads. */
export const TARGETS_FILE = 'targets.json';

/** The layer that holds literal values. Nothing here is expected to alias. */
export const PRIMITIVE_LAYER = 'primitive';

/**
 * Layers whose tokens must reference another token rather than restate a
 * value. A semantic that repeats a literal has stopped being a name for a
 * decision and become a second copy of it.
 */
export const ALIAS_ONLY_LAYERS = new Set(['semantic', 'component']);

/** Token path grammar: dot-separated, lowercase kebab-case segments. */
export const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A `$value` that is nothing but a reference: "{color.neutral.900}". */
const ALIAS_PATTERN = /^\{([^{}]+)\}$/;

/**
 * Minimum contrast by the context a pair is declared for.
 *
 * The first three come from WCAG 2.2: 1.4.3 for text, and 1.4.11 for non-text
 * contrast — which governs "user interface components and their states" and
 * meaningful graphics, and explicitly exempts anything purely decorative.
 *
 * `decorative` is that exemption, made declarable. Its threshold is `null`, not
 * a low number: a low number would still be a bar, and the point is that no bar
 * applies. A pair declared decorative is resolved and its ratio reported in
 * every mode combination, but it can never fail the build.
 *
 * It exists so the third option — leaving a pairing undeclared — stops being
 * the only way to avoid a wrong threshold. An undeclared pairing is invisible
 * to this gate; a decorative one is tracked, printed and countable. The cost of
 * the category is that it can be abused, which is why the reported section is
 * printed on a passing run rather than hidden behind a flag.
 */
export const CONTRAST_THRESHOLDS = Object.freeze({
  'text': 4.5,
  'large-text': 3.0,
  'ui': 3.0,
  'decorative': null,
});

/** Sentinel for a value that could not be resolved. */
const UNRESOLVED = Symbol('unresolved');

/* ------------------------------------------------------------------ *
 * Diagnostics
 * ------------------------------------------------------------------ */

export class Diagnostics {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.notices = [];
    this._seen = new Set();
  }

  _add(list, code, message, context = {}) {
    // Mode is deliberately excluded from the identity of a diagnostic: the
    // same base defect would otherwise be reported once per mode combination.
    const key = JSON.stringify([code, context.file ?? '', context.token ?? '', message]);
    if (this._seen.has(key)) return;
    this._seen.add(key);
    list.push({ code, message, ...context });
  }

  error(code, message, context) { this._add(this.errors, code, message, context); }
  warn(code, message, context) { this._add(this.warnings, code, message, context); }
  notice(message) { this.notices.push(message); }

  get ok() { return this.errors.length === 0; }
}

/* ------------------------------------------------------------------ *
 * Paths
 * ------------------------------------------------------------------ */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/** Repository root, derived from this file's own location. */
export function repoRoot() {
  return resolve(LIB_DIR, '..', '..', '..');
}

/**
 * Where tokens live by default. This is a repository layout convention, not a
 * value: --root and the TOKENS_ROOT environment variable both override it.
 */
export function defaultTokensRoot() {
  return process.env.TOKENS_ROOT
    ? resolve(process.env.TOKENS_ROOT)
    : join(repoRoot(), 'content', 'tokens');
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function aliasTarget(value) {
  if (typeof value !== 'string') return null;
  const match = ALIAS_PATTERN.exec(value.trim());
  return match ? match[1].trim() : null;
}

/**
 * True when every leaf of a value is a reference to another token. A plain
 * alias string qualifies; so does a composite value whose every leaf aliases.
 */
export function isFullyAliased(value) {
  if (typeof value === 'string') return aliasTarget(value) !== null;
  if (Array.isArray(value)) return value.length > 0 && value.every(isFullyAliased);
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([k]) => !k.startsWith('$'));
    return entries.length > 0 && entries.every(([, v]) => isFullyAliased(v));
  }
  return false;
}

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(abs, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(abs);
  }
  return out;
}

export function readJson(absPath, diagnostics, code = 'invalid-json') {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (error) {
    diagnostics?.error(code, `Cannot read JSON: ${error.message}`, { file: absPath });
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Flattening
 * ------------------------------------------------------------------ */

/**
 * Walk one DTCG document into flat token nodes.
 *
 * A token is any object carrying `$value`. Anything else with non-`$` children
 * is a group. `$type` inherits from the nearest ancestor group *within the same
 * file* — files are separate documents, so inheritance does not cross them.
 */
function flattenDocument(data, { file, layer, diagnostics, into }) {
  if (!isPlainObject(data)) {
    diagnostics.error('invalid-document', 'Token file must contain a JSON object at the top level.', { file });
    return;
  }

  const walk = (node, segments, inheritedType) => {
    const ownType = typeof node.$type === 'string' ? node.$type : undefined;
    const path = segments.join('.');
    const childKeys = Object.keys(node).filter((key) => !key.startsWith('$'));
    const hasValue = Object.hasOwn(node, '$value');

    if (hasValue) {
      if (childKeys.length > 0) {
        diagnostics.error(
          'token-has-children',
          `Token "${path}" carries $value and also has child keys (${childKeys.join(', ')}). A token cannot also be a group.`,
          { file, token: path },
        );
      }
      const existing = into.get(path);
      if (existing) {
        diagnostics.error(
          'duplicate-token',
          `Token "${path}" is declared in two files: ${existing.file} and ${file}.`,
          { file, token: path },
        );
        return;
      }
      into.set(path, {
        path,
        segments: [...segments],
        file,
        layer,
        rawValue: node.$value,
        ownType,
        inheritedType,
        type: ownType ?? inheritedType,
        description: node.$description,
        deprecated: node.$deprecated,
      });
      return;
    }

    if (childKeys.length === 0) {
      diagnostics.error(
        'missing-value',
        `"${path || '(root)'}" has no $value and no children. A token needs a $value; a group needs members.`,
        { file, token: path },
      );
      return;
    }

    for (const key of childKeys) {
      const child = node[key];
      if (!isPlainObject(child)) {
        diagnostics.error(
          'invalid-node',
          `"${[...segments, key].join('.')}" is ${Array.isArray(child) ? 'an array' : typeof child}. Every token and group must be an object.`,
          { file, token: [...segments, key].join('.') },
        );
        continue;
      }
      walk(child, [...segments, key], ownType ?? inheritedType);
    }
  };

  walk(data, [], undefined);
}

/* ------------------------------------------------------------------ *
 * Mode discovery
 * ------------------------------------------------------------------ */

/**
 * Modes are content, so they are discovered rather than declared here.
 *
 * Two mechanisms, in priority order:
 *
 *  1. A manifest at `<root>/modes.json`:
 *       { "dimensions": [ { "name": "theme",   "modes": ["light", "dark"] },
 *                         { "name": "product", "modes": ["a", "b"] } ] }
 *     Dimension order in the manifest is the order overrides are applied.
 *
 *  2. Failing that, the filenames in `<root>/modes/`:
 *       "theme.light.json"  -> dimension "theme", mode id "theme.light"
 *       "light.json"        -> dimension "mode"  (the implicit single
 *                              dimension), mode id "light"
 *     Dimensions are then applied in alphabetical order by dimension name.
 *
 * A combination takes exactly one mode from each dimension, so the set of
 * applicable combinations is the cartesian product of the dimensions.
 *
 * ## Overlays — a mode that is deliberately not a dimension
 *
 * A manifest may also declare `overlays`:
 *
 *     "overlays": [ { "name": "script", "mode": "script.arabic",
 *                     "selector": ":lang(ar)" } ]
 *
 * An overlay mode is composed on top of whichever combination is active rather
 * than taking part in the cartesian product. It exists because the product is
 * the wrong shape for a mode whose values are identical across the whole
 * matrix: making such a mode a dimension doubles the combinations, doubles the
 * blocks emitted, and doubles the work of every gate that resolves something in
 * every combination — to produce copies that differ in nothing.
 *
 * The `selector` is content's to state and is emitted verbatim. Nothing here
 * parses it or knows what it selects: a dimension answers to an attribute this
 * file can construct from a name, and an overlay answers to whatever selects
 * the subtree it applies to, which is a fact about the content and not about
 * the mechanism. A system whose overlay is `[data-density="compact"]` or
 * `@media print` gets that string through unchanged.
 */
export function discoverModes(root, diagnostics) {
  const modesDir = join(root, MODES_DIR);
  const files = existsSync(modesDir) && statSync(modesDir).isDirectory()
    ? readdirSync(modesDir)
      .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
      .sort()
    : [];

  const byId = new Map();
  for (const name of files) {
    const id = name.slice(0, -'.json'.length);
    byId.set(id, { id, file: join(modesDir, name) });
  }

  const manifestPath = join(root, MODES_MANIFEST);
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath, diagnostics, 'invalid-modes-manifest');
    const dimensions = [];
    if (manifest && Array.isArray(manifest.dimensions)) {
      for (const dimension of manifest.dimensions) {
        if (!isPlainObject(dimension) || typeof dimension.name !== 'string' || !Array.isArray(dimension.modes)) {
          diagnostics.error(
            'invalid-modes-manifest',
            'Each entry of "dimensions" needs a string "name" and an array "modes".',
            { file: manifestPath },
          );
          continue;
        }
        const members = [];
        for (const id of dimension.modes) {
          if (!byId.has(id)) {
            diagnostics.error(
              'mode-file-missing',
              `Manifest dimension "${dimension.name}" lists mode "${id}" but ${join(MODES_DIR, `${id}.json`)} does not exist.`,
              { file: manifestPath },
            );
            continue;
          }
          byId.get(id).dimension = dimension.name;
          members.push(id);
        }
        if (members.length > 0) dimensions.push({ name: dimension.name, modes: members });
      }
    } else if (manifest) {
      diagnostics.error('invalid-modes-manifest', 'Mode manifest must contain a "dimensions" array.', { file: manifestPath });
    }

    const overlays = [];
    if (manifest && manifest.overlays !== undefined) {
      if (!Array.isArray(manifest.overlays)) {
        diagnostics.error('invalid-modes-manifest', '"overlays" must be an array when present.', { file: manifestPath });
      } else {
        for (const overlay of manifest.overlays) {
          if (!isPlainObject(overlay)
            || typeof overlay.name !== 'string'
            || typeof overlay.mode !== 'string'
            || typeof overlay.selector !== 'string'
            || overlay.selector.trim() === '') {
            diagnostics.error(
              'invalid-modes-manifest',
              'Each entry of "overlays" needs a string "name", a string "mode" naming a mode file, and a non-empty string "selector". '
                + 'The selector is content\'s to state: an overlay applies to a subtree, and only the token set knows what selects it.',
              { file: manifestPath },
            );
            continue;
          }
          if (!byId.has(overlay.mode)) {
            diagnostics.error(
              'mode-file-missing',
              `Manifest overlay "${overlay.name}" names mode "${overlay.mode}" but ${join(MODES_DIR, `${overlay.mode}.json`)} does not exist.`,
              { file: manifestPath },
            );
            continue;
          }
          /* A name reaches a filename in the build directory and identifies the
             emitted block, so two overlays sharing one would write over each
             other's intermediate file and emit the second's values under the
             first's selector — with no error anywhere. */
          if (overlays.some((existing) => existing.name === overlay.name)) {
            diagnostics.error(
              'duplicate-overlay-name',
              `Two overlays are both named "${overlay.name}". An overlay's name identifies its emitted block and its build artefact, so a duplicate silently overwrites.`,
              { file: manifestPath },
            );
            continue;
          }
          /* A mode belongs to a dimension or to an overlay, never both: as a
             dimension member it joins the cartesian product, and as an overlay
             it is composed on top of all of it. Claiming both would do each
             once and the collision guard would catch it later by accident,
             naming a token path rather than the actual mistake. */
          if (byId.get(overlay.mode).dimension) {
            diagnostics.error(
              'overlay-claims-dimension-mode',
              `Overlay "${overlay.name}" names mode "${overlay.mode}", which dimension "${byId.get(overlay.mode).dimension}" already claims. `
                + 'A mode takes part in the cartesian product or is applied on top of it, never both.',
              { file: manifestPath },
            );
            continue;
          }
          /* Marked so the not-in-manifest check below passes, and marked as an
             overlay rather than a dimension so nothing downstream mistakes it
             for one and multiplies the matrix by it. */
          byId.get(overlay.mode).overlay = overlay.name;
          overlays.push({ name: overlay.name, mode: overlay.mode, selector: overlay.selector.trim() });
        }
      }
    }

    for (const mode of byId.values()) {
      if (!mode.dimension && !mode.overlay) {
        diagnostics.error(
          'mode-not-in-manifest',
          `Mode file ${basename(mode.file)} is not listed in any dimension or overlay of ${MODES_MANIFEST}. Every mode file must belong to one or the other.`,
          { file: mode.file },
        );
      }
    }
    return { modes: byId, dimensions, overlays, source: manifestPath };
  }

  // Filename convention.
  const grouped = new Map();
  for (const mode of byId.values()) {
    const dot = mode.id.indexOf('.');
    mode.dimension = dot > 0 ? mode.id.slice(0, dot) : 'mode';
    if (!grouped.has(mode.dimension)) grouped.set(mode.dimension, []);
    grouped.get(mode.dimension).push(mode.id);
  }
  const dimensions = [...grouped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, modes]) => ({ name, modes: modes.sort() }));

  /* The filename convention has no way to express an overlay — a filename says
     which dimension a mode belongs to and cannot carry a selector, and a
     selector is the one thing an overlay cannot be given a default for. So a
     root without a manifest has dimensions and no overlays, which is the
     honest answer rather than a guessed one. */
  return { modes: byId, dimensions, overlays: [], source: 'filenames' };
}

/** Cartesian product of the dimensions: every applicable mode combination. */
export function modeCombinations(dimensions) {
  if (dimensions.length === 0) return [[]];
  let combos = [[]];
  for (const dimension of dimensions) {
    const next = [];
    for (const combo of combos) {
      for (const mode of dimension.modes) next.push([...combo, mode]);
    }
    combos = next;
  }
  return combos;
}

/** Human label for a combination. */
export function combinationLabel(combo) {
  return combo.length === 0 ? 'base' : combo.join(' + ');
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

/**
 * Load every token document under `root`.
 *
 * Returns the base layer as a flat `path -> node` map, the mode override maps,
 * the discovered dimensions, and the list of applicable combinations.
 */
export function loadTokenSet(root, diagnostics = new Diagnostics()) {
  const absRoot = resolve(root);
  const base = new Map();
  const files = [];

  if (!existsSync(absRoot)) {
    diagnostics.error('root-missing', `Token root does not exist: ${absRoot}`, { file: absRoot });
    return { root: absRoot, base, modes: new Map(), dimensions: [], combinations: [[]], files, diagnostics };
  }

  const modeInfo = discoverModes(absRoot, diagnostics);

  for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) continue;
    if (entry.name === MODES_DIR) continue;
    for (const abs of collectFiles(join(absRoot, entry.name))) {
      files.push({ file: abs, layer: entry.name });
    }
  }
  files.sort((a, b) => (a.file < b.file ? -1 : 1));

  for (const { file, layer } of files) {
    const data = readJson(file, diagnostics);
    if (data === null) continue;
    flattenDocument(data, { file, layer, diagnostics, into: base });
  }

  const modes = new Map();
  for (const mode of modeInfo.modes.values()) {
    const overrides = new Map();
    const data = readJson(mode.file, diagnostics);
    if (data !== null) {
      flattenDocument(data, { file: mode.file, layer: MODES_DIR, diagnostics, into: overrides });
    }
    modes.set(mode.id, { ...mode, overrides });
    files.push({ file: mode.file, layer: MODES_DIR });
  }

  return {
    root: absRoot,
    base,
    modes,
    dimensions: modeInfo.dimensions,
    /* Overlays are returned beside the dimensions and deliberately NOT folded
       into `combinations`. Every consumer that resolves something in every
       combination — the contrast gate above all — therefore sees exactly the
       matrix it saw before any overlay existed, which is the whole point of
       the distinction rather than an oversight. A consumer that wants them
       asks for them by name. */
    overlays: modeInfo.overlays ?? [],
    modeSource: modeInfo.source,
    combinations: modeCombinations(modeInfo.dimensions),
    files,
    diagnostics,
  };
}

/** True when the root contains no token documents at all. */
export function isEmptyTokenSet(set) {
  return set.files.length === 0;
}

/* ------------------------------------------------------------------ *
 * Mode composition
 * ------------------------------------------------------------------ */

/**
 * Apply a combination of modes to the base layer.
 *
 * The effective value of a token is its base value, overridden by each mode in
 * the order given — later modes win. A mode may only override a path that
 * already exists in the base; introducing a token from a mode file would mean
 * the token exists in some modes and not others, which nothing downstream can
 * represent.
 */
export function composeModes(set, combo, diagnostics) {
  const composed = new Map(set.base);
  for (const modeId of combo) {
    const mode = set.modes.get(modeId);
    if (!mode) {
      diagnostics.error('unknown-mode', `No mode named "${modeId}". Known modes: ${[...set.modes.keys()].join(', ') || '(none)'}.`, {});
      continue;
    }
    for (const [path, override] of mode.overrides) {
      const baseNode = set.base.get(path);
      if (!baseNode) {
        diagnostics.error(
          'mode-overrides-unknown-path',
          `Mode "${modeId}" overrides "${path}", which does not exist in the base tokens. A mode may only change tokens that already exist.`,
          { file: override.file, token: path, mode: modeId },
        );
        continue;
      }
      composed.set(path, {
        ...baseNode,
        rawValue: override.rawValue,
        // A mode override inherits the base token's type unless it declares one.
        type: override.ownType ?? override.inheritedType ?? baseNode.type,
        overriddenBy: modeId,
        overrideFile: override.file,
      });
    }
  }
  return composed;
}

/* ------------------------------------------------------------------ *
 * Alias resolution
 * ------------------------------------------------------------------ */

/**
 * Resolve every alias in a composed token map.
 *
 * Returns `path -> { path, type, value, file, layer }` for tokens that
 * resolved. Tokens that did not resolve are absent, and the reason is on the
 * diagnostics.
 */
export function resolveTokens(nodes, diagnostics, modeLabel) {
  const resolved = new Map();
  const failed = new Set();

  const resolvePath = (path, stack) => {
    if (resolved.has(path)) return resolved.get(path).value;
    if (failed.has(path)) return UNRESOLVED;

    const cycleAt = stack.indexOf(path);
    if (cycleAt !== -1) {
      const cycle = [...stack.slice(cycleAt), path].join(' -> ');
      diagnostics.error('alias-cycle', `Alias cycle: ${cycle}`, {
        file: nodes.get(path)?.file,
        token: path,
        mode: modeLabel,
      });
      failed.add(path);
      return UNRESOLVED;
    }

    const node = nodes.get(path);
    if (!node) return UNRESOLVED;

    const value = substitute(node.rawValue, [...stack, path], node);
    if (value === UNRESOLVED) {
      failed.add(path);
      return UNRESOLVED;
    }
    resolved.set(path, {
      path,
      type: node.type,
      value,
      raw: node.rawValue,
      file: node.overrideFile ?? node.file,
      layer: node.layer,
      overriddenBy: node.overriddenBy,
    });
    return value;
  };

  const substitute = (value, stack, node) => {
    const target = aliasTarget(value);
    if (target !== null) {
      if (!nodes.has(target)) {
        diagnostics.error(
          'alias-not-found',
          `"${node.path}" references "{${target}}", which is not a token.`,
          { file: node.overrideFile ?? node.file, token: node.path, mode: modeLabel },
        );
        return UNRESOLVED;
      }
      return resolvePath(target, stack);
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        const next = substitute(item, stack, node);
        if (next === UNRESOLVED) return UNRESOLVED;
        out.push(next);
      }
      return out;
    }
    if (isPlainObject(value)) {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        const next = substitute(item, stack, node);
        if (next === UNRESOLVED) return UNRESOLVED;
        out[key] = next;
      }
      return out;
    }
    return value;
  };

  for (const path of nodes.keys()) resolvePath(path, []);
  return resolved;
}

/**
 * Every token path referenced by an alias across a collection of nodes.
 * Accepts anything iterable: a Map's values, an array, a Set.
 */
export function referencedPaths(nodes) {
  const found = new Set();
  const walk = (value) => {
    const target = aliasTarget(value);
    if (target !== null) { found.add(target); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (isPlainObject(value)) { Object.values(value).forEach(walk); }
  };
  const iterable = nodes instanceof Map ? nodes.values() : nodes;
  for (const node of iterable) walk(node.rawValue);
  return found;
}

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

function byteToHex(n) { return n.toString(16).padStart(2, '0'); }

/** Normalise a hex string to lowercase 6 or 8 digits without the hash. */
export function normaliseHex(hex) {
  if (typeof hex !== 'string') return null;
  const raw = hex.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(raw)) return null;
  if (raw.length === 3 || raw.length === 4) {
    return raw.split('').map((c) => c + c).join('');
  }
  if (raw.length === 6 || raw.length === 8) return raw;
  return null;
}

/** Hex computed from sRGB components. Alpha is appended only if asked for. */
export function hexFromComponents(components, alpha, withAlpha = false) {
  const rgb = components.map((c) => byteToHex(Math.round(clamp01(c) * 255))).join('');
  if (!withAlpha) return rgb;
  return rgb + byteToHex(Math.round(clamp01(alpha ?? 1) * 255));
}

/**
 * Parse a DTCG 2025.10 colour value.
 *
 * Returns `{ ok: true, color }` or `{ ok: false, code, message }`. `hex` on the
 * input is advisory: the computed value is authoritative, and a disagreement is
 * reported rather than silently preferred either way.
 */
export function parseColor(value) {
  if (typeof value === 'string') {
    return {
      ok: false,
      code: 'color-not-object',
      message: `Colour must be an object with colorSpace and components, not the string ${JSON.stringify(value)}.`,
    };
  }
  if (!isPlainObject(value)) {
    return { ok: false, code: 'color-not-object', message: 'Colour must be an object with colorSpace and components.' };
  }
  const { colorSpace, components, alpha, hex } = value;
  if (colorSpace !== 'srgb') {
    return {
      ok: false,
      code: 'color-space-unsupported',
      message: `Colour space ${JSON.stringify(colorSpace)} is not supported. This checker understands "srgb" only.`,
    };
  }
  if (!Array.isArray(components) || components.length !== 3 || !components.every((c) => typeof c === 'number' && Number.isFinite(c))) {
    return {
      ok: false,
      code: 'color-components-invalid',
      message: 'components must be an array of three finite numbers.',
    };
  }
  const outOfRange = components.filter((c) => c < 0 || c > 1);
  if (outOfRange.length > 0) {
    return {
      ok: false,
      code: 'color-components-range',
      message: `components must be 0-1 floats; got ${JSON.stringify(components)}.`,
    };
  }
  const resolvedAlpha = alpha === undefined ? 1 : alpha;
  if (typeof resolvedAlpha !== 'number' || !Number.isFinite(resolvedAlpha) || resolvedAlpha < 0 || resolvedAlpha > 1) {
    return { ok: false, code: 'color-alpha-range', message: `alpha must be a 0-1 float; got ${JSON.stringify(alpha)}.` };
  }

  const color = {
    colorSpace,
    components: components.slice(),
    alpha: resolvedAlpha,
    hex: `#${hexFromComponents(components, resolvedAlpha, false)}`,
    declaredHex: hex,
  };

  if (hex !== undefined) {
    const declared = normaliseHex(hex);
    if (declared === null) {
      return { ok: false, code: 'hex-malformed', message: `hex ${JSON.stringify(hex)} is not a valid hex colour.` };
    }
    const computed = hexFromComponents(components, resolvedAlpha, declared.length === 8);
    if (declared !== computed) {
      return {
        ok: false,
        code: 'hex-mismatch',
        message: `hex "#${declared}" disagrees with components ${JSON.stringify(components)}${declared.length === 8 ? ` and alpha ${resolvedAlpha}` : ''}, which compute to "#${computed}".`,
        color,
      };
    }
  }

  return { ok: true, color };
}

/** sRGB channel to linear light. */
export function srgbToLinear(channel) {
  const c = clamp01(channel);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque sRGB colour. */
export function relativeLuminance(color) {
  const [r, g, b] = color.components.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Composite a translucent colour over an opaque one (simple source-over). */
export function compositeOver(foreground, background) {
  const a = foreground.alpha;
  const components = foreground.components.map((c, i) => c * a + background.components[i] * (1 - a));
  return { colorSpace: 'srgb', components, alpha: 1, hex: `#${hexFromComponents(components, 1, false)}` };
}

/** WCAG contrast ratio. Order does not matter. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Two decimal places, always — CI output should be comparable line to line. */
export function formatRatio(ratio) {
  return `${ratio.toFixed(2)}:1`;
}

/* ------------------------------------------------------------------ *
 * Argument parsing
 * ------------------------------------------------------------------ */

/**
 * Minimal argument parser. Flags listed in `repeatable` collect into arrays.
 * Anything unrecognised is returned so a caller can complain about it.
 */
export function parseArgs(argv, { flags = [], values = [], repeatable = [] } = {}) {
  const result = { _: [], unknown: [] };
  for (const name of repeatable) result[name] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { result._.push(arg); continue; }
    const eq = arg.indexOf('=');
    const name = (eq === -1 ? arg.slice(2) : arg.slice(2, eq));
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (flags.includes(name)) { result[name] = true; continue; }
    if (values.includes(name) || repeatable.includes(name)) {
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined) { result.unknown.push(arg); continue; }
      if (repeatable.includes(name)) result[name].push(value);
      else result[name] = value;
      continue;
    }
    result.unknown.push(arg);
  }
  return result;
}

/** Path shown in output: repo-relative when it is inside the repo. */
export function displayPath(absPath) {
  if (typeof absPath !== 'string') return absPath;
  const rel = relative(repoRoot(), absPath);
  return rel && !rel.startsWith(`..${sep}`) && rel !== '..' ? rel : absPath;
}
