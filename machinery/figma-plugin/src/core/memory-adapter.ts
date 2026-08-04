/**
 * memory-adapter.ts — Figma's variable model, in memory.
 *
 * This exists so the transformation is provable without Figma. It enforces the
 * constraints that actually bite in the real API and that a lenient stand-in
 * would let a bug slide past:
 *
 *   - a collection always has at least one mode, and starts with exactly one
 *     under a placeholder name
 *   - mode names are unique within a collection
 *   - variable names are unique within a collection, and may not contain
 *     `.` or `:`
 *   - a variable's resolved type is fixed at creation
 *   - a value must match the variable's resolved type, aliases included
 *   - an alias must point at a variable that exists
 *
 * Anything this refuses, Figma refuses. That is the contract; if the two ever
 * disagree, this file is the one that is wrong.
 */

import type { ResolvedValue, VariablesAdapter } from './apply';
import type { FigmaType, PlanValue, Snapshot, SnapshotCollection, SnapshotVariable } from './types';

interface MemoryCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: { id: string; name: string }[];
}

interface MemoryVariable {
  id: string;
  name: string;
  collectionId: string;
  resolvedType: FigmaType;
  description: string;
  valuesByMode: Record<string, ResolvedValue>;
}

export class MemoryVariables implements VariablesAdapter {
  private collections: MemoryCollection[] = [];
  private variables: MemoryVariable[] = [];
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}:${this.counter}`;
  }

  readSnapshot(): Snapshot {
    const collections: SnapshotCollection[] = this.collections.map((c) => ({
      id: c.id,
      name: c.name,
      defaultModeId: c.defaultModeId,
      modes: c.modes.map((m) => ({ id: m.id, name: m.name })),
    }));

    const nameById = new Map<string, string>();
    for (const variable of this.variables) nameById.set(variable.id, variable.name);
    const collectionOfVariable = new Map<string, string>();
    for (const variable of this.variables) collectionOfVariable.set(variable.id, variable.collectionId);
    const collectionNameById = new Map<string, string>();
    for (const collection of this.collections) collectionNameById.set(collection.id, collection.name);

    const variables: SnapshotVariable[] = this.variables.map((v) => {
      const valuesByMode: Record<string, PlanValue> = {};
      for (const modeId of Object.keys(v.valuesByMode)) {
        const value = v.valuesByMode[modeId];
        if (value.kind === 'ALIAS') {
          const targetName = nameById.get(value.id);
          const targetCollectionId = collectionOfVariable.get(value.id);
          const targetCollection = targetCollectionId ? collectionNameById.get(targetCollectionId) : undefined;
          valuesByMode[modeId] =
            targetName && targetCollection
              ? { kind: 'ALIAS', collection: targetCollection, name: targetName }
              : { kind: 'UNKNOWN', note: 'alias to a variable that no longer exists' };
        } else {
          valuesByMode[modeId] = value;
        }
      }
      return {
        id: v.id,
        name: v.name,
        collectionId: v.collectionId,
        resolvedType: v.resolvedType,
        description: v.description,
        valuesByMode,
      };
    });

    return { collections, variables };
  }

  createCollection(name: string): { id: string; defaultModeId: string; defaultModeName: string } {
    if (this.collections.some((c) => c.name === name)) {
      throw new Error(`a collection named "${name}" already exists`);
    }
    const id = this.nextId('collection');
    const defaultModeId = this.nextId('mode');
    // Figma's own placeholder. Nothing may rely on this string.
    const defaultModeName = 'Mode 1';
    this.collections.push({ id, name, defaultModeId, modes: [{ id: defaultModeId, name: defaultModeName }] });
    return { id, defaultModeId, defaultModeName };
  }

  renameMode(collectionId: string, modeId: string, name: string): void {
    const collection = this.collection(collectionId);
    const mode = collection.modes.filter((m) => m.id === modeId)[0];
    if (!mode) throw new Error(`no mode ${modeId} in collection "${collection.name}"`);
    if (collection.modes.some((m) => m.id !== modeId && m.name === name)) {
      throw new Error(`collection "${collection.name}" already has a mode named "${name}"`);
    }
    mode.name = name;
  }

  addMode(collectionId: string, name: string): string {
    const collection = this.collection(collectionId);
    if (collection.modes.some((m) => m.name === name)) {
      throw new Error(`collection "${collection.name}" already has a mode named "${name}"`);
    }
    const id = this.nextId('mode');
    collection.modes.push({ id, name });
    return id;
  }

  createVariable(collectionId: string, name: string, type: FigmaType): string {
    const collection = this.collection(collectionId);
    if (name.indexOf('.') !== -1 || name.indexOf(':') !== -1) {
      throw new Error(`variable name "${name}" contains a character Figma does not allow`);
    }
    if (this.variables.some((v) => v.collectionId === collectionId && v.name === name)) {
      throw new Error(`collection "${collection.name}" already has a variable named "${name}"`);
    }
    const id = this.nextId('variable');
    this.variables.push({ id, name, collectionId, resolvedType: type, description: '', valuesByMode: {} });
    return id;
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
    const collection = this.collection(variable.collectionId);
    if (!collection.modes.some((m) => m.id === modeId)) {
      throw new Error(`mode ${modeId} does not belong to collection "${collection.name}"`);
    }
    const resolved = resolve(value);
    if (resolved.kind === 'ALIAS') {
      const target = this.variable(resolved.id);
      if (target.resolvedType !== variable.resolvedType) {
        throw new Error(
          `cannot alias "${variable.name}" (${variable.resolvedType}) to "${target.name}" (${target.resolvedType})`,
        );
      }
      if (target.id === variable.id) throw new Error(`"${variable.name}" cannot alias itself`);
    } else if (resolved.kind !== variable.resolvedType) {
      throw new Error(`"${variable.name}" is ${variable.resolvedType}; got a ${resolved.kind} value`);
    }
    variable.valuesByMode[modeId] = resolved;
  }

  private collection(id: string): MemoryCollection {
    const found = this.collections.filter((c) => c.id === id)[0];
    if (!found) throw new Error(`no collection ${id}`);
    return found;
  }

  private variable(id: string): MemoryVariable {
    const found = this.variables.filter((v) => v.id === id)[0];
    if (!found) throw new Error(`no variable ${id}`);
    return found;
  }
}
