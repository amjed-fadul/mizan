#!/usr/bin/env node
/**
 * check-contrast.mjs — WCAG contrast gate over declared token pairings.
 *
 * Brand-agnostic. The pairs, the tokens and the modes are all content; this
 * script supplies only the arithmetic and the thresholds, which come from WCAG
 * rather than from anybody's palette.
 *
 * Every declared pair is checked in every applicable mode combination. A pair
 * that passes in one mode and fails in another is a failure — that is the
 * entire reason this runs across combinations rather than against base values.
 *
 * One context, `decorative`, has no threshold. Those pairs are resolved and
 * their ratios reported like any other, and can never fail the build. The
 * category exists so that a pairing WCAG does not govern can still be declared
 * and tracked, instead of being either wrongly gated or left undeclared.
 *
 * A pair or an exception may carry a `"modes"` list to narrow itself to part of
 * the combination space. It means "for every dimension this list mentions, the
 * combination's mode for that dimension must be one of these" — see `modeScope`,
 * which also records what that used to mean and why it changed. Whatever the
 * list says, a declared pair that ends up evaluated in no combination at all is
 * an error: an undeclared pairing is an unchecked pairing, and so is a declared
 * one nothing ever looked at.
 *
 * Usage:
 *   node machinery/scripts/check-contrast.mjs [--root <dir>] [--pairs <file>]
 *                                             [--mode <id>]... [--json] [--quiet]
 *
 *   --root <dir>    token root. Defaults to $TOKENS_ROOT, then content/tokens.
 *   --pairs <file>  pairs file. Defaults to <root>/pairs.json.
 *   --mode <id>     check only this one combination. Repeatable, and applied
 *                   in the order given. Omit to check every combination.
 *   --json          machine-readable output.
 *   --quiet         suppress the passing summary; failures still print.
 *
 * Exits 1 on any non-excepted failure, or on a malformed pairs file.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONTRAST_THRESHOLDS,
  Diagnostics,
  PAIRS_FILE,
  combinationLabel,
  composeModes,
  compositeOver,
  contrastRatio,
  defaultTokensRoot,
  displayPath,
  formatRatio,
  isEmptyTokenSet,
  isPlainObject,
  loadTokenSet,
  parseArgs,
  parseColor,
  readJson,
  resolveTokens,
} from './lib/tokens.mjs';

/* ------------------------------------------------------------------ *
 * Mode scopes
 * ------------------------------------------------------------------ */

/**
 * What a `"modes"` list on a pair or an exception means.
 *
 * BEHAVIOUR CHANGE, and it is worth reading before trusting an old pairs file.
 * This used to be a plain conjunction: a combination matched when it contained
 * *every* listed mode. A combination holds exactly one mode per dimension, so
 * `["theme.light", "theme.dark"]` — which reads to anybody as "check this in
 * both themes" — matched nothing at all. The pair was skipped in every
 * combination, the gate reported "0 check(s)" and passed, and the most natural
 * thing a person could write was the one thing that silently switched the check
 * off. A typo did the same.
 *
 * It now means: **for every dimension the list mentions, the combination's mode
 * for that dimension must be one of the listed ones.** Or within a dimension,
 * and within a dimension only; still and across dimensions. So
 * `["theme.light", "theme.dark"]` is both themes, `["theme.dark"]` is the dark
 * ones, and `["theme.dark", "density.compact"]` is the single combination that
 * is both — which is what it meant before.
 *
 * That last part is the reason this is a safe change rather than a reinterpreted
 * one. Where the old rule selected anything at all, the two rules agree exactly:
 * a list naming at most one mode per dimension is a conjunction either way. They
 * differ only where the old rule selected *nothing*, which was never a
 * declaration anybody meant to write. No existing pairing changes meaning; the
 * ones that had no meaning acquire the obvious one.
 *
 * A list is validated against the token set as it is read, so a mode id that
 * does not exist is an error at the declaration rather than a filter that
 * quietly excludes everything.
 */
function modeScope(list, set, where, code, pairsPath, diagnostics) {
  if (list === null) return null;
  const byDimension = new Map();
  let valid = true;

  for (const id of list) {
    const mode = set.modes.get(id);
    if (mode === undefined || mode.dimension === undefined) {
      // A mode with no dimension has already been reported by the loader; an id
      // the set has never heard of has not, and is reported here.
      if (mode === undefined) {
        diagnostics.error(
          code,
          `${where} restricts itself to mode ${JSON.stringify(id)}, which this token set does not define. `
          + `Known modes: ${[...set.modes.keys()].join(', ') || '(none)'}. `
          + 'An unrecognised mode used to exclude every combination, which switched the check off rather than narrowing it.',
          { file: pairsPath, mode: id },
        );
      }
      valid = false;
      continue;
    }
    if (!byDimension.has(mode.dimension)) byDimension.set(mode.dimension, new Set());
    byDimension.get(mode.dimension).add(id);
  }

  return { list, byDimension, valid };
}

