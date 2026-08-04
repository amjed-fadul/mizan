#!/usr/bin/env node
/**
 * gen-contract.mjs — writes a component's contract.
 *
 * Brand-agnostic: it is pointed at a component and discovers everything else.
 * It knows the shape of a contract, never the contents of one.
 *
 * **Written once, run per component.** A contract hand-authored for the fifth
 * component disagrees with the first one's in some small way nobody notices,
 * and the agents that read them inherit the disagreement. So the shape is
 * decided in one place — the schema — and produced in one place, here.
 *
 * ## The line
 *
 * Half of a contract is a fact about the component and half is a judgment about
 * it, and the two halves live apart so that neither can quietly become the
 * other.
 *
 * **Derived, from the component's source, and not writable by hand:** the
 * component's name, the props type it declares, what that type extends, and for
 * every prop its name, type, whether it is required, its default, its JSDoc
 * description, and the members of its union where it has one. Every one of
 * those is already stated in TypeScript. A contract that restated them would be
 * a second source for the same fact, and the second source is always the one
 * that is out of date.
 *
 * Also derived, from the stylesheet beside the component: which tokens it
 * consumes. The stylesheet already states that, in the only way that cannot be
 * out of date — by referencing them.
 *
 * **Authored, in `metadata/authored/<component>.json`, and never overwritten by
 * this script:** purpose, responsibilities, do and don't, `do_not_use_when` and
 * `alternatives`, what content designers control, what nobody may customise,
 * RTL behaviour, accessibility guarantees, `aiHints`, the deprecation policy,
 * the Figma component name, per-prop guidance, and the reason for any token the
 * component asked for and the system has not decided. None of those is in the
 * source, none is derivable from it, and a generator that invented them would
 * be inventing the judgment the contract exists to carry.
 *
 * The two meet in exactly one place and the meeting is structural: a prop's
 * Figma property is *named* by a person and the mapping is *assembled* here, so
 * a prop cannot stop having a Figma side by nobody mentioning it. A prop that
 * mirrors nothing has to say so under `figma.unmapped` or generation fails.
 *
 * ## What holds the line
 *
 * `check-contracts.mjs` regenerates every contract and compares. The authored
 * half cannot drift because it is copied through unread; the derived half
 * cannot drift because the check re-derives it. The contract itself is build
 * output — editing it is editing a display, and the next run overwrites it.
 *
 * Usage:
 *   node machinery/scripts/gen-contract.mjs --source <file> [--props-type <name>]
 *   node machinery/scripts/gen-contract.mjs --all
 *
 *   --source <file>     component source to read the API from.
 *   --all               regenerate every contract in the metadata directory,
 *                       each from the source it records.
 *   --props-type <name> which props type, when the file exports more than one.
 *   --metadata <dir>    where contracts live. Defaults to machinery/metadata.
 *   --authored <file>   the authored half. Defaults to
 *                       <metadata>/authored/<component>.json.
 *   --schema <file>     the contract schema. Defaults to the one in <metadata>.
 *   --root <dir>        token root, for reading the component's stylesheet.
 *                       Defaults to $TOKENS_ROOT, then to content/tokens.
 *   --css-prefix <str>  the prefix the CSS build publishes token names under.
 *                       Defaults to none, as the build's own does.
 *   --out <file>        where to write. Defaults to <metadata>/<component>.json.
 *   --stdout            write to stdout instead of to a file.
 *   --json              machine-readable output.
 *   --quiet             suppress the summary; failures still print.
 *
 * Exits 1 if a contract could not be generated. It writes nothing in that case:
 * a contract half-derived from a source this reader could not follow would look
 * exactly like one derived from all of it.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Diagnostics, defaultTokensRoot, displayPath, isEmptyTokenSet, loadTokenSet, parseArgs, repoRoot } from './lib/tokens.mjs';
import { readComponentApi } from './lib/component-source.mjs';
import {
  AUTHORED_DIR,
  SCHEMA_FILE,
  buildContract,
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
 * Generate one contract, without writing it.
 *
 * Returns `{ ok, contract, errors }`. Every failure is a list of errors rather
 * than a throw, because a run over several components should report all of them
 * and not stop at the first.
 */
