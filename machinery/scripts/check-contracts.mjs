#!/usr/bin/env node
/**
 * check-contracts.mjs — deterministic gate over the component contracts.
 *
 * Brand-agnostic: it is pointed at a metadata directory and a token root, and
 * discovers everything else. It knows the shape of a contract, never the
 * contents of one.
 *
 * **The question it answers is whether a contract is still true**, and the way
 * it answers it is to regenerate the contract from the component's source and
 * the authored half and compare. A contract is correct exactly when it is what
 * `gen-contract.mjs` would write today.
 *
 * The prop-level findings are named individually rather than left to that
 * comparison, because "the file differs" is not something anybody can act on
 * and because each one is a different mistake:
 *
 * | Code | Meaning |
 * |---|---|
 * | `contract-invalid` | the contract does not satisfy the schema |
 * | `component-source-missing` | the contract names a source file that is not there |
 * | `source-unreadable` | the source is outside the subset the reader parses |
 * | `authored-missing` | the contract has no authored half to regenerate from |
 * | `authored-invalid` | the authored half writes something it does not own |
 * | `component-name-mismatch` | the contract and the source disagree about the component |
 * | `props-type-mismatch` | the props type was renamed |
 * | `extends-mismatch` | the props type inherits from something else now |
 * | `prop-missing-in-contract` | the source declares a prop the contract does not mention |
 * | `prop-unknown-to-source` | the contract describes a prop nothing implements |
 * | `prop-type-mismatch` | the same prop, two types |
 * | `prop-required-mismatch` | optional in one, required in the other |
 * | `prop-default-mismatch` | the same prop, two defaults |
 * | `prop-values-mismatch` | the union gained or lost a member |
 * | `prop-description-drift` | the JSDoc moved and the contract did not |
 * | `prop-deprecation-drift` | a prop was deprecated in one place only |
 * | `contract-stale` | anything else the regeneration disagrees about |
 * | `contract-token-unknown` | the contract names a token the token root does not define |
 * | `alternative-not-in-system` | an alternative claims to be a component and has no contract |
 * | `orphan-authored` | a warning: an authored half with no contract generated from it |
 *
 * `contract-stale` is the one that covers what the others cannot, and the edit
 * it exists for is the authored half rewritten in the generated file. No
 * comparison against a component's source could ever catch that, and it is the
 * finding that makes a contract build output rather than a file that merely
 * started as one.
 *
 * An empty metadata directory is reported as such and exits 0. There is nothing
 * to reject, and that is stated in the output rather than implied by a green
 * tick.
 *
 * Usage:
 *   node machinery/scripts/check-contracts.mjs [--metadata <dir>] [--schema <file>]
 *                                              [--root <dir>] [--css-prefix <str>]
 *                                              [--json] [--quiet]
 *
 *   --metadata <dir>    where contracts live. Defaults to machinery/metadata.
 *   --schema <file>     the contract schema. Defaults to the one in <metadata>.
 *   --root <dir>        token root, for the token names a contract claims and
 *                       for reading each component's stylesheet. Defaults to
 *                       $TOKENS_ROOT, then to the repository's content/tokens.
 *   --css-prefix <str>  the prefix the CSS build publishes token names under.
 *
 * Exits 1 on any error. Warnings never fail the build.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Diagnostics, defaultTokensRoot, displayPath, isEmptyTokenSet, loadTokenSet, parseArgs, repoRoot } from './lib/tokens.mjs';
import { readComponentApi } from './lib/component-source.mjs';
import {
  AUTHORED_DIR,
  SCHEMA_FILE,
  buildContract,
  compareToRegenerated,
  compareToSource,
  contractFiles,
  fileNameFor,
  loadSchema,
  readStylesheet,
  stylesheetBeside,
  unsupportedKeywords,
  validate,
} from './lib/contract.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_METADATA = join(dirname(SCRIPTS_DIR), 'metadata');
const GENERATOR = 'machinery/scripts/gen-contract.mjs';

/**
 * The token names a contract claims, against the token set that exists.
 *
 * A contract references tokens by name and never restates what they resolve
 * to, which makes the name the only thing there is to be wrong about — so it
 * is the one thing checked. Nothing here knows a token name; they all come
 * from the root.
 */
function checkTokens(contract, tokenPaths, diagnostics, file) {
  if (!tokenPaths || !contract.tokens) return;
  const known = new Set(tokenPaths);
  for (const name of contract.tokens) {
    if (known.has(name)) continue;
    diagnostics.error(
      'contract-token-unknown',
      `${contract.name} claims to consume "${name}", which no token file defines.`,
      { file, component: contract.name },
    );
  }
}

function checkAlternatives(contract, known, diagnostics, file) {
  for (const alternative of contract.alternatives ?? []) {
    if (alternative.in_system !== true) continue;
    if (known.has(alternative.use)) continue;
    diagnostics.error(
      'alternative-not-in-system',
      `${contract.name} sends people to "${alternative.use}" for ${alternative.for}, and no contract describes it. An alternative that does not exist is a dead end at the exact moment somebody has been told not to use this component.`,
      { file, component: contract.name },
    );
  }
}

