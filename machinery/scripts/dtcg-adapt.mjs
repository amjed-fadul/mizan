#!/usr/bin/env node
/**
 * dtcg-adapt.mjs — TEMPORARY. Delete this file when Style Dictionary supports
 * DTCG 2025.10 properly.
 * ===========================================================================
 *
 * WHY THIS EXISTS
 *
 * The tokens in the source of truth are authored strictly to DTCG 2025.10,
 * which specifies structured values: a colour is an object with a `colorSpace`
 * and 0–1 `components`, a dimension is `{ "value": 16, "unit": "px" }`, a
 * shadow is an object whose members are themselves colours and dimensions.
 *
 * Style Dictionary 5.5 does not consume that. Its own documentation describes
 * 2025.10 support as a work in progress: it expects colours as CSS-parseable
 * strings and dimensions as strings or numbers, and it has no reader for the
 * object forms. Two ways out were available. Author the tokens in whatever
 * Style Dictionary happens to accept this quarter, and let a tool's current
 * limitations become the shape of the source of truth. Or author to the spec
 * and put the gap in one deletable file.
 *
 * This is that file. It reads real 2025.10 and hands Style Dictionary the
 * degraded form it can still read today. Nothing else in the pipeline knows
 * the degradation happened.
 *
 * ---------------------------------------------------------------------------
 * WHAT TO DELETE, AND WHEN
 *
 * Tracking issue: https://github.com/style-dictionary/style-dictionary/issues/1590
 *
 * When that lands and Style Dictionary reads 2025.10 object values directly:
 *
 *   1. Delete this file.
 *   2. In machinery/scripts/build-tokens.mjs, replace the `adaptTokenSet()`
 *      call with Style Dictionary reading content/tokens/ directly, and delete
 *      the `--work` directory plumbing along with the intermediate JSON.
 *      Mode composition still has to come from lib/tokens.mjs — that is this
 *      system's composition rule, not Style Dictionary's, and it is not what
 *      this file is compensating for.
 *   3. Delete the `.tokens-build/` entry from .gitignore.
 *   4. Re-run `npm run build:tokens` and diff packages/tokens/. The output
 *      should be byte-identical. If it is not, this file was doing something
 *      beyond value-shape translation, and that something needs a home before
 *      the file goes.
 *
 * Nothing else imports it. That is deliberate: the blast radius of deleting it
 * is one call site.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT DO
 *
 * It does not resolve aliases. Alias strings are passed through untouched so
 * Style Dictionary can emit `var(--…)` references and keep the CSS readable.
 * (`resolveTokens` from the shared library is still run, as a gate: a chain
 * that cannot resolve is an error here rather than a broken reference later.)
 *
 * It does not know a single colour value, dimension name or mode name. Modes,
 * dimensions and their order are discovered from the token root exactly as the
 * check scripts discover them, through lib/tokens.mjs.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 *
 *   node machinery/scripts/dtcg-adapt.mjs [--root <dir>] [--out <dir>]
 *                                         [--mode <id>]... [--quiet]
 *
 *   --root <dir>   token root to adapt. Defaults to $TOKENS_ROOT, then to the
 *                  repository's content/tokens.
 *   --out <dir>    where the adapted JSON is written. Defaults to
 *                  <repo>/.tokens-build. This is a build artefact, not output.
 *   --mode <id>    restrict to one combination, repeatable and ordered, exactly
 *                  as check-contrast.mjs takes it. Omit to adapt every
 *                  combination discovered in the token root.
 *   --quiet        suppress the summary.
 *
 * Exits 1 if the token set does not load, does not resolve, or contains a value
 * this adapter does not know how to degrade.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Diagnostics,
  combinationLabel,
  composeModes,
  defaultTokensRoot,
  displayPath,
  hexFromComponents,
  isEmptyTokenSet,
  isPlainObject,
  aliasTarget,
  loadTokenSet,
  parseArgs,
  parseColor,
  repoRoot,
  resolveTokens,
} from './lib/tokens.mjs';

/** Default build location for the adapted JSON. Ignored by git. */
export function defaultWorkDir() {
  return join(repoRoot(), '.tokens-build');
}

/* ------------------------------------------------------------------ *
 * Value shapes
 *
 * Detection is by shape, not by declared $type. A shadow's members are a
 * colour and four dimensions but carry no $type of their own, and the same is
 * true of border, typography, gradient and transition members. Walking on
 * shape handles every composite type, including ones this repository does not
 * use yet, without enumerating them.
 * ------------------------------------------------------------------ */

/** A DTCG 2025.10 colour: `{ colorSpace, components, alpha?, hex? }`. */
export function isColorValue(value) {
  return isPlainObject(value)
    && typeof value.colorSpace === 'string'
    && Array.isArray(value.components);
}

/** A DTCG dimension or duration: `{ value: <number>, unit: <string> }`. */
export function isDimensionValue(value) {
  return isPlainObject(value)
    && typeof value.value === 'number'
    && typeof value.unit === 'string';
}

