#!/usr/bin/env node
/**
 * dry-run.mjs — the plugin's mapping, proved without Figma.
 *
 * A Figma plugin cannot run in CI. If the only way to find out what this thing
 * does is to load it in the desktop app and look, then nothing about it is
 * checkable and every claim in its comments is an assertion nobody can test.
 *
 * So the whole transformation — load, classify, assign collections, map values,
 * diff, apply — is pure and runs here against a real token root and two
 * fixtures, driving the *same* built core the plugin loads. The Figma API is
 * replaced by an in-memory model that enforces the constraints the real one
 * enforces; nothing else is substituted.
 *
 * What it asserts, in one list:
 *
 *   1. The plugin's fs-free token loader agrees with machinery/scripts/lib/
 *      tokens.mjs, token for token, on the real token root. The port cannot
 *      drift without this failing.
 *   2. Every token is accounted for: projected, or skipped with a reason, or
 *      an error. Nothing disappears quietly.
 *   3. Each token lands in the collection its dimensions say it should.
 *   4. `$description` reaches the variable; colour components reach Figma
 *      unchanged; DTCG types land on the Figma types they are supposed to.
 *   5. A semantic aliases its primitive, and at least one alias crosses a
 *      collection boundary — the mechanism the two-dimension case rests on.
 *   6. The sync is idempotent: apply, re-plan, nothing left to do.
 *   7. A token removed from the source is reported as an orphan and not
 *      deleted. There is no delete operation in the vocabulary at all.
 *   8. A third mode dimension needs no code change.
 *   9. A token varying by two dimensions is refused, with the reason.
 *  10. Collections this plugin did not plan are left alone.
 *
 *   node dry-run.mjs [--root <dir>] [--verbose]
 *
 * Exits 1 if any assertion fails. Run `node build.mjs` first — this drives the
 * built core on purpose, so that what is proved is what ships.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Diagnostics as LibDiagnostics,
  defaultTokensRoot,
  displayPath,
  loadTokenSet,
  parseArgs,
} from '../scripts/lib/tokens.mjs';
import { bundleTokenRoot } from './bundle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, 'dist', 'core.mjs');

if (!existsSync(CORE)) {
  process.stderr.write('dist/core.mjs is missing. Run `node build.mjs` first.\n');
  process.exit(1);
}

const {
  MemoryVariables,
  SINGLE_MODE_NAME,
  applyPlan,
  describeAction,
  isApplicable,
  figmaName,
  loadBundle,
  planSync,
  varyingDimensions,
  effectiveType,
} = await import(`file://${CORE}`);

const args = parseArgs(process.argv.slice(2), { flags: ['verbose'], values: ['root'] });
const ROOT = args.root ? args.root : defaultTokensRoot();
const FIXTURES = join(HERE, '__fixtures__');

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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const emptySnapshot = () => ({ collections: [], variables: [] });

/** The known action vocabulary. Note what is not in it: anything that removes. */
const ACTION_OPS = ['create-collection', 'create-mode', 'rename-mode', 'create-variable', 'set-description', 'set-value'];

/* ================================================================== *
 * 1. The port agrees with the shared library
 * ================================================================== */

process.stdout.write(`Token root: ${displayPath(ROOT)}\n\n`);
process.stdout.write('1. The plugin\'s fs-free loader agrees with machinery/scripts/lib/tokens.mjs\n');

const libDiagnostics = new LibDiagnostics();
const libSet = loadTokenSet(ROOT, libDiagnostics);
const bundle = bundleTokenRoot(ROOT);
const portSet = loadBundle(bundle);

assert(libDiagnostics.errors.length === 0, 'the real token root loads cleanly through the shared library',
  JSON.stringify(libDiagnostics.errors.slice(0, 3)));
assert(portSet.diagnostics.errors.length === 0, 'the real token root loads cleanly through the plugin\'s loader',
  JSON.stringify(portSet.diagnostics.errors.slice(0, 3)));

assert(same(libSet.dimensions, portSet.dimensions), 'both loaders discover the same mode dimensions, in the same order',
  `${JSON.stringify(libSet.dimensions)} vs ${JSON.stringify(portSet.dimensions)}`);

const libPaths = [...libSet.base.keys()].sort();
const portPaths = [...portSet.base.keys()].sort();
assert(same(libPaths, portPaths), 'both loaders find the same token paths',
  `${libPaths.length} vs ${portPaths.length}`);

