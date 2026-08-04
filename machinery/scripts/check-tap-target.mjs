#!/usr/bin/env node
/**
 * check-tap-target.mjs — WCAG target-size gate over declared control footprints.
 *
 * Brand-agnostic. The targets, the tokens and the modes are all content; this
 * script supplies only the comparison and the two thresholds, which come from
 * WCAG 2.2 rather than from anybody's control geometry.
 *
 * This is the gate decision 022 said was owed and the token layer could not
 * hold on its own. A dimension token can state a geometry — `control.md.min-block`
 * is 48 — but it cannot state that 48 must stay at or above 44, because that is a
 * relation between a value and a threshold and a token is only the value. So the
 * threshold lives here, the way decision 010 put the contrast thresholds in
 * check-contrast.mjs and had pairs.json declare what to check against them. This
 * file is that shape a second time: `targets.json` declares which control steps
 * claim to be full-size and which floors express the claim, and this script
 * asserts every one of them clears its bar in every mode combination.
 *
 * Two contexts, both real floors:
 *
 *   pointer   44×44 CSS px. SC 2.5.5 Target Size (Enhanced), Level AAA. The bar a
 *             control step must clear to stand alone as a pointer/touch action.
 *   inline    24×24 CSS px. SC 2.5.8 Target Size (Minimum), Level AA. The reduced
 *             bar a step earns only where 2.5.8 itself does not require a large
 *             target — inline within a run of text, or where an equivalent
 *             full-size control for the same action exists elsewhere. A step
 *             declared `inline` is not waived; it is held to the minimum and must
 *             argue the reduction in its own $description, the way a `decorative`
 *             pair argues its absent bar in check-contrast.mjs.
 *
 * Unlike a colour pairing, a footprint is not scoped to a mode. Decision 022 asks
 * for the floor to hold "in every mode combination", so every declared target is
 * evaluated in every combination and there is no `"modes"` narrowing to develop
 * the silent-skip hole scoping otherwise invites. The only way a declared target
 * goes unevaluated is `--mode` narrowing the run to nothing, and that is caught.
 *
 * Usage:
 *   node machinery/scripts/check-tap-target.mjs [--root <dir>] [--targets <file>]
 *                                               [--mode <id>]... [--json] [--quiet]
 *
 *   --root <dir>      token root. Defaults to $TOKENS_ROOT, then content/tokens.
 *   --targets <file>  targets file. Defaults to <root>/targets.json.
 *   --mode <id>       check only this one combination. Repeatable. Omit for all.
 *   --json            machine-readable output.
 *   --quiet           suppress the passing summary; failures still print.
 *
 * Exits 1 on any failure, or on a malformed targets file.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  Diagnostics,
  TARGETS_FILE,
  combinationLabel,
  composeModes,
  defaultTokensRoot,
  displayPath,
  isEmptyTokenSet,
  isPlainObject,
  loadTokenSet,
  parseArgs,
  readJson,
  resolveTokens,
} from './lib/tokens.mjs';

/* ------------------------------------------------------------------ *
 * Thresholds
 * ------------------------------------------------------------------ */

/**
 * The two target-size floors, in CSS px, by the context a step is declared for.
 *
 * Both are real bars — neither is null the way `decorative` is in the contrast
 * gate — because a control has a footprint and WCAG governs it either way. What
 * differs between the two is which success criterion applies, and that is a
 * property of how the step is used, not of the geometry:
 *
 *   pointer  SC 2.5.5 (Enhanced, AAA), 44. The system's own commitment for a
 *            standalone action.
 *   inline   SC 2.5.8 (Minimum, AA), 24. The floor a step still clears when the
 *            enhanced bar is legitimately not required.
 */
export const TARGET_THRESHOLDS = Object.freeze({
  pointer: 44,
  inline: 24,
});

/* ------------------------------------------------------------------ *
 * Targets file
 * ------------------------------------------------------------------ */

