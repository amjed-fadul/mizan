/**
 * figma-adapter.ts — the only file in this plugin that knows Figma exists.
 *
 * It implements `VariablesAdapter` against the Plugin API and nothing else:
 * no planning, no mapping, no token knowledge. Everything above it is the pure
 * core that the command-line dry run also drives.
 *
 * The manifest declares `documentAccess: "dynamic-page"`, so the read side is
 * async and has to happen before planning rather than during it. That is why
 * `readSnapshot()` on this adapter returns a snapshot captured earlier by
 * `captureSnapshot()` instead of reading the document itself.
 */

import type { ResolvedValue, VariablesAdapter } from './core/apply';
import type { FigmaType, PlanValue, Snapshot, SnapshotVariable } from './core/types';

/** Read the whole local variable state into plain data. Async, once, up front. */
export async function captureSnapshot(): Promise<Snapshot> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  const nameById = new Map<string, { name: string; collectionId: string }>();
  for (const variable of variables) {
    nameById.set(variable.id, { name: variable.name, collectionId: variable.variableCollectionId });
  }
  const collectionNameById = new Map<string, string>();
  for (const collection of collections) collectionNameById.set(collection.id, collection.name);

  const snapshotVariables: SnapshotVariable[] = variables.map((variable) => {
    const valuesByMode: Record<string, PlanValue> = {};
    for (const modeId of Object.keys(variable.valuesByMode)) {
      valuesByMode[modeId] = fromFigmaValue(variable.valuesByMode[modeId], nameById, collectionNameById);
    }
    return {
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType as FigmaType,
      description: variable.description || '',
      valuesByMode,
    };
  });

  return {
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
    })),
    variables: snapshotVariables,
  };
}

function fromFigmaValue(
  value: VariableValue,
  nameById: Map<string, { name: string; collectionId: string }>,
  collectionNameById: Map<string, string>,
): PlanValue {
  if (typeof value === 'number') return { kind: 'FLOAT', value };
  if (typeof value === 'string') return { kind: 'STRING', value };
  if (typeof value === 'boolean') return { kind: 'BOOLEAN', value };
  if (value && typeof value === 'object') {
    const asAlias = value as VariableAlias;
    if (asAlias.type === 'VARIABLE_ALIAS') {
      const target = nameById.get(asAlias.id);
      const collection = target ? collectionNameById.get(target.collectionId) : undefined;
      if (target && collection) return { kind: 'ALIAS', collection, name: target.name };
      // A variable in a library, or one that has since been deleted. Reported
      // as a difference rather than guessed at.
      return { kind: 'UNKNOWN', note: 'alias to a variable outside this file' };
    }
    const rgba = value as RGBA;
    if (typeof rgba.r === 'number') {
      return { kind: 'COLOR', value: { r: rgba.r, g: rgba.g, b: rgba.b, a: typeof rgba.a === 'number' ? rgba.a : 1 } };
    }
  }
  return { kind: 'UNKNOWN', note: 'value shape this plugin does not read' };
}

/**
 * The write side. Every method is one Plugin API call, and the ones that need
 * an object rather than an id look it up from the caches filled by
 * `captureSnapshot` plus whatever this run has created.
 */
export class FigmaVariables implements VariablesAdapter {
  private collections = new Map<string, VariableCollection>();
  private variables = new Map<string, Variable>();

  constructor(
    private snapshot: Snapshot,
    collections: VariableCollection[],
    variables: Variable[],
  ) {
    for (const collection of collections) this.collections.set(collection.id, collection);
    for (const variable of variables) this.variables.set(variable.id, variable);
  }

  static async create(): Promise<FigmaVariables> {
    const snapshot = await captureSnapshot();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    return new FigmaVariables(snapshot, collections, variables);
  }

  readSnapshot(): Snapshot {
    return this.snapshot;
  }

  createCollection(name: string): { id: string; defaultModeId: string; defaultModeName: string } {
    const collection = figma.variables.createVariableCollection(name);
    this.collections.set(collection.id, collection);
    return {
      id: collection.id,
      defaultModeId: collection.defaultModeId,
      defaultModeName: collection.modes[0].name,
    };
  }

  renameMode(collectionId: string, modeId: string, name: string): void {
    this.collection(collectionId).renameMode(modeId, name);
  }

  addMode(collectionId: string, name: string): string {
    return this.collection(collectionId).addMode(name);
  }

  createVariable(collectionId: string, name: string, type: FigmaType): string {
    const variable = figma.variables.createVariable(name, this.collection(collectionId), type);
    this.variables.set(variable.id, variable);
    return variable.id;
  }

  setDescription(variableId: string, description: string): void {
    this.variable(variableId).description = description;
  }

  setValue(
    variableId: string,
    modeId: string,
    value: PlanValue,
    resolve: (v: PlanValue) => ResolvedValue,
  ): void {
    const variable = this.variable(variableId);
    const resolved = resolve(value);
    if (resolved.kind === 'ALIAS') {
      // The alias chain is the point: a semantic variable references its
      // primitive rather than restating the value, so a primitive edited later
      // moves everything downstream of it.
      variable.setValueForMode(modeId, figma.variables.createVariableAlias(this.variable(resolved.id)));
      return;
    }
    variable.setValueForMode(modeId, resolved.value as VariableValue);
  }

  private collection(id: string): VariableCollection {
    const found = this.collections.get(id);
    if (!found) throw new Error(`collection ${id} is not loaded`);
    return found;
  }

  private variable(id: string): Variable {
    const found = this.variables.get(id);
    if (!found) throw new Error(`variable ${id} is not loaded`);
    return found;
  }
}
