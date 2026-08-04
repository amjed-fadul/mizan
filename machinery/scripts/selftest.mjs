#!/usr/bin/env node
/**
 * selftest.mjs — proves the gates actually reject things.
 *
 * Runs check-schema, check-contrast and check-drift against the fixture sets
 * and asserts not only the exit codes but the specific defects that come back.
 * A gate that has never rejected anything is an untested claim, and a gate
 * asserted only on its exit code can pass for the wrong reason.
 *
 * It also holds one piece of structure in place that no fixture can: the sync
 * plugin and the drift detector must narrow a font stack identically, because
 * that projection is lossy and a disagreement would produce drift no sync could
 * ever clear. The rule is one shared function; these assertions are what keep it
 * one.
 *
 * And it holds the read bridge to the claim decision 016 made for it. The bridge
 * is read-only *by construction* — its vocabulary has no word for writing — and
 * its port is a constant in four files because a Figma manifest cannot take a
 * variable. Neither of those is self-enforcing, so both are asserted here: the
 * manifest, the plugin's vocabulary and the relay that carries it are read as
 * text, and then a stand-in plugin completes a real round trip over a real
 * socket.
 *
 * A working socket is not the same claim as a working bridge, so the last
 * section drives `check-drift.mjs --bridge` end to end against a stand-in
 * plugin holding a real token root: the happy path, drift arriving over the
 * wire unrounded, a live read saved as an offline fixture, and each of the
 * three ways the far end can fail — none of which may be reported as drift.
 *
 * Usage: node machinery/scripts/selftest.mjs [--verbose]
 * Exits 1 if any assertion fails.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { defaultTokensRoot, displayPath, parseArgs } from './lib/tokens.mjs';
import { narrowFontStack } from './lib/projection.mjs';
import {
  BRIDGE_PORT,
  BRIDGE_PROTOCOL,
  BRIDGE_SENDS,
  BRIDGE_TIMEOUT_MS,
  readSnapshotOverBridge,
} from './lib/bridge.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const MACHINERY_DIR = dirname(SCRIPTS_DIR);
const PLUGIN_DIR = join(MACHINERY_DIR, 'figma-plugin');
const FIXTURES = join(SCRIPTS_DIR, '__fixtures__');
const VALID = join(FIXTURES, 'valid');
const BROKEN = join(FIXTURES, 'broken');
const FIGMA_ALIGNED = join(FIXTURES, 'figma', 'aligned.json');
const FIGMA_DRIFTED = join(FIXTURES, 'figma', 'drifted.json');
const PAIRS_MODE_SCOPES = join(FIXTURES, 'pairs', 'mode-scopes.json');
const PAIRS_UNKNOWN_MODE = join(FIXTURES, 'pairs', 'unknown-mode.json');
const FIGMA_MODE_DELETED = join(FIXTURES, 'figma', 'mode-deleted.json');
const FIGMA_DIMENSION_FLATTENED = join(FIXTURES, 'figma', 'dimension-flattened.json');

const args = parseArgs(process.argv.slice(2), { flags: ['verbose'] });

const failures = [];
const passes = [];

/**
 * Sections that could not run, and the claim each of them would have proved.
 *
 * Two sections need the plugin core built, which needs esbuild installed. When
 * it is absent they print a note and are stepped over — and that was fine until
 * the summary at the bottom went on claiming, unconditionally, that the read
 * bridge is "proven to do its job end to end". A run with 140 assertions and a
 * skipped bridge exited 0 and said the same sentence as a run with 164 and a
 * real socket. The notes admitting it were four lines above and easy to miss.
 *
 * So a skip is recorded rather than only printed, and the summary is assembled
 * from what actually ran. A gate that overstates its own coverage is worse than
 * one that fails: a failure is read, and an inflated pass is filed.
 */
const skipped = [];

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

