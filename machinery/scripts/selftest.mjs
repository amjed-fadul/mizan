#!/usr/bin/env node
/**
 * selftest.mjs — proves the gates actually reject things.
 *
 * Runs check-schema, check-contrast and check-drift against the fixture sets
 * and asserts not only the exit codes but the specific defects that come back.
 * A gate that has never rejected anything is an untested claim, and a gate
 * asserted only on its exit code can pass for the wrong reason.
 *
 * Usage: node machinery/scripts/selftest.mjs [--verbose]
 * Exits 1 if any assertion fails.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { displayPath, parseArgs } from './lib/tokens.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(SCRIPTS_DIR, '__fixtures__');
const VALID = join(FIXTURES, 'valid');
const BROKEN = join(FIXTURES, 'broken');
const FIGMA_ALIGNED = join(FIXTURES, 'figma', 'aligned.json');
const FIGMA_DRIFTED = join(FIXTURES, 'figma', 'drifted.json');

const args = parseArgs(process.argv.slice(2), { flags: ['verbose'] });

const failures = [];
const passes = [];

function assert(condition, description, detail) {
  if (condition) {
    passes.push(description);
    if (args.verbose) process.stdout.write(`  ok    ${description}\n`);
  } else {
    failures.push({ description, detail });
    process.stdout.write(`  FAIL  ${description}\n`);
    if (detail) process.stdout.write(`        ${detail}\n`);
  }
}

function run(script, extraArgs) {
  const result = spawnSync(process.execPath, [join(SCRIPTS_DIR, script), '--json', ...extraArgs], {
    encoding: 'utf8',
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    payload = null;
  }
  return { status: result.status, payload, stdout: result.stdout, stderr: result.stderr };
}

function codes(list) {
  return new Set((list ?? []).map((entry) => entry.code));
}

/* ------------------------------------------------------------------ *
 * The valid fixture must pass, both gates.
 * ------------------------------------------------------------------ */

process.stdout.write('Fixture: valid — both gates must pass\n');

const validSchema = run('check-schema.mjs', ['--root', VALID]);
assert(validSchema.status === 0, 'valid fixture: schema gate exits 0',
  `exit ${validSchema.status}; errors: ${JSON.stringify(validSchema.payload?.errors ?? validSchema.stderr)}`);
assert((validSchema.payload?.errors ?? []).length === 0, 'valid fixture: schema gate reports no errors',
  JSON.stringify(validSchema.payload?.errors));
assert((validSchema.payload?.warnings ?? []).length === 0, 'valid fixture: schema gate reports no warnings either',
  JSON.stringify(validSchema.payload?.warnings));
assert(validSchema.payload?.combinations?.length === 4,
  'valid fixture: two dimensions of two modes give four combinations',
  JSON.stringify(validSchema.payload?.combinations));
assert(
  (validSchema.payload?.combinations ?? []).includes('density.comfortable + theme.dark'),
  'valid fixture: combinations are the cartesian product of the discovered dimensions',
  JSON.stringify(validSchema.payload?.combinations),
);

const validContrast = run('check-contrast.mjs', ['--root', VALID]);
assert(validContrast.status === 0, 'valid fixture: contrast gate exits 0',
  `exit ${validContrast.status}; ${JSON.stringify(validContrast.payload?.errors ?? validContrast.stderr)}`);
assert((validContrast.payload?.results ?? []).every((r) => r.status === 'pass' || r.status === 'report'),
  'valid fixture: every gated pair passes in every mode combination',
  JSON.stringify((validContrast.payload?.results ?? []).filter((r) => r.status !== 'pass' && r.status !== 'report')));
assert(validContrast.payload?.checks === 20,
  'valid fixture: five pairs times four combinations is twenty checks',
  `checks: ${validContrast.payload?.checks}`);

const exceptedResults = (validContrast.payload?.results ?? []).filter((r) => r.excepted);
assert(exceptedResults.length === 4,
  'valid fixture: the passing exception is still reported, in every combination',
  `excepted results: ${exceptedResults.length}`);
assert(exceptedResults.every((r) => typeof r.reason === 'string' && r.reason.length > 0),
  'valid fixture: every reported exception carries its reason');

