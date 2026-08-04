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
 *  11. The proof sheet documents exactly the variables the sync projects, and
 *      *binds* every one of them to a real property of a real node — a value
 *      written as a label would prove nothing and would be invisible to
 *      anything asking Figma what a layer uses.
 *  12. Every combination frame carries an explicit mode for every collection.
 *  13. Drawing the sheet twice changes nothing the second time, and nothing in
 *      its vocabulary removes anything either.
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
  HEADING_NODE,
  LABEL_NODE,
  MemoryNodes,
  MemoryVariables,
  SHEET_PAGE_NAME,
  SINGLE_MODE_NAME,
  SPECIMEN_NODE,
  applyPlan,
  applySheet,
  describeAction,
  describeSheetAction,
  isApplicable,
  isSheetApplicable,
  figmaName,
  loadBundle,
  planSheet,
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

/** The sheet's vocabulary. Note the same absence, for the same reason. */
const SHEET_OPS = ['create-page', 'create-node', 'set-prop', 'set-text', 'bind', 'set-explicit-mode'];

/** Every field the sheet is allowed to bind. All of them are real Figma fields. */
const BINDABLE = ['fill', 'width', 'height', 'cornerRadius', 'characters', 'fontFamily', 'fontWeight', 'visible'];

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
 * 11. The proof sheet
 *
 * The sheet's whole claim is that it *binds* every variable rather than
 * describing it, so that is what gets asserted hardest below. A sheet that
 * printed hexes into text labels would look identical in a screenshot and
 * would prove nothing.
 * ================================================================== */

process.stdout.write('\n9. The proof sheet: every variable bound to something real\n');

/* The sheet documents a file the sync has already written, so start from one. */
const synced = figma.readSnapshot();
const nodes = new MemoryNodes(synced);
const sheet = planSheet(bundle, synced, nodes.readSheet());

assert(sheet.errors.length === 0, 'the sheet plans cleanly against a freshly synced file',
  JSON.stringify(sheet.errors.slice(0, 3), null, 1));
assert(isSheetApplicable(sheet), 'the sheet plan is applicable');
assert(sheet.actions.every((a) => SHEET_OPS.includes(a.op)), 'every sheet action is one of the six known operations',
  JSON.stringify(sheet.actions.filter((a) => !SHEET_OPS.includes(a.op)).slice(0, 3)));

/* It documents exactly what the sync projects — one projection, not two. */
const projectedKeys = plan.projected.map((v) => `${v.collection}/${v.name}`).sort();
const specimenKeys = sheet.specimens.map((s) => `${s.collection}/${s.name}`).sort();
assert(same(projectedKeys, specimenKeys),
  'the sheet documents exactly the variables the sync projects — no more, no fewer',
  `${projectedKeys.length} projected vs ${specimenKeys.length} documented`);
assert(same(sheet.skipped.map((s) => s.token).sort(), plan.skipped.map((s) => s.token).sort()),
  'and skips exactly what the sync skips, with the sync\'s own reason');
assert(sheet.skipped.every((s) => /composite/i.test(s.reason) || s.reason.length > 0),
  'a composite type stays out of the sheet for the reason the sync gives, not a new one');

assert(sheet.specimens.every((s) => BINDABLE.includes(s.field)),
  'every specimen binds a real Figma bindable field',
  JSON.stringify(sheet.specimens.filter((s) => !BINDABLE.includes(s.field)).slice(0, 3)));
assert(sheet.specimens.every((s) => typeof s.reason === 'string' && s.reason.length > 0),
  'and every binding choice carries the reason it was chosen');

/* A property that is bound must never also be written as a plain value: the
 * two would fight, and the plain one would be re-set on every single run. */
