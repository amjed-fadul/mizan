#!/usr/bin/env node
/**
 * selftest.mjs — proves the gates actually reject things.
 *
 * Runs check-schema and check-contrast against both fixture sets and asserts
 * not only the exit codes but the specific defects that come back. A gate that
 * has never rejected anything is an untested claim, and a gate asserted only on
 * its exit code can pass for the wrong reason.
 *
 * Usage: node machinery/scripts/selftest.mjs [--verbose]
 * Exits 1 if any assertion fails.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { displayPath, parseArgs } from './lib/tokens.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(SCRIPTS_DIR, '__fixtures__');
const VALID = join(FIXTURES, 'valid');
const BROKEN = join(FIXTURES, 'broken');

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
 * Summary
 * ------------------------------------------------------------------ */

process.stdout.write(`\nFixtures: ${displayPath(FIXTURES)}\n`);
if (failures.length === 0) {
  process.stdout.write(`Result: pass. ${passes.length} assertion(s), both gates proven to accept the valid set and reject the broken one.\n`);
  process.exitCode = 0;
} else {
  process.stdout.write(`Result: fail. ${failures.length} of ${passes.length + failures.length} assertion(s) failed.\n`);
  process.exitCode = 1;
}