let valueMismatch = null;
for (const path of libPaths) {
  const a = libSet.base.get(path);
  const b = portSet.base.get(path);
  if (!b || !same(a.rawValue, b.rawValue) || a.type !== b.type || a.layer !== b.layer || a.description !== b.description) {
    valueMismatch = path;
    break;
  }
}
assert(valueMismatch === null, 'every token has the same raw value, $type, layer and $description in both loaders',
  valueMismatch ? `first disagreement at "${valueMismatch}"` : undefined);

let modeMismatch = null;
for (const [id, libMode] of libSet.modes) {
  const portMode = portSet.modes.get(id);
  if (!portMode || portMode.dimension !== libMode.dimension) { modeMismatch = id; break; }
  const a = [...libMode.overrides.entries()].map(([p, n]) => [p, n.rawValue]).sort();
  const b = [...portMode.overrides.entries()].map(([p, n]) => [p, n.rawValue]).sort();
  if (!same(a, b)) { modeMismatch = id; break; }
}
assert(libSet.modes.size === portSet.modes.size && modeMismatch === null,
  'every mode file yields the same overrides in both loaders',
  modeMismatch ? `first disagreement in mode "${modeMismatch}"` : undefined);

/* ================================================================== *
 * 2-5. The projection of the real token root
 * ================================================================== */

process.stdout.write('\n2. The projection of the real token root\n');

const plan = planSync(bundle, emptySnapshot());

assert(plan.errors.length === 0, 'the real token root produces a plan with no errors',
  JSON.stringify(plan.errors.slice(0, 3), null, 1));
assert(isApplicable(plan), 'the plan is applicable');
assert(plan.actions.every((a) => ACTION_OPS.includes(a.op)), 'every action is one of the six known operations');

const created = plan.actions.filter((a) => a.op === 'create-variable');
const createdTokens = new Set(created.map((a) => a.token));
const skippedTokens = new Set(plan.skipped.map((s) => s.token));

const unaccounted = [...portSet.base.keys()].filter((p) => !createdTokens.has(p) && !skippedTokens.has(p));
assert(unaccounted.length === 0, 'every token is either projected or reported as skipped — nothing vanishes silently',
  unaccounted.slice(0, 5).join(', '));
assert([...createdTokens].every((p) => !skippedTokens.has(p)), 'no token is both projected and skipped');
assert(plan.skipped.every((s) => typeof s.reason === 'string' && s.reason.length > 0), 'every skip carries a reason');

let wrongCollection = null;
for (const action of created) {
  const varying = varyingDimensions(action.token, portSet);
  const expected = varying.length === 1 ? varying[0] : portSet.base.get(action.token).layer;
  if (action.collection !== expected) { wrongCollection = `${action.token}: ${action.collection} != ${expected}`; break; }
}
assert(wrongCollection === null,
  'a token overridden by one dimension lands in that dimension\'s collection; a token overridden by none lands in its layer\'s',
  wrongCollection);

assert(created.every((a) => !a.name.includes('.') && !a.name.includes(':')),
  'no Figma variable name contains a character Figma rejects');

let wrongDescription = null;
for (const action of created) {
  const expected = portSet.base.get(action.token).description || '';
  if (action.description !== expected) { wrongDescription = action.token; break; }
}
assert(wrongDescription === null, '$description is carried into the Figma variable description verbatim', wrongDescription);
assert(created.some((a) => a.description.length > 0), 'at least one variable actually carries a description');

/* Collections and their modes come from the dimensions, one collection each. */
for (const dimension of portSet.dimensions) {
  const collection = plan.collections.filter((c) => c.name === dimension.name)[0];
  assert(Boolean(collection) && collection.origin === 'dimension',
    `dimension "${dimension.name}" becomes a collection of its own`);
  assert(Boolean(collection) && collection.modes.length === dimension.modes.length,
    `collection "${dimension.name}" has exactly ${dimension.modes.length} modes — one per mode of the dimension, not one per combination`);
}
const combinations = portSet.dimensions.reduce((n, d) => n * d.modes.length, 1);
const widest = Math.max(...plan.collections.map((c) => c.modes.length));
assert(widest < combinations || portSet.dimensions.length <= 1,
  'no collection carries the cartesian product of the dimensions',
  `widest collection ${widest} modes, ${combinations} combinations`);

for (const collection of plan.collections) {
  if (collection.origin !== 'layer') continue;
  assert(same(collection.modes, [SINGLE_MODE_NAME]),
    `layer collection "${collection.name}" has a single mode`);
}

