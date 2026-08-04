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
 * Pairs file
 * ------------------------------------------------------------------ */

function loadPairs(pairsPath, diagnostics) {
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
      if (typeof context !== 'string' || !Object.hasOwn(CONTRAST_THRESHOLDS, context)) {
        diagnostics.error(
          'invalid-pair-context',
          `${where} (${foreground} on ${background}) declares context ${JSON.stringify(context)}. Valid contexts: ${Object.keys(CONTRAST_THRESHOLDS).join(', ')}.`,
          { file: pairsPath },
        );
        return;
      }
      pairs.push({
        foreground,
        background,
        context,
        description: pair.$description,
        modes: Array.isArray(pair.modes) ? pair.modes : null,
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
      exceptions.push({
        foreground,
        background,
        reason: reason.trim(),
        modes: Array.isArray(exception.modes) ? exception.modes : null,
      });
    });
  }

  return { pairs, exceptions, description: data.$description };
}

/** An exception applies when the tokens match and every listed mode is active. */
function matchException(exceptions, pair, combo) {
  return exceptions.find((exception) => exception.foreground === pair.foreground
    && exception.background === pair.background
    && (exception.modes === null || exception.modes.every((mode) => combo.includes(mode))));
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

  result.status = ratio >= threshold ? 'pass' : 'fail';
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

  const { pairs, exceptions } = loadPairs(pairsPath, diagnostics);

  const combinations = args.mode.length > 0 ? [args.mode] : set.combinations;
  const results = [];

  for (const combo of combinations) {
    const composed = composeModes(set, combo, diagnostics);
    const resolved = resolveTokens(composed, diagnostics, combinationLabel(combo));
    for (const pair of pairs) {
      if (pair.modes && !pair.modes.every((mode) => combo.includes(mode))) continue;
      const result = evaluatePair(pair, combo, resolved, pairsPath, diagnostics);
      const exception = matchException(exceptions, pair, combo);
      if (exception) {
        result.excepted = true;
        result.reason = exception.reason;
      }
      results.push(result);
    }
  }

  return report({ args, set, pairsPath, results, exceptions, diagnostics, empty: false });
}

function report({ args, set, pairsPath, results, exceptions, diagnostics, empty }) {
  const failures = results.filter((r) => r.status === 'fail' && !r.excepted);
  const excepted = results.filter((r) => r.excepted);
  const passing = results.filter((r) => r.status === 'pass' && !r.excepted);
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

  if (excepted.length > 0) {
    out.push('');
    out.push(`EXCEPTIONS IN EFFECT (${excepted.length})`);
    out.push('  Every exception is reported whether it passes or fails. A silent exception is not an exception, it is a hole.');
    for (const result of excepted) {
      out.push(...formatResult(result, result.status === 'pass' ? 'EXCEPTION (currently passing)' : 'EXCEPTION (currently failing)'));
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
      ? `Result: pass. ${passing.length} check(s) passed, ${excepted.length} exception(s) in effect.`
      : `Result: fail. ${failures.length} failing pair(s), ${diagnostics.errors.length} error(s), ${excepted.length} exception(s) in effect.`,
  );

  if (!args.quiet || !ok) process.stdout.write(`${out.join('\n')}\n`);
  return ok ? 0 : 1;
}

function formatResult(result, prefix) {
  const lines = [];
  lines.push(`  ${prefix}  ${result.foreground} on ${result.background}`);
  lines.push(`      mode: ${result.modeLabel}`);
  if (result.ratio !== undefined) {
    lines.push(
      `      ratio ${formatRatio(result.ratio)}  required ${result.threshold.toFixed(2)}:1  (context: ${result.context})`,
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