/** Is a package installed for a given directory? Nothing here requires one. */
function canResolve(specifier, fromDir) {
  try {
    createRequire(join(fromDir, 'package.json')).resolve(specifier);
    return true;
  } catch {
    return false;
  }
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
 * A pair's mode scope, which could switch the pair off.
 *
 * `"modes"` narrows a pairing to part of the combination space. It used to be a
 * plain conjunction — a combination had to contain every listed mode — and a
 * combination holds exactly one mode per dimension, so
 * `["theme.light", "theme.dark"]` matched nothing whatsoever. The most natural
 * way to write "check this in both themes" was the one way to switch the check
 * off, and the gate reported a smaller number of checks and passed. So did a
 * misspelt mode id.
 *
 * The rule is now per dimension: or within one, and across them. The assertions
 * below are counts rather than exit codes on purpose — every pairing in the
 * scope fixture passes, so an exit code proves nothing at all about which
 * combinations were looked at, which is the entire subject.
 * ------------------------------------------------------------------ */

process.stdout.write('\nPair scopes: a "modes" list narrows a pairing, and may never silence one\n');

const scopes = run('check-contrast.mjs', ['--root', VALID, '--pairs', PAIRS_MODE_SCOPES]);
const checkedIn = (foreground) => (scopes.payload?.results ?? []).filter((r) => r.foreground === foreground).length;

assert(scopes.status === 0 && scopes.payload?.checks === 11,
  'pair scopes: four differently scoped pairings are checked in 4 + 2 + 1 + 4 combinations',
  `exit ${scopes.status}; ${scopes.payload?.checks} check(s); ${JSON.stringify(scopes.payload?.errors)}`);

assert(checkedIn('text.primary') === 4,
  'pair scopes: both modes of one dimension means both — the declaration that used to match nothing now matches everything it names',
  `checked in ${checkedIn('text.primary')} combination(s)`);
assert(checkedIn('text.secondary') === 2,
  'pair scopes: one mode of one dimension still means that mode, in every combination containing it',
  `checked in ${checkedIn('text.secondary')} combination(s)`);
assert(checkedIn('text.on-action') === 1,
  'pair scopes: one mode of each of two dimensions is still an and — narrowing across dimensions was not traded away for the other reading',
  `checked in ${checkedIn('text.on-action')} combination(s)`);
assert(checkedIn('border.default') === 4,
  'pair scopes: and no list at all is still every combination',
  `checked in ${checkedIn('border.default')} combination(s)`);

const unknownMode = run('check-contrast.mjs', ['--root', VALID, '--pairs', PAIRS_UNKNOWN_MODE]);
const unknownCodes = codes(unknownMode.payload?.errors);
assert(unknownMode.status === 1 && unknownCodes.has('pair-mode-unknown'),
  'pair scopes: a mode id the token set does not define is an error on the declaration, not a filter that quietly excludes everything',
  `exit ${unknownMode.status}; ${[...unknownCodes].join(', ') || '(no errors)'}`);
assert(unknownCodes.has('exception-mode-unknown'),
  'pair scopes: and the same on an exception — a waiver that has silently stopped applying is still a decision that left without saying so',
  `codes seen: ${[...unknownCodes].join(', ') || '(none)'}`);
assert((unknownMode.payload?.results ?? []).length === 4,
  'pair scopes: while the sound pair in the same file is still checked in all four combinations — one bad id does not take the run with it',
  JSON.stringify((unknownMode.payload?.results ?? []).map((r) => r.modeLabel)));

/* The backstop, which holds however the scope rules are written. `--mode` is a
 * narrowing of the run rather than of the declaration, so it is the one way left
 * to ask this gate to pass having checked a declared pairing nowhere. */
const narrowed = run('check-contrast.mjs', [
  '--root', VALID, '--pairs', PAIRS_MODE_SCOPES, '--mode', 'density.comfortable', '--mode', 'theme.light',
]);
const neverEvaluated = (narrowed.payload?.errors ?? []).filter((e) => e.code === 'pair-never-evaluated');
assert(narrowed.status === 1 && neverEvaluated.length === 2,
  'pair scopes: a declared pairing evaluated in no combination fails the run — a pairing nobody looked at is not a pairing that passed',
  `exit ${narrowed.status}; ${JSON.stringify((narrowed.payload?.errors ?? []).map((e) => e.code))}`);
assert(neverEvaluated.every((error) => /restricts itself to/.test(error.message) && /--mode/.test(error.message)),
  'pair scopes: and the error names both ways it can happen, because from inside the run they look identical',
  JSON.stringify(neverEvaluated.map((e) => e.message)));

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
assert(aligned.payload?.counts?.aligned === 20 && aligned.payload?.counts?.checks === 80,
  'aligned snapshot: all twenty tokens compared, in every mode combination',
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

const valueMismatch = (drifted.payload?.findings ?? [])
  .find((f) => f.code === 'value-mismatch' && f.token === 'color.neutral.900');
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

/* ------------------------------------------------------------------ *
 * The drift a deletion causes, which is drift nobody sees.
 *
 * Every class above announces itself: something in the file disagrees with
 * something in the source, and the detector has both halves in front of it. A
 * *deleted mode* is the opposite shape. There is no wrong value to find, because
 * there is no value at all — the comparison for that mode simply stops being
 * run, and a gate that counts what it compared rather than what it should have
 * compared reports a pass with a smaller number in it.
 *
 * So both directions are fixtures now. `drifted.json` carries a mode Figma has
 * and the source does not, which was always warned about. `mode-deleted.json`
 * carries the reverse, which was silent.
 *
 * And `dimension-flattened.json` holds the line between them, because an
 * unclaimed mode is not always a gap: a collection with one mode is invariant
 * *by design*, and a dimension no collection models is a dimension every value
 * is compared against in full. That fixture must produce a value finding and no
 * mode finding — the difference between a comparison that ran and disagreed and
 * one that never ran.
 * ------------------------------------------------------------------ */

process.stdout.write('\nFixture: figma/mode-deleted — a mode the source has and the file no longer does\n');

const modeDeleted = run('check-drift.mjs', ['--root', VALID, '--snapshot', FIGMA_MODE_DELETED]);
assert(modeDeleted.status === 1, 'mode deleted: the drift gate exits 1',
  `exit ${modeDeleted.status}; ${JSON.stringify(modeDeleted.payload?.findings ?? modeDeleted.stderr)}`);

const modeFindings = (modeDeleted.payload?.findings ?? []).filter((f) => f.code === 'mode-missing-in-figma');
assert(modeFindings.length === 1,
  'mode deleted: exactly one mode-missing-in-figma finding — one deleted mode, one finding, not one per token that lived in it',
  JSON.stringify((modeDeleted.payload?.findings ?? []).map((f) => f.code)));
assert(modeFindings[0]?.tokenMode === 'theme.dark',
  'mode deleted: and it names the source mode that has nowhere left to be compared',
  JSON.stringify(modeFindings[0]));

/* The whole point of the fixture: nothing else in it is wrong. Every value that
 * survived still agrees with the source, so an assertion on the exit code alone
 * would have passed for a reason that has nothing to do with the deletion. */
assert((modeDeleted.payload?.findings ?? []).length === 1,
  'mode deleted: and it is the *only* finding — every value still in the file agrees, so the deletion is the entire defect',
  JSON.stringify((modeDeleted.payload?.findings ?? []).map((f) => `${f.code} ${f.token ?? ''}`)));

/* The symptom the old gate left behind, asserted so it stays evidence: the run
 * did fewer comparisons than the aligned snapshot of the same source, and that
 * difference used to be the only trace in a passing report. */
assert(modeDeleted.payload?.counts?.checks < (aligned.payload?.counts?.checks ?? 0),
  'mode deleted: the run compares less than the aligned snapshot of the same source — the number that used to be the only trace',
  `${modeDeleted.payload?.counts?.checks} comparison(s) against ${aligned.payload?.counts?.checks}`);
assert(modeDeleted.payload?.counts?.modesMissing === 1 && modeDeleted.payload?.counts?.drifted === 0,
  'mode deleted: counted as a missing mode and not as a drifted token — the two are different units and the summary says so',
  JSON.stringify(modeDeleted.payload?.counts));

const modeRemedy = modeFindings[0]?.remedy ?? '';
assert(/outward/.test(modeRemedy) && !/copy|import|pull/i.test(modeRemedy),
  'mode deleted: the new class carries the same outward remedy as the other eight — nothing here recovers a mode from the file',
  modeRemedy);

process.stdout.write('\nFixture: figma/dimension-flattened — an invariant collection is not a missing mode\n');

const dimensionFlattened = run('check-drift.mjs', ['--root', VALID, '--snapshot', FIGMA_DIMENSION_FLATTENED]);
assert(!codes(dimensionFlattened.payload?.findings).has('mode-missing-in-figma'),
  'dimension flattened: a dimension no collection models reports no missing mode — a single-mode collection is invariant by design, not incomplete',
  JSON.stringify((dimensionFlattened.payload?.findings ?? []).map((f) => f.code)));

const flattenedFinding = (dimensionFlattened.payload?.findings ?? [])
  .find((f) => f.code === 'alias-target-mismatch' && f.token === 'spacing.inset');
assert(dimensionFlattened.status === 1 && flattenedFinding !== undefined,
  'dimension flattened: the one value now speaking for every combination is compared against every combination, and the disagreement is reported',
  JSON.stringify((dimensionFlattened.payload?.findings ?? []).map((f) => `${f.code} ${f.token ?? ''}`)));
assert((flattenedFinding?.tokenModes ?? []).length === 2
  && (flattenedFinding?.tokenModes ?? []).every((label) => label.includes('density.compact')),
  'dimension flattened: reported against exactly the combinations where the source disagrees, and not the ones where it does not',
  JSON.stringify(flattenedFinding?.tokenModes));

/* ------------------------------------------------------------------ *
 * The lossy rule: one narrowing, imported by both ends of the sync.
 *
 * A DTCG font stack becomes one Figma string, and the projection throws the
 * fallbacks away. Two tools that mirrored that rule by hand and then drifted
 * apart would produce the worst possible failure: the detector reports drift,
 * the sync runs, the file is rewritten, and the same finding comes back — a gate
 * nobody can ever clear, whose only remedy is to stop running it. So the rule is
 * one function in lib/projection.mjs, and these assertions are what keep it one.
 * ------------------------------------------------------------------ */

process.stdout.write('\nProjection: the font-stack narrowing is shared code, not a shared comment\n');

const SOURCE_STACK = ['Fixture Sans', 'Fixture Fallback', 'sans-serif'];

assert(narrowFontStack(SOURCE_STACK)?.family === 'Fixture Sans'
  && narrowFontStack(SOURCE_STACK)?.fallbacks.join() === 'Fixture Fallback,sans-serif',
  'projection: a stack narrows to its first family, and the lost fallbacks are named rather than dropped',
  JSON.stringify(narrowFontStack(SOURCE_STACK)));

// The aligned fixture holds what the sync plugin writes. If check-drift.mjs ever
// narrowed differently, this fixture would stop being aligned — which is why the
// zero-drift assertion above is itself a test of the shared rule.
const alignedStack = JSON.parse(readFileSync(FIGMA_ALIGNED, 'utf8'))
  .meta.variables['VariableID:1:11'].valuesByMode['1:0'];
assert(alignedStack === narrowFontStack(SOURCE_STACK)?.family,
  'projection: the aligned fixture stores exactly what the shared narrowing produces',
  `fixture holds ${JSON.stringify(alignedStack)}`);

const stackDrift = (drifted.payload?.findings ?? [])
  .find((f) => f.code === 'value-mismatch' && f.token === 'font-family.sans');
assert(stackDrift?.expected?.display === 'Fixture Sans'
  && stackDrift?.actual?.display === 'Fixture Sans, Fixture Fallback, sans-serif',
  'projection: a whole CSS stack pasted into the variable is caught, and the source side is the first family',
  JSON.stringify(stackDrift));

/* One definition, two importers — asserted on the source, so re-inlining the
 * rule in either file fails here rather than in Figma six months later. */

const mapSource = readFileSync(join(PLUGIN_DIR, 'src', 'core', 'map.ts'), 'utf8');
const driftSource = readFileSync(join(SCRIPTS_DIR, 'check-drift.mjs'), 'utf8');
assert(/import \{ narrowFontStack \} from '\.\.\/\.\.\/\.\.\/scripts\/lib\/projection\.mjs'/.test(mapSource),
  'projection: the sync plugin imports the narrowing rather than owning a copy of it');
assert(/import \{ narrowFontStack \} from '\.\/lib\/projection\.mjs'/.test(driftSource),
  'projection: the drift detector imports the same function from the same file');

// Assembled from parts so this file is not itself a match, and `code.js` is not
// excluded by name: the bundler drops the `export` keyword, so a generated copy
// of the rule cannot be mistaken for a second authored one.
const DEFINITION = ['export', 'function', 'narrowFontStack'].join(' ');
const definitions = spawnSync('grep', [
  '-rl', '--include=*.mjs', '--include=*.ts', '--include=*.js',
  '--exclude-dir=node_modules', '--exclude-dir=dist',
  DEFINITION, MACHINERY_DIR,
], { encoding: 'utf8' });
const definingFiles = definitions.stdout.split('\n').filter(Boolean);
assert(definingFiles.length === 1 && definingFiles[0].endsWith(join('lib', 'projection.mjs')),
  'projection: exactly one file under machinery/ defines the narrowing',
  definingFiles.join(', ') || '(none found)');

/* And the plugin's own build, run against the same input, must land on the same
 * answer. This is the only assertion here that needs a build step, so it is the
 * only one allowed not to run — and it says so out loud when it cannot. */

const CORE = join(PLUGIN_DIR, 'dist', 'core.mjs');
if (!existsSync(CORE) && canResolve('esbuild', PLUGIN_DIR)) {
  spawnSync(process.execPath, [join(PLUGIN_DIR, 'build.mjs'), '--quiet'], { cwd: PLUGIN_DIR, encoding: 'utf8' });
}
if (existsSync(CORE)) {
  const { mapValue } = await import(pathToFileURL(CORE).href);
  const mapped = mapValue(SOURCE_STACK, 'fontFamily');
  assert(mapped.ok === true && mapped.value?.value === narrowFontStack(SOURCE_STACK)?.family,
    'projection: the built plugin core writes the same family the detector expects',
    JSON.stringify(mapped));
  assert(mapped.note === narrowFontStack(SOURCE_STACK)?.note,
    'projection: and reports the loss in the same words, because the wording is shared too',
    `${mapped.note}\n        ${narrowFontStack(SOURCE_STACK)?.note}`);
} else {
  process.stdout.write(
    '  note  the plugin core is not built and esbuild is not installed, so the round-trip\n'
    + '        against machinery/figma-plugin was not run. The import assertions above still\n'
    + '        hold: there is one definition of the rule and both files import it.\n',
  );
  skipped.push('the lossy projection agreeing across both ends at run time');
}

/* No snapshot and no credentials is a failure, not a quiet pass. -------- */

const noSource = run('check-drift.mjs', ['--root', VALID]);
assert(noSource.status === 1 && codes(noSource.payload?.errors).has('no-source'),
  'drift gate: with nothing to compare against it fails loudly rather than reporting zero drift',
  JSON.stringify(noSource.payload?.errors ?? noSource.stderr));

/* ------------------------------------------------------------------ *
 * The read bridge: one port in four files, and no word for writing.
 *
 * Decision 016 refused a general Figma-over-MCP dependency and built this
 * instead, and the entire argument rests on one claim: the bridge is read-only
 * *by construction*, because the vocabulary has no word for writing. A claim of
 * that shape is worth exactly as much as the check behind it. `src/core/
 * bridge.ts` already tells its reader that this file reads and asserts its
 * message list; below is what makes that sentence true.
 *
 * The port is the other half, and a duller problem. A Figma manifest cannot take
 * a variable, so 8791 is written out in four places — the two loopback entries
 * in `manifest.json`, the plugin's `BRIDGE_PORT`, the port in `ui.html`, and the
 * detector's default. Four hand-kept copies of a number agree right up until the
 * day one of them does not, and the failure is a plugin that retries forever
 * against a door nobody opened. Nothing but this section keeps them equal.
 * ------------------------------------------------------------------ */

process.stdout.write('\nRead bridge: one port, four files\n');

const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
const bridgeSource = readFileSync(join(PLUGIN_DIR, 'src', 'core', 'bridge.ts'), 'utf8');
const uiSource = readFileSync(join(PLUGIN_DIR, 'ui.html'), 'utf8');

/** A development domain may only be a ws:// port on this machine. */
const LOOPBACK_WS = /^ws:\/\/(?:localhost|127\.0\.0\.1):(\d+)$/;

/* The manifest is read first and the other three are asserted against it, rather
 * than all four against a number written here. A test stating the port itself
 * would have to be edited alongside the files it checks, and would then agree
 * with whatever it was last told — which is the failure it exists to catch. */
const devDomains = manifest.networkAccess?.devAllowedDomains ?? [];
const manifestPorts = devDomains.map((entry) => LOOPBACK_WS.exec(String(entry))?.[1]);
assert(manifestPorts.length > 0 && manifestPorts.every((port) => port !== undefined && port === manifestPorts[0]),
  'bridge port: every development domain the manifest permits names the same port',
  JSON.stringify(devDomains));

/* Figma's validator refuses `ws://127.0.0.1:8791` as "not a valid URL" — it
 * wants a hostname, whatever the URL specification says about IP literals. The
 * manifest therefore permits the `localhost` spelling only, and `ui.html` has
 * to dial the string the manifest permits rather than the address the server
 * binds. Asserted because the two are easy to drift apart and the symptom is a
 * plugin that will not load at all, discovered at the moment somebody tries to
 * use it. */
assert(devDomains.every((entry) => /^ws:\/\/localhost:\d+$/.test(String(entry))),
  'manifest: development domains are spelled with the host name Figma will accept, not an IP literal',
  JSON.stringify(devDomains));

const uiHost = /var BRIDGE_HOST = '([^']+)';/.exec(uiSource)?.[1];
assert(devDomains.some((entry) => String(entry) === `ws://${uiHost}:${manifestPorts[0]}`),
  'bridge host: ui.html dials exactly a URL the manifest permits — anything else is refused before the socket opens',
  `ui.html dials ws://${uiHost}:${manifestPorts[0]}, manifest permits ${JSON.stringify(devDomains)}`);