process.stdout.write('\n3. Values: types, colours and the alias chain\n');

const EXPECTED_FIGMA_TYPE = {
  color: 'COLOR',
  dimension: 'FLOAT',
  number: 'FLOAT',
  fontWeight: 'FLOAT',
  fontFamily: 'STRING',
};

let wrongType = null;
for (const action of created) {
  const dtcg = effectiveType(action.token, portSet.base);
  const expected = EXPECTED_FIGMA_TYPE[dtcg];
  if (expected && action.type !== expected) { wrongType = `${action.token}: ${dtcg} -> ${action.type}`; break; }
}
assert(wrongType === null, 'DTCG types land on the Figma types they are supposed to', wrongType);

const setValues = plan.actions.filter((a) => a.op === 'set-value');

/* A colour reaches Figma as the components the token declares — no conversion. */
let wrongColor = null;
for (const [path, node] of portSet.base) {
  if (!createdTokens.has(path)) continue;
  if (varyingDimensions(path, portSet).length !== 0) continue;
  const raw = node.rawValue;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.components)) continue;
  const action = setValues.filter((a) => a.token === path && a.mode === SINGLE_MODE_NAME)[0];
  const expected = { kind: 'COLOR', value: { r: raw.components[0], g: raw.components[1], b: raw.components[2], a: raw.alpha === undefined ? 1 : raw.alpha } };
  if (!action || !same(action.to, expected)) { wrongColor = path; break; }
}
assert(wrongColor === null, 'DTCG colour components (already 0-1) become Figma RGBA unchanged', wrongColor);

const aliasValues = setValues.filter((a) => a.to.kind === 'ALIAS');
assert(aliasValues.length > 0, 'semantic variables reference their primitives rather than restating values');

const crossCollection = aliasValues.filter((a) => a.to.collection !== a.collection);
assert(crossCollection.length > 0,
  'at least one alias crosses a collection boundary — the mechanism the two-dimension case rests on',
  `${aliasValues.length} aliases, none crossing`);

if (args.verbose && crossCollection.length > 0) {
  for (const action of crossCollection.slice(0, 4)) process.stdout.write(`        ${describeAction(action)}\n`);
}

let danglingAlias = null;
for (const action of aliasValues) {
  const target = created.filter((c) => c.collection === action.to.collection && c.name === action.to.name)[0];
  if (!target) { danglingAlias = `${action.token} -> ${action.to.collection}/${action.to.name}`; break; }
  if (target.type !== created.filter((c) => c.collection === action.collection && c.name === action.name)[0].type) {
    danglingAlias = `${action.token} type mismatch`;
    break;
  }
}
assert(danglingAlias === null, 'every alias points at a variable this run creates, of the same type', danglingAlias);

/* ================================================================== *
 * 6. Idempotency
 * ================================================================== */

process.stdout.write('\n4. Applying it, twice\n');

const figma = new MemoryVariables();
const first = applyPlan(plan, figma);
assert(first.failures.length === 0, 'the plan applies with no failures',
  JSON.stringify(first.failures.slice(0, 3).map((f) => f.message)));
assert(first.applied === plan.actions.length, 'every action was applied',
  `${first.applied} of ${plan.actions.length}`);

const second = planSync(bundle, figma.readSnapshot());
assert(second.actions.length === 0, 'running the sync again changes nothing — it is idempotent',
  second.actions.slice(0, 5).map(describeAction).join(' | '));
assert(second.errors.length === 0, 're-planning produces no errors', JSON.stringify(second.errors.slice(0, 2)));
assert(second.orphans.length === 0, 'a freshly synced file has no orphans', JSON.stringify(second.orphans.slice(0, 3)));

const third = applyPlan(second, figma);
assert(third.applied === 0 && third.failures.length === 0, 'applying an empty plan writes nothing');
assert(planSync(bundle, figma.readSnapshot()).actions.length === 0, 'and the file is still in sync afterwards');

/* ================================================================== *
 * 7. Orphans are reported, never removed
 * ================================================================== */

process.stdout.write('\n5. A token removed from the source\n');

const referenced = new Set();
const collectRefs = (value) => {
  if (typeof value === 'string') {
    const match = /^\{([^{}]+)\}$/.exec(value.trim());
    if (match) referenced.add(match[1].trim());
    return;
  }
  if (Array.isArray(value)) { value.forEach(collectRefs); return; }
  if (value && typeof value === 'object') Object.values(value).forEach(collectRefs);
};
for (const node of portSet.base.values()) collectRefs(node.rawValue);
for (const mode of portSet.modes.values()) for (const node of mode.overrides.values()) collectRefs(node.rawValue);

