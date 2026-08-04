#!/usr/bin/env node
/**
 * check-drift.mjs — governance rung 2: does the Figma file still agree with the
 * token source?
 *
 * Rung 1 (check-schema, check-contrast) checks the token source against itself.
 * This checks the *display* against the source. Figma is a display, never a
 * source: sync is one-way, always outward. So every disagreement this finds has
 * exactly one legitimate resolution — re-generate the Figma variables from the
 * token JSON — and every finding carries that direction in its `remedy`. There
 * is deliberately no mechanism here for reading a Figma value back into the
 * tokens, and there should never be one. This is a report, not a merge tool.
 *
 * Brand-agnostic: it is pointed at a token root and a Figma snapshot and
 * discovers everything else. No mode name, collection name, product name or
 * token name is written in this file.
 *
 * Usage:
 *   node machinery/scripts/check-drift.mjs [--root <dir>] [--snapshot <file>]
 *                                          [--file-key <key>] [--bridge]
 *                                          [--bridge-port <n>] [--bridge-timeout <s>]
 *                                          [--save-snapshot <file>]
 *                                          [--json] [--quiet]
 *
 *   --root <dir>           token root. Defaults to $TOKENS_ROOT, then to the
 *                          repository's content/tokens.
 *   --snapshot <file>      a saved Figma variables payload. Offline, no
 *                          credentials, reproducible — this is what makes the
 *                          detector testable in CI and in the selftest.
 *   --file-key <key>       fetch live instead. Defaults to $FIGMA_FILE_KEY.
 *                          Needs $FIGMA_TOKEN, and an Enterprise plan.
 *   --bridge               read the live variables from a running Mizan Sync
 *                          plugin over localhost. The route for every plan
 *                          below Enterprise. Needs Figma Desktop open with the
 *                          plugin running — a person, not a service.
 *   --bridge-port <n>      default 8791, which the plugin manifest also names.
 *   --bridge-timeout <s>   how long to wait for the plugin. Default 60.
 *   --save-snapshot <file> write the payload to disk, whichever source it came
 *                          from, so a live run becomes an offline fixture.
 *                          Refused if it points inside --root: see below.
 *   --json                 machine-readable output on stdout.
 *   --quiet                suppress the passing summary; drift still prints.
 *
 * Three sources, one comparison. `--snapshot` wins over `--bridge`, which wins
 * over `--file-key`, and the order is not arbitrary: the offline path is the
 * one that runs in CI and in the selftest, so it stays the default and the
 * privileged one. A live read is a convenience laid beside it, never a
 * replacement for it.
 *
 * `--save-snapshot` will not write inside `--root`, and the refusal is a check
 * rather than a warning. `lib/tokens.mjs` loads every `.json` under every
 * subdirectory of the token root, so a snapshot saved there is read back as
 * tokens on the very next run — which is a Figma value becoming a source, the
 * one thing rule 1 forbids, arriving by a path nobody chose. It is checkable, so
 * it is checked.
 *
 * Exits 1 on any drift or error, 0 when the display agrees with the source.
 *
 * ---------------------------------------------------------------------------
 * The snapshot format
 * ---------------------------------------------------------------------------
 *
 * Exactly the payload of Figma's read endpoint for local variables,
 * `GET /v1/files/<file-key>/variables/local`, saved verbatim. Either the whole
 * response or its `meta` object alone is accepted, so `curl … > snapshot.json`
 * and a plugin's own export both work with no massaging:
 *
 *   {
 *     "meta": {
 *       "variableCollections": {
 *         "<collectionId>": {
 *           "id": "<collectionId>",
 *           "name": "<collection name>",
 *           "modes": [ { "modeId": "<modeId>", "name": "<mode name>" } ],
 *           "defaultModeId": "<modeId>"
 *         }
 *       },
 *       "variables": {
 *         "<variableId>": {
 *           "id": "<variableId>",
 *           "name": "group/subgroup/leaf",
 *           "variableCollectionId": "<collectionId>",
 *           "resolvedType": "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
 *           "description": "",
 *           "valuesByMode": {
 *             "<modeId>": { "r": 1, "g": 1, "b": 1, "a": 1 }
 *                       |  { "type": "VARIABLE_ALIAS", "id": "<variableId>" }
 *                       |  <number> | <string> | <boolean>
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 * Two conventions turn that into something comparable, and both are rules
 * rather than values:
 *
 *   Names.  Figma groups with "/", DTCG paths join with ".", so the variable
 *           "text/primary" is the token path "text.primary". Nothing else is
 *           stripped or rewritten.
 *
 *   Modes.  A Figma collection carries modes; a token root carries mode
 *           *dimensions*. A collection whose name and mode names resolve to a
 *           known mode id — "<collection>.<mode>" first, then "<mode>" — is that
 *           dimension. A collection with a single mode is taken as invariant and
 *           compared against every combination. A collection with several modes,
 *           one of which resolves to nothing, is a mode Figma has and the source
 *           does not: warned about, and its values skipped, because there is no
 *           source value to compare them to.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import {
  Diagnostics,
  aliasTarget,
  combinationLabel,
  composeModes,
  defaultTokensRoot,
  displayPath,
  isEmptyTokenSet,
  isPlainObject,
  loadTokenSet,
  parseArgs,
  parseColor,
  readJson,
  resolveTokens,
} from './lib/tokens.mjs';
import { narrowFontStack } from './lib/projection.mjs';
import { BRIDGE_PORT, BRIDGE_TIMEOUT_MS, readSnapshotOverBridge } from './lib/bridge.mjs';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** Figma's read endpoint for a file's local variables. */
const FIGMA_API = 'https://api.figma.com/v1/files';

/** Figma groups variable names with a slash; DTCG paths join with a dot. */
const FIGMA_NAME_SEPARATOR = '/';

/**
 * The projection, mirrored.
 *
 * `machinery/figma-plugin/src/core/map.ts` decides what a token becomes when it
 * is written to Figma. This file has to decide what a token *should* look like
 * once it is there, which is the same question. The two are deliberately the
 * same rules and are kept the same rules: a detector more lenient than the
 * syncer calls a file aligned that the syncer would still rewrite, and a
 * detector stricter than the syncer reports drift nobody can fix.
 *
 * Kept in step by hand, because a gate that needs a TypeScript build to run is
 * not a gate. If `map.ts` changes, this changes with it.
 *
 * One rule is exempt from that arrangement and lives in `lib/projection.mjs`,
 * which both sides import: narrowing a font stack to its first family. A
 * mirrored rule that disagrees produces a finding somebody can read and fix; a
 * *lossy* rule that disagrees produces drift no sync can ever clear, because the
 * writer discards the information the reader would need to agree. That one is
 * shared code, not a shared comment.
 */