const manifestPort = Number(manifestPorts[0]);
const pluginPort = /export const BRIDGE_PORT = (\d+);/.exec(bridgeSource)?.[1];
const uiPort = /var BRIDGE_PORT = (\d+);/.exec(uiSource)?.[1];

assert(Number(pluginPort) === manifestPort,
  'bridge port: the plugin core names the port the manifest permits',
  `bridge.ts says ${pluginPort}, manifest.json says ${manifestPort}`);
assert(Number(uiPort) === manifestPort,
  'bridge port: so does ui.html, which is the file that actually opens the socket',
  `ui.html says ${uiPort}, manifest.json says ${manifestPort}`);
assert(BRIDGE_PORT === manifestPort,
  'bridge port: and so does the detector\'s default, which is the end that listens',
  `lib/bridge.mjs says ${BRIDGE_PORT}, manifest.json says ${manifestPort}`);

const pluginProtocol = /export const BRIDGE_PROTOCOL = '([^']+)';/.exec(bridgeSource)?.[1];
const uiProtocol = /var BRIDGE_PROTOCOL = '([^']+)';/.exec(uiSource)?.[1];
assert(pluginProtocol === BRIDGE_PROTOCOL,
  'bridge protocol: the plugin core and the detector name the same version of the envelope',
  `bridge.ts says ${JSON.stringify(pluginProtocol)}, lib/bridge.mjs says ${JSON.stringify(BRIDGE_PROTOCOL)}`);
