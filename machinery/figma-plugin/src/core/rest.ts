/**
 * rest.ts — the variable state, in the shape Figma's read endpoint returns it.
 *
 * `machinery/scripts/check-drift.mjs` compares the token source against a
 * *snapshot*, and the snapshot format it documents is the payload of
 * `GET /v1/files/<key>/variables/local`. On Enterprise that payload comes from
 * Figma. Below Enterprise that endpoint is closed, so the payload has to be
 * produced by something that can read variables on any plan — a plugin — and
 * handed to the detector another way ([015], [016]).
 *
 * This is the one place that produces it, and it is pure. Two callers feed it
 * the same structure from opposite worlds:
 *
 *   `figma-adapter.ts`      from the live Plugin API, for the bridge
 *   `memory-adapter.ts`     from the in-memory model, for the dry run
 *
 * That is the point of the shape below. The dry run applies a real plan to the
 * in-memory model, exports it through this function and runs the real drift
 * detector over the result. The claim "what this plugin writes is what the
 * detector expects to find" is therefore a test rather than a paragraph, and
 * the projection under test is the projection that ships.
 *
 * ---------------------------------------------------------------------------
 * What this is not
 * ---------------------------------------------------------------------------
 *
 * It is the *subset* of the REST response the detector reads, not the whole
 * response. `key`, `remote`, `hiddenFromPublishing`, `scopes`, `codeSyntax`
 * and the rest are absent, because inventing them would be inventing facts.
 * A payload from here carries `generatedBy` beside `meta` so nobody mistakes
 * one for a genuine API response later; the detector reads `meta` and ignores
 * everything beside it.
 *
 * ---------------------------------------------------------------------------
 * Direction
 * ---------------------------------------------------------------------------
 *
 * This reads. Nothing here writes, and nothing downstream of it may: the
 * payload's only consumer is a gate that reports. A value that comes out of
 * here never goes back into `content/tokens/` — that is rule 1, and it is why
 * the bridge that carries this has no write vocabulary at all.
 */

import type { ResolvedValue } from './apply';
import type { FigmaType } from './types';

/* ------------------------------------------------------------------ *
 * The input: a variable backend's own state, ids intact
 * ------------------------------------------------------------------ */

/**
 * Deliberately *not* `Snapshot`.
 *
 * `Snapshot` carries an alias by collection-and-name, because the planner runs
 * before the target necessarily exists. The REST payload carries an alias by
 * **id**, and re-deriving an id from a name would be a lookup that can fail
 * halfway and quietly emit a variable with a missing mode value — which the
 * detector would report as drift that nobody caused. So this takes the state
 * with its ids still on it and never has to guess.
 */
export interface RestSourceCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: { id: string; name: string }[];
}

export interface RestSourceVariable {
  id: string;
  name: string;
  collectionId: string;
  resolvedType: FigmaType;
  description: string;
  /** modeId -> value, aliases already carrying the target's id. */
  valuesByMode: Record<string, ResolvedValue>;
}

export interface RestSource {
  collections: RestSourceCollection[];
  variables: RestSourceVariable[];
}

/* ------------------------------------------------------------------ *
 * The output: Figma's documented read shape
 * ------------------------------------------------------------------ */

export type RestValue =
  | number
  | string
  | boolean
  | { r: number; g: number; b: number; a: number }
  | { type: 'VARIABLE_ALIAS'; id: string };

export interface RestCollection {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  defaultModeId: string;
  variableIds: string[];
}

export interface RestVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: FigmaType;
  description: string;
  valuesByMode: Record<string, RestValue>;
}

export interface RestPayload {
  generatedBy: string;
  meta: {
    variableCollections: Record<string, RestCollection>;
    variables: Record<string, RestVariable>;
  };
}

/** Stamped into every payload, so a saved snapshot says where it came from. */
export const REST_PAYLOAD_ORIGIN = 'mizan-sync: local variables read through the plugin, not the REST API';

/**
 * One value, in the shape the endpoint returns it.
 *
 * Every branch is a straight restatement. There is no unit conversion, no
 * colour-space reinterpretation and no rounding, because the detector compares
 * at 1e-6 and any tidying here would be a difference it could never explain.
 */
function restValue(value: ResolvedValue): RestValue {
  if (value.kind === 'ALIAS') return { type: 'VARIABLE_ALIAS', id: value.id };
  if (value.kind === 'COLOR') {
    return { r: value.value.r, g: value.value.g, b: value.value.b, a: value.value.a };
  }
  return value.value;
}

/**
 * A backend's state as the read endpoint would have returned it.
 *
 * Variables are grouped back onto their collections so `variableIds` is
 * derived rather than trusted: a collection that claims a variable it does not
 * hold is a disagreement this function cannot produce.
 */
export function toRestPayload(source: RestSource): RestPayload {
  const variableIdsByCollection: Record<string, string[]> = {};
  for (const collection of source.collections) variableIdsByCollection[collection.id] = [];

  const variables: Record<string, RestVariable> = {};
  for (const variable of source.variables) {
    const valuesByMode: Record<string, RestValue> = {};
    for (const modeId of Object.keys(variable.valuesByMode)) {
      valuesByMode[modeId] = restValue(variable.valuesByMode[modeId]);
    }
    variables[variable.id] = {
      id: variable.id,
      name: variable.name,
      variableCollectionId: variable.collectionId,
      resolvedType: variable.resolvedType,
      description: variable.description,
      valuesByMode,
    };
    // A variable whose collection is not in the list still appears — dropping
    // it would hide an orphan the detector exists to find.
    if (variableIdsByCollection[variable.collectionId]) {
      variableIdsByCollection[variable.collectionId].push(variable.id);
    }
  }

  const variableCollections: Record<string, RestCollection> = {};
  for (const collection of source.collections) {
    variableCollections[collection.id] = {
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({ modeId: mode.id, name: mode.name })),
      defaultModeId: collection.defaultModeId,
      variableIds: variableIdsByCollection[collection.id],
    };
  }

  return { generatedBy: REST_PAYLOAD_ORIGIN, meta: { variableCollections, variables } };
}