/** DTCG composites. Figma has no composite variable — these are styles. */
const COMPOSITE_TYPES = new Set([
  'shadow', 'typography', 'border', 'transition', 'gradient', 'strokeStyle', 'cubicBezier',
]);

/** Where a DTCG `$type` lands unconditionally. */
const TYPE_TABLE = Object.freeze({
  color: 'COLOR',
  dimension: 'FLOAT',
  number: 'FLOAT',
  duration: 'FLOAT',
  fontFamily: 'STRING',
  string: 'STRING',
  boolean: 'BOOLEAN',
});

/**
 * Every drift class, and the fix for it — which always runs outward.
 *
 * The remedies are the whole point of the file. "Copy the Figma value into the
 * token" appears nowhere, because that is the one repair the system forbids: it
 * would make the display a source, and the next sync would silently undo it.
 */
const DRIFT_CLASSES = Object.freeze({
  'missing-in-figma': {
    label: 'Missing in Figma',
    summary: 'The source defines this token; the Figma file has no variable for it.',
    remedy: 'Re-sync outward. The variable has not been generated yet — nothing needs deciding.',
  },
  'orphan-in-figma': {
    label: 'Orphan in Figma',
    summary: 'The Figma file has a variable the source never defined. Somebody created it by hand.',
    remedy: 'Delete the variable in Figma. If the concept is wanted, it is authored in the token source first and arrives here by sync.',
  },
  'value-mismatch': {
    label: 'Value mismatch',
    summary: 'The variable holds a different value from the token it stands for.',
    remedy: 'Re-sync outward. The Figma value is discarded — it was hand-edited, and the source is the decision.',
  },
  'alias-flattened': {
    label: 'Alias flattened',
    summary: 'The token references a primitive; the variable holds a raw value instead. The reference chain has been broken.',
    remedy: 'Re-sync outward to restore the reference. The value may still look right today, which is exactly why this is the worst class: the link is what the system protects, and a flattened variable stops moving when the primitive moves.',
  },
  'alias-unexpected': {
    label: 'Alias where the source has a value',
    summary: 'The token states a literal; the variable points at another variable.',
    remedy: 'Re-sync outward. A reference invented in Figma is a structural decision taken outside the source.',
  },
  'alias-target-mismatch': {
    label: 'Alias points elsewhere',
    summary: 'Both sides reference, but at different targets.',
    remedy: 'Re-sync outward. The source decides which primitive a semantic name resolves to.',
  },
  'type-mismatch': {
    label: 'Type mismatch',
    summary: 'The variable\'s resolved type does not match the token\'s $type.',
    remedy: 'Delete and re-sync outward. A variable of the wrong type cannot be corrected in place and was not generated by the sync.',
  },
  'description-drift': {
    label: 'Description drift',
    summary: 'The variable\'s description differs from the token\'s $description.',
    remedy: 'Re-sync outward. Descriptions are documentation at the moment of use; editing them in Figma forks the documentation from the decision.',
  },
});

/**
 * Numeric tolerance, colours included. 1e-6 is what the sync plugin compares
 * with, and it has to be the same number: at 8-bit resolution this gate would
 * call a file aligned that the plugin's own diff still lists as a change.
 * It is far below one 8-bit colour step (1/255 ≈ 0.0039), so a real edit
 * cannot hide inside it.
 */
const NUMBER_EPSILON = 1e-6;

/* ------------------------------------------------------------------ *
 * Snapshot loading
 * ------------------------------------------------------------------ */

/** Accept the whole API response or its `meta` object alone. */
function unwrapSnapshot(data) {
  if (!isPlainObject(data)) return null;
  if (isPlainObject(data.meta)) return data.meta;
  if (isPlainObject(data.variables) || isPlainObject(data.variableCollections)) return data;
  return null;
}