const removable = [...createdTokens].filter((p) => !referenced.has(p) && varyingDimensions(p, portSet).length === 0).sort()[0]
  || [...createdTokens].filter((p) => !referenced.has(p)).sort()[0];

assert(Boolean(removable), 'the token root has a token nothing else references, so one can be removed for this test');

if (removable) {
  const reduced = JSON.parse(JSON.stringify(bundle));
  const removedFrom = removeToken(reduced, removable);
  assert(removedFrom, `"${removable}" was removed from the bundle for this test`);

  const afterRemoval = planSync(reduced, figma.readSnapshot());
  const orphan = afterRemoval.orphans.filter((o) => o.kind === 'variable' && o.name === figmaName(removable))[0];
  assert(Boolean(orphan), 'a variable whose token no longer exists is reported as an orphan',
    JSON.stringify(afterRemoval.orphans.slice(0, 3)));
  assert(afterRemoval.actions.length === 0, 'and nothing is written to remove it',
    afterRemoval.actions.slice(0, 3).map(describeAction).join(' | '));
  assert(!ACTION_OPS.some((op) => op.includes('delete') || op.includes('remove')),
    'the action vocabulary contains no delete operation at all');
}

/* ================================================================== *
 * 8. A third dimension, and the two-dimension case
 * ================================================================== */

process.stdout.write('\n6. Fixture: three dimensions, no code change\n');

const threeBundle = bundleTokenRoot(join(FIXTURES, 'three-dimensions'));
const threeSet = loadBundle(threeBundle);
const threePlan = planSync(threeBundle, emptySnapshot());

assert(threePlan.errors.length === 0, 'the three-dimension fixture plans cleanly',
  JSON.stringify(threePlan.errors.slice(0, 3), null, 1));
assert(threeSet.dimensions.length === 3, 'the fixture really does declare three dimensions');

const threeDimensionCollections = threePlan.collections.filter((c) => c.origin === 'dimension');
assert(threeDimensionCollections.length === 3, 'three dimensions become three collections',
  JSON.stringify(threePlan.collections.map((c) => `${c.name}:${c.modes.length}`)));
assert(threeDimensionCollections.every((c) => c.modes.length === 2),
  'each carries two modes — eight combinations, and no collection holds more than two',
  JSON.stringify(threeDimensionCollections.map((c) => `${c.name}:${c.modes.length}`)));
assert(threePlan.collections.some((c) => c.origin === 'layer' && c.name === 'semantic'),
  'a semantic that varies by nothing lands in a "semantic" collection rather than a dimension\'s');

const threeCreated = threePlan.actions.filter((a) => a.op === 'create-variable');
const collectionOfToken = (token) => (threeCreated.filter((a) => a.token === token)[0] || {}).collection;
assert(collectionOfToken('text.leading') === 'script', 'a token overridden by the third dimension lands in its collection');
assert(collectionOfToken('text.secondary') === 'product', 'the selector token belongs to the last-applied dimension it depends on');
assert(collectionOfToken('text.secondary-one') === 'theme', 'its slots belong to the dimension that sets them');

const selectorValues = threePlan.actions.filter((a) => a.op === 'set-value' && a.token === 'text.secondary');
assert(selectorValues.length === 2 && selectorValues.every((a) => a.to.kind === 'ALIAS' && a.to.collection === 'theme'),
  'the selector aliases a slot in the other collection, one per product mode — the two-dimension case, expressed',
  JSON.stringify(selectorValues.map(describeAction)));

const shadowSkip = threePlan.skipped.filter((s) => s.token === 'shadow.raised')[0];
assert(Boolean(shadowSkip) && /composite/i.test(shadowSkip.reason),
  'a composite DTCG type is reported as skipped, not flattened into something Figma would accept',
  JSON.stringify(shadowSkip));

const faceValue = threePlan.actions.filter((a) => a.op === 'set-value' && a.token === 'font-family.sans')[0];
assert(Boolean(faceValue) && faceValue.to.kind === 'STRING' && faceValue.to.value === 'System UI',
  'a font stack narrows to its first family — the one Figma can resolve to a font',
  JSON.stringify(faceValue && faceValue.to));