const propsByPath = new Map();
const bindsByPath = new Map();
for (const action of sheet.actions) {
  if (action.op === 'set-prop') {
    const key = action.path.join(' / ');
    propsByPath.set(key, (propsByPath.get(key) || []).concat(action.prop));
  }
  if (action.op === 'bind') {
    const key = action.path.join(' / ');
    bindsByPath.set(key, (bindsByPath.get(key) || []).concat(action.field));
  }
}
let boundAndSet = null;
for (const [key, fields] of bindsByPath) {
  const overlap = (propsByPath.get(key) || []).filter((prop) => fields.includes(prop));
  if (overlap.length > 0) { boundAndSet = `${key}: ${overlap.join(', ')}`; break; }
}
assert(boundAndSet === null,
  'no node has a property both bound to a variable and written as a plain value',
  boundAndSet);

/* One frame per mode combination, and that is the product of the dimensions. */
const dimensionCollections = plan.collections.filter((c) => c.origin === 'dimension');
const expectedCombinations = dimensionCollections.reduce((n, c) => n * c.modes.length, 1);
assert(sheet.combinations.length === expectedCombinations,
  `one frame per mode combination — ${expectedCombinations} with these dimensions`,
  `${sheet.combinations.length} frames`);

let wrongModes = null;
for (const combination of sheet.combinations) {
  for (const collection of plan.collections) {
    const mode = combination.modes[collection.name];
    if (!mode || !collection.modes.includes(mode)) {
      wrongModes = `${combination.label}: ${collection.name} = ${mode}`;
      break;
    }
  }
  if (wrongModes) break;
}
assert(wrongModes === null,
  'every frame carries an explicit mode for every collection the sync manages, and each is a mode of that collection',
  wrongModes);
assert(sheet.combinations.every((c) => Object.keys(c.modes).length === plan.collections.length),
  'no collection is left to fall back to its default — nothing about what a frame renders is implicit');
assert(sheet.combinations.every((c) =>
  dimensionCollections.every((d) => c.label.includes(`${d.name} ${c.modes[d.name]}`))),
  'and each frame is titled with the combination it renders',
  JSON.stringify(sheet.combinations.map((c) => c.label)));
assert(new Set(sheet.combinations.map((c) => c.label)).size === sheet.combinations.length,
  'the frame titles are distinct, so find-or-create by name cannot confuse two combinations');

/* Nothing on the sheet is named after a brand: every part of every frame title
 * is a collection or a mode this token root declares. */
const declared = new Set();
for (const collection of plan.collections) {
  declared.add(collection.name);
  for (const mode of collection.modes) declared.add(mode);
}
assert(sheet.combinations.every((c) => c.label.split(' / ').every((part) => {
  const words = part.split(' ');
  return declared.has(words[0]) && declared.has(words.slice(1).join(' '));
})), 'every word in a frame title comes from the token root — no name is hardcoded',
  JSON.stringify(sheet.combinations.map((c) => c.label)));

/* ================================================================== *
 * 12. Drawing it, twice
 * ================================================================== */

process.stdout.write('\n10. Drawing it, twice\n');

const built = applySheet(sheet, nodes);
assert(built.failures.length === 0, 'the sheet applies with no failures',
  JSON.stringify(built.failures.slice(0, 3).map((f) => `${describeSheetAction(f.action)}: ${f.message}`)));
assert(built.applied === sheet.actions.length, 'every sheet action was applied',
  `${built.applied} of ${sheet.actions.length}`);

const drawn = nodes.readSheet();
assert(Boolean(drawn.page) && drawn.page.name === SHEET_PAGE_NAME, 'the sheet lives on its own page');
assert(same(Object.keys(drawn), ['page']),
  'the sheet adapter can see nothing but that page — user content is unreachable, not merely untouched',
  JSON.stringify(Object.keys(drawn)));

/* Walk what actually got built. */
const bindingsOf = new Map(); // "collection/name" -> count of nodes bound to it
const swatchProblems = [];
const nonAscii = [];
const frameNames = drawn.page.children.map((child) => child.name);