/* ------------------------------------------------------------------ *
 * The degradations
 * ------------------------------------------------------------------ */

/**
 * Colour object -> hex string.
 *
 * Six digits when the colour is opaque, eight when it is not. Style Dictionary
 * parses both, on every platform target here.
 *
 * The components are authoritative — a declared `hex` in the source is
 * advisory and is verified against them by check-schema.mjs, so by the time
 * this runs a disagreement has already failed the build.
 */
function adaptColor(value, context) {
  const parsed = parseColor(value);
  if (!parsed.ok) {
    throw new AdaptError(`${context}: ${parsed.message}`, parsed.code);
  }
  const { components, alpha } = parsed.color;
  return `#${hexFromComponents(components, alpha, alpha !== 1)}`;
}

/**
 * Dimension/duration object -> the string CSS already wanted.
 *
 * `{ value: 16, unit: "px" }` becomes `"16px"`. The unit is carried through
 * rather than assumed: `rem` and `ms` survive this unchanged, and a unit this
 * pipeline has not seen still reaches the platform transforms intact.
 */
function adaptDimension(value, context) {
  if (!Number.isFinite(value.value)) {
    throw new AdaptError(`${context}: dimension value must be a finite number, got ${JSON.stringify(value.value)}.`, 'dimension-invalid');
  }
  return `${value.value}${value.unit}`;
}

export class AdaptError extends Error {
  constructor(message, code = 'adapt-failed') {
    super(message);
    this.name = 'AdaptError';
    this.code = code;
  }
}

/**
 * Degrade one `$value` of any depth.
 *
 * Alias strings pass through untouched — Style Dictionary's reference syntax
 * and DTCG's are the same `{path.to.token}`, and keeping them is what lets the
 * CSS come out as `var(--…)` rather than a wall of hexes.
 */
export function adaptValue(value, context = 'value') {
  const alias = aliasTarget(value);
  if (alias !== null) return value;

  if (Array.isArray(value)) {
    return value.map((item, index) => adaptValue(item, `${context}[${index}]`));
  }

  if (isColorValue(value)) return adaptColor(value, context);
  if (isDimensionValue(value)) return adaptDimension(value, context);

  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = adaptValue(item, `${context}.${key}`);
    }
    return out;
  }

  // Strings, numbers and booleans are already what Style Dictionary reads:
  // fontWeight, number, fontFamily entries, cubicBezier members, strokeStyle.
  return value;
}

/* ------------------------------------------------------------------ *
 * Combinations
 * ------------------------------------------------------------------ */

/**
 * The attribute pairs a combination selects, as `{ dimension, mode }`.
 *
 * A mode id is `<dimension>.<name>` by the filename convention, and may be
 * anything at all when a manifest names it. The dimension is whatever the
 * library resolved it to; the short name is the id with that prefix removed
 * when it has one. Both are discovered — nothing here is a known name.
 */
export function combinationAttributes(set, combo) {
  return combo.map((modeId) => {
    const mode = set.modes.get(modeId);
    const dimension = mode?.dimension ?? 'mode';
    const prefix = `${dimension}.`;
    const name = modeId.startsWith(prefix) ? modeId.slice(prefix.length) : modeId;
    return { dimension, mode: name, id: modeId };
  });
}

/** Filesystem-safe, stable identifier for a combination. `base` when empty. */
export function combinationSlug(attributes) {
  if (attributes.length === 0) return 'base';
  return attributes.map((a) => a.mode).join('-');
}

/* ------------------------------------------------------------------ *
 * Adapting a whole token set
 * ------------------------------------------------------------------ */

/** Nest a flat `path -> { type, value }` map back into a DTCG document. */
function nest(entries) {
  const doc = {};
  for (const { path, type, value } of entries) {
    const segments = path.split('.');
    let node = doc;
    for (const segment of segments.slice(0, -1)) {
      if (!isPlainObject(node[segment])) node[segment] = {};
      node = node[segment];
    }
    node[segments.at(-1)] = { $type: type, $value: value };
  }
  return doc;
}

/**
 * Adapt every applicable mode combination.
 *
 * Returns a model the build script can consume without touching the token
 * library again:
 *
 *   {
 *     root, dimensions,
 *     combinations: [{ modes, attributes, slug, label, entries, document }],
 *     invariant: Set<path>,   // identical in every combination
 *     varying:   Set<path>,   // differs in at least one
 *   }
 *
 * The invariant/varying split is what lets the CSS put the values that never
 * change in one `:root` block and repeat only the ones that do. It is computed
 * from the adapted values themselves rather than assumed from the layer a
 * token lives in — a mode is free to override a primitive, and if it does, that
 * primitive belongs in the per-combination blocks.
 */