const validHuman = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'check-contrast.mjs'), '--root', VALID], { encoding: 'utf8' });
assert(validHuman.stdout.includes('EXCEPTIONS IN EFFECT'),
  'valid fixture: human-readable output announces exceptions prominently even though the build passes');

/* The decorative context: reported, never gated, never a reason to fail. --- */

assert(validContrast.payload?.thresholds?.decorative === null,
  'decorative: the threshold table maps it to null, not to a low number — no bar rather than a soft one',
  JSON.stringify(validContrast.payload?.thresholds));

const decorative = (validContrast.payload?.results ?? []).filter((r) => r.context === 'decorative');
assert(decorative.length === 4,
  'decorative: the pair is still resolved in every mode combination, like any other',
  `decorative results: ${decorative.length}`);
assert(decorative.every((r) => r.status === 'report' && r.threshold === null && typeof r.ratio === 'number'),
  'decorative: every result carries a measured ratio and no threshold',
  JSON.stringify(decorative));

const decorativeLight = decorative.find((r) => r.modeLabel.includes('theme.light'));
assert(decorativeLight !== undefined && decorativeLight.ratio < 3.0,
  'decorative: the fixture pair sits below even the 3.0 non-text threshold in light',
  JSON.stringify(decorativeLight));
assert(validContrast.status === 0,
  'decorative: and the gate still exits 0 — a decorative pair cannot fail the build',
  `exit ${validContrast.status}`);

assert(validHuman.stdout.includes('REPORTED, NOT GATED')
  && validHuman.stdout.includes('border.subtle on surface.default')
  && validHuman.stdout.includes('no threshold applies'),
  'decorative: the passing run still prints the pair and its ratio — tracked, not hidden',
  validHuman.stdout);

/* ------------------------------------------------------------------ *
 * The broken fixture must fail, with the defects we planted.
 * ------------------------------------------------------------------ */

process.stdout.write('\nFixture: broken — both gates must fail, for the stated reasons\n');

const brokenSchema = run('check-schema.mjs', ['--root', BROKEN]);
assert(brokenSchema.status === 1, 'broken fixture: schema gate exits 1', `exit ${brokenSchema.status}`);

const schemaCodes = codes(brokenSchema.payload?.errors);
const expectedSchemaCodes = [
  ['missing-value', 'a token with no $value'],
  ['unresolvable-type', 'a token whose $type cannot be resolved'],
  ['alias-not-found', 'an alias pointing at a token that does not exist'],
  ['alias-cycle', 'an alias cycle'],
  ['semantic-literal', 'a semantic token stating a literal'],
  ['naming-pattern', 'a token path violating the naming pattern'],
  ['hex-mismatch', 'a colour whose hex disagrees with its components'],
  ['mode-overrides-unknown-path', 'a mode overriding a path absent from the base'],
  ['pair-token-missing', 'a declared pairing naming a token no file defines'],
];
for (const [code, description] of expectedSchemaCodes) {
  assert(schemaCodes.has(code), `broken fixture: schema gate reports ${code} — ${description}`,
    `codes seen: ${[...schemaCodes].join(', ')}`);
}

const schemaWarningCodes = codes(brokenSchema.payload?.warnings);
assert(schemaWarningCodes.has('unused-primitive'),
  'broken fixture: schema gate warns about a primitive nothing references',
  `warning codes seen: ${[...schemaWarningCodes].join(', ')}`);

const cycleError = (brokenSchema.payload?.errors ?? []).find((e) => e.code === 'alias-cycle');
assert(/loop\.(a|b)/.test(cycleError?.message ?? ''),
  'broken fixture: the cycle error names the tokens in the cycle',
  cycleError?.message);

const contrastBroken = run('check-contrast.mjs', ['--root', BROKEN]);
assert(contrastBroken.status === 1, 'broken fixture: contrast gate exits 1', `exit ${contrastBroken.status}`);

const results = contrastBroken.payload?.results ?? [];
const secondaryLight = results.find((r) => r.foreground === 'text.secondary' && r.modeLabel === 'light');
const secondaryDark = results.find((r) => r.foreground === 'text.secondary' && r.modeLabel === 'dark');