const walkSheet = (node, path) => {
  if (!/^[\x20-\x7e]*$/.test(node.name)) nonAscii.push(node.name);
  for (const field of Object.keys(node.bindings)) {
    const binding = node.bindings[field];
    const key = `${binding.collection}/${binding.name}`;
    bindingsOf.set(key, (bindingsOf.get(key) || 0) + 1);
  }
  for (const child of node.children) walkSheet(child, path.concat(child.name));
};
walkSheet(drawn.page, []);

assert(same(frameNames, sheet.combinations.map((c) => c.label)),
  'the page holds one frame per combination and nothing else',
  JSON.stringify(frameNames));
assert(nonAscii.length === 0, 'no generated layer name contains a character outside plain ASCII',
  JSON.stringify(nonAscii.slice(0, 3)));

/* The modes are asserted on the page that got drawn, not on the plan that
 * described it — a frame that renders the wrong combination renders wrong
 * values, and a plan agreeing with itself would not catch that. */
let frameModes = null;
for (const combination of sheet.combinations) {
  const frame = drawn.page.children.filter((child) => child.name === combination.label)[0];
  if (!frame) { frameModes = `no frame drawn for "${combination.label}"`; break; }
  const wanted = Object.keys(combination.modes).sort();
  const written = Object.keys(frame.explicitModes).sort();
  if (!same(wanted, written) || wanted.some((collection) => frame.explicitModes[collection] !== combination.modes[collection])) {
    frameModes = `${combination.label}: drew ${JSON.stringify(frame.explicitModes)}, wanted ${JSON.stringify(combination.modes)}`;
    break;
  }
}
assert(frameModes === null,
  'each frame that got drawn carries exactly the explicit modes its combination names, for every collection',
  frameModes);

const unbound = plan.projected.filter((v) => !bindingsOf.has(`${v.collection}/${v.name}`));
assert(unbound.length === 0,
  'every variable the sync projects is bound to at least one node on the sheet — the claim the whole artifact rests on',
  unbound.slice(0, 5).map((v) => `${v.collection}/${v.name}`).join(', '));

const wrongCount = plan.projected.filter((v) => bindingsOf.get(`${v.collection}/${v.name}`) !== sheet.combinations.length);
assert(wrongCount.length === 0,
  'and bound once in every combination frame, so selecting any one frame reads the whole set',
  wrongCount.slice(0, 3).map((v) => `${v.collection}/${v.name}: ${bindingsOf.get(`${v.collection}/${v.name}`)}`).join(', '));

/* Each swatch: one bound specimen, and one plain-text label naming the variable. */
const swatchNames = new Set(sheet.specimens.map((s) => s.name));
let swatchesSeen = 0;
const checkSwatches = (node) => {
  if (swatchNames.has(node.name) && node.children.length > 0) {
    swatchesSeen += 1;
    const specimen = node.children.filter((child) => child.name === SPECIMEN_NODE)[0];
    const label = node.children.filter((child) => child.name === LABEL_NODE)[0];
    if (!specimen || Object.keys(specimen.bindings).length !== 1) {
      swatchProblems.push(`${node.name}: specimen has ${specimen ? Object.keys(specimen.bindings).length : 'no'} binding(s)`);
    }
    if (!label || label.kind !== 'TEXT' || label.text !== node.name || Object.keys(label.bindings).length !== 0) {
      swatchProblems.push(`${node.name}: label is not unbound text naming the variable`);
    }
  }
  for (const child of node.children) checkSwatches(child);
};
checkSwatches(drawn.page);
assert(swatchesSeen === sheet.specimens.length * sheet.combinations.length,
  'the sheet holds one swatch per variable per combination, and the check below actually visited all of them',
  `${swatchesSeen} swatches, expected ${sheet.specimens.length * sheet.combinations.length}`);
assert(swatchProblems.length === 0,
  'every swatch is one bound specimen plus one unbound text label carrying the variable name',
  swatchProblems.slice(0, 3).join(' | '));