assert(threePlan.warnings.some((w) => w.code === 'value-narrowed'),
  'and the fallbacks that are not represented are named, not dropped quietly');

const threeFigma = new MemoryVariables();
const threeApply = applyPlan(threePlan, threeFigma);
assert(threeApply.failures.length === 0, 'the three-dimension plan applies with no failures',
  JSON.stringify(threeApply.failures.slice(0, 3).map((f) => f.message)));
assert(planSync(threeBundle, threeFigma.readSnapshot()).actions.length === 0,
  'and is idempotent too');

/* ================================================================== *
 * 9. The refusal
 * ================================================================== */

process.stdout.write('\n7. Fixture: a token varying by two dimensions is refused\n');

const crossBundle = bundleTokenRoot(join(FIXTURES, 'cross-dimension'));
const crossPlan = planSync(crossBundle, emptySnapshot());
const crossError = crossPlan.errors.filter((e) => e.code === 'cross-dimension-token')[0];

assert(Boolean(crossError), 'a token overridden by two dimensions is an error',
  JSON.stringify(crossPlan.errors.slice(0, 3)));
assert(Boolean(crossError) && /slot/i.test(crossError.message),
  'and the message names the slot convention that expresses it', crossError && crossError.message);
assert(!isApplicable(crossPlan), 'a plan with that error cannot be applied');
assert(!crossPlan.actions.some((a) => a.op === 'create-variable' && a.token === 'text.secondary'),
  'and no variable is planned for the offending token');

/* ================================================================== *
 * 10. Everything else in the file is left alone
 * ================================================================== */

process.stdout.write('\n8. Collections this plugin does not manage\n');

const handmade = new MemoryVariables();
const handmadeCollection = handmade.createCollection('a-collection-somebody-made');
handmade.createVariable(handmadeCollection.id, 'something/by-hand', 'COLOR');

const withHandmade = planSync(bundle, handmade.readSnapshot());
assert(withHandmade.untouched.includes('a-collection-somebody-made'),
  'a collection with no counterpart in the token root is listed as untouched',
  JSON.stringify(withHandmade.untouched));
assert(!withHandmade.actions.some((a) => a.collection === 'a-collection-somebody-made'),
  'and no action touches it');
assert(!withHandmade.orphans.some((o) => o.collection === 'a-collection-somebody-made'),
  'nor is anything inside it reported as an orphan — it is not this plugin\'s business');

/* ================================================================== *
 * Summary
 * ================================================================== */

process.stdout.write('\n');
process.stdout.write(`${plan.stats.tokensRead} tokens read, ${plan.stats.variablesPlanned} variables projected, `);
process.stdout.write(`${plan.skipped.length} skipped, ${plan.collections.length} collections\n`);
for (const collection of plan.collections) {
  process.stdout.write(
    `  ${collection.name.padEnd(12)} ${String(collection.variableCount).padStart(3)} variables  modes: ${collection.modes.join(', ')}\n`,
  );
}
if (plan.skipped.length > 0) {
  process.stdout.write('\nSkipped, with reasons:\n');
  for (const skip of plan.skipped) process.stdout.write(`  ${skip.token} (${skip.type}) — ${skip.reason}\n`);
}
if (plan.warnings.length > 0) {
  process.stdout.write('\nWarnings:\n');
  for (const warning of plan.warnings) process.stdout.write(`  ${warning.code}: ${warning.message}\n`);
}

process.stdout.write(`\n${passes.length} assertion(s) passed, ${failures.length} failed\n`);
process.exit(failures.length === 0 ? 0 : 1);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Remove one token from a bundle, pruning any group it leaves empty. */
function removeToken(target, path) {
  const segments = path.split('.');
  for (const file of Object.keys(target.files)) {
    if (file.indexOf('/') === -1 || file.startsWith('modes/')) continue;
    const document = target.files[file];
    const chain = [];
    let node = document;
    let found = true;
    for (const segment of segments) {
      if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, segment)) { found = false; break; }
      chain.push({ parent: node, key: segment });
      node = node[segment];
    }
    if (!found || !node || !Object.prototype.hasOwnProperty.call(node, '$value')) continue;
    const last = chain.pop();
    delete last.parent[last.key];
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const { parent, key } = chain[i];
      const remaining = Object.keys(parent[key]).filter((k) => k.charAt(0) !== '$');
      if (remaining.length === 0) delete parent[key]; else break;
    }
    return file;
  }
  return null;
}