assert(secondaryLight?.status === 'pass',
  'broken fixture: text.secondary on surface.default passes in light',
  JSON.stringify(secondaryLight));
assert(secondaryDark?.status === 'fail',
  'broken fixture: the same pair fails in dark — the failure a base-only check would miss',
  JSON.stringify(secondaryDark));
assert(secondaryDark?.threshold === 4.5 && secondaryDark?.ratio < 4.5,
  'broken fixture: the dark failure is reported against the 4.5 text threshold',
  JSON.stringify(secondaryDark));

const brokenHuman = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'check-contrast.mjs'), '--root', BROKEN], { encoding: 'utf8' });
assert(
  brokenHuman.stdout.includes('text.secondary on surface.default')
  && brokenHuman.stdout.includes('mode: dark')
  && brokenHuman.stdout.includes('required 4.50:1'),
  'broken fixture: the failure line names the pair, the mode, the ratio and the threshold',
  brokenHuman.stdout,
);

/* ------------------------------------------------------------------ *
 * Rung 2: the drift detector, against the same valid token set.
 *
 * Rung 1 checks the source against itself. This checks the display against the
 * source, so both fixtures here are Figma snapshots of the *same* correct token
 * set: one that agrees with it, and one that has been hand-edited in each of the
 * ways the detector claims to catch. Every class is asserted by name, and the
 * flattened-alias case is asserted twice over — because its Figma value is
 * *correct*, and a detector that only compared values would call it aligned.
 * ------------------------------------------------------------------ */

process.stdout.write('\nFixture: figma/aligned — the display agrees with the source\n');

const aligned = run('check-drift.mjs', ['--root', VALID, '--snapshot', FIGMA_ALIGNED]);
assert(aligned.status === 0, 'aligned snapshot: drift gate exits 0',
  `exit ${aligned.status}; ${JSON.stringify(aligned.payload?.findings ?? aligned.stderr)}`);
assert((aligned.payload?.findings ?? []).length === 0, 'aligned snapshot: no drift at all',
  JSON.stringify(aligned.payload?.findings));
assert((aligned.payload?.errors ?? []).length === 0 && (aligned.payload?.warnings ?? []).length === 0,
  'aligned snapshot: no errors and no warnings either',
  JSON.stringify([aligned.payload?.errors, aligned.payload?.warnings]));
assert(aligned.payload?.counts?.aligned === 18 && aligned.payload?.counts?.checks === 72,
  'aligned snapshot: all eighteen tokens compared, in every mode combination',
  JSON.stringify(aligned.payload?.counts));
assert((aligned.payload?.tokens ?? []).every((token) => token.status === 'aligned'),
  'aligned snapshot: every row of the dashboard table says aligned',
  JSON.stringify((aligned.payload?.tokens ?? []).filter((t) => t.status !== 'aligned')));

// Mode mapping is discovered, not configured: the collection named after a
// dimension maps onto that dimension's modes, and a single-mode collection is
// taken as invariant rather than guessed at.
const collections = aligned.payload?.collections ?? [];
const themeCollection = collections.find((c) => c.mappedTo.includes('theme.light'));
assert(themeCollection !== undefined && themeCollection.mappedTo.includes('theme.dark'),
  'aligned snapshot: a Figma collection\'s modes are mapped onto the token set\'s mode ids',
  JSON.stringify(collections));
assert(collections.some((c) => c.modes.length === 1 && c.mappedTo[0] === null),
  'aligned snapshot: a single-mode collection maps to nothing and is compared as invariant',
  JSON.stringify(collections));

// The snapshots are the shape machinery/figma-plugin actually writes — one
// collection per mode dimension, one per invariant layer, whose single mode
// carries the plugin's SINGLE_MODE_NAME. Comparing against a projection the
// syncer does not produce would prove nothing about the real file.
assert(collections.filter((c) => c.modes.length === 1).every((c) => c.modes[0] === 'Default'),
  'aligned snapshot: an invariant collection\'s single mode is named as the sync plugin names it',
  JSON.stringify(collections.map((c) => c.modes)));

process.stdout.write('\nFixture: figma/drifted — one hand-edit of every kind\n');