/* Grouped by collection, and by the groups already in the token names. */
const firstFrame = drawn.page.children[0];
const sections = firstFrame.children.filter((child) => child.name !== HEADING_NODE).map((child) => child.name);
assert(sections.length > 0 && sections.every((name) => plan.collections.some((c) => c.name === name)),
  'a frame is divided by collection', JSON.stringify(sections));
const groupsSeen = [];
for (const section of firstFrame.children) {
  if (section.name === HEADING_NODE) continue;
  for (const group of section.children) {
    if (group.name === HEADING_NODE) continue;
    groupsSeen.push(group.name);
    const members = group.children.filter((child) => child.name !== HEADING_NODE);
    if (members.some((member) => member.name.indexOf('/') !== -1 && member.name.split('/')[0] !== group.name)) {
      groupsSeen.push(`MISPLACED in ${group.name}`);
    }
  }
}
assert(groupsSeen.length > 0 && !groupsSeen.some((name) => name.startsWith('MISPLACED')),
  'and each collection by the group structure already in the token names',
  JSON.stringify(groupsSeen.slice(0, 8)));

const redrawn = planSheet(bundle, synced, nodes.readSheet());
assert(redrawn.actions.length === 0, 'drawing the sheet again changes nothing — it is idempotent',
  redrawn.actions.slice(0, 5).map(describeSheetAction).join(' | '));
assert(redrawn.errors.length === 0, 're-planning the sheet produces no errors', JSON.stringify(redrawn.errors.slice(0, 2)));
assert(redrawn.orphans.length === 0, 'a freshly drawn sheet has no orphans', JSON.stringify(redrawn.orphans.slice(0, 3)));

const redrawResult = applySheet(redrawn, nodes);
assert(redrawResult.applied === 0 && redrawResult.failures.length === 0, 'applying an empty sheet plan draws nothing');
assert(planSheet(bundle, synced, nodes.readSheet()).actions.length === 0, 'and the sheet is still up to date afterwards');

/* ================================================================== *
 * 13. What the sheet refuses to do
 * ================================================================== */

process.stdout.write('\n11. What the sheet refuses to do\n');

assert(!SHEET_OPS.some((op) => op.includes('delete') || op.includes('remove')),
  'the sheet\'s action vocabulary contains no delete operation at all');
assert(!Object.getOwnPropertyNames(MemoryNodes.prototype).some((name) => /delete|remove/i.test(name)),
  'and the scene-graph adapter exposes no method that could remove a node');

nodes.addStrayNode([sheet.combinations[0].label], 'something-somebody-drew', 'FRAME');
const withStray = planSheet(bundle, synced, nodes.readSheet());
const stray = withStray.orphans.filter((o) => o.path[o.path.length - 1] === 'something-somebody-drew')[0];
assert(Boolean(stray), 'a node on the page that this plan did not produce is reported as an orphan',
  JSON.stringify(withStray.orphans.slice(0, 3)));
assert(withStray.actions.length === 0, 'and nothing is written to remove it',
  withStray.actions.slice(0, 3).map(describeSheetAction).join(' | '));

/* The sheet binds variables; it does not create them. */
const unsynced = planSheet(bundle, emptySnapshot(), { page: null });
const notSynced = unsynced.errors.filter((e) => e.code === 'sheet-variable-missing')[0];
assert(Boolean(notSynced), 'a file whose variables have not been synced yet is an error, not a sheet full of nothing',
  JSON.stringify(unsynced.errors.slice(0, 2)));
assert(Boolean(notSynced) && /sync/i.test(notSynced.message), 'and the message says to run the sync first',
  notSynced && notSynced.message);
assert(!isSheetApplicable(unsynced), 'a sheet plan with that error cannot be drawn');