async function fetchSnapshot(fileKey, token) {
  const url = `${FIGMA_API}/${encodeURIComponent(fileKey)}/variables/local`;
  const response = await fetch(url, { headers: { 'X-Figma-Token': token } });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Figma responded ${response.status} ${response.statusText}: ${body.slice(0, 400)}`);
  }
  return JSON.parse(body);
}

/**
 * Normalise a snapshot into what the comparison needs: variables keyed by the
 * token path their name maps to, collections keyed by id.
 */
function normaliseSnapshot(meta, diagnostics, sourceLabel) {
  const collections = new Map();
  for (const [id, raw] of Object.entries(meta.variableCollections ?? {})) {
    if (!isPlainObject(raw)) continue;
    const modes = Array.isArray(raw.modes) ? raw.modes : [];
    collections.set(id, {
      id,
      name: typeof raw.name === 'string' ? raw.name : id,
      modes: modes
        .filter((mode) => isPlainObject(mode) && typeof mode.modeId === 'string')
        .map((mode) => ({ modeId: mode.modeId, name: typeof mode.name === 'string' ? mode.name : mode.modeId })),
      defaultModeId: raw.defaultModeId,
    });
  }

  const byId = new Map();
  const byPath = new Map();
  const duplicates = [];

  for (const [id, raw] of Object.entries(meta.variables ?? {})) {
    if (!isPlainObject(raw)) continue;
    if (typeof raw.name !== 'string' || raw.name.trim() === '') {
      diagnostics.error('invalid-snapshot', `Variable ${id} has no name.`, { file: sourceLabel });
      continue;
    }
    const path = raw.name.split(FIGMA_NAME_SEPARATOR).map((segment) => segment.trim()).join('.');
    const variable = {
      id,
      name: raw.name,
      path,
      resolvedType: raw.resolvedType,
      description: typeof raw.description === 'string' ? raw.description : '',
      collectionId: raw.variableCollectionId,
      collection: collections.get(raw.variableCollectionId) ?? null,
      valuesByMode: isPlainObject(raw.valuesByMode) ? raw.valuesByMode : {},
    };
    byId.set(id, variable);
    if (byPath.has(path)) duplicates.push(path);
    else byPath.set(path, variable);
  }

  for (const path of new Set(duplicates)) {
    diagnostics.error(
      'duplicate-variable',
      `Two Figma variables map to the token path "${path}". A path names one decision, so it can only have one display.`,
      { file: sourceLabel, token: path },
    );
  }

  return { collections, byId, byPath };
}

/* ------------------------------------------------------------------ *
 * Mode mapping
 * ------------------------------------------------------------------ */

/**
 * Map each Figma collection mode onto a token mode id.
 *
 * "<collection>.<mode>" is tried before "<mode>" so that a token root using the
 * dimension-prefixed filename convention matches without the collection having
 * to repeat itself, and a root using bare mode names still matches.
 */
function mapModes(snapshot, set, diagnostics, sourceLabel) {
  const known = new Set(set.modes.keys());
  const mapping = new Map(); // collectionId -> Map(modeId -> tokenModeId|null)

  for (const collection of snapshot.collections.values()) {
    const modes = new Map();
    for (const mode of collection.modes) {
      const qualified = `${collection.name}.${mode.name}`;
      const tokenModeId = known.has(qualified) ? qualified : (known.has(mode.name) ? mode.name : null);
      modes.set(mode.modeId, tokenModeId);
      if (tokenModeId === null && collection.modes.length > 1) {
        diagnostics.warn(
          'figma-mode-unknown',
          `Collection "${collection.name}" has a mode "${mode.name}" that matches no mode in the token source (looked for "${qualified}" and "${mode.name}"). Values in it are skipped: there is no source value to compare them against. A mode that exists only in Figma is a decision taken in the display.`,
          { file: sourceLabel, mode: `${collection.name}.${mode.name}` },
        );
      }
    }
    mapping.set(collection.id, modes);
  }
  return mapping;
}

/**
 * Which token mode combinations a Figma mode speaks for.
 *
 * A mapped mode selects every combination containing it. An unmapped mode in a
 * single-mode collection is invariant and selects every combination. An unmapped
 * mode in a multi-mode collection selects nothing — it has already been warned
 * about.
 */
function combinationsFor(set, collection, tokenModeId) {
  if (tokenModeId !== null) return set.combinations.filter((combo) => combo.includes(tokenModeId));
  if (collection && collection.modes.length > 1) return [];
  return set.combinations;
}

/* ------------------------------------------------------------------ *
 * Value shaping
 * ------------------------------------------------------------------ */

function figmaAlias(value) {
  return isPlainObject(value) && value.type === 'VARIABLE_ALIAS' && typeof value.id === 'string'
    ? value.id
    : null;
}

function hexOf(components, alpha) {
  const byte = (n) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0');
  const rgb = components.map(byte).join('');
  return alpha >= 1 - NUMBER_EPSILON ? `#${rgb}` : `#${rgb}${byte(alpha)}`;
}

/** The Figma type a DTCG type lands on. Mirrors `figmaTypeFor` in map.ts. */
function figmaTypeFor(type, value) {
  if (type && COMPOSITE_TYPES.has(type)) return undefined;
  if (type && TYPE_TABLE[type]) return TYPE_TABLE[type];
  // fontWeight is value-dependent: DTCG allows 700 and "bold".
  if (type === 'fontWeight') return typeof value === 'number' ? 'FLOAT' : 'STRING';
  if (type) return undefined;
  if (typeof value === 'number') return 'FLOAT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'string') return 'STRING';
  if (isPlainObject(value) && typeof value.colorSpace === 'string') return 'COLOR';
  if (isPlainObject(value) && typeof value.value === 'number' && typeof value.unit === 'string') return 'FLOAT';
  return undefined;
}

/**
 * A resolved DTCG value, reduced to what the sync plugin would have written.
 *
 * Every refusal here is a refusal `map.ts` also makes, for the same reason: a
 * value that would need invented information — a root font size, a colour space
 * reinterpreted as sRGB, a composite flattened — is reported as having no Figma
 * form rather than compared against a guess.
 */
function tokenSideValue(type, value) {
  if (type && COMPOSITE_TYPES.has(type)) {
    return { ok: false, reason: `"${type}" is a composite DTCG type; Figma models it as a style, not a variable` };
  }
  const kind = figmaTypeFor(type, value);
  if (kind === undefined) {
    return { ok: false, reason: `no Figma variable type for $type ${JSON.stringify(type)}` };
  }

  if (kind === 'COLOR') {
    const parsed = parseColor(value);
    if (!parsed.ok) return { ok: false, reason: parsed.message };
    return {
      ok: true,
      kind,
      components: parsed.color.components,
      alpha: parsed.color.alpha,
      display: hexOf(parsed.color.components, parsed.color.alpha),
      precise: `rgba(${parsed.color.components.join(', ')}, ${parsed.color.alpha})`,
    };
  }

  if (kind === 'FLOAT') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { ok: true, kind, number: value, display: String(value) };
    }
    if (isPlainObject(value) && typeof value.value === 'number' && typeof value.unit === 'string') {
      if (value.unit === 'px') {
        return { ok: true, kind, number: value.value, display: `${value.value}${value.unit}` };
      }
      if (type === 'duration' && (value.unit === 'ms' || value.unit === 's')) {
        const ms = value.unit === 's' ? value.value * 1000 : value.value;
        return { ok: true, kind, number: ms, display: `${ms}ms` };
      }
      return {
        ok: false,
        reason: `dimension unit "${value.unit}" has no Figma form: a FLOAT is unitless, and converting would assume a root size the token does not state`,
      };
    }
    return { ok: false, reason: `expected a number or a px dimension; got ${JSON.stringify(value)}` };
  }

  if (kind === 'BOOLEAN') {
    if (typeof value === 'boolean') return { ok: true, kind, boolean: value, display: String(value) };
    return { ok: false, reason: `expected a boolean; got ${JSON.stringify(value)}` };
  }

  if (typeof value === 'string') return { ok: true, kind, string: value, display: value };

  /* A DTCG fontFamily may be a stack; a Figma STRING holds one value. Which one
   * is not decided here — `lib/projection.mjs` decides it, and the sync plugin
   * imports the same function. This is the one rule the two sides cannot state
   * separately: a stack narrowed differently at each end is drift no sync can
   * ever clear. See that file for why it is the exception. */
  const narrowed = narrowFontStack(value);
  if (narrowed !== null) {
    return { ok: true, kind, string: narrowed.family, display: narrowed.family, note: narrowed.note };
  }
  return { ok: false, reason: `expected a string or a list of strings; got ${JSON.stringify(value)}` };
}