function loadTargets(targetsPath, diagnostics) {
  const data = readJson(targetsPath, diagnostics, 'invalid-targets-file');
  if (data === null) return { targets: [] };
  if (!isPlainObject(data)) {
    diagnostics.error('invalid-targets-file', 'Targets file must contain a JSON object.', { file: targetsPath });
    return { targets: [] };
  }

  const rawTargets = data.targets;
  if (!Array.isArray(rawTargets)) {
    diagnostics.error('invalid-targets-file', 'Targets file must contain a "targets" array.', { file: targetsPath });
    return { targets: [] };
  }

  const targets = [];
  rawTargets.forEach((target, index) => {
    const where = `targets[${index}]`;
    if (!isPlainObject(target)) {
      diagnostics.error('invalid-target', `${where} is not an object.`, { file: targetsPath });
      return;
    }
    const { step, block, inline, context } = target;
    if (typeof step !== 'string' || step.trim() === '') {
      diagnostics.error('invalid-target', `${where} needs a string "step" naming the control step it describes.`, { file: targetsPath });
      return;
    }
    if (typeof block !== 'string' || typeof inline !== 'string') {
      diagnostics.error(
        'invalid-target',
        `${where} (${step}) needs string "block" and "inline" token paths — the two floors that express the footprint.`,
        { file: targetsPath },
      );
      return;
    }
    // Object.hasOwn, not truthiness: a threshold could be 0 in principle, and a
    // context is a key that must be recognised rather than merely present.
    if (typeof context !== 'string' || !Object.hasOwn(TARGET_THRESHOLDS, context)) {
      diagnostics.error(
        'invalid-target-context',
        `${where} (${step}) declares context ${JSON.stringify(context)}. Valid contexts: ${Object.keys(TARGET_THRESHOLDS).join(', ')}.`,
        { file: targetsPath },
      );
      return;
    }
    targets.push({
      step,
      block,
      inline,
      context,
      description: target.$description,
    });
  });

  return { targets, description: data.$description };
}

/* ------------------------------------------------------------------ *
 * One target in one combination
 * ------------------------------------------------------------------ */

/**
 * Read a dimension token and return its CSS-px length, or null having reported
 * why not. A target-size floor stated in anything but px cannot be compared to a
 * px bar without knowing a font size, so a non-px unit is a category error at the
 * declaration rather than a number quietly coerced.
 */
function readLength(path, axis, target, resolved, label, targetsPath, diagnostics) {
  const token = resolved.get(path);
  if (!token) {
    diagnostics.error(
      'target-token-unresolved',
      `Target "${target.step}" names ${axis} token "${path}", which does not exist or did not resolve in mode ${label}.`,
      { file: targetsPath, token: path, mode: label },
    );
    return null;
  }
  if (token.type !== 'dimension') {
    diagnostics.error(
      'target-token-not-dimension',
      `Target "${target.step}" names ${axis} token "${path}", whose $type is ${JSON.stringify(token.type)} rather than "dimension". A tap target is a length.`,
      { file: token.file, token: path, mode: label },
    );
    return null;
  }
  const value = token.value;
  if (!isPlainObject(value) || typeof value.value !== 'number' || typeof value.unit !== 'string') {
    diagnostics.error(
      'target-token-malformed',
      `Target "${target.step}" names ${axis} token "${path}", whose value is not a {value, unit} length in mode ${label}.`,
      { file: token.file, token: path, mode: label },
    );
    return null;
  }
  if (value.unit !== 'px') {
    diagnostics.error(
      'target-token-not-px',
      `Target "${target.step}" names ${axis} token "${path}", which is ${value.value}${value.unit} in mode ${label}. `
      + 'A target-size floor must be in px: a length in em or rem scales with the font and cannot be compared to a CSS-px bar without one.',
      { file: token.file, token: path, mode: label },
    );
    return null;
  }
  return value.value;
}