assert(uiProtocol === BRIDGE_PROTOCOL,
  'bridge protocol: and so does ui.html — a mismatch here is a frame both ends silently ignore',
  `ui.html says ${JSON.stringify(uiProtocol)}, lib/bridge.mjs says ${JSON.stringify(BRIDGE_PROTOCOL)}`);

/* The permission, read as narrowly as 016's amendment claims it is. ----- */

process.stdout.write('\nRead bridge: the permission is as narrow as the manifest claims\n');

assert(Array.isArray(manifest.networkAccess?.allowedDomains)
  && manifest.networkAccess.allowedDomains.length === 1
  && manifest.networkAccess.allowedDomains[0] === 'none',
  'manifest: published, this plugin still has no network access at all — allowedDomains is exactly ["none"]',
  JSON.stringify(manifest.networkAccess?.allowedDomains));

assert(devDomains.length > 0 && devDomains.every((entry) => LOOPBACK_WS.test(String(entry))),
  'manifest: every development domain is a ws:// port on the loopback interface — nothing public, nothing wss to a host elsewhere',
  JSON.stringify(devDomains));

const reasoning = manifest.networkAccess?.reasoning ?? '';
assert(typeof reasoning === 'string' && reasoning.length > 200,
  'manifest: the reasoning field argues the permission rather than naming it',
  `${reasoning.length} character(s)`);

/* Figma's own ceiling, and the only one of these limits nothing in this
 * repository could have told us about. It was found the way such things
 * usually are — the desktop app refused to load the plugin, with an error that
 * named the field and the number. A manifest is not something the gates here
 * parse for validity, so a length that fails on import fails at the worst
 * possible moment: in front of the one person who was about to use the thing.
 * That is a fact a script can hold, so a script holds it. */
assert(reasoning.length < 1000,
  'manifest: and stays under the 1000 characters Figma will accept, or the plugin does not load at all',
  `${reasoning.length} character(s)`);
assert(/carries no command/i.test(reasoning) && /create, update, rename or delete/i.test(reasoning),
  'manifest: and says on the record that the socket carries no command that changes anything',
  reasoning);

/* The vocabulary. ------------------------------------------------------- */

process.stdout.write('\nRead bridge: the vocabulary has no word for writing\n');

assert(Array.isArray(BRIDGE_SENDS) && BRIDGE_SENDS.length === 1 && BRIDGE_SENDS[0] === 'snapshot-request',
  'vocabulary: everything the listening end may say is one request, and it is a noun',
  JSON.stringify(BRIDGE_SENDS));

// Read as text rather than imported: the point is what the authored list says,
// and a TypeScript build is not something a gate may depend on.
const messageTypes = (/export const BRIDGE_MESSAGE_TYPES = \[([^\]]*)\]/.exec(bridgeSource)?.[1] ?? '')
  .match(/'[^']*'/g)?.map((quoted) => quoted.slice(1, -1)) ?? [];
assert(messageTypes.join(', ') === 'hello, snapshot-request, snapshot, error',
  'vocabulary: the plugin knows four message types — greet, ask, answer, fail — and no others',
  JSON.stringify(messageTypes));

/* Every verb that would mean a change to the file. The self-test on the line
 * after it is not decoration: a pattern that had quietly stopped matching
 * anything would pass the assertion below against any list at all, and the
 * section would go on reporting a guarantee it was no longer checking. */