export function generate({ sourceFile, authoredFile, metadataDir, propsType, schema, tokenPaths, cssPrefix }) {
  const errors = [];
  const sourceRef = displayPath(sourceFile);

  if (!existsSync(sourceFile)) {
    return { ok: false, contract: null, errors: [{ code: 'component-source-missing', message: `No such file: ${sourceRef}.`, file: sourceRef }] };
  }
  const read = readComponentApi(readFileSync(sourceFile, 'utf8'), { file: sourceRef, propsType });
  if (!read.ok) {
    return {
      ok: false,
      contract: null,
      errors: read.errors.map((error) => ({ ...error, file: sourceRef })),
    };
  }

  const authoredPath = authoredFile ?? join(metadataDir, AUTHORED_DIR, `${fileNameFor(read.api.component)}.json`);
  const authoredRef = displayPath(authoredPath);
  if (!existsSync(authoredPath)) {
    return {
      ok: false,
      contract: null,
      errors: [{
        code: 'authored-missing',
        message: `No authored half at ${authoredRef}. The judgment in a contract — what it is for, when not to reach for it, what it refuses to do — is not derivable from the source and this script will not invent it.`,
        file: authoredRef,
      }],
    };
  }

  let authored;
  try {
    authored = JSON.parse(readFileSync(authoredPath, 'utf8'));
  } catch (error) {
    return { ok: false, contract: null, errors: [{ code: 'authored-invalid-json', message: error.message, file: authoredRef }] };
  }

  const cssFile = stylesheetBeside(sourceFile);
  const stylesheet = cssFile ? readStylesheet(readFileSync(cssFile, 'utf8'), tokenPaths, cssPrefix) : null;

  const outFile = join(metadataDir, `${fileNameFor(read.api.component)}.json`);
  const { contract, problems } = buildContract({
    api: read.api,
    authored,
    schema,
    source: sourceRef,
    schemaRef: `./${SCHEMA_FILE}`,
    generator: GENERATOR,
    authoredRef,
    stylesheet,
    stylesheetRef: cssFile ? displayPath(cssFile) : null,
  });

  for (const problem of problems) {
    errors.push({ code: 'authored-invalid', message: `${problem.path}: ${problem.message}`, file: authoredRef });
  }

  for (const problem of validate(contract, schema)) {
    errors.push({ code: 'contract-invalid', message: `${problem.path}: ${problem.message}`, file: displayPath(outFile) });
  }

  if (errors.length > 0) return { ok: false, contract: null, errors };
  return { ok: true, contract, errors: [], outFile, authoredPath };
}