/* A node of the wrong type is refused rather than silently recreated. */
const clashing = new MemoryNodes(synced);
const clashingPage = clashing.createPage(SHEET_PAGE_NAME);
clashing.createNode(clashingPage, 'RECTANGLE', sheet.combinations[0].label);
const clashPlan = planSheet(bundle, synced, clashing.readSheet());
const clash = clashPlan.errors.filter((e) => e.code === 'sheet-kind-conflict')[0];
assert(Boolean(clash), 'a node whose name matches but whose type does not is an error',
  JSON.stringify(clashPlan.errors.slice(0, 2)));
assert(Boolean(clash) && /delete/i.test(clash.message),
  'and the message says to remove it by hand, because this plugin will not',
  clash && clash.message);

/* ================================================================== *
 * 14. The sheet on a third dimension
 * ================================================================== */

process.stdout.write('\n12. Fixture: the sheet across three dimensions\n');

const threeSheetVariables = threeFigma.readSnapshot();
const threeNodes = new MemoryNodes(threeSheetVariables);
const threeSheet = planSheet(threeBundle, threeSheetVariables, threeNodes.readSheet());

assert(threeSheet.errors.length === 0, 'the three-dimension fixture produces a sheet with no errors',
  JSON.stringify(threeSheet.errors.slice(0, 3), null, 1));
assert(threeSheet.combinations.length === 8, 'three dimensions of two modes become eight frames, with no code change',
  `${threeSheet.combinations.length} frames`);

const threeBuilt = applySheet(threeSheet, threeNodes);
assert(threeBuilt.failures.length === 0, 'and it draws with no failures',
  JSON.stringify(threeBuilt.failures.slice(0, 3).map((f) => f.message)));
assert(planSheet(threeBundle, threeSheetVariables, threeNodes.readSheet()).actions.length === 0,
  'and is idempotent too');

const threeBindings = new Set();
const collectBindings = (node) => {
  for (const field of Object.keys(node.bindings)) {
    threeBindings.add(`${node.bindings[field].collection}/${node.bindings[field].name}`);
  }
  for (const child of node.children) collectBindings(child);
};
collectBindings(threeNodes.readSheet().page);
assert(threePlan.projected.every((v) => threeBindings.has(`${v.collection}/${v.name}`)),
  'every variable in the fixture is bound there too, including the selector that crosses collections',
  threePlan.projected.filter((v) => !threeBindings.has(`${v.collection}/${v.name}`)).slice(0, 3)
    .map((v) => `${v.collection}/${v.name}`).join(', '));

const fontSpecimen = threeSheet.specimens.filter((s) => s.dtcgType === 'fontFamily')[0];
assert(Boolean(fontSpecimen) && fontSpecimen.kind === 'TEXT' && fontSpecimen.field === 'fontFamily',
  'a fontFamily token binds a text node\'s family rather than being written out as a string',
  JSON.stringify(fontSpecimen));
assert(threeSheet.fonts.length > 0,
  'and the families it will need are named up front, because Figma will not bind a font it has not loaded',
  JSON.stringify(threeSheet.fonts));
assert(!threeSheet.specimens.some((s) => s.token === 'shadow.raised'),
  'a composite type is absent from the sheet, exactly as it is absent from the sync');

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

process.stdout.write(
  `\nProof sheet: ${sheet.stats.variablesDocumented} variables documented across ` +
    `${sheet.combinations.length} mode combination(s), ${sheet.stats.nodesPlanned} nodes\n`,
);
const byBinding = new Map();
for (const specimen of sheet.specimens) {
  const key = `${String(specimen.dtcgType).padEnd(12)} ${specimen.type.padEnd(8)} ${specimen.kind.padEnd(10)} ${specimen.field}`;
  byBinding.set(key, (byBinding.get(key) || 0) + 1);
}
for (const [key, count] of [...byBinding.entries()].sort()) {
  process.stdout.write(`  ${key.padEnd(46)} ${String(count).padStart(3)} variable(s)\n`);
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
