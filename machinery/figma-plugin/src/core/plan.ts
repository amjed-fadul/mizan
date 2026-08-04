/**
 * plan.ts — the projection, decided before anything is written.
 *
 * ===========================================================================
 * THE ARCHITECTURE PROBLEM, AND WHY THIS FILE DOES NOT SOLVE IT
 * ===========================================================================
 *
 * Figma variable modes are per *collection*. A variable lives in exactly one
 * collection and holds one value per mode of that collection. A token that
 * depends on two dimensions — theme AND product — therefore has no single
 * Figma variable that can express it. Two independent collections cannot
 * either: `theme` does not know which `product` mode is active, and vice versa.
 *
 * That is the same wall the token layer hit, and the token layer already went
 * over it (decision 007, Amendment; `content/tokens/modes.json`). A token
 * depending on N dimensions is expressed as one **selector** token plus one
 * **slot** per mode of the last-applied dimension, with the earlier dimensions
 * setting the slots. `text.secondary` is the selector; `text.secondary-market`
 * and `text.secondary-move` are the slots.
 *
 * So this plugin invents nothing. It projects:
 *
 *   one Figma collection per mode dimension    theme, product, (script)
 *   one Figma collection per invariant layer   primitive, semantic, component
 *
 *   a token overridden by dimension D  ->  a variable in collection D,
 *                                          one value per mode of D
 *   a token overridden by nothing      ->  a variable in its layer's
 *                                          collection, one mode
 *   a token overridden by two or more  ->  an ERROR, naming the slot
 *      dimensions                          convention that expresses it
 *
 * The slots then do their work through Figma's own alias support, which is the
 * point rather than a convenience: `text/secondary` lives in `product` and, in
 * mode `market`, *aliases* `text/secondary-market`, which lives in `theme` and
 * varies by theme. Selecting theme=dark and product=market on a frame resolves
 * the chain across both collections. The Figma structure is the token structure
 * with nothing added, which is the only thing that makes a drift detector
 * meaningful: two structures that disagree by design cannot be compared.
 *
 * A THIRD DIMENSION COSTS NO CODE. Dimensions are read from the token root's
 * mode manifest. Adding `script` to `modes.json` with its mode files produces a
 * third collection with two modes and moves the tokens script overrides into
 * it. Nothing below names a dimension, a mode or a layer.
 *
 * ===========================================================================
 */

import type {
  Action,
  CollectionPlanSummary,
  FigmaType,
  Orphan,
  Plan,
  PlanValue,
  Problem,
  Skip,
  Snapshot,
  SnapshotCollection,
  SnapshotVariable,
  TokenBundle,
} from './types';
import { describeValue, figmaName, mapValue, valuesEqual } from './map';
import {
  Diagnostics,
  aliasTarget,
  effectiveType,
  loadBundle,
  nodeInMode,
  varyingDimensions,
  type TokenNode,
  type TokenSet,
} from './token-model';

/**
 * The name given to the single mode of a collection that varies by nothing.
 *
 * This is the one name in the projection that does not come from the token
 * root, because a collection with no dimension has no mode name to inherit and
 * Figma requires every collection to have at least one mode. It is stated here
 * rather than left as Figma's "Mode 1" so that a re-run recognises its own work.
 */
export const SINGLE_MODE_NAME = 'Default';

interface DesiredVariable {
  token: string;
  name: string;
  collection: string;
  type: FigmaType;
  description: string;
  /** mode display name -> value */
  values: Record<string, PlanValue>;
}

interface DesiredCollection {
  name: string;
  origin: 'dimension' | 'layer';
  modes: string[];
  /** mode display name -> mode id in the token root, or null for the single mode. */
  modeIds: Record<string, string | null>;
}

type Classification =
  | { status: 'ok'; type: FigmaType }
  | { status: 'skip'; reason: string }
  | { status: 'error'; problem: Problem };

/**
 * A mode's name in Figma. `theme.dark` in dimension `theme` becomes `dark`:
 * the dimension is already the collection, so repeating it in every mode name
 * is noise. A mode id that does not carry its dimension as a prefix is used
 * whole.
 */