const drifted = run('check-drift.mjs', ['--root', VALID, '--snapshot', FIGMA_DRIFTED]);
assert(drifted.status === 1, 'drifted snapshot: drift gate exits 1', `exit ${drifted.status}`);

const driftCodes = codes(drifted.payload?.findings);
const expectedDriftCodes = [
  ['missing-in-figma', 'a token the Figma file has no variable for'],
  ['orphan-in-figma', 'a variable no token declares'],
  ['value-mismatch', 'a variable holding a different value'],
  ['alias-flattened', 'a reference replaced by a raw value'],
  ['alias-unexpected', 'a reference invented where the source states a literal'],
  ['alias-target-mismatch', 'a reference pointing at the wrong primitive'],
  ['type-mismatch', 'a variable whose resolved type is not the token\'s'],
  ['description-drift', 'a description edited in the file'],
];
for (const [code, description] of expectedDriftCodes) {
  assert(driftCodes.has(code), `drifted snapshot: drift gate reports ${code} — ${description}`,
    `codes seen: ${[...driftCodes].join(', ')}`);
}

/* The flattened alias, asserted properly. ------------------------------- */

const flattened = (drifted.payload?.findings ?? []).find((f) => f.code === 'alias-flattened');
assert(flattened !== undefined && flattened.expected?.resolves === flattened.actual?.display,
  'alias-flattened: the flattened value is *correct* — a value-only comparison would call this aligned',
  JSON.stringify(flattened));
assert(flattened?.mode === 'dark' && !(flattened?.tokenModes ?? []).some((label) => label.includes('theme.light')),
  'alias-flattened: it is caught in the one Figma mode it was planted in, and not in the other',
  JSON.stringify(flattened));
assert((drifted.payload?.findings ?? []).filter((f) => f.token === 'text.primary').length === 1,
  'alias-flattened: the untouched mode of the same variable reports nothing',
  JSON.stringify((drifted.payload?.findings ?? []).filter((f) => f.token === 'text.primary')));

/* Everything else that has to be true of the report. -------------------- */

const targetMismatch = (drifted.payload?.findings ?? []).find((f) => f.code === 'alias-target-mismatch');
assert(/\{color\.neutral\.500\}/.test(targetMismatch?.expected?.display ?? '')
  && /\{color\.neutral\.600\}/.test(targetMismatch?.actual?.display ?? ''),
  'drifted snapshot: an alias mismatch names both targets, source side first',
  JSON.stringify(targetMismatch));

const valueMismatch = (drifted.payload?.findings ?? []).find((f) => f.code === 'value-mismatch');
assert(valueMismatch?.expected?.display === '#2e2e2e' && valueMismatch?.actual?.display === '#333333',
  'drifted snapshot: a value mismatch shows both values',
  JSON.stringify(valueMismatch));

assert((drifted.payload?.findings ?? []).every((f) => typeof f.remedy === 'string' && f.remedy.length > 0),
  'drifted snapshot: every finding carries a remedy');
assert((drifted.payload?.findings ?? []).every((f) => !/copy|import|pull/i.test(f.remedy)
  || /outward|delete/i.test(f.remedy)),
  'drifted snapshot: no remedy tells anybody to take a Figma value back into the source',
  JSON.stringify((drifted.payload?.findings ?? []).map((f) => f.remedy)));

const driftWarnings = codes(drifted.payload?.warnings);
assert(driftWarnings.has('figma-mode-unknown'),
  'drifted snapshot: a Figma mode the token source has never heard of is warned about, not silently compared',
  `warning codes seen: ${[...driftWarnings].join(', ')}`);

const driftedRows = drifted.payload?.tokens ?? [];
assert(driftedRows.some((row) => row.status === 'orphan')
  && driftedRows.some((row) => row.status === 'missing')
  && driftedRows.some((row) => row.status === 'drifted')
  && driftedRows.some((row) => row.status === 'aligned'),
  'drifted snapshot: the dashboard table carries all four statuses, aligned rows included',
  JSON.stringify([...new Set(driftedRows.map((row) => row.status))]));

const driftHuman = spawnSync(process.execPath,
  [join(SCRIPTS_DIR, 'check-drift.mjs'), '--root', VALID, '--snapshot', FIGMA_DRIFTED], { encoding: 'utf8' });