function main(argv) {
  const args = parseArgs(argv, { flags: ['json', 'quiet', 'help'], values: ['metadata', 'root', 'css-prefix', 'schema'] });
  if (args.help) {
    process.stdout.write('Usage: check-contracts.mjs [--metadata <dir>] [--root <dir>] [--json] [--quiet]\n');
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`check-contracts: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const metadataDir = args.metadata ? resolve(args.metadata) : DEFAULT_METADATA;
  const diagnostics = new Diagnostics();
  const schemaFile = args.schema ? resolve(args.schema) : join(metadataDir, SCHEMA_FILE);

  if (!existsSync(schemaFile)) {
    process.stderr.write(`check-contracts: no schema at ${displayPath(schemaFile)}.\n`);
    return 2;
  }
  const schema = loadSchema(schemaFile);
  const unsupported = unsupportedKeywords(schema);
  if (unsupported.length > 0) {
    process.stderr.write(`check-contracts: the schema uses keyword(s) this validator does not implement: ${unsupported.join(', ')}. A schema that cannot be enforced in full must not be used to claim anything.\n`);
    return 2;
  }

  const files = contractFiles(metadataDir);
  const authoredDir = join(metadataDir, AUTHORED_DIR);

  if (files.length === 0) {
    return report({ args, metadataDir, diagnostics, contracts: [], empty: true });
  }

  // Token names, when there is a token set to check them against. A contract
  // may be checked with no token root present — the names simply go unchecked
  // and the output says so rather than implying they passed.
  const tokenRoot = args.root ? resolve(args.root) : defaultTokensRoot();
  let tokenPaths = null;
  if (existsSync(tokenRoot)) {
    const set = loadTokenSet(tokenRoot, new Diagnostics());
    if (!isEmptyTokenSet(set)) tokenPaths = [...set.base.keys()];
  }
  const cssPrefix = args['css-prefix'] ?? '';

  const contracts = [];
  const known = new Set();
  const loaded = [];

  for (const file of files) {
    const ref = displayPath(file);
    let contract;
    try {
      contract = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      diagnostics.error('contract-invalid', `${ref} is not readable JSON: ${error.message}`, { file: ref });
      continue;
    }
    loaded.push({ file, ref, contract });
    if (typeof contract.name === 'string') known.add(contract.name);
  }

  for (const { file, ref, contract } of loaded) {
    const problems = validate(contract, schema);
    for (const problem of problems) {
      diagnostics.error('contract-invalid', `${problem.path}: ${problem.message}`, { file: ref, component: contract.name });
    }
    // Everything below reads properties the schema guarantees. If it did not,
    // the findings would be about the validator's own confusion.
    if (problems.length > 0) {
      contracts.push({ file: ref, name: contract.name ?? basename(file), checked: false });
      continue;
    }

    checkTokens(contract, tokenPaths, diagnostics, ref);
    checkAlternatives(contract, known, diagnostics, ref);

    const sourceFile = join(repoRoot(), contract.source);
    if (!existsSync(sourceFile)) {
      diagnostics.error(
        'component-source-missing',
        `${contract.name}'s contract names ${contract.source}, which does not exist. A contract with nothing to check against is not a verified contract.`,
        { file: ref, component: contract.name },
      );
      contracts.push({ file: ref, name: contract.name, checked: false });
      continue;
    }

    // Discovery first, and the contract's own answer only as a tie-break. If
    // the contract's `propsType` were handed to the reader up front, renaming
    // the props type would be reported as a source this reader cannot follow
    // rather than as the rename it is — and the finding would name the wrong
    // file. The contract's answer is still needed where a file declares more
    // than one props type, which is the one question discovery cannot settle.
    const text = readFileSync(sourceFile, 'utf8');
    let read = readComponentApi(text, { file: contract.source });
    if (!read.ok && read.errors.some((error) => error.code === 'props-type-ambiguous')) {
      read = readComponentApi(text, { file: contract.source, propsType: contract.propsType });
    }
    if (!read.ok) {
      for (const error of read.errors) {
        diagnostics.error('source-unreadable', `[${error.code}] ${error.message}`, {
          file: contract.source,
          component: contract.name,
          line: error.line,
        });
      }
      contracts.push({ file: ref, name: contract.name, checked: false });
      continue;
    }

    for (const finding of compareToSource(contract, read.api)) {
      diagnostics.error(finding.code, finding.message, { file: ref, component: contract.name, prop: finding.prop });
    }

    const authoredPath = join(authoredDir, `${fileNameFor(contract.name)}.json`);
    if (!existsSync(authoredPath)) {
      diagnostics.error(
        'authored-missing',
        `${contract.name}'s contract has no authored half at ${displayPath(authoredPath)}, so there is nothing to regenerate it from. The generated file cannot be the editing surface for the judgment in it.`,
        { file: ref, component: contract.name },
      );
      contracts.push({ file: ref, name: contract.name, checked: false });
      continue;
    }

    let authored;
    try {
      authored = JSON.parse(readFileSync(authoredPath, 'utf8'));
    } catch (error) {
      diagnostics.error('authored-invalid', `${displayPath(authoredPath)} is not readable JSON: ${error.message}`, { file: displayPath(authoredPath), component: contract.name });
      contracts.push({ file: ref, name: contract.name, checked: false });
      continue;
    }

    const cssFile = stylesheetBeside(sourceFile);
    const stylesheet = cssFile && tokenPaths
      ? readStylesheet(readFileSync(cssFile, 'utf8'), tokenPaths, cssPrefix)
      : null;

    const built = buildContract({
      api: read.api,
      authored,
      schema,
      source: contract.source,
      schemaRef: `./${SCHEMA_FILE}`,
      generator: GENERATOR,
      authoredRef: displayPath(authoredPath),
      stylesheet,
      stylesheetRef: cssFile ? displayPath(cssFile) : null,
    });
    for (const problem of built.problems) {
      diagnostics.error('authored-invalid', `${problem.path}: ${problem.message}`, {
        file: displayPath(authoredPath),
        component: contract.name,
      });
    }
    if (built.problems.length === 0) {
      for (const finding of compareToRegenerated(contract, built.contract)) {
        diagnostics.error(finding.code, finding.message, { file: ref, component: contract.name });
      }
    }

    contracts.push({
      file: ref,
      name: contract.name,
      source: contract.source,
      props: contract.props.length,
      keywords: contract.aiHints.keywords.length,
      boundaries: contract.do_not_use_when.length,
      tokens: contract.tokens?.length ?? 0,
      checked: true,
    });
  }

  // An authored half nobody generated from is work that has not landed. It is a
  // warning rather than an error: the file is harmless, but it is also invisible
  // to every agent that reads this directory, which is the opposite of why it
  // was written.
  if (existsSync(authoredDir)) {
    for (const entry of readdirSync(authoredDir)) {
      if (!entry.endsWith('.json')) continue;
      if (files.some((file) => basename(file) === entry)) continue;
      diagnostics.warn(
        'orphan-authored',
        `${displayPath(join(authoredDir, entry))} has no contract generated from it. Run ${GENERATOR} against the component it describes.`,
        { file: displayPath(join(authoredDir, entry)) },
      );
    }
  }

  return report({ args, metadataDir, diagnostics, contracts, empty: false, tokensChecked: tokenPaths !== null });
}