function evaluateTarget(target, combo, resolved, targetsPath, diagnostics) {
  const label = combinationLabel(combo);
  const threshold = TARGET_THRESHOLDS[target.context];
  const result = {
    step: target.step,
    block: target.block,
    inline: target.inline,
    context: target.context,
    modes: combo,
    modeLabel: label,
    threshold,
    status: 'error',
  };

  const blockLen = readLength(target.block, 'block', target, resolved, label, targetsPath, diagnostics);
  const inlineLen = readLength(target.inline, 'inline', target, resolved, label, targetsPath, diagnostics);
  if (blockLen === null || inlineLen === null) return result;

  result.blockPx = blockLen;
  result.inlinePx = inlineLen;
  // Both axes are floored against the same bar, and the smaller decides. A
  // control that clears 44 vertically and 40 across is a control you miss across.
  result.smallestPx = Math.min(blockLen, inlineLen);
  result.smallestAxis = blockLen <= inlineLen ? 'block' : 'inline';
  result.status = result.smallestPx >= threshold ? 'pass' : 'fail';
  return result;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, {
    flags: ['json', 'quiet', 'help'],
    values: ['root', 'targets'],
    repeatable: ['mode'],
  });
  if (args.help) {
    process.stdout.write('Usage: check-tap-target.mjs [--root <dir>] [--targets <file>] [--mode <id>]... [--json] [--quiet]\n');
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`check-tap-target: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(root, diagnostics);
  const targetsPath = args.targets ? args.targets : join(set.root, TARGETS_FILE);

  // An empty root means nothing has been authored yet. A root that failed to
  // load is a different thing and must not be reported as empty.
  if (diagnostics.ok && isEmptyTokenSet(set)) {
    return report({ args, set, targetsPath, results: [], diagnostics, empty: true });
  }

  if (!existsSync(targetsPath)) {
    diagnostics.error(
      'targets-file-missing',
      `No targets file at ${displayPath(targetsPath)}. A control step whose footprint is never declared is a footprint nothing checks, so this gate needs one.`,
      { file: targetsPath },
    );
    return report({ args, set, targetsPath, results: [], diagnostics, empty: false });
  }

  const { targets } = loadTargets(targetsPath, diagnostics);

  const combinations = args.mode.length > 0 ? [args.mode] : set.combinations;
  const results = [];

  /* Every target in every combination, with no `"modes"` narrowing between them.
   * The contrast gate carries a backstop for a target it declared but never
   * evaluated, because a scoped pair can exclude every combination and report a
   * pass having checked nothing. A footprint has no scope: modeCombinations never
   * returns an empty list — a set with no modes still yields the single `base`
   * combination — so this loop evaluates every declared target at least once by
   * construction, and coverage is a property of the shape rather than a thing a
   * runtime check has to defend. If a footprint ever earns a per-mode scope, the
   * backstop comes back with it. */
  for (const combo of combinations) {
    const composed = composeModes(set, combo, diagnostics);
    const resolved = resolveTokens(composed, diagnostics, combinationLabel(combo));
    for (const target of targets) {
      results.push(evaluateTarget(target, combo, resolved, targetsPath, diagnostics));
    }
  }

  return report({ args, set, targetsPath, results, diagnostics, empty: false });
}

function report({ args, set, targetsPath, results, diagnostics, empty }) {
  const failures = results.filter((r) => r.status === 'fail');
  const passing = results.filter((r) => r.status === 'pass');
  const ok = diagnostics.ok && failures.length === 0;

  const payload = {
    check: 'tap-target',
    ok,
    root: set.root,
    targetsFile: targetsPath,
    empty,
    thresholds: TARGET_THRESHOLDS,
    combinations: (args.mode.length > 0 ? [args.mode] : set.combinations).map(combinationLabel),
    checks: results.length,
    results,
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return ok ? 0 : 1;
  }

  const out = [];
  out.push(`Tap-target gate — ${displayPath(set.root)}`);

  if (empty) {
    out.push('');
    out.push('No token files found. Nothing to check yet.');
    out.push('This passes because there is nothing to reject, not because anything was checked.');
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
  }

  out.push(`targets: ${displayPath(targetsPath)}`);
  out.push(`${payload.combinations.length} mode combination(s): ${payload.combinations.join(', ')}`);
  out.push(`${results.length} check(s).`);

  if (failures.length > 0) {
    out.push('');
    out.push(`FAILURES (${failures.length})`);
    for (const result of failures) out.push(...formatResult(result, 'FAIL'));
  }

  if (passing.length > 0 && !args.quiet) {
    out.push('');
    out.push(`PASSING (${passing.length})`);
    for (const result of passing) out.push(...formatResult(result, 'PASS'));
  }

  if (diagnostics.errors.length > 0) {
    out.push('');
    out.push(`ERRORS (${diagnostics.errors.length})`);
    for (const error of diagnostics.errors) {
      out.push(`  [${error.code}] ${error.message}`);
      const where = [];
      if (error.token) where.push(`token: ${error.token}`);
      if (error.file) where.push(`file: ${displayPath(error.file)}`);
      if (error.mode) where.push(`mode: ${error.mode}`);
      if (where.length > 0) out.push(`      ${where.join('  ')}`);
    }
  }

  if (diagnostics.warnings.length > 0) {
    out.push('');
    out.push(`WARNINGS (${diagnostics.warnings.length})`);
    for (const warning of diagnostics.warnings) out.push(`  [${warning.code}] ${warning.message}`);
  }

  out.push('');
  out.push(
    ok
      ? `Result: pass. ${passing.length} footprint check(s) cleared their floor.`
      : `Result: fail. ${failures.length} footprint(s) under floor, ${diagnostics.errors.length} error(s).`,
  );

  if (!args.quiet || !ok) process.stdout.write(`${out.join('\n')}\n`);
  return ok ? 0 : 1;
}

function formatResult(result, prefix) {
  const lines = [];
  lines.push(`  ${prefix}  ${result.step}  (${result.context})`);
  lines.push(`      mode: ${result.modeLabel}`);
  if (result.smallestPx !== undefined) {
    lines.push(
      `      ${result.blockPx}px block × ${result.inlinePx}px inline  required ${result.threshold}×${result.threshold}  `
      + `(${result.smallestAxis} is the binding axis at ${result.smallestPx}px)`,
    );
    lines.push(`      block ${result.block}  inline ${result.inline}`);
  } else {
    lines.push('      not evaluated — see errors below');
  }
  return lines;
}

process.exitCode = main(process.argv.slice(2));