assert(driftHuman.stdout.includes('Figma is a display, never a source')
  && driftHuman.stdout.includes('runs outward'),
  'drifted snapshot: the human-readable output states the direction of the fix, not just the disagreement',
  driftHuman.stdout);

/* No snapshot and no credentials is a failure, not a quiet pass. -------- */

const noSource = run('check-drift.mjs', ['--root', VALID]);
assert(noSource.status === 1 && codes(noSource.payload?.errors).has('no-source'),
  'drift gate: with nothing to compare against it fails loudly rather than reporting zero drift',
  JSON.stringify(noSource.payload?.errors ?? noSource.stderr));

/* ------------------------------------------------------------------ *
 * The dashboard is generated from the gates, and only from the gates.
 * ------------------------------------------------------------------ */

process.stdout.write('\nDashboard: generated from the same JSON the gates emit\n');

const dashboardOut = join(tmpdir(), `health-selftest-${process.pid}.html`);
const dashboard = spawnSync(process.execPath, [
  join(SCRIPTS_DIR, 'health-dashboard.mjs'),
  '--root', VALID, '--snapshot', FIGMA_DRIFTED, '--out', dashboardOut, '--quiet',
], { encoding: 'utf8' });
assert(dashboard.status === 0, 'dashboard: generating a page succeeds even when the news is bad',
  `exit ${dashboard.status}; ${dashboard.stderr}`);

let page = '';
try { page = readFileSync(dashboardOut, 'utf8'); } catch { page = ''; }
assert(page.startsWith('<!doctype html>') && page.includes('</html>'), 'dashboard: writes a complete HTML document');
assert(!/<(script|link|img)[^>]+(src|href)=["']?(https?:)?\/\//i.test(page),
  'dashboard: self-contained — nothing is fetched from anywhere');
assert(page.includes('DRIFTED') && page.includes('never a source') && page.includes('no arrow back'),
  'dashboard: the verdict and the direction of the fix are both on the page');
for (const [code] of expectedDriftCodes) {
  const label = drifted.payload?.classes?.[code]?.label;
  assert(label !== undefined && page.includes(label),
    `dashboard: shows the ${code} finding`, `label: ${label}`);
}
assert(page.includes('#2e2e2e') && page.includes('#333333'),
  'dashboard: both sides of a value mismatch appear, side by side');
assert(/--mz-page: #0f0f0f/.test(page),
  'dashboard: its own palette is resolved from the token set it reports on, not hardcoded',
  (page.match(/--mz-page: #[0-9a-f]{6}/) ?? []).join());

const strict = spawnSync(process.execPath, [
  join(SCRIPTS_DIR, 'health-dashboard.mjs'),
  '--root', VALID, '--snapshot', FIGMA_DRIFTED, '--out', dashboardOut, '--quiet', '--strict',
], { encoding: 'utf8' });
assert(strict.status === 1, 'dashboard: --strict adopts the gates\' verdict for CI', `exit ${strict.status}`);

const alignedDashboard = spawnSync(process.execPath, [
  join(SCRIPTS_DIR, 'health-dashboard.mjs'),
  '--root', VALID, '--snapshot', FIGMA_ALIGNED, '--out', dashboardOut, '--quiet', '--strict',
], { encoding: 'utf8' });
assert(alignedDashboard.status === 0, 'dashboard: --strict passes when every gate passes',
  `exit ${alignedDashboard.status}; ${alignedDashboard.stdout}${alignedDashboard.stderr}`);
try { rmSync(dashboardOut, { force: true }); } catch { /* nothing to clean up */ }

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

process.stdout.write(`\nFixtures: ${displayPath(FIXTURES)}\n`);
if (failures.length === 0) {
  process.stdout.write(
    `Result: pass. ${passes.length} assertion(s). Rung 1 proven to accept the valid token set and reject the broken one; `
    + 'rung 2 proven to accept a Figma snapshot that agrees and to catch each way one can disagree.\n',
  );
  process.exitCode = 0;
} else {
  process.stdout.write(`Result: fail. ${failures.length} of ${passes.length + failures.length} assertion(s) failed.\n`);
  process.exitCode = 1;
}