const WRITE_VERB = /create|update|write|set|delete|remove|rename|apply|move|insert/i;
assert(WRITE_VERB.test('delete-variable') && WRITE_VERB.test('create-collection'),
  'vocabulary: the verb pattern below does match a verb, so nothing after it passes vacuously');
assert(messageTypes.length === 4 && messageTypes.every((type) => !WRITE_VERB.test(type)),
  'vocabulary: and not one of the four is a verb — there is no word here for changing anything',
  messageTypes.filter((type) => WRITE_VERB.test(type)).join(', ') || '(none)');

/* ui.html: the one file in the plugin that cannot be driven from the command
 * line, and therefore the one whose behaviour is asserted by reading it. ---- */

process.stdout.write('\nRead bridge: ui.html is a relay, not a participant\n');

const blockStart = uiSource.indexOf('* The read bridge.');
const blockEnd = uiSource.indexOf('window.onmessage');
assert(blockStart > 0 && blockEnd > blockStart,
  'relay: the bridge block is where the file says it is — between its own heading and the message pump',
  `heading at ${blockStart}, pump at ${blockEnd}`);
const bridgeBlock = uiSource.slice(blockStart, blockEnd);

const sendCount = (uiSource.match(/socket\.send\(/g) ?? []).length;
assert(sendCount === 1 && uiSource.includes('socket.send(JSON.stringify(message));'),
  'relay: one send in the whole file, and its argument is the finished object the main thread handed over',
  `${sendCount} call(s) to socket.send`);

assert(!/type:\s*['"]snapshot/.test(uiSource) && !/["']type["']\s*:\s*["']snapshot/.test(uiSource),
  'relay: nowhere does it compose a protocol message of its own — there is no branch here that could invent one',
  (uiSource.match(/type:\s*['"]snapshot[^'"]*['"]/g) ?? []).join(', '));

const actedOn = [...bridgeBlock.matchAll(/frame\.type === '([^']+)'/g)].map((match) => match[1]);
assert(actedOn.length === 1 && actedOn[0] === 'snapshot-request',
  'relay: exactly one wire frame type is acted on — everything else is counted and dropped, because text on a socket is data',
  JSON.stringify(actedOn));

const RELAY_VERB = /create|update|delete|rename/i;
assert(RELAY_VERB.test('rename-mode'),
  'relay: the verb pattern below does match a verb, so the assertion after it is not vacuous either');
assert(!RELAY_VERB.test(bridgeBlock),
  'relay: and no create, update, delete or rename appears anywhere in the bridge block',
  (bridgeBlock.match(RELAY_VERB) ?? []).join(', ') || '(none)');

/* The gate gained a source and did not lose one. ------------------------ */

process.stdout.write('\nRead bridge: check-drift gained a source without losing one\n');

const driftHelp = run('check-drift.mjs', ['--help']);
assert(driftHelp.status === 0
  && driftHelp.stdout.includes('--bridge')
  && driftHelp.stdout.includes('--bridge-port')
  && driftHelp.stdout.includes('--bridge-timeout'),
  'drift gate: --help names the bridge and both of its dials',
  driftHelp.stdout);

const noSourceMessage = (noSource.payload?.errors ?? []).find((error) => error.code === 'no-source')?.message ?? '';
assert(/--snapshot/.test(noSourceMessage) && /--bridge/.test(noSourceMessage) && /--file-key/.test(noSourceMessage),
  'drift gate: with no source at all the error names all three routes, so nobody has to guess which one they are missing',
  noSourceMessage);

/* A bad port is refused before anything is bound. The elapsed time is asserted
 * because the interesting failure is not the exit code — it is a run that opens
 * a socket and then sits on the default timeout waiting for a plugin that was
 * never going to arrive on a port that does not exist. */
const startedAt = Date.now();
const badPort = run('check-drift.mjs', ['--root', VALID, '--bridge', '--bridge-port', 'nonsense']);
const badPortMs = Date.now() - startedAt;
assert(badPort.status === 1 && codes(badPort.payload?.errors).has('bridge-port-invalid'),
  'drift gate: a port that is not a port is refused by name',
  `exit ${badPort.status}; ${JSON.stringify(badPort.payload?.errors ?? badPort.stderr)}`);
assert(badPortMs < BRIDGE_TIMEOUT_MS / 6,
  'drift gate: and refused immediately, without opening a socket and waiting out the timeout',
  `took ${badPortMs}ms; the default bridge timeout is ${BRIDGE_TIMEOUT_MS}ms`);
assert(badPort.payload?.check === 'drift',
  'drift gate: a bridge failure still emits the JSON contract the dashboard reads, not a stack trace',
  badPort.stdout.slice(0, 200));

const snapshotWins = run('check-drift.mjs', ['--root', VALID, '--snapshot', FIGMA_ALIGNED, '--bridge']);
assert(snapshotWins.status === 0 && snapshotWins.payload?.source?.kind === 'snapshot',
  'drift gate: a snapshot still wins over --bridge — the offline path stays the privileged one and no socket is opened',
  JSON.stringify(snapshotWins.payload?.source));

/* ------------------------------------------------------------------ *
 * And finally the wire itself, because everything above is a reading.
 *
 * A stand-in plugin — Node's own WebSocket client, speaking the same four words
 * — connects, greets, is asked, and answers. That exercises the hand-written
 * RFC 6455 server, the envelope, the payload shape check and the timeout, which
 * between them are the only parts of this that no fixture can stand in for.
 * ------------------------------------------------------------------ */

process.stdout.write('\nRead bridge: a real round trip over a real socket\n');

/* Deliberately not 8791. `readSnapshotOverBridge` does not report the port it
 * bound, so port 0 cannot be used here, and binding the real one would mean a
 * developer with a bridge session open could not run the selftest. */
const ROUND_TRIP_PORT = 58791;
const SILENT_CLIENT_PORT = 58792;

/** Valid enough for the bridge's own shape check, and no larger than that. */
const STAND_IN_PAYLOAD = { meta: { variableCollections: {}, variables: {} } };

const openSockets = [];

/**
 * Stand in for the plugin.
 *
 * It retries, because `readSnapshotOverBridge` starts listening a tick after it
 * is called — which is exactly the situation the real plugin is in, since it
 * sits there retrying while nobody is reading.
 */
function standInPlugin({ port, sayHello, deadlineMs = 10_000 }) {
  const received = [];
  const giveUpAt = Date.now() + deadlineMs;
  const done = new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };

    const attempt = () => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}`);
      openSockets.push(socket);
      let opened = false;
      let movedOn = false;

      // `error` is followed by `close`, so the hand-off is guarded per attempt.
      const next = () => {
        if (movedOn) return;
        movedOn = true;
        if (opened || Date.now() >= giveUpAt) { finish(); return; }
        setTimeout(attempt, 25).unref?.();
      };

      socket.addEventListener('open', () => {
        opened = true;
        if (!sayHello) return;
        socket.send(JSON.stringify({
          protocol: BRIDGE_PROTOCOL, type: 'hello', plugin: 'selftest stand-in', answers: ['snapshot'],
        }));
      });
      socket.addEventListener('message', (event) => {
        let frame = null;
        try { frame = JSON.parse(String(event.data)); } catch { frame = { type: '(unparseable)' }; }
        received.push(frame);
        if (frame.type !== 'snapshot-request') return;
        socket.send(JSON.stringify({
          protocol: BRIDGE_PROTOCOL, type: 'snapshot', id: frame.id, payload: STAND_IN_PAYLOAD,
        }));
      });
      socket.addEventListener('close', next);
      socket.addEventListener('error', next);
    };

    attempt();
  });
  return { received, done };
}

assert(ROUND_TRIP_PORT !== BRIDGE_PORT && SILENT_CLIENT_PORT !== BRIDGE_PORT,
  'round trip: neither test binds the real bridge port, so this runs with Figma open and a bridge session live',
  `${ROUND_TRIP_PORT}, ${SILENT_CLIENT_PORT}, bridge ${BRIDGE_PORT}`);

const roundTrip = standInPlugin({ port: ROUND_TRIP_PORT, sayHello: true });
const read = await readSnapshotOverBridge({ port: ROUND_TRIP_PORT, timeoutMs: 5_000, onStatus: () => {} });
await roundTrip.done;

assert(read.ok === true,
  'round trip: a stand-in that greets, is asked, and answers produces a resolved read',
  JSON.stringify(read));
assert(JSON.stringify(read.payload) === JSON.stringify(STAND_IN_PAYLOAD),
  'round trip: and what comes back is the payload the stand-in sent, unaltered',
  JSON.stringify(read.payload));
assert(roundTrip.received.length === 1
  && roundTrip.received[0]?.type === 'snapshot-request'
  && roundTrip.received[0]?.protocol === BRIDGE_PROTOCOL,
  'round trip: the only thing the reading end said on the socket was the one word it is allowed to say',
  JSON.stringify(roundTrip.received));

/* The negative, which is the half that proves the greeting is required. */

const silent = standInPlugin({ port: SILENT_CLIENT_PORT, sayHello: false });
const timedOut = await readSnapshotOverBridge({ port: SILENT_CLIENT_PORT, timeoutMs: 2_000, onStatus: () => {} });
await silent.done;

assert(timedOut.ok === false && timedOut.code === 'bridge-timeout',
  'round trip: a client that connects and never identifies itself is waited for, then given up on by name',
  JSON.stringify(timedOut));
assert(silent.received.length === 0,
  'round trip: and is sent nothing at all — the request goes only to a plugin that has said hello first',
  JSON.stringify(silent.received));

// Nothing may be left holding the event loop open: a selftest that hangs after
// its last assertion is indistinguishable from one that failed to finish.
for (const socket of openSockets) {
  try { socket.close(); } catch { /* already gone */ }
}

/* ------------------------------------------------------------------ *
 * And then the job the bridge was built to do.
 *
 * Everything above proves the wire works. None of it proves the wire is worth
 * having: the payload that crossed it was two empty objects, and the thing at
 * the far end was this file rather than the gate. So this drives
 * `check-drift.mjs --bridge` the way a person drives it — a stand-in plugin
 * holding a real token root, planned and applied through the same core the
 * plugin ships and handed out in the same REST shape — and asserts what comes
 * back on the other side of a process boundary.
 *
 * The failure cases are the half that matters most. A bridge that breaks and
 * says "every token is missing from Figma" would be believed, and acted on, and
 * the action is a sync. So each way the far end can fail is asserted twice: once
 * that it is named, and once that it produced no findings at all.
 *
 * It needs the plugin core built, and a token root to hand it. Neither is
 * something a gate may require, so this says out loud when it did not run.
 * ------------------------------------------------------------------ */

process.stdout.write('\nRead bridge: the gate reads a live variable table and reports on it\n');

const LIVE_ROOT = defaultTokensRoot();

if (!existsSync(CORE) || !existsSync(LIVE_ROOT)) {
  process.stdout.write(
    '  note  this needs the built plugin core and a token root to hand it, and one of the two\n'
    + '        is absent, so the end-to-end read through check-drift.mjs was not run. The round\n'
    + '        trip above still holds: the socket, the envelope, the greeting and the timeout\n'
    + '        are proven. What is skipped is the proof that what crosses the wire is a table\n'
    + '        the gate can compare.\n',
  );
  skipped.push('the bridge carrying a real variable table the gate can compare');
} else {
  const core = await import(pathToFileURL(CORE).href);
  const { bundleTokenRoot } = await import(pathToFileURL(join(PLUGIN_DIR, 'bundle.mjs')).href);

  /* Two more ports of this section's own. Same reason as above, twice over: a
   * developer with a live bridge session must be able to run the selftest, and
   * two selftests running side by side must both be able to finish. */
  const E2E_PORT = 58793;
  const NOBODY_PORT = 58794;
  const TAKEN = [BRIDGE_PORT, ROUND_TRIP_PORT, SILENT_CLIENT_PORT];
  assert(!TAKEN.includes(E2E_PORT) && !TAKEN.includes(NOBODY_PORT) && E2E_PORT !== NOBODY_PORT,
    'end to end: this section binds two ports of its own — neither the real bridge, nor either port already used above',
    `${E2E_PORT}, ${NOBODY_PORT}; already taken: ${TAKEN.join(', ')}`);

  /* What the stand-in is holding. Not a fixture written to make the gate happy:
   * a real token root, run through the plugin's own planner, applied to the
   * plugin's own in-memory model of the Figma API, and projected with the same
   * function the plugin answers the bridge with. If the syncer and the detector
   * disagreed about one convention, this document would arrive as drift. */
  const bundle = bundleTokenRoot(LIVE_ROOT);
  const memory = new core.MemoryVariables();
  const plan = core.planSync(bundle, memory.readSnapshot());
  assert(plan.errors.length === 0,
    'end to end: the token root the stand-in will serve plans without a single error, so anything reported below arrived over the wire',
    JSON.stringify(plan.errors.slice(0, 3)));
  core.applyPlan(plan, memory);
  const livePayload = core.toRestPayload(memory.readRestSource());

  /**
   * A stand-in plugin that outlives a child process.
   *
   * The round trip above drives the library in this process and is finished the
   * moment its socket closes. This one has to sit there through a whole
   * `check-drift.mjs` run and answer whichever server that run opens — which is
   * exactly the real plugin's situation, and why the real plugin retries.
   * `ui.html` retries from both `close` and `error` because engines disagree
   * about which of the two a refused connection produces; so does this, guarded
   * per attempt so a refusal that fires both does not schedule two.
   */
  function servingPlugin({ port, answer = 'snapshot', payload = livePayload }) {
    let stopped = false;
    let socket = null;

    const attempt = () => {
      if (stopped) return;
      let ws;
      try { ws = new WebSocket(`ws://127.0.0.1:${port}`); } catch { setTimeout(attempt, 25).unref?.(); return; }
      socket = ws;

      let scheduled = false;
      const again = () => {
        if (scheduled || stopped) return;
        scheduled = true;
        setTimeout(attempt, 25).unref?.();
      };

      ws.addEventListener('open', () => ws.send(JSON.stringify(core.helloMessage())));
      ws.addEventListener('message', (event) => {
        const frame = core.parseBridgeMessage(String(event.data));
        if (!core.isSnapshotRequest(frame)) return;
        ws.send(JSON.stringify(answer === 'error'
          ? core.errorMessage(frame.id, 'the document holds a value this plugin cannot read')
          : core.snapshotMessage(frame.id, payload)));
      });
      ws.addEventListener('close', again);
      ws.addEventListener('error', again);
    };

    attempt();
    return { stop: () => { stopped = true; try { socket?.close(); } catch { /* already gone */ } } };
  }

  /**
   * The gate itself, spawned. `run()` above cannot be used here: it is
   * synchronous, and a blocked event loop is one in which the stand-in never
   * gets to connect.
   */
  function readOverBridge(extraArgs) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [
        join(SCRIPTS_DIR, 'check-drift.mjs'), '--root', LIVE_ROOT, '--json', ...extraArgs,
      ]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      // Nothing here should ever reach this, but a selftest that hangs is worse
      // than one that fails, so the run has an outer bound of its own.
      const guard = setTimeout(() => child.kill('SIGKILL'), 30_000);
      guard.unref?.();
      child.on('close', (status) => {
        clearTimeout(guard);
        let payload = null;
        try { payload = JSON.parse(stdout); } catch { payload = null; }
        resolve({ status, payload, stdout, stderr });
      });
    });
  }

  /* 1. The happy path, and the fixture it can leave behind. -------------- */

  const bridgeTmp = mkdtempSync(join(tmpdir(), 'mizan-selftest-bridge-'));
  const savedSnapshot = join(bridgeTmp, 'from-the-bridge.json');

  let plugin = servingPlugin({ port: E2E_PORT });
  const live = await readOverBridge([
    '--bridge', '--bridge-port', String(E2E_PORT), '--bridge-timeout', '15',
    '--save-snapshot', savedSnapshot,
  ]);
  plugin.stop();

  assert(live.status === 0,
    'end to end: a plugin holding the synced token root passes the drift gate, read over a socket rather than out of a file',
    `exit ${live.status}\n        ${live.stderr}`);
  assert(live.payload !== null,
    'end to end: stdout parses as JSON even though progress was printed throughout — the dashboard reads this stream, so it is a contract',
    live.stdout.slice(0, 200));
  assert(live.stderr.includes('bridge:'),
    'end to end: and the progress a person needs went to stderr, which is not',
    live.stderr.slice(0, 200));
  assert(live.payload?.ok === true, 'end to end: the report says ok', JSON.stringify(live.payload?.errors));
  assert((live.payload?.findings ?? []).length === 0,
    'end to end: with no findings — the display the plugin is holding agrees with the source, variable for variable',
    JSON.stringify((live.payload?.findings ?? []).slice(0, 2)));
  assert(live.payload?.source?.kind === 'bridge' && live.payload?.source?.port === E2E_PORT,
    'end to end: and it names the bridge and the port it read on, so a saved report says where its evidence came from',
    JSON.stringify(live.payload?.source));

  /* Derived from the plan, never written down: a number typed here would agree
   * with whatever it was last told, which is the failure it would exist to
   * catch. If the wire dropped a variable, the plan still knows how many. */
  assert(live.payload?.counts?.aligned === plan.projected.length,
    'end to end: every variable the plan projects was compared and found aligned — the count is the plan\'s own, not a number written into this test',
    `${live.payload?.counts?.aligned} aligned, ${plan.projected.length} projected`);

  assert(existsSync(savedSnapshot),
    'end to end: --save-snapshot turned the live read into a file, which is how a fixture gets made on a plan with no variables API',
    savedSnapshot);
  const saved = existsSync(savedSnapshot) ? JSON.parse(readFileSync(savedSnapshot, 'utf8')) : {};
  assert(typeof saved.generatedBy === 'string' && /not the REST API/i.test(saved.generatedBy),
    'end to end: and the file says on its face that it did not come from the REST API — a snapshot that lied about its origin would be worse than none',
    JSON.stringify(saved.generatedBy));

  const offline = run('check-drift.mjs', ['--root', LIVE_ROOT, '--snapshot', savedSnapshot]);
  assert(offline.status === 0 && (offline.payload?.findings ?? []).length === 0,
    'end to end: and that file passes the same gate offline — the bridge added a source, not a format',
    `exit ${offline.status}; ${JSON.stringify(offline.payload?.findings ?? offline.stderr)}`);

  /* 2. Drift, arriving over the wire intact. ------------------------------ */

  const isRawColour = (value) => value !== null && typeof value === 'object' && 'r' in value;
  const victim = Object.values(livePayload.meta.variables).find((variable) => variable.resolvedType === 'COLOR'
    && Object.values(variable.valuesByMode).some(isRawColour));
  assert(victim !== undefined,
    'end to end: the projected table holds at least one colour stated as a value, which is the thing a person hand-edits');

  /* Channels chosen to land on whole bytes: 0.2, 0.4 and 0.6 of 255 are 51, 102
   * and 153 exactly, so #336699 is what a faithful wire produces and any
   * rounding, re-encoding or helpful tidying anywhere in between shows up as a
   * different hex rather than as nothing at all. */
  const HAND_EDIT = { r: 0.2, g: 0.4, b: 0.6, a: 1 };
  const driftedPayload = JSON.parse(JSON.stringify(livePayload));
  if (victim !== undefined) {
    for (const [modeId, value] of Object.entries(driftedPayload.meta.variables[victim.id].valuesByMode)) {
      if (!isRawColour(value)) continue;
      driftedPayload.meta.variables[victim.id].valuesByMode[modeId] = HAND_EDIT;
      break;
    }
  }

  plugin = servingPlugin({ port: E2E_PORT, payload: driftedPayload });
  const drifting = await readOverBridge(['--bridge', '--bridge-port', String(E2E_PORT), '--bridge-timeout', '15']);
  plugin.stop();

  assert(drifting.status === 1 && codes(drifting.payload?.findings).has('value-mismatch'),
    'end to end: one colour hand-edited in the document arrives as a value-mismatch and fails the gate',
    `exit ${drifting.status}; ${JSON.stringify((drifting.payload?.findings ?? []).map((f) => f.code))}`);

  const overTheWire = (drifting.payload?.findings ?? [])
    .find((finding) => finding.token === core.tokenPathFromName(victim?.name ?? ''));
  assert(overTheWire?.actual?.display === '#336699',
    'end to end: the finding names the edited variable and the exact value it holds — nothing on the wire rounded it or tidied it',
    JSON.stringify(overTheWire));
  assert(new Set((drifting.payload?.findings ?? []).map((finding) => finding.token)).size === 1,
    'end to end: and nothing else drifted — every other variable in the table crossed the wire unchanged',
    JSON.stringify([...new Set((drifting.payload?.findings ?? []).map((finding) => finding.token))]));

  /* 3. The three ways the far end fails, none of which is drift. ---------- */

  plugin = servingPlugin({ port: E2E_PORT, answer: 'error' });
  const pluginError = await readOverBridge(['--bridge', '--bridge-port', String(E2E_PORT), '--bridge-timeout', '15']);
  plugin.stop();

  assert(pluginError.status === 1 && codes(pluginError.payload?.errors).has('bridge-plugin-error'),
    'end to end: a plugin that answers "I could not read that" is reported as a plugin failure, by name',
    `exit ${pluginError.status}; ${JSON.stringify(pluginError.payload?.errors)}`);
  assert((pluginError.payload?.findings ?? []).length === 0,
    'end to end: and reports no drift whatsoever — a read that never happened is not a file that disagrees',
    JSON.stringify(pluginError.payload?.findings));

  plugin = servingPlugin({ port: E2E_PORT, payload: { meta: { nothing: 'that is a variable table' } } });
  const badPayload = await readOverBridge(['--bridge', '--bridge-port', String(E2E_PORT), '--bridge-timeout', '15']);
  plugin.stop();

  assert(badPayload.status === 1 && codes(badPayload.payload?.errors).has('bridge-bad-payload'),
    'end to end: an answer that is not a variable table is caught at the bridge, where the two ends can be told they are on different versions',
    `exit ${badPayload.status}; ${JSON.stringify(badPayload.payload?.errors)}`);
  assert((badPayload.payload?.findings ?? []).length === 0
    && !codes(badPayload.payload?.findings).has('missing-in-figma'),
    'end to end: and not one finding claims a token is missing from Figma — a broken bridge reported as total drift would be believed, and the remedy for drift is a sync',
    JSON.stringify((badPayload.payload?.findings ?? []).map((finding) => finding.code)));

  /* Nobody at all, on a port nothing in this file ever binds. A short timeout
   * because the assertion is about what the failure is called, not about how
   * long a person is given to go and click something. */
  const timedOutRun = await readOverBridge(['--bridge', '--bridge-port', String(NOBODY_PORT), '--bridge-timeout', '1']);

  assert(timedOutRun.status === 1 && codes(timedOutRun.payload?.errors).has('bridge-timeout'),
    'end to end: with nothing on the other end the gate times out and fails, rather than reporting a file it never read as clean',
    `exit ${timedOutRun.status}; ${JSON.stringify(timedOutRun.payload?.errors)}`);
  const timeoutMessage = (timedOutRun.payload?.errors ?? [])
    .find((error) => error.code === 'bridge-timeout')?.message ?? '';
  assert(/person/i.test(timeoutMessage) && /not a background service/i.test(timeoutMessage),
    'end to end: and says the thing that is missing is a person — 016 removed a copy and a paste, not the human, and the message still says so',
    timeoutMessage);

  rmSync(bridgeTmp, { recursive: true, force: true });
}

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
 * Searchability: every authored file under machinery/ must be plain text
 *
 * A NUL byte is a tempting delimiter for a composite key — it cannot occur
 * in ordinary text, so it never collides. The cost is invisible and only
 * shows up later: grep classifies the whole file as binary and silently
 * returns nothing, and file(1) reports it as data. A search that finds no
 * matches looks exactly like a search that found nothing to match.
 *
 * That cost is unacceptable here specifically. machinery/ is the half of
 * this repo published for other teams to read and fork, and a file nobody
 * can grep is a file nobody can audit. This has now been introduced three
 * separate times by three different authors, which is the definition of a
 * mistake that wants a check rather than a note. Write it as the six-character escape sequence instead.
 * ------------------------------------------------------------------ */