/** A raw Figma variable value, reduced to the same shape. */
function figmaSideValue(resolvedType, value) {
  if (resolvedType === 'COLOR') {
    if (!isPlainObject(value) || typeof value.r !== 'number' || typeof value.g !== 'number' || typeof value.b !== 'number') {
      return { ok: false, reason: `colour must be {r, g, b, a}; got ${JSON.stringify(value)}` };
    }
    const components = [value.r, value.g, value.b];
    const alpha = typeof value.a === 'number' ? value.a : 1;
    return {
      ok: true, kind: 'COLOR', components, alpha,
      display: hexOf(components, alpha),
      precise: `rgba(${components.join(', ')}, ${alpha})`,
    };
  }
  if (resolvedType === 'FLOAT') {
    if (typeof value !== 'number') return { ok: false, reason: `FLOAT must be a number; got ${JSON.stringify(value)}` };
    return { ok: true, kind: 'FLOAT', number: value, display: String(value) };
  }
  if (resolvedType === 'BOOLEAN') {
    if (typeof value !== 'boolean') return { ok: false, reason: `BOOLEAN must be true or false; got ${JSON.stringify(value)}` };
    return { ok: true, kind: 'BOOLEAN', boolean: value, display: String(value) };
  }
  if (typeof value !== 'string') return { ok: false, reason: `STRING must be a string; got ${JSON.stringify(value)}` };
  return { ok: true, kind: 'STRING', string: value, display: value };
}

function sameValue(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'COLOR') {
    return a.components.every((channel, i) => Math.abs(channel - b.components[i]) < NUMBER_EPSILON)
      && Math.abs(a.alpha - b.alpha) < NUMBER_EPSILON;
  }
  if (a.kind === 'FLOAT') return Math.abs(a.number - b.number) < NUMBER_EPSILON;
  if (a.kind === 'BOOLEAN') return a.boolean === b.boolean;
  return a.string === b.string;
}

/**
 * The description a variable should carry. Mirrors `describeToken` in plan.ts:
 * a deprecation marker, then the token's own `$description`, so the reasoning
 * travels with the value and a designer hovering the variable reads the same
 * sentence a developer reads in the JSON.
 */
function expectedDescription(node) {
  const parts = [];
  if (node.deprecated) {
    parts.push(typeof node.deprecated === 'string' ? `[deprecated: ${node.deprecated}]` : '[deprecated]');
  }
  if (node.description) parts.push(node.description);
  return normaliseDescription(parts.join(' '));
}