export function modeDisplayName(modeId: string, dimension: string): string {
  const prefix = `${dimension}.`;
  return modeId.indexOf(prefix) === 0 ? modeId.slice(prefix.length) : modeId;
}

/* ------------------------------------------------------------------ *
 * The planner
 * ------------------------------------------------------------------ */

export function planSync(bundle: TokenBundle, snapshot: Snapshot): Plan {
  const diagnostics = new Diagnostics();
  const set = loadBundle(bundle, diagnostics);

  const errors: Problem[] = diagnostics.errors.map((d) => ({
    code: d.code,
    message: d.message,
    token: d.token,
    file: d.file,
  }));
  const warnings: Problem[] = diagnostics.warnings.map((d) => ({
    code: d.code,
    message: d.message,
    token: d.token,
    file: d.file,
  }));
  const skipped: Skip[] = [];

  if (set.files.length === 0) {
    errors.push({
      code: 'empty-bundle',
      message: 'The bundle contains no token documents. Nothing to sync.',
    });
  }

  /* -- Which collection does each token belong to? ------------------ */

  const collectionOf = new Map<string, string>();
  const dimensionOf = new Map<string, string | null>();

  for (const [path, node] of set.base) {
    const varying = varyingDimensions(path, set);
    if (varying.length > 1) {
      errors.push({
        code: 'cross-dimension-token',
        token: path,
        file: node.file,
        message:
          `"${path}" is overridden by ${varying.length} mode dimensions (${varying.join(', ')}). ` +
          'A Figma variable lives in one collection and holds one value per mode of that collection, ' +
          'so a token varying by two dimensions has no Figma representation. Express it the way the ' +
          'token layer already does: one slot token per mode of the last-applied dimension, set by the ' +
          'earlier dimension, and a selector token that aliases the slot.',
      });
      continue;
    }
    dimensionOf.set(path, varying.length === 1 ? varying[0] : null);
    collectionOf.set(path, varying.length === 1 ? varying[0] : node.layer);
  }

  /* -- Which tokens can be a Figma variable at all? ------------------ */

  const classified = new Map<string, Classification>();

  const classify = (path: string, seen: string[]): Classification => {
    const cached = classified.get(path);
    if (cached) return cached;

    if (seen.indexOf(path) !== -1) {
      const result: Classification = {
        status: 'error',
        problem: {
          code: 'alias-cycle',
          token: path,
          message: `Alias cycle: ${seen.concat(path).join(' -> ')}`,
        },
      };
      classified.set(path, result);
      return result;
    }

    const node = set.base.get(path) as TokenNode;
    const target = aliasTarget(node.rawValue);

    let result: Classification;
    if (target !== null) {
      if (!set.base.has(target)) {
        result = {
          status: 'error',
          problem: {
            code: 'alias-not-found',
            token: path,
            file: node.file,
            message: `"${path}" references "{${target}}", which is not a token.`,
          },
        };
      } else {
        const upstream = classify(target, seen.concat(path));
        result =
          upstream.status === 'ok'
            ? upstream
            : upstream.status === 'skip'
              ? { status: 'skip', reason: `aliases "${target}", which is not projected: ${upstream.reason}` }
              : upstream;
      }
    } else {
      const declared = effectiveType(path, set.base);
      const mapped = mapValue(node.rawValue, declared);
      if (!mapped.ok) {
        result = { status: 'skip', reason: mapped.reason };
      } else if ('alias' in mapped) {
        // Unreachable: aliasTarget already returned null for this value.
        result = { status: 'skip', reason: 'unexpected alias' };
      } else {
        result = { status: 'ok', type: mapped.type };
      }
    }

    classified.set(path, result);
    return result;
  };

  for (const path of set.base.keys()) {
    if (!collectionOf.has(path)) continue; // already a cross-dimension error
    const result = classify(path, []);
    if (result.status === 'skip') {
      skipped.push({ token: path, type: effectiveType(path, set.base), reason: result.reason });
    } else if (result.status === 'error') {
      errors.push(result.problem);
    }
  }

  /* -- The collections and modes the file should end up with --------- */

  const desiredCollections = new Map<string, DesiredCollection>();

  const collectionFor = (name: string): DesiredCollection => {
    let collection = desiredCollections.get(name);
    if (collection) return collection;
    const dimension = set.dimensions.filter((d) => d.name === name)[0];
    if (dimension) {
      const modes: string[] = [];
      const modeIds: Record<string, string | null> = {};
      for (const modeId of dimension.modes) {
        const display = modeDisplayName(modeId, dimension.name);
        if (Object.prototype.hasOwnProperty.call(modeIds, display)) {
          errors.push({
            code: 'mode-name-collision',
            collection: name,
            message: `Dimension "${name}" has two modes that both shorten to "${display}". Mode names inside a collection must be distinct.`,
          });
          continue;
        }
        modes.push(display);
        modeIds[display] = modeId;
      }
      collection = { name, origin: 'dimension', modes, modeIds };
    } else {
      collection = {
        name,
        origin: 'layer',
        modes: [SINGLE_MODE_NAME],
        modeIds: { [SINGLE_MODE_NAME]: null },
      };
    }
    desiredCollections.set(name, collection);
    return collection;
  };

  /* -- The variables, with a value for every mode -------------------- */

  const desired: DesiredVariable[] = [];

  for (const [path, node] of set.base) {
    const classification = classified.get(path);
    if (!classification || classification.status !== 'ok') continue;

    const collectionName = collectionOf.get(path) as string;
    const collection = collectionFor(collectionName);
    const name = figmaName(path);

    if (name.indexOf(':') !== -1 || name.charAt(0) === '/' || name.indexOf('//') !== -1) {
      errors.push({
        code: 'unusable-variable-name',
        token: path,
        message: `"${path}" becomes the Figma name "${name}", which Figma will not accept.`,
      });
      continue;
    }

    const values: Record<string, PlanValue> = {};
    let usable = true;

    for (const modeName of collection.modes) {
      const modeId = collection.modeIds[modeName];
      const inMode = nodeInMode(path, set, modeId) as TokenNode;
      const target = aliasTarget(inMode.rawValue);

      if (target !== null) {
        const targetClass = classified.get(target);
        if (!set.base.has(target)) {
          errors.push({
            code: 'alias-not-found',
            token: path,
            file: inMode.file,
            message: `"${path}" references "{${target}}" in mode "${modeName}", which is not a token.`,
          });
          usable = false;
          break;
        }
        if (!targetClass || targetClass.status !== 'ok') {
          skipped.push({
            token: path,
            type: effectiveType(path, set.base),
            reason: `in mode "${modeName}" it aliases "${target}", which is not projected`,
          });
          usable = false;
          break;
        }
        if (targetClass.type !== classification.type) {
          errors.push({
            code: 'alias-type-mismatch',
            token: path,
            file: inMode.file,
            message: `"${path}" is a ${classification.type} variable but in mode "${modeName}" it aliases "${target}", which is ${targetClass.type}. Figma requires an alias to match the variable's resolved type.`,
          });
          usable = false;
          break;
        }
        if (!collectionOf.has(target)) {
          usable = false;
          break;
        }
        values[modeName] = {
          kind: 'ALIAS',
          collection: collectionOf.get(target) as string,
          name: figmaName(target),
        };
        continue;
      }

      const mapped = mapValue(inMode.rawValue, inMode.type || effectiveType(path, set.base));
      if (!mapped.ok) {
        skipped.push({ token: path, type: inMode.type, reason: `in mode "${modeName}": ${mapped.reason}` });
        usable = false;
        break;
      }
      if ('alias' in mapped) {
        usable = false;
        break;
      }
      if (mapped.type !== classification.type) {
        errors.push({
          code: 'type-varies-by-mode',
          token: path,
          file: inMode.file,
          message: `"${path}" is ${classification.type} in the base layer but ${mapped.type} in mode "${modeName}". A Figma variable has one resolved type across every mode.`,
        });
        usable = false;
        break;
      }
      if (mapped.note) {
        warnings.push({ code: 'value-narrowed', token: path, message: `${path} (${modeName}): ${mapped.note}` });
      }
      values[modeName] = mapped.value;
    }

    if (!usable) continue;

    desired.push({
      token: path,
      name,
      collection: collectionName,
      type: classification.type,
      description: describeToken(node),
      values,
    });
  }

  /* -- Diff against what the file already holds ---------------------- */

  const actions: Action[] = [];
  const orphans: Orphan[] = [];

  const existingCollections = new Map<string, SnapshotCollection>();
  for (const collection of snapshot.collections) existingCollections.set(collection.name, collection);

  const variablesByCollection = new Map<string, SnapshotVariable[]>();
  for (const variable of snapshot.variables) {
    const list = variablesByCollection.get(variable.collectionId) || [];
    list.push(variable);
    variablesByCollection.set(variable.collectionId, list);
  }

  const desiredByCollection = new Map<string, DesiredVariable[]>();
  for (const variable of desired) {
    const list = desiredByCollection.get(variable.collection) || [];
    list.push(variable);
    desiredByCollection.set(variable.collection, list);
  }

  const collectionSummaries: CollectionPlanSummary[] = [];
  const orderedCollections = orderCollections(desiredCollections, set);

  for (const collection of orderedCollections) {
    const existing = existingCollections.get(collection.name);
    const members = desiredByCollection.get(collection.name) || [];

    collectionSummaries.push({
      name: collection.name,
      origin: collection.origin,
      modes: collection.modes,
      variableCount: members.length,
      exists: Boolean(existing),
    });

    const existingModeNames = existing ? existing.modes.map((m) => m.name) : [];

    if (!existing) {
      actions.push({ op: 'create-collection', collection: collection.name, firstMode: collection.modes[0] });
      for (const mode of collection.modes.slice(1)) {
        actions.push({ op: 'create-mode', collection: collection.name, mode });
      }
    } else {
      const existingMembers = variablesByCollection.get(existing.id) || [];
      // The only rename this plugin ever performs: a collection somebody made
      // by hand, still holding Figma's single placeholder mode and nothing
      // else. Renaming a mode that already has values would silently re-point
      // every value bound to it.
      const placeholderOnly =
        existing.modes.length === 1 && existingMembers.length === 0 && existingModeNames.indexOf(collection.modes[0]) === -1;
      if (placeholderOnly) {
        actions.push({
          op: 'rename-mode',
          collection: collection.name,
          from: existing.modes[0].name,
          to: collection.modes[0],
        });
        existingModeNames[0] = collection.modes[0];
      }
      for (const mode of collection.modes) {
        if (existingModeNames.indexOf(mode) === -1) {
          actions.push({ op: 'create-mode', collection: collection.name, mode });
        }
      }
      for (const mode of existingModeNames) {
        if (collection.modes.indexOf(mode) === -1) {
          orphans.push({
            kind: 'mode',
            collection: collection.name,
            name: mode,
            note: 'no dimension in the token root declares this mode',
          });
        }
      }
    }

    const existingByName = new Map<string, SnapshotVariable>();
    if (existing) {
      for (const variable of variablesByCollection.get(existing.id) || []) {
        existingByName.set(variable.name, variable);
      }
    }
    const modeIdByName = new Map<string, string>();
    if (existing) for (const mode of existing.modes) modeIdByName.set(mode.name, mode.id);

    for (const variable of members) {
      const current = existingByName.get(variable.name);
      if (!current) {
        actions.push({
          op: 'create-variable',
          collection: collection.name,
          name: variable.name,
          token: variable.token,
          type: variable.type,
          description: variable.description,
        });
      } else if (current.resolvedType !== variable.type) {
        errors.push({
          code: 'type-conflict',
          token: variable.token,
          collection: collection.name,
          message: `"${variable.name}" already exists in collection "${collection.name}" as ${current.resolvedType}, but the token is ${variable.type}. A variable's resolved type cannot be changed, and this plugin does not delete. Remove the variable in Figma, or rename the token.`,
        });
        continue;
      } else if (current.description !== variable.description) {
        actions.push({
          op: 'set-description',
          collection: collection.name,
          name: variable.name,
          token: variable.token,
          from: current.description,
          to: variable.description,
        });
      }

      for (const modeName of collection.modes) {
        const next = variable.values[modeName];
        if (!next) continue;
        const modeId = modeIdByName.get(modeName);
        const currentValue = current && modeId ? current.valuesByMode[modeId] : undefined;
        if (valuesEqual(currentValue, next)) continue;
        actions.push({
          op: 'set-value',
          collection: collection.name,
          name: variable.name,
          token: variable.token,
          mode: modeName,
          from: currentValue === undefined ? null : currentValue,
          to: next,
        });
      }
    }

    // Orphans: in a collection this plugin manages, but not in the token root.
    if (existing) {
      const desiredNames = new Set(members.map((v) => v.name));
      for (const variable of variablesByCollection.get(existing.id) || []) {
        if (desiredNames.has(variable.name)) continue;
        const movedTo = desired.filter((v) => v.name === variable.name)[0];
        orphans.push({
          kind: 'variable',
          collection: collection.name,
          name: variable.name,
          note: movedTo
            ? `the token now varies by "${movedTo.collection}" and has moved to that collection; this copy is left for you to delete`
            : 'no token in the source declares it',
        });
      }
    }
  }

  const managed = new Set(orderedCollections.map((c) => c.name));
  const untouched = snapshot.collections.filter((c) => !managed.has(c.name)).map((c) => c.name);

  const creates = actions.filter(
    (a) => a.op === 'create-collection' || a.op === 'create-mode' || a.op === 'create-variable',
  ).length;

  return {
    collections: collectionSummaries,
    actions,
    errors,
    warnings,
    skipped,
    orphans,
    untouched,
    signature: signatureOf(actions),
    stats: {
      tokensRead: set.base.size,
      variablesPlanned: desired.length,
      creates,
      updates: actions.length - creates,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Collections in a deterministic order: invariant layers first, then the mode
 * dimensions in the order the manifest applies them. Layers hold the values the
 * dimensions alias, so this is also the order a reader wants them in.
 */
function orderCollections(collections: Map<string, DesiredCollection>, set: TokenSet): DesiredCollection[] {
  const layers = Array.from(collections.values())
    .filter((c) => c.origin === 'layer')
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const dimensions: DesiredCollection[] = [];
  for (const dimension of set.dimensions) {
    const found = collections.get(dimension.name);
    if (found) dimensions.push(found);
  }
  return layers.concat(dimensions);
}

/**
 * The variable's Figma description. `$description` carried verbatim, so the
 * reasoning travels with the value — a designer hovering a variable in Figma
 * reads the same sentence a developer reads in the JSON.
 */
export function describeToken(node: TokenNode): string {
  const parts: string[] = [];
  if (node.deprecated) {
    parts.push(typeof node.deprecated === 'string' ? `[deprecated: ${node.deprecated}]` : '[deprecated]');
  }
  if (node.description) parts.push(node.description);
  return parts.join(' ');
}

/**
 * A stable digest of the planned actions.
 *
 * Apply re-plans against the live document and refuses if the signature has
 * moved: the diff the user confirmed has to be the diff that gets written, or
 * the confirmation meant nothing.
 */
export function signatureOf(actions: Action[]): string {
  const text = JSON.stringify(actions);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${actions.length}`;
}

/** One diff line, for the UI and for the command-line dry run alike. */
export function describeAction(action: Action): string {
  switch (action.op) {
    case 'create-collection':
      return `+ collection "${action.collection}" (first mode "${action.firstMode}")`;
    case 'create-mode':
      return `+ mode "${action.mode}" in "${action.collection}"`;
    case 'rename-mode':
      return `~ mode "${action.from}" -> "${action.to}" in "${action.collection}"`;
    case 'create-variable':
      return `+ ${action.collection}/${action.name} (${action.type})`;
    case 'set-description':
      return `~ ${action.collection}/${action.name} description`;
    case 'set-value':
      return `~ ${action.collection}/${action.name} [${action.mode}] ${describeValue(action.from)} -> ${describeValue(action.to)}`;
    default:
      return JSON.stringify(action);
  }
}

/** True when the plan may be written. Errors block; warnings do not. */
export function isApplicable(plan: Plan): boolean {
  return plan.errors.length === 0;
}