function report({ args, metadataDir, diagnostics, contracts, empty, tokensChecked }) {
  const payload = {
    check: 'contracts',
    ok: diagnostics.ok,
    metadata: displayPath(metadataDir),
    empty,
    tokensChecked: Boolean(tokensChecked),
    contracts,
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return diagnostics.ok ? 0 : 1;
  }

  const out = [`Contract gate — ${displayPath(metadataDir)}`];

  if (empty) {
    out.push('');
    out.push('No component contracts found. Nothing to validate yet.');
    out.push('This passes because there is nothing to reject, not because anything was checked.');
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
  }

  const checked = contracts.filter((entry) => entry.checked);
  out.push(
    `${contracts.length} contract(s), ${checked.length} checked against source, `
    + `${checked.reduce((sum, entry) => sum + entry.props, 0)} prop(s) compared.`,
  );
  if (!tokensChecked) out.push('No token root was readable, so the token names in these contracts went unchecked.');

  for (const entry of checked) {
    out.push(`  ${entry.name} — ${entry.props} prop(s), ${entry.boundaries} boundary(ies), ${entry.keywords} keyword(s), ${entry.tokens} token(s)  [${entry.source}]`);
  }

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
      ? `Result: pass. ${checked.length} contract(s) agree with their components. ${diagnostics.warnings.length} warning(s).`
      : `Result: fail. ${diagnostics.errors.length} error(s), ${diagnostics.warnings.length} warning(s). Regenerate with ${GENERATOR} rather than editing a contract by hand.`,
  );

  if (!args.quiet || !diagnostics.ok) process.stdout.write(`${out.join('\n')}\n`);
  return diagnostics.ok ? 0 : 1;
}

function formatDiagnostic(entry) {
  const lines = [`  [${entry.code}] ${entry.message}`];
  const where = [];
  if (entry.component) where.push(`component: ${entry.component}`);
  if (entry.prop) where.push(`prop: ${entry.prop}`);
  if (entry.file) where.push(`file: ${entry.file}`);
  if (entry.line) where.push(`line: ${entry.line}`);
  if (where.length > 0) lines.push(`      ${where.join('  ')}`);
  return lines;
}

process.exitCode = main(process.argv.slice(2));