function normaliseDescription(text) {
  return typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

function finding(code, extra) {
  const meta = DRIFT_CLASSES[code];
  return { code, label: meta.label, remedy: meta.remedy, ...extra };
}

/**
 * Compare one Figma variable against one token, in one Figma mode.
 *
 * A Figma mode speaks for one or more token mode combinations — a mode in the
 * theme collection speaks for every combination containing that theme. The
 * token is resolved in each of them and the results are grouped by what the
 * source actually says, so an invariant token reports one finding rather than
 * one per combination, while a token that varies along a dimension the Figma
 * collection does not model reports each distinct source value against the one
 * value Figma holds. Nothing is silently picked.
 */
function compareInMode(context) {
  const { variable, modeId, modeName, combos, composedByLabel, resolvedByLabel, node, findings } = context;
  const actualRaw = variable.valuesByMode[modeId];

  if (actualRaw === undefined) {
    findings.push(finding('missing-in-figma', {
      token: node.path,
      variable: variable.name,
      mode: modeName,
      expected: { kind: 'value', display: '(a value)' },
      actual: { kind: 'absent', display: '(no value in this mode)' },
      message: `Variable "${variable.name}" has no value in mode "${modeName}".`,
    }));
    return;
  }

  const actualAliasId = figmaAlias(actualRaw);
  const actualTarget = actualAliasId === null ? null : context.snapshot.byId.get(actualAliasId);
  const actualPath = actualTarget ? actualTarget.path : null;
  const modeSuffix = modeName === null ? '' : ` [Figma mode "${modeName}"]`;

  /* What the source says, grouped: one entry per distinct source value, each
   * carrying the combinations that produced it. */
  const groups = new Map();
  for (const combo of combos) {
    const label = combinationLabel(combo);
    const composedNode = composedByLabel.get(label).get(node.path);
    const resolvedNode = resolvedByLabel.get(label).get(node.path);
    if (!composedNode || !resolvedNode) continue; // unresolvable — rung 1's problem, not this gate's

    const expectedAlias = aliasTarget(composedNode.rawValue);
    const expectedValue = tokenSideValue(resolvedNode.type, resolvedNode.value);
    const key = `${expectedAlias ?? ''}\u0000${expectedValue.ok ? expectedValue.display : expectedValue.reason}`;
    if (!groups.has(key)) groups.set(key, { expectedAlias, expectedValue, labels: [] });
    groups.get(key).labels.push(label);
  }

  for (const { expectedAlias, expectedValue, labels } of groups.values()) {
    // A token that says the same thing in every combination says it once here.
    // Spelling out four identical combinations buries the ones that differ.
    const label = labels.length === context.totalCombinations && labels.length > 1
      ? 'every combination'
      : labels.join(', ');
    const where = { token: node.path, variable: variable.name, mode: modeName, tokenMode: label, tokenModes: labels };

    /* Structure first. A flattened reference is a different defect from a wrong
     * value, and reporting it as a value mismatch — or not at all, when the
     * flattened value happens to be correct — is how the chain quietly dies. */
    if (expectedAlias !== null && actualAliasId === null) {
      findings.push(finding('alias-flattened', {
        ...where,
        expected: { kind: 'alias', display: `{${expectedAlias}}`, resolves: expectedValue.ok ? expectedValue.display : undefined },
        actual: { kind: 'value', display: describeFigmaValue(variable, actualRaw), color: colorOf(figmaSideValue(variable.resolvedType, actualRaw)) },
        message: `"${node.path}" references {${expectedAlias}} in ${label}, but the variable holds a raw value${modeSuffix}. The chain has been flattened.`,
      }));
      continue;
    }

    if (expectedAlias === null && actualAliasId !== null) {
      findings.push(finding('alias-unexpected', {
        ...where,
        expected: { kind: 'value', display: expectedValue.ok ? expectedValue.display : '(unreadable)', color: colorOf(expectedValue) },
        actual: { kind: 'alias', display: aliasDisplay(context, actualAliasId) },
        message: `"${node.path}" states a value in ${label}, but the variable points at ${aliasDisplay(context, actualAliasId)}${modeSuffix}.`,
      }));
      continue;
    }

    if (expectedAlias !== null && actualAliasId !== null) {
      if (actualPath !== expectedAlias) {
        findings.push(finding('alias-target-mismatch', {
          ...where,
          expected: { kind: 'alias', display: `{${expectedAlias}}` },
          actual: { kind: 'alias', display: aliasDisplay(context, actualAliasId) },
          message: `"${node.path}" references {${expectedAlias}} in ${label}; the variable references ${aliasDisplay(context, actualAliasId)}${modeSuffix}.`,
        }));
      }
      continue; // targets agree — the target variable is compared on its own turn
    }

    /* Both sides hold a literal. */
    const actual = figmaSideValue(variable.resolvedType, actualRaw);
    if (!expectedValue.ok || !actual.ok) {
      context.diagnostics.error(
        'uncomparable-value',
        `"${node.path}" in ${label}: ${(expectedValue.ok ? actual : expectedValue).reason}.`,
        { token: node.path, mode: label },
      );
      continue;
    }
    if (!sameValue(expectedValue, actual)) {
      /* Values are compared at the precision the sync plugin writes at, which is
       * finer than a hex can print. When the two displays agree the difference
       * is real but invisible, so the exact numbers are shown instead. */
      const identical = expectedValue.display === actual.display;
      const expectedDisplay = identical ? (expectedValue.precise ?? expectedValue.display) : expectedValue.display;
      const actualDisplay = identical ? (actual.precise ?? actual.display) : actual.display;
      findings.push(finding('value-mismatch', {
        ...where,
        expected: { kind: 'value', display: expectedDisplay, color: colorOf(expectedValue) },
        actual: { kind: 'value', display: actualDisplay, color: colorOf(actual) },
        message: `"${node.path}" is ${expectedDisplay} in ${label}; the variable holds ${actualDisplay}${modeSuffix}.`
          + (identical ? ' The two print as the same hex; the difference is below 8-bit and would still be rewritten by a sync.' : ''),
      }));
    }
  }
}

/** A hex swatch for the dashboard, when the value is a colour and readable. */
function colorOf(shaped) {
  return shaped && shaped.ok && shaped.kind === 'COLOR' ? shaped.display : undefined;
}

function describeFigmaValue(variable, raw) {
  const shaped = figmaSideValue(variable.resolvedType, raw);
  return shaped.ok ? shaped.display : JSON.stringify(raw);
}

function aliasDisplay(context, id) {
  const target = context.snapshot.byId.get(id);
  return target ? `{${target.path}}` : `an unknown variable (${id})`;
}

/* ------------------------------------------------------------------ *
 * Main comparison pass
 * ------------------------------------------------------------------ */

function compare(set, snapshot, diagnostics, sourceLabel) {
  const modeMap = mapModes(snapshot, set, diagnostics, sourceLabel);

  const composedByLabel = new Map();
  const resolvedByLabel = new Map();
  for (const combo of set.combinations) {
    const label = combinationLabel(combo);
    const composed = composeModes(set, combo, diagnostics);
    composedByLabel.set(label, composed);
    resolvedByLabel.set(label, resolveTokens(composed, diagnostics, label));
  }

  const findings = [];
  const notRepresentable = [];
  const compared = new Set();
  let checks = 0;

  /**
   * What the sync plugin would have written for this token, if anything.
   *
   * Representability depends on the value as well as the type — a `dimension`
   * in `px` is a FLOAT and the same token in `rem` has no Figma form at all —
   * so it is decided from the resolved value, in every combination. A token the
   * plugin would skip in any one mode is a token the plugin skips.
   */
  const projectionOf = (node) => {
    for (const combo of set.combinations) {
      const resolvedNode = resolvedByLabel.get(combinationLabel(combo)).get(node.path);
      if (!resolvedNode) continue; // unresolvable — rung 1 reports that, not this gate
      const shaped = tokenSideValue(resolvedNode.type, resolvedNode.value);
      if (!shaped.ok) return { ok: false, reason: shaped.reason };
      if (shaped.kind !== undefined) return { ok: true, kind: shaped.kind };
    }
    return { ok: false, reason: 'the token did not resolve in any mode combination' };
  };

  for (const node of set.base.values()) {
    const projection = projectionOf(node);
    const expectedType = projection.ok ? projection.kind : undefined;
    const variable = snapshot.byPath.get(node.path);

    if (expectedType === undefined) {
      notRepresentable.push({ token: node.path, type: node.type ?? null, reason: projection.reason });
      if (variable) {
        // Figma holds something for a token that cannot be a variable. That is
        // an orphan wearing a real token's name, not a comparable pair.
        compared.add(node.path);
        findings.push(finding('orphan-in-figma', {
          token: node.path,
          variable: variable.name,
          expected: { kind: 'absent', display: `(no Figma variable form: ${projection.reason})` },
          actual: { kind: 'value', display: variable.resolvedType ?? '(unknown type)' },
          message: `Variable "${variable.name}" exists for token "${node.path}", which has no Figma variable representation — ${projection.reason}.`,
        }));
      }
      continue;
    }

    if (!variable) {
      findings.push(finding('missing-in-figma', {
        token: node.path,
        variable: null,
        expected: { kind: 'value', display: `a ${expectedType} variable named "${node.path.split('.').join(FIGMA_NAME_SEPARATOR)}"` },
        actual: { kind: 'absent', display: '(not in the Figma file)' },
        message: `Token "${node.path}" has no Figma variable. The display is behind the source.`,
      }));
      continue;
    }

    compared.add(node.path);

    if (variable.resolvedType !== expectedType) {
      findings.push(finding('type-mismatch', {
        token: node.path,
        variable: variable.name,
        expected: { kind: 'value', display: `${expectedType} (from $type "${node.type}")` },
        actual: { kind: 'value', display: String(variable.resolvedType) },
        message: `Token "${node.path}" is $type "${node.type}", which the sync projects as a Figma ${expectedType}; the variable is ${variable.resolvedType}. Figma fixes a resolved type at creation, so this variable was not generated by the sync and cannot be corrected in place.`,
      }));
      continue; // values of the wrong type are not worth diffing
    }

    const declared = expectedDescription(node);
    const displayed = normaliseDescription(variable.description);
    if (declared !== displayed) {
      findings.push(finding('description-drift', {
        token: node.path,
        variable: variable.name,
        expected: { kind: 'text', display: declared === '' ? '(no $description)' : declared },
        actual: { kind: 'text', display: displayed === '' ? '(no description)' : displayed },
        message: `Description of "${node.path}" differs between the source and the Figma file.`,
      }));
    }

    const modes = modeMap.get(variable.collectionId) ?? new Map();
    const modeEntries = variable.collection && variable.collection.modes.length > 0
      ? variable.collection.modes
      : [{ modeId: Object.keys(variable.valuesByMode)[0], name: null }];

    for (const mode of modeEntries) {
      if (mode.modeId === undefined) continue;
      const tokenModeId = modes.get(mode.modeId) ?? null;
      const combos = combinationsFor(set, variable.collection, tokenModeId);
      if (combos.length === 0) continue;
      checks += combos.length;
      compareInMode({
        variable, modeId: mode.modeId, modeName: mode.name, combos,
        composedByLabel, resolvedByLabel, node, findings, snapshot, diagnostics,
        totalCombinations: set.combinations.length,
      });
    }
  }

  for (const variable of snapshot.byPath.values()) {
    if (set.base.has(variable.path)) continue;
    findings.push(finding('orphan-in-figma', {
      token: null,
      variable: variable.name,
      expected: { kind: 'absent', display: '(no token declares this)' },
      actual: { kind: 'value', display: `${variable.resolvedType ?? 'variable'} in collection "${variable.collection?.name ?? '?'}"` },
      message: `Figma variable "${variable.name}" maps to token path "${variable.path}", which no token file declares.`,
    }));
  }

  const drifted = new Set(findings.map((f) => f.token).filter((path) => path !== null));
  const aligned = [...compared].filter((path) => !drifted.has(path)).sort();

  /* Every token and its display, aligned or not, in one list. The dashboard's
   * main table is this: the roadmap asks for every token, Figma against code,
   * not only the ones that went wrong. A row that says "aligned" is doing work
   * — it is the evidence that the detector looked. */
  const notRepresentablePaths = new Set(notRepresentable.map((item) => item.token));
  const alignedPaths = new Set(aligned);
  const codesByToken = new Map();
  for (const item of findings) {
    if (item.token === null) continue;
    if (!codesByToken.has(item.token)) codesByToken.set(item.token, new Set());
    codesByToken.get(item.token).add(item.code);
  }
  const tokens = [...set.base.values()].map((node) => {
    const variable = snapshot.byPath.get(node.path) ?? null;
    const codes = codesByToken.get(node.path);
    const status = codes === undefined
      ? (notRepresentablePaths.has(node.path) ? 'not-representable' : alignedPaths.has(node.path) ? 'aligned' : 'unknown')
      : (codes.size === 1 && codes.has('missing-in-figma') ? 'missing' : 'drifted');
    return {
      path: node.path,
      type: node.type ?? null,
      layer: node.layer,
      variable: variable ? variable.name : null,
      collection: variable?.collection?.name ?? null,
      status,
    };
  }).sort((a, b) => (a.path < b.path ? -1 : 1));

  for (const variable of snapshot.byPath.values()) {
    if (set.base.has(variable.path)) continue;
    tokens.push({
      path: variable.path,
      type: null,
      layer: null,
      variable: variable.name,
      collection: variable.collection?.name ?? null,
      status: 'orphan',
    });
  }

  return { findings, aligned, notRepresentable, checks, modeMap, tokens };
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

/**
 * Is one path inside another?
 *
 * By `relative`, not by string prefix. "/a/bc" starts with "/a/b" and is not
 * inside it, and a containment test that gets that wrong is worse than none: it
 * refuses writes that were fine and is trusted to catch the one that is not.
 * A path equal to the directory counts as inside — a snapshot cannot be saved
 * *as* the token root either.
 */
function isInside(directory, candidate) {
  const rel = relative(resolve(directory), resolve(candidate));
  if (rel === '') return true;
  if (isAbsolute(rel)) return false; // a different drive, on Windows
  return rel !== '..' && !rel.startsWith(`..${sep}`);
}

/**
 * Refuse to write a Figma value into the token source.
 *
 * `--save-snapshot content/tokens/<anything>.json` is one flag away from being
 * typed, and `loadTokenSet` reads every `.json` under every subdirectory of the
 * root — so the file lands, the next run parses it as token documents, and Figma
 * has quietly become a source. Nothing about that failure announces itself: the
 * snapshot is valid JSON and the run that created it passes.
 *
 * Rule 4 says anything checkable gets a deterministic check, and this is
 * checkable, so it is a named error before a byte is written rather than a
 * sentence in a README asking people not to. The remedy is not "save it
 * somewhere else in particular" — it is that the token root has one editing
 * surface and a snapshot is not on it.
 */
function refuseSaveInsideRoot(savePath, root) {
  if (!savePath) return null;
  if (!isInside(root, savePath)) return null;
  return {
    code: 'save-snapshot-inside-root',
    message: `--save-snapshot points inside the token root (${displayPath(resolve(savePath))} is under ${displayPath(resolve(root))}). `
      + 'Refused, and nothing was written. Every .json under the token root is loaded as tokens, so a Figma snapshot saved there would be read back as a source on the next run — and Figma is a display, never a source. Save it outside the root: a fixture directory, or anywhere the loader does not look.',
  };
}

async function main(argv) {
  const args = parseArgs(argv, {
    flags: ['json', 'quiet', 'help', 'bridge'],
    values: ['root', 'snapshot', 'file-key', 'save-snapshot', 'bridge-port', 'bridge-timeout'],
  });
  if (args.help) {
    process.stdout.write(
      'Usage: check-drift.mjs [--root <dir>] [--snapshot <file>] [--file-key <key>]\n'
      + '                       [--bridge] [--bridge-port <n>] [--bridge-timeout <s>]\n'
      + '                       [--save-snapshot <file>] [--json] [--quiet]\n',
    );
    return 0;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`check-drift: unknown argument ${args.unknown.join(' ')}\n`);
    return 2;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(root, diagnostics);

  /* Checked before any source is opened, so a refused save cannot cost somebody
   * a sixty-second wait at the bridge to be told the destination was never
   * allowed. Nothing has been written at this point and nothing will be. */
  const refusal = refuseSaveInsideRoot(args['save-snapshot'], set.root);
  if (refusal) {
    diagnostics.error(refusal.code, refusal.message, { file: args['save-snapshot'] });
    return report({ args, set, source: null, result: emptyResult(), diagnostics, empty: false });
  }

  if (diagnostics.ok && isEmptyTokenSet(set)) {
    return report({ args, set, source: null, result: emptyResult(), diagnostics, empty: true });
  }

  /* Where the display comes from. The snapshot path is deliberately first: it
   * is what lets this run in CI, in the selftest, and on a machine that has
   * never held a Figma token. */
  const fileKey = args['file-key'] ?? process.env.FIGMA_FILE_KEY;
  let source = null;
  let payload = null;

  /* Saving is the same act whichever source produced the payload: a live read
   * turned into a file is how a fixture gets made, and the bridge is the only
   * live read most plans have. */
  const savePayload = (data) => {
    if (!args['save-snapshot']) return;
    mkdirSync(dirname(args['save-snapshot']), { recursive: true });
    writeFileSync(args['save-snapshot'], `${JSON.stringify(data, null, 2)}\n`);
  };

  if (args.snapshot) {
    source = { kind: 'snapshot', path: args.snapshot };
    if (!existsSync(args.snapshot)) {
      diagnostics.error('snapshot-missing', `No snapshot at ${displayPath(args.snapshot)}.`, { file: args.snapshot });
    } else {
      payload = readJson(args.snapshot, diagnostics, 'invalid-snapshot');
    }
  } else if (args.bridge) {
    const port = args['bridge-port'] === undefined ? BRIDGE_PORT : Number(args['bridge-port']);
    const timeoutMs = args['bridge-timeout'] === undefined
      ? BRIDGE_TIMEOUT_MS
      : Number(args['bridge-timeout']) * 1000;
    /* `document` is filled in from the answer, not from the request: a port is
     * not an identity, and a report that cannot name the document it read is a
     * report whose remedy cannot be checked. With the wrong file open every
     * token comes back missing-in-figma and the remedy beside it says "re-sync
     * outward" — which would write the entire token set into a document nobody
     * meant to touch. Null means the plugin did not say, and that is printed
     * rather than passed over. */
    source = { kind: 'bridge', port, document: null };

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      diagnostics.error('bridge-port-invalid', `--bridge-port must be a port number; got ${JSON.stringify(args['bridge-port'])}.`, {});
    } else if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      diagnostics.error('bridge-timeout-invalid', `--bridge-timeout must be a number of seconds; got ${JSON.stringify(args['bridge-timeout'])}.`, {});
    } else {
      /* Progress goes to stderr, always. This command's stdout is a contract —
       * `--json` is parsed by the health dashboard — and a friendly line in the
       * middle of it would be a breaking change dressed as a courtesy. */
      const result = await readSnapshotOverBridge({
        port,
        timeoutMs,
        onStatus: (text) => process.stderr.write(`bridge: ${text}\n`),
      });
      if (result.ok) {
        payload = result.payload;
        source.document = result.document ?? null;
        savePayload(payload);
      } else {
        diagnostics.error(result.code, result.message, {});
      }
    }
  } else if (fileKey) {
    const token = process.env.FIGMA_TOKEN;
    source = { kind: 'figma', fileKey };
    if (!token) {
      diagnostics.error(
        'no-credentials',
        'A file key was given but $FIGMA_TOKEN is not set. Set it, or point --snapshot at a saved payload.',
        {},
      );
    } else {
      try {
        payload = await fetchSnapshot(fileKey, token);
        savePayload(payload);
      } catch (error) {
        diagnostics.error('figma-unreachable', `Could not read variables from Figma: ${error.message}`, {});
      }
    }
  } else {
    diagnostics.error(
      'no-source',
      'Nothing to compare against. Pass --snapshot <file> with a saved Figma variables payload; or --bridge to read the live file from a running Mizan Sync plugin; or --file-key/$FIGMA_FILE_KEY with $FIGMA_TOKEN set, which needs an Enterprise plan.',
      {},
    );
  }

  if (payload === null) {
    return report({ args, set, source, result: emptyResult(), diagnostics, empty: false });
  }

  const meta = unwrapSnapshot(payload);
  if (meta === null) {
    diagnostics.error(
      'invalid-snapshot',
      'Snapshot is not a Figma variables payload. Expected an object with "variables" and "variableCollections", either at the top level or under "meta".',
      { file: source?.path },
    );
    return report({ args, set, source, result: emptyResult(), diagnostics, empty: false });
  }

  const sourceLabel = source?.path
    ?? (source?.kind === 'bridge'
      ? `bridge:127.0.0.1:${source.port}${source.document ? ` ("${source.document.name}")` : ''}`
      : `figma:${source?.fileKey ?? ''}`);
  const snapshot = normaliseSnapshot(meta, diagnostics, sourceLabel);
  const result = compare(set, snapshot, diagnostics, sourceLabel);
  result.snapshot = snapshot;

  return report({ args, set, source, result, diagnostics, empty: false });
}