export function adaptTokenSet(root, { modes: requestedModes = [], diagnostics = new Diagnostics() } = {}) {
  const set = loadTokenSet(root, diagnostics);

  if (!diagnostics.ok) {
    throw new AdaptError(
      `Token set at ${displayPath(set.root)} did not load:\n`
      + diagnostics.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n'),
      'load-failed',
    );
  }

  const empty = isEmptyTokenSet(set);
  const combinations = requestedModes.length > 0 ? [requestedModes] : set.combinations;

  const adapted = [];
  for (const combo of combinations) {
    const label = combinationLabel(combo);
    const composed = composeModes(set, combo, diagnostics);

    // Resolution is a gate, not a step: the adapted output keeps the aliases.
    // A chain that cannot resolve is an error here rather than an undefined
    // custom property three layers downstream.
    resolveTokens(composed, diagnostics, label);
    if (!diagnostics.ok) {
      throw new AdaptError(
        `Combination "${label}" did not resolve:\n`
        + diagnostics.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n'),
        'resolve-failed',
      );
    }

    const entries = [];
    for (const [path, node] of [...composed].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!node.type) {
        throw new AdaptError(`Token "${path}" has no resolvable $type.`, 'unresolvable-type');
      }
      entries.push({
        path,
        type: node.type,
        value: adaptValue(node.rawValue, `${label}: ${path}`),
        layer: node.layer,
      });
    }

    const attributes = combinationAttributes(set, combo);
    adapted.push({
      modes: [...combo],
      attributes,
      slug: combinationSlug(attributes),
      label,
      entries,
      document: nest(entries),
    });
  }

  // A path is invariant when its adapted value is byte-identical everywhere.
  const invariant = new Set();
  const varying = new Set();
  const first = adapted[0];
  if (first) {
    const others = adapted.slice(1).map((c) => new Map(c.entries.map((e) => [e.path, JSON.stringify(e.value)])));
    for (const entry of first.entries) {
      const reference = JSON.stringify(entry.value);
      const same = others.every((map) => map.get(entry.path) === reference);
      (same ? invariant : varying).add(entry.path);
    }
  }

  return {
    root: set.root,
    empty,
    dimensions: set.dimensions,
    modeSource: set.modeSource,
    tokenCount: set.base.size,
    combinations: adapted,
    invariant,
    varying,
    diagnostics,
  };
}

/**
 * Write the adapted documents to a build directory, one file per combination
 * plus a manifest. The directory is emptied first: a combination that no longer
 * exists must not leave a file behind for the next build to pick up.
 */
export function writeAdapted(model, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const combination of model.combinations) {
    const file = join(outDir, `tokens.${combination.slug}.json`);
    writeFileSync(file, `${JSON.stringify(combination.document, null, 2)}\n`, 'utf8');
    written.push(file);
    combination.file = file;
  }

  const manifest = {
    $comment: 'Build artefact of machinery/scripts/dtcg-adapt.mjs. Not a source, not output. Safe to delete.',
    root: model.root,
    dimensions: model.dimensions,
    modeSource: model.modeSource,
    combinations: model.combinations.map((c) => ({
      slug: c.slug,
      label: c.label,
      modes: c.modes,
      attributes: c.attributes,
      file: c.file,
    })),
    invariant: [...model.invariant].sort(),
    varying: [...model.varying].sort(),
  };
  const manifestFile = join(outDir, 'manifest.json');
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  written.push(manifestFile);

  return written;
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, {
    flags: ['quiet'],
    values: ['root', 'out'],
    repeatable: ['mode'],
  });

  if (args.unknown.length > 0) {
    process.stderr.write(`Unrecognised argument(s): ${args.unknown.join(', ')}\n`);
    return 1;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const outDir = args.out ? args.out : defaultWorkDir();

  let model;
  try {
    model = adaptTokenSet(root, { modes: args.mode });
  } catch (error) {
    process.stderr.write(`Adapt failed.\n${error.message}\n`);
    return 1;
  }

  if (model.empty) {
    process.stdout.write(
      `Adapter — ${displayPath(model.root)}\n\n`
      + 'No token files found. Nothing to adapt.\n',
    );
    return 0;
  }

  const written = writeAdapted(model, outDir);

  if (!args.quiet) {
    const lines = [
      `Adapter — ${displayPath(model.root)} -> ${displayPath(outDir)}`,
      `${model.tokenCount} token(s), ${model.combinations.length} combination(s), `
      + `${model.invariant.size} invariant, ${model.varying.size} mode-dependent.`,
      '',
      ...model.combinations.map((c) => `  ${c.slug.padEnd(20)} ${c.label}`),
      '',
      `${written.length} file(s) written. This directory is a build artefact.`,
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  return 0;
}

// Only run as a CLI. build-tokens.mjs imports adaptTokenSet directly.
if (process.argv[1] && process.argv[1].endsWith('dtcg-adapt.mjs')) {
  process.exitCode = main(process.argv.slice(2));
}
