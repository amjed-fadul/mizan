#!/usr/bin/env node
/**
 * check-schema.mjs — deterministic structural gate for a DTCG token set.
 *
 * Brand-agnostic: it is pointed at a token root and discovers everything else.
 * It knows the shape of a valid token set, never the contents of one.
 *
 * Usage:
 *   node machinery/scripts/check-schema.mjs [--root <dir>] [--json] [--quiet]
 *
 *   --root <dir>   token root to check. Defaults to $TOKENS_ROOT, then to the
 *                  repository's content/tokens.
 *   --json         machine-readable output on stdout.
 *   --quiet        suppress the passing summary; failures still print.
 *
 * Exits 1 on any error, 0 otherwise. Warnings never fail the build.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  ALIAS_ONLY_LAYERS,
  Diagnostics,
  PAIRS_FILE,
  PRIMITIVE_LAYER,
  SEGMENT_PATTERN,
  combinationLabel,
  composeModes,
  defaultTokensRoot,
  displayPath,
  isEmptyTokenSet,
  isFullyAliased,
  isPlainObject,
  loadTokenSet,
  parseArgs,
  parseColor,
  readJson,
  referencedPaths,
  resolveTokens,
} from './lib/tokens.mjs';

/* ------------------------------------------------------------------ */

function checkNaming(node, diagnostics) {
  const bad = node.segments.filter((segment) => !SEGMENT_PATTERN.test(segment));
  if (bad.length === 0) return;
  diagnostics.error(
    'naming-pattern',
    `Token path "${node.path}" is not lowercase kebab-case: ${bad.map((s) => `"${s}"`).join(', ')}. Segments must match ${SEGMENT_PATTERN.source} and be separated by dots.`,
    { file: node.file, token: node.path },
  );
}

function checkType(node, diagnostics) {
  if (node.type) return;
  diagnostics.error(
    'unresolvable-type',
    `Token "${node.path}" has no $type and no ancestor group in ${displayPath(node.file)} declares one.`,
    { file: node.file, token: node.path },
  );
}

function checkAliasOnlyLayer(node, diagnostics) {
  if (!ALIAS_ONLY_LAYERS.has(node.layer)) return;
  if (isFullyAliased(node.rawValue)) return;
  diagnostics.error(
    'semantic-literal',
    `Token "${node.path}" in the ${node.layer} layer states a literal value. A ${node.layer} token must reference a token — ${JSON.stringify(node.rawValue)} restates a value instead of naming one.`,
    { file: node.file, token: node.path },
  );
}

/**
 * Colour literals are checked where they are written, not where they resolve,
 * so the error names the file the author has open.
 */
function checkColorLiteral(node, diagnostics) {
  if (node.type !== 'color') return;
  const value = node.rawValue;
  if (typeof value === 'string') {
    // An alias is fine here; a bare hex string is not.
    if (/^\{.+\}$/.test(value.trim())) return;
  }
  const parsed = parseColor(value);
  if (parsed.ok) return;
  diagnostics.error(parsed.code, `Token "${node.path}": ${parsed.message}`, {
    file: node.overrideFile ?? node.file,
    token: node.path,
  });
}

function checkUnusedPrimitives(set, diagnostics) {
  const consumers = [];
  for (const node of set.base.values()) {
    if (node.layer !== PRIMITIVE_LAYER) consumers.push(node);
  }
  for (const mode of set.modes.values()) consumers.push(...mode.overrides.values());

  const referenced = referencedPaths(consumers);
  for (const node of set.base.values()) {
    if (node.layer !== PRIMITIVE_LAYER) continue;
    if (referenced.has(node.path)) continue;
    diagnostics.warn(
      'unused-primitive',
      `Primitive "${node.path}" is not referenced by any semantic, component or mode token. A primitive with no consumer is a value nobody decided to use.`,
      { file: node.file, token: node.path },
    );
  }
}

/**
 * The declared pairs are part of the token set, so the token paths they name
 * have to exist. This is the check that answers "you declared a pairing for a
 * token nobody has written yet" in plain words, rather than leaving it to the
 * contrast gate to discover mid-calculation.
 */
function checkDeclaredPairs(set, diagnostics) {
  const pairsPath = join(set.root, PAIRS_FILE);
  if (!existsSync(pairsPath)) return;
  const data = readJson(pairsPath, diagnostics, 'invalid-pairs-file');
  if (data === null) return;
  if (!isPlainObject(data) || !Array.isArray(data.pairs)) {
    diagnostics.error('invalid-pairs-file', 'Pairs file must be an object containing a "pairs" array.', { file: pairsPath });
    return;
  }
  // Grouped by token, not by pair: one missing token named in five pairings is
  // one thing to fix, and five copies of it buries everything else in the run.
  const missing = new Map();
  for (const pair of data.pairs) {
    if (!isPlainObject(pair)) continue;
    for (const role of ['foreground', 'background']) {
      const path = pair[role];
      if (typeof path !== 'string' || set.base.has(path)) continue;
      if (!missing.has(path)) missing.set(path, []);
      missing.get(path).push(`${pair.foreground} on ${pair.background}`);
    }
  }
  for (const [path, pairings] of missing) {
    diagnostics.error(
      'pair-token-missing',
      `Declared pair token "${path}" is not defined by any token file. Named by: ${[...new Set(pairings)].join('; ')}.`,
      { file: pairsPath, token: path },
    );
  }
}

/* ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, { flags: ['json', 'quiet', 'help'], values: ['root'] });
  if (args.help) {
    process.stdout.write('Usage: check-schema.mjs [--root <dir>] [--json] [--quiet]\n');
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`check-schema: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(root, diagnostics);

  if (diagnostics.ok && isEmptyTokenSet(set)) {
    return report({
      args,
      root: set.root,
      set,
      diagnostics,
      empty: true,
    });
  }

  // Structure of every authored node: base layers first, then mode overrides.
  for (const node of set.base.values()) {
    checkNaming(node, diagnostics);
    checkType(node, diagnostics);
    checkAliasOnlyLayer(node, diagnostics);
    checkColorLiteral(node, diagnostics);
  }

  for (const mode of set.modes.values()) {
    for (const node of mode.overrides.values()) {
      checkNaming(node, diagnostics);
      const baseNode = set.base.get(node.path);
      if (!baseNode) continue; // reported by composeModes as mode-overrides-unknown-path
      const typed = { ...node, layer: baseNode.layer, type: node.ownType ?? node.inheritedType ?? baseNode.type };
      checkAliasOnlyLayer(typed, diagnostics);
      checkColorLiteral(typed, diagnostics);
    }
  }

  // Resolution, for the base and then for every applicable mode combination.
  // A mode can introduce a broken alias that the base never had, so every
  // combination has to be resolved, not just the base.
  resolveTokens(set.base, diagnostics, 'base');
  for (const combo of set.combinations) {
    if (combo.length === 0) continue;
    const composed = composeModes(set, combo, diagnostics);
    resolveTokens(composed, diagnostics, combinationLabel(combo));
  }

  checkDeclaredPairs(set, diagnostics);
  checkUnusedPrimitives(set, diagnostics);

  return report({ args, root: set.root, set, diagnostics, empty: false });
}

function report({ args, root, set, diagnostics, empty }) {
  const payload = {
    check: 'schema',
    ok: diagnostics.ok,
    root,
    empty,
    files: set.files.length,
    tokens: set.base.size,
    modes: [...set.modes.keys()],
    dimensions: set.dimensions,
    combinations: set.combinations.map(combinationLabel),
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return diagnostics.ok ? 0 : 1;
  }

  const out = [];
  out.push(`Schema gate — ${displayPath(root)}`);

  if (empty) {
    out.push('');
    out.push('No token files found. Nothing to validate yet.');
    out.push('This passes because there is nothing to reject, not because anything was checked.');
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
  }

  out.push(
    `${set.files.length} file(s), ${set.base.size} token(s), `
    + `${set.modes.size} mode(s) in ${set.dimensions.length} dimension(s), `
    + `${set.combinations.length} mode combination(s).`,
  );

  if (diagnostics.errors.length > 0) {
    out.push('');
    out.push(`ERRORS (${diagnostics.errors.length})`);
    for (const error of diagnostics.errors) out.push(...formatDiagnostic(error));
  }

  if (diagnostics.warnings.length > 0) {
    out.push('');
    out.push(`WARNINGS (${diagnostics.warnings.length}) — these do not fail the build`);
    for (const warning of diagnostics.warnings) out.push(...formatDiagnostic(warning));
  }

  out.push('');
  out.push(
    diagnostics.ok
      ? `Result: pass. ${diagnostics.warnings.length} warning(s).`
      : `Result: fail. ${diagnostics.errors.length} error(s), ${diagnostics.warnings.length} warning(s).`,
  );

  if (!args.quiet || !diagnostics.ok) process.stdout.write(`${out.join('\n')}\n`);
  return diagnostics.ok ? 0 : 1;
}

function formatDiagnostic(entry) {
  const lines = [`  [${entry.code}] ${entry.message}`];
  const where = [];
  if (entry.token) where.push(`token: ${entry.token}`);
  if (entry.file) where.push(`file: ${displayPath(entry.file)}`);
  if (entry.mode && entry.mode !== 'base') where.push(`mode: ${entry.mode}`);
  if (where.length > 0) lines.push(`      ${where.join('  ')}`);
  return lines;
}

process.exitCode = main(process.argv.slice(2));