function emptyResult() {
  return { findings: [], aligned: [], notRepresentable: [], tokens: [], checks: 0, modeMap: new Map(), snapshot: null };
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

function report({ args, set, source, result, diagnostics, empty }) {
  const { findings, aligned, notRepresentable, checks } = result;
  const ok = diagnostics.ok && findings.length === 0;

  const byCode = new Map();
  for (const item of findings) {
    if (!byCode.has(item.code)) byCode.set(item.code, []);
    byCode.get(item.code).push(item);
  }

  const counts = {
    tokens: set.base.size,
    variables: result.snapshot ? result.snapshot.byPath.size : 0,
    comparable: aligned.length + new Set(findings.map((f) => f.token).filter(Boolean)).size,
    aligned: aligned.length,
    drifted: new Set(findings.filter((f) => f.code !== 'missing-in-figma' && f.code !== 'orphan-in-figma').map((f) => f.token)).size,
    missing: byCode.get('missing-in-figma')?.length ?? 0,
    orphan: byCode.get('orphan-in-figma')?.length ?? 0,
    notRepresentable: notRepresentable.length,
    checks,
  };

  const payload = {
    check: 'drift',
    ok,
    direction: 'Figma is a display, never a source. Every finding is fixed by regenerating Figma from the token source.',
    root: set.root,
    empty,
    source,
    dimensions: set.dimensions,
    combinations: set.combinations.map(combinationLabel),
    collections: result.snapshot
      ? [...result.snapshot.collections.values()].map((collection) => ({
        name: collection.name,
        modes: collection.modes.map((mode) => mode.name),
        mappedTo: collection.modes.map((mode) => result.modeMap.get(collection.id)?.get(mode.modeId) ?? null),
      }))
      : [],
    classes: DRIFT_CLASSES,
    counts,
    tokens: result.tokens ?? [],
    findings,
    aligned,
    notRepresentable,
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return ok ? 0 : 1;
  }

  const out = [];
  out.push(`Drift gate — ${displayPath(set.root)}`);

  if (empty) {
    out.push('');
    out.push('No token files found. Nothing to compare against yet.');
    out.push('This passes because there is nothing to reject, not because anything was checked.');
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
  }

  out.push(describeSource(source, result.snapshot !== null));

  if (result.snapshot) {
    out.push(
      `${counts.tokens} token(s), ${counts.variables} variable(s), `
      + `${payload.combinations.length} mode combination(s), ${checks} comparison(s).`,
    );
    for (const collection of payload.collections) {
      const modes = collection.modes.map((name, i) => `${name} -> ${collection.mappedTo[i] ?? '(unmapped)'}`);
      out.push(`  collection "${collection.name}": ${modes.join(', ') || '(no modes)'}`);
    }
  }

  if (findings.length > 0) {
    out.push('');
    out.push(`DRIFT (${findings.length})`);
    out.push('  Figma is a display, never a source. Every fix below runs outward — regenerate the');
    out.push('  variables from the token source. No value here is ever copied back into the tokens.');
    for (const [code, items] of byCode) {
      const meta = DRIFT_CLASSES[code];
      out.push('');
      out.push(`  ${meta.label.toUpperCase()} — ${code} (${items.length})`);
      out.push(`    ${meta.summary}`);
      out.push(`    fix: ${meta.remedy}`);
      for (const item of items) out.push(...formatFinding(item));
    }
  }

  if (notRepresentable.length > 0) {
    out.push('');
    out.push(`NOT REPRESENTABLE IN FIGMA (${notRepresentable.length}) — not drift`);
    out.push('  Figma variables hold colour, number, string and boolean. These token types have no');
    out.push('  variable form, so their absence from the file is a fact about Figma, not a disagreement.');
    for (const item of notRepresentable) out.push(`    ${item.token}  ($type: ${item.type ?? 'none'})`);
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
    ok
      ? `Result: pass. ${counts.aligned} token(s) aligned across ${checks} comparison(s), 0 drifted, 0 missing, 0 orphaned.`
      : `Result: fail. ${counts.aligned} aligned, ${counts.drifted} drifted, ${counts.missing} missing in Figma, `
        + `${counts.orphan} orphaned in Figma, ${diagnostics.errors.length} error(s).`,
  );

  if (!args.quiet || !ok) process.stdout.write(`${out.join('\n')}\n`);
  return ok ? 0 : 1;
}

/**
 * The one line that says what was compared against.
 *
 * A snapshot names a path and a live fetch names a key, so both have always been
 * answerable. A bridge read named only a port, and a port says nothing about
 * which document was open — which matters most in the case that looks least like
 * a problem: read the wrong file and every token comes back missing, with
 * "re-sync outward" printed beside it. Follow that and the whole token set is
 * written into a document nobody chose. The name is what makes the remedy
 * checkable before it is carried out.
 *
 * When the plugin sent no identity that is said in the line rather than left
 * out. An unnamed document is a fact about this report, and quietly omitting it
 * would leave the line reading exactly as it did when the answer was known.
 */
function describeSource(source, read) {
  if (source === null) return 'figma: (none)';
  if (source.kind === 'snapshot') return `figma: snapshot ${displayPath(source.path)}`;
  if (source.kind !== 'bridge') return `figma: file ${source.fileKey} (live)`;

  const wire = `read through the plugin bridge on 127.0.0.1:${source.port}`;
  if (source.document) {
    // No file key is ordinary rather than wrong — an unsaved document has none.
    const key = source.document.fileKey === null
      ? 'no file key — the document may be unsaved'
      : `file key ${source.document.fileKey}`;
    return `figma: "${source.document.name}" (${key}), ${wire}`;
  }
  return read
    ? `figma: the open file (the plugin did not name the document — rebuild it with npm run figma:build), ${wire}`
    : `figma: the open file, ${wire}`;
}

function formatFinding(item) {
  const lines = [];
  lines.push(`      ${item.token ?? '(no token)'}${item.variable ? `  <-  ${item.variable}` : ''}`);
  const where = [];
  if (item.tokenMode) where.push(`source mode: ${item.tokenMode}`);
  if (item.mode) where.push(`figma mode: ${item.mode}`);
  if (where.length > 0) lines.push(`        ${where.join('  ')}`);
  lines.push(`        source: ${truncate(item.expected.display)}${item.expected.resolves ? `  (resolves to ${item.expected.resolves})` : ''}`);
  lines.push(`        figma:  ${truncate(item.actual.display)}`);
  return lines;
}

function truncate(text, limit = 160) {
  const value = String(text);
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function formatDiagnostic(entry) {
  const lines = [`  [${entry.code}] ${entry.message}`];
  const where = [];
  if (entry.token) where.push(`token: ${entry.token}`);
  if (entry.file) where.push(`file: ${displayPath(entry.file)}`);
  if (entry.mode) where.push(`mode: ${entry.mode}`);
  if (where.length > 0) lines.push(`      ${where.join('  ')}`);
  return lines;
}

process.exitCode = await main(process.argv.slice(2));