export function serialise(contract) {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

/* ------------------------------------------------------------------ */

function main(argv) {
  const args = parseArgs(argv, {
    flags: ['all', 'stdout', 'json', 'quiet', 'help'],
    values: ['source', 'authored', 'out', 'metadata', 'props-type', 'root', 'css-prefix', 'schema'],
  });
  if (args.help) {
    process.stdout.write('Usage: gen-contract.mjs --source <file> [--props-type <name>] [--metadata <dir>] [--out <file>] [--stdout]\n       gen-contract.mjs --all\n');
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`gen-contract: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }
  if (!args.source && !args.all) {
    process.stderr.write('gen-contract: --source <file> or --all is required.\n');
    return 2;
  }

  const metadataDir = args.metadata ? resolve(args.metadata) : DEFAULT_METADATA;
  const schemaFile = args.schema ? resolve(args.schema) : join(metadataDir, SCHEMA_FILE);
  if (!existsSync(schemaFile)) {
    process.stderr.write(`gen-contract: no schema at ${displayPath(schemaFile)}.\n`);
    return 2;
  }
  const schema = loadSchema(schemaFile);
  const unsupported = unsupportedKeywords(schema);
  if (unsupported.length > 0) {
    process.stderr.write(`gen-contract: the schema uses keyword(s) this repository's validator does not implement: ${unsupported.join(', ')}. An unenforced constraint that looks enforced is worse than no constraint.\n`);
    return 2;
  }

  // The token set, for reading the component's stylesheet. A contract records
  // which tokens the component consumes, and that answer is a fact about two
  // files at once — the stylesheet's references and the set that defines them —
  // so neither is optional. Generating without a token set would produce a
  // contract whose token list means "nobody looked".
  const tokenRoot = args.root ? resolve(args.root) : defaultTokensRoot();
  const tokenSet = existsSync(tokenRoot) ? loadTokenSet(tokenRoot, new Diagnostics()) : null;
  if (!tokenSet || isEmptyTokenSet(tokenSet)) {
    process.stderr.write(`gen-contract: no token set at ${displayPath(tokenRoot)}. Pass --root.\n`);
    return 2;
  }
  const tokenPaths = [...tokenSet.base.keys()];

  const jobs = [];
  if (args.source) {
    jobs.push({ sourceFile: resolve(args.source), authoredFile: args.authored ? resolve(args.authored) : null, out: args.out ? resolve(args.out) : null });
  } else {
    for (const file of contractFiles(metadataDir)) {
      let existing;
      try {
        existing = JSON.parse(readFileSync(file, 'utf8'));
      } catch (error) {
        process.stderr.write(`gen-contract: ${displayPath(file)} is not readable JSON: ${error.message}\n`);
        return 1;
      }
      jobs.push({ sourceFile: join(repoRoot(), existing.source), authoredFile: null, out: file });
    }
    if (jobs.length === 0) {
      if (!args.quiet) process.stdout.write(`No contracts in ${displayPath(metadataDir)}. Nothing to regenerate.\n`);
      return 0;
    }
  }

  const results = [];
  let failed = false;

  for (const job of jobs) {
    const result = generate({
      sourceFile: job.sourceFile,
      authoredFile: job.authoredFile,
      metadataDir,
      propsType: args['props-type'],
      schema,
      tokenPaths,
      cssPrefix: args['css-prefix'] ?? '',
    });
    if (!result.ok) {
      failed = true;
      results.push({ source: displayPath(job.sourceFile), written: null, errors: result.errors });
      continue;
    }
    const target = job.out ?? result.outFile;
    const text = serialise(result.contract);
    if (args.stdout) {
      process.stdout.write(text);
      results.push({ source: displayPath(job.sourceFile), written: '(stdout)', errors: [] });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    const unchanged = existsSync(target) && readFileSync(target, 'utf8') === text;
    writeFileSync(target, text);
    results.push({
      source: displayPath(job.sourceFile),
      written: displayPath(target),
      unchanged,
      props: result.contract.props.length,
      errors: [],
    });
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ tool: 'gen-contract', ok: !failed, results }, null, 2)}\n`);
    return failed ? 1 : 0;
  }

  const out = [];
  for (const result of results) {
    if (result.errors.length > 0) {
      out.push(`FAILED — ${result.source}`);
      for (const error of result.errors) {
        out.push(`  [${error.code}] ${error.message}`);
        if (error.line) out.push(`      line ${error.line}`);
      }
      continue;
    }
    out.push(`${result.unchanged ? 'unchanged' : 'wrote'}  ${result.written}${result.props ? ` — ${result.props} prop(s)` : ''}`);
  }
  if (failed) out.push('', 'Nothing was written for the failures above. A contract derived from half a props declaration looks exactly like one derived from all of it.');

  if (!args.quiet || failed) process.stdout.write(`${out.join('\n')}\n`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}

export { main };
export const METADATA_DIR = DEFAULT_METADATA;