process.stdout.write('\nSearchability: authored machinery files are greppable text\n');

const CONTROL_BYTE = (byte) => byte === 0 || byte < 9 || (byte > 13 && byte < 32 && byte !== 27);

function authoredFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) authoredFiles(full, found);
    // code.js is bundler output, not authored, and is excluded on that basis.
    else if (/\.(mjs|js|ts|json|md|html)$/.test(entry) && !full.endsWith('code.js')) found.push(full);
  }
  return found;
}

const binaryFiles = authoredFiles(MACHINERY_DIR).filter((file) => {
  const buffer = readFileSync(file);
  for (let i = 0; i < buffer.length; i += 1) if (CONTROL_BYTE(buffer[i])) return true;
  return false;
});

assert(binaryFiles.length === 0,
  'searchability: no authored file under machinery/ contains a control byte',
  binaryFiles.map(displayPath).join(', ') || '(none)');

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

process.stdout.write(`\nFixtures: ${displayPath(FIXTURES)}\n`);
if (failures.length === 0) {
  process.stdout.write(
    `Result: pass. ${passes.length} assertion(s). Rung 1 proven to accept the valid token set and reject the broken one; `
    + 'rung 2 proven to accept a Figma snapshot that agrees and to catch each way one can disagree; '
    + 'and the read bridge proven read-only by construction — one port agreed across four files, '
    + 'a vocabulary of four words none of which is a verb, and a round trip over a real socket.\n'
    + (skipped.length === 0
      ? 'The one lossy projection is proven to be a single function both ends import, and the '
        + 'bridge proven to do its job end to end — the gate reading a real variable table off '
        + 'the wire, passing it, catching a hand-edit in it unrounded, saving it as an offline '
        + 'fixture, and naming each way the far end can fail rather than reporting any of them '
        + 'as drift.\n'
      /* Named, not counted. "2 sections skipped" is a number somebody scrolls
       * past; the sentence below is the claim this run is not entitled to make,
       * which is the thing a reader has to know. */
      : `NOT PROVEN BY THIS RUN — ${skipped.length} section(s) did not run, so this pass does `
        + `not cover: ${skipped.join('; ')}. Build the plugin core `
        + '(npm --prefix machinery/figma-plugin run build) and run again for the full set.\n'),
  );
  process.exitCode = 0;
} else {
  process.stdout.write(`Result: fail. ${failures.length} of ${passes.length + failures.length} assertion(s) failed.\n`);
  process.exitCode = 1;
}