/** Does a combination fall inside a declared scope? A null scope is everywhere. */
function scopeIncludes(scope, combo) {
  if (scope === null) return true;
  if (!scope.valid) return false;
  for (const ids of scope.byDimension.values()) {
    if (!combo.some((mode) => ids.has(mode))) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Pairs file
 * ------------------------------------------------------------------ */

function loadPairs(pairsPath, set, diagnostics) {
  const data = readJson(pairsPath, diagnostics, 'invalid-pairs-file');
  if (data === null) return { pairs: [], exceptions: [] };
  if (!isPlainObject(data)) {
    diagnostics.error('invalid-pairs-file', 'Pairs file must contain a JSON object.', { file: pairsPath });
    return { pairs: [], exceptions: [] };
  }

  const pairs = [];
  const rawPairs = data.pairs;
  if (!Array.isArray(rawPairs)) {
    diagnostics.error('invalid-pairs-file', 'Pairs file must contain a "pairs" array.', { file: pairsPath });
  } else {
    rawPairs.forEach((pair, index) => {
      const where = `pairs[${index}]`;
      if (!isPlainObject(pair)) {
        diagnostics.error('invalid-pair', `${where} is not an object.`, { file: pairsPath });
        return;
      }
      const { foreground, background, context } = pair;
      if (typeof foreground !== 'string' || typeof background !== 'string') {
        diagnostics.error('invalid-pair', `${where} needs string "foreground" and "background" token paths.`, { file: pairsPath });
        return;
      }
      // Object.hasOwn, not truthiness: "decorative" maps to null on purpose and
      // must still be a recognised context.
      if (typeof context !== 'string' || !Object.hasOwn(CONTRAST_THRESHOLDS, context)) {
        diagnostics.error(
          'invalid-pair-context',
          `${where} (${foreground} on ${background}) declares context ${JSON.stringify(context)}. Valid contexts: ${Object.keys(CONTRAST_THRESHOLDS).join(', ')}.`,
          { file: pairsPath },
        );
        return;
      }
      const modes = Array.isArray(pair.modes) ? pair.modes : null;
      pairs.push({
        foreground,
        background,
        context,
        description: pair.$description,
        modes,
        scope: modeScope(
          modes, set,
          `${where} (${foreground} on ${background})`,
          'pair-mode-unknown', pairsPath, diagnostics,
        ),
      });
    });
  }

  const exceptions = [];
  const rawExceptions = data.exceptions;
  if (rawExceptions !== undefined && !Array.isArray(rawExceptions)) {
    diagnostics.error('invalid-exceptions', '"exceptions" must be an array when present.', { file: pairsPath });
  } else {
    (rawExceptions ?? []).forEach((exception, index) => {
      const where = `exceptions[${index}]`;
      if (!isPlainObject(exception)) {
        diagnostics.error('invalid-exception', `${where} is not an object.`, { file: pairsPath });
        return;
      }
      const { foreground, background, reason } = exception;
      if (typeof foreground !== 'string' || typeof background !== 'string') {
        diagnostics.error('invalid-exception', `${where} needs string "foreground" and "background" token paths.`, { file: pairsPath });
        return;
      }
      if (typeof reason !== 'string' || reason.trim() === '') {
        diagnostics.error(
          'exception-missing-reason',
          `${where} (${foreground} on ${background}) has no "reason". An exception without a stated reason is an unrecorded decision.`,
          { file: pairsPath },
        );
        return;
      }
      const modes = Array.isArray(exception.modes) ? exception.modes : null;
      exceptions.push({
        foreground,
        background,
        reason: reason.trim(),
        modes,
        scope: modeScope(
          modes, set,
          `${where} (${foreground} on ${background})`,
          'exception-mode-unknown', pairsPath, diagnostics,
        ),
      });
    });
  }

  return { pairs, exceptions, description: data.$description };
}

/**
 * An exception applies when the tokens match and the combination is in scope.
 *
 * The same scope rule as a pair, deliberately: two spellings of one word in one
 * file is how a file stops being readable. There is no reachability error for an
 * exception, though, and the asymmetry is the point. A pair whose scope selects
 * nothing fails *open* — the pairing goes unchecked and the build passes. An
 * exception whose scope selects nothing fails *safe* — the pairing is checked
 * against its full threshold and can still fail the build. Only the first is a
 * hole, so only the first is an error.
 */
function matchException(exceptions, pair, combo) {
  return exceptions.find((exception) => exception.foreground === pair.foreground
    && exception.background === pair.background
    && scopeIncludes(exception.scope, combo));
}

/* ------------------------------------------------------------------ *
 * One pair in one combination
 * ------------------------------------------------------------------ */

function evaluatePair(pair, combo, resolved, pairsPath, diagnostics) {
  const label = combinationLabel(combo);
  const threshold = CONTRAST_THRESHOLDS[pair.context];
  const result = {
    foreground: pair.foreground,
    background: pair.background,
    context: pair.context,
    modes: combo,
    modeLabel: label,
    threshold,
    status: 'error',
  };

  const readColor = (path, role) => {
    const token = resolved.get(path);
    if (!token) {
      diagnostics.error(
        'pair-token-unresolved',
        `Pair "${pair.foreground} on ${pair.background}" names ${role} token "${path}", which does not exist or did not resolve in mode ${label}.`,
        { file: pairsPath, token: path, mode: label },
      );
      return null;
    }
    if (token.type !== 'color') {
      diagnostics.error(
        'pair-token-not-color',
        `Pair "${pair.foreground} on ${pair.background}" names ${role} token "${path}", whose $type is ${JSON.stringify(token.type)} rather than "color".`,
        { file: token.file, token: path, mode: label },
      );
      return null;
    }
    const parsed = parseColor(token.value);
    if (!parsed.ok) {
      diagnostics.error(parsed.code, `Token "${path}" (${role} of a declared pair): ${parsed.message}`, {
        file: token.file, token: path, mode: label,
      });
      return null;
    }
    return parsed.color;
  };

  const foreground = readColor(pair.foreground, 'foreground');
  const background = readColor(pair.background, 'background');
  if (!foreground || !background) return result;

  if (background.alpha < 1) {
    diagnostics.error(
      'background-not-opaque',
      `Background token "${pair.background}" has alpha ${background.alpha} in mode ${label}. Contrast against a translucent background is undefined, because what sits behind it is unknown.`,
      { file: pairsPath, token: pair.background, mode: label },
    );
    return result;
  }

  const effective = foreground.alpha < 1 ? compositeOver(foreground, background) : foreground;
  const ratio = contrastRatio(effective, background);

  // A null threshold is a context with no bar to clear. The ratio is still
  // computed and still printed — the pair is tracked, it is simply not gated.
  result.status = threshold === null ? 'report' : (ratio >= threshold ? 'pass' : 'fail');
  result.ratio = Number(ratio.toFixed(4));
  result.foregroundHex = effective.hex;
  result.backgroundHex = background.hex;
  result.composited = foreground.alpha < 1;
  return result;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, {
    flags: ['json', 'quiet', 'help'],
    values: ['root', 'pairs'],
    repeatable: ['mode'],
  });
  if (args.help) {
    process.stdout.write('Usage: check-contrast.mjs [--root <dir>] [--pairs <file>] [--mode <id>]... [--json] [--quiet]\n');
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`check-contrast: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(root, diagnostics);
  const pairsPath = args.pairs ? args.pairs : join(set.root, PAIRS_FILE);

  // An empty root means nothing has been authored yet. A root that failed to
  // load is a different thing entirely and must not be reported as empty.
  if (diagnostics.ok && isEmptyTokenSet(set)) {
    return report({ args, set, pairsPath, results: [], exceptions: [], diagnostics, empty: true });
  }

  if (!existsSync(pairsPath)) {
    diagnostics.error(
      'pairs-file-missing',
      `No pairs file at ${displayPath(pairsPath)}. An undeclared pairing is an unchecked pairing, so this gate needs one.`,
      { file: pairsPath },
    );
    return report({ args, set, pairsPath, results: [], exceptions: [], diagnostics, empty: false });
  }

  const { pairs, exceptions } = loadPairs(pairsPath, set, diagnostics);

  const combinations = args.mode.length > 0 ? [args.mode] : set.combinations;
  const results = [];
  const evaluations = new Map(pairs.map((pair) => [pair, 0]));

  for (const combo of combinations) {
    const composed = composeModes(set, combo, diagnostics);
    const resolved = resolveTokens(composed, diagnostics, combinationLabel(combo));
    for (const pair of pairs) {
      if (!scopeIncludes(pair.scope, combo)) continue;
      evaluations.set(pair, evaluations.get(pair) + 1);
      const result = evaluatePair(pair, combo, resolved, pairsPath, diagnostics);
      const exception = matchException(exceptions, pair, combo);
      if (exception) {
        result.excepted = true;
        result.reason = exception.reason;
      }
      results.push(result);
    }
  }

  /* A declared pair that was never evaluated is the failure this gate is least
   * able to notice from its own output: it prints a smaller number of checks and
   * the word "pass". Every other defect in this file announces itself as a ratio
   * that did not clear a bar. This one announces itself as nothing.
   *
   * So it is counted rather than reasoned about. Whatever the scope rules are
   * today or become later, and whatever `--mode` was asked to narrow the run to,
   * the invariant holds: this gate does not report a pass having skipped a
   * pairing somebody declared. Declaring a pairing is asking for it to be
   * checked, and the answer to that request is never silence. */
  for (const [pair, count] of evaluations) {
    if (count > 0) continue;
    if (pair.scope !== null && !pair.scope.valid) continue; // already reported, by name
    diagnostics.error(
      'pair-never-evaluated',
      `Pair "${pair.foreground} on ${pair.background}" was not checked in a single mode combination. `
      + `It restricts itself to ${JSON.stringify(pair.modes ?? [])}, and this run covered `
      + `${combinations.map(combinationLabel).join(', ') || '(nothing)'}. `
      + 'A declared pairing that is never evaluated is an unchecked pairing reported as a passing one — either the restriction excludes every combination the token set has, or --mode narrowed the run past it.',
      { file: pairsPath },
    );
  }

  return report({ args, set, pairsPath, results, exceptions, diagnostics, empty: false });
}

function report({ args, set, pairsPath, results, exceptions, diagnostics, empty }) {
  const failures = results.filter((r) => r.status === 'fail' && !r.excepted);
  const excepted = results.filter((r) => r.excepted);
  const passing = results.filter((r) => r.status === 'pass' && !r.excepted);
  const reported = results.filter((r) => r.status === 'report' && !r.excepted);
  const ok = diagnostics.ok && failures.length === 0;

  const payload = {
    check: 'contrast',
    ok,
    root: set.root,
    pairsFile: pairsPath,
    empty,
    thresholds: CONTRAST_THRESHOLDS,
    combinations: (args.mode.length > 0 ? [args.mode] : set.combinations).map(combinationLabel),
    checks: results.length,
    results,
    exceptions,
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return ok ? 0 : 1;
  }

  const out = [];
  out.push(`Contrast gate — ${displayPath(set.root)}`);

  if (empty) {
    out.push('');
    out.push('No token files found. Nothing to check yet.');
    out.push('This passes because there is nothing to reject, not because anything was checked.');
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
  }

  out.push(`pairs: ${displayPath(pairsPath)}`);
  out.push(`${payload.combinations.length} mode combination(s): ${payload.combinations.join(', ')}`);
  out.push(`${results.length} check(s).`);

  if (failures.length > 0) {
    out.push('');
    out.push(`FAILURES (${failures.length})`);
    for (const result of failures) out.push(...formatResult(result, 'FAIL'));
  }

  if (reported.length > 0) {
    out.push('');
    out.push(`REPORTED, NOT GATED (${reported.length})`);
    out.push('  Declared in a context with no threshold. The ratio is measured and printed so the pairing can be read and counted, but nothing here can fail the build.');
    for (const result of reported) out.push(...formatResult(result, 'REPORT'));
  }

  if (excepted.length > 0) {
    out.push('');
    out.push(`EXCEPTIONS IN EFFECT (${excepted.length})`);
    out.push('  Every exception is reported whether it passes or fails. A silent exception is not an exception, it is a hole.');
    for (const result of excepted) {
      out.push(...formatResult(result, exceptionLabel(result.status)));
      out.push(`      reason: ${result.reason}`);
    }
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
      ? `Result: pass. ${passing.length} check(s) passed, ${reported.length} reported without a threshold, ${excepted.length} exception(s) in effect.`
      : `Result: fail. ${failures.length} failing pair(s), ${diagnostics.errors.length} error(s), ${reported.length} reported without a threshold, ${excepted.length} exception(s) in effect.`,
  );

  if (!args.quiet || !ok) process.stdout.write(`${out.join('\n')}\n`);
  return ok ? 0 : 1;
}

function exceptionLabel(status) {
  if (status === 'fail') return 'EXCEPTION (currently failing)';
  if (status === 'report') return 'EXCEPTION (context is not gated)';
  return 'EXCEPTION (currently passing)';
}

function formatResult(result, prefix) {
  const lines = [];
  lines.push(`  ${prefix}  ${result.foreground} on ${result.background}`);
  lines.push(`      mode: ${result.modeLabel}`);
  if (result.ratio !== undefined) {
    lines.push(
      result.threshold === null
        ? `      ratio ${formatRatio(result.ratio)}  no threshold applies  (context: ${result.context})`
        : `      ratio ${formatRatio(result.ratio)}  required ${result.threshold.toFixed(2)}:1  (context: ${result.context})`,
    );
    lines.push(
      `      foreground ${result.foregroundHex}${result.composited ? ' (composited over the background)' : ''}  background ${result.backgroundHex}`,
    );
  } else {
    lines.push('      not evaluated — see errors below');
  }
  return lines;
}

process.exitCode = main(process.argv.slice(2));
