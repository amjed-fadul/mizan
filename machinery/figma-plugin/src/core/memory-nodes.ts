/**
 * memory-nodes.ts — Figma's scene graph, in memory, for the sheet.
 *
 * The sibling of `memory-adapter.ts`, and it earns its keep the same way: by
 * refusing what Figma refuses, so that a bug in the sheet cannot slide past the
 * dry run and only show up in the desktop app.
 *
 *   - a node is created under a parent that exists, and is appended last
 *   - a node's kind is fixed at creation
 *   - a binding must name a variable that exists, and the variable's resolved
 *     type must be one the field can hold — a COLOR cannot drive a width
 *   - a field must belong to the node's kind: `characters` is a text field,
 *     `cornerRadius` is not
 *   - an explicit mode must name a collection that exists and a mode of *that*
 *     collection
 *   - text may only be set on a TEXT node
 *
 * It is constructed from a variable snapshot rather than inventing one, so the
 * two halves of the dry run — variables and nodes — are checked against each
 * other rather than against two different fictions.
 */

import type { NodesAdapter } from './sheet-apply';
import type {
  FigmaType,
  SheetBinding,
  SheetNodeKind,
  SheetNodeSnapshot,
  SheetPropValue,
  SheetSnapshot,
  Snapshot,
} from './types';

interface MemoryNode {
  id: string;
  name: string;
  kind: SheetNodeKind;
  props: { [prop: string]: SheetPropValue };
  text?: string;
  bindings: { [field: string]: SheetBinding };
  explicitModes: { [collection: string]: string };
  children: MemoryNode[];
}

/** Which Figma types a bindable field accepts, and which node kinds carry it. */
const FIELDS: { [field: string]: { types: FigmaType[]; kinds: SheetNodeKind[] } } = {
  fill: { types: ['COLOR'], kinds: ['RECTANGLE', 'FRAME', 'TEXT'] },
  width: { types: ['FLOAT'], kinds: ['RECTANGLE', 'FRAME'] },
  height: { types: ['FLOAT'], kinds: ['RECTANGLE', 'FRAME'] },
  cornerRadius: { types: ['FLOAT'], kinds: ['RECTANGLE', 'FRAME'] },
  visible: { types: ['BOOLEAN'], kinds: ['RECTANGLE', 'FRAME', 'TEXT'] },
  characters: { types: ['STRING'], kinds: ['TEXT'] },
  fontFamily: { types: ['STRING'], kinds: ['TEXT'] },
  fontWeight: { types: ['FLOAT'], kinds: ['TEXT'] },
};

export class MemoryNodes implements NodesAdapter {
  private page: MemoryNode | null = null;
  private byId = new Map<string, MemoryNode>();
  private counter = 0;

  constructor(private variables: Snapshot) {}

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}:${this.counter}`;
  }

  readSheet(): SheetSnapshot {
    return { page: this.page ? snapshotOf(this.page) : null };
  }

  createPage(name: string): string {
    if (this.page) throw new Error(`the page "${this.page.name}" already exists`);
    const node: MemoryNode = {
      id: this.nextId('page'),
      name,
      kind: 'FRAME',
      props: {},
      bindings: {},
      explicitModes: {},
      children: [],
    };
    this.page = node;
    this.byId.set(node.id, node);
    return node.id;
  }

  createNode(parentId: string, kind: SheetNodeKind, name: string): string {
    const parent = this.node(parentId);
    if (parent.children.some((child) => child.name === name)) {
      throw new Error(`"${parent.name}" already has a child named "${name}"`);
    }
    const node: MemoryNode = {
      id: this.nextId(kind.toLowerCase()),
      name,
      kind,
      props: {},
      bindings: {},
      explicitModes: {},
      children: [],
    };
    parent.children.push(node);
    this.byId.set(node.id, node);
    return node.id;
  }

  setProp(nodeId: string, prop: string, value: SheetPropValue): void {
    const node = this.node(nodeId);
    if (node.bindings[prop]) {
      // Figma would let this through and then overwrite it with the variable's
      // value on the next render, which is exactly how a generator stops being
      // idempotent: the plain value read back would never match what was set.
      throw new Error(`"${node.name}" has ${prop} bound to a variable; setting it as a plain value would be overwritten`);
    }
    node.props[prop] = value;
  }

  setText(nodeId: string, characters: string): void {
    const node = this.node(nodeId);
    if (node.kind !== 'TEXT') throw new Error(`"${node.name}" is a ${node.kind}; only a TEXT node has characters`);
    if (node.bindings.characters) throw new Error(`"${node.name}" has its characters bound to a variable`);
    node.text = characters;
  }

  bind(nodeId: string, field: string, collection: string, variable: string): void {
    const node = this.node(nodeId);
    const rule = FIELDS[field];
    if (!rule) throw new Error(`"${field}" is not a bindable field`);
    if (rule.kinds.indexOf(node.kind) === -1) {
      throw new Error(`"${field}" cannot be bound on a ${node.kind}`);
    }
    const target = this.variable(collection, variable);
    if (!target) throw new Error(`no variable "${variable}" in collection "${collection}"`);
    if (rule.types.indexOf(target) === -1) {
      throw new Error(`"${field}" accepts ${rule.types.join(' or ')}; "${collection}/${variable}" is ${target}`);
    }
    node.bindings[field] = { collection, name: variable };
  }

  setExplicitMode(nodeId: string, collection: string, mode: string): void {
    const node = this.node(nodeId);
    const found = this.variables.collections.filter((c) => c.name === collection)[0];
    if (!found) throw new Error(`no collection named "${collection}"`);
    if (!found.modes.some((m) => m.name === mode)) {
      throw new Error(`collection "${collection}" has no mode named "${mode}"`);
    }
    node.explicitModes[collection] = mode;
  }

  /* -- Test affordances, not part of the adapter -------------------- */

  /** Every node under the page, for assertions about what got built. */
  allNodes(): SheetNodeSnapshot[] {
    const out: SheetNodeSnapshot[] = [];
    const walk = (node: SheetNodeSnapshot): void => {
      out.push(node);
      for (const child of node.children) walk(child);
    };
    if (this.page) walk(snapshotOf(this.page));
    return out;
  }

  /** Add a node the plan never asked for, to prove orphans are reported. */
  addStrayNode(parentPath: string[], name: string, kind: SheetNodeKind): string {
    if (!this.page) throw new Error('no page');
    let node: MemoryNode = this.page;
    for (const segment of parentPath) {
      const next: MemoryNode | undefined = node.children.filter((child) => child.name === segment)[0];
      if (!next) throw new Error(`no node named "${segment}"`);
      node = next;
    }
    return this.createNode(node.id, kind, name);
  }

  private node(id: string): MemoryNode {
    const found = this.byId.get(id);
    if (!found) throw new Error(`no node ${id}`);
    return found;
  }

  private variable(collection: string, name: string): FigmaType | null {
    const found = this.variables.collections.filter((c) => c.name === collection)[0];
    if (!found) return null;
    const variable = this.variables.variables.filter((v) => v.collectionId === found.id && v.name === name)[0];
    return variable ? variable.resolvedType : null;
  }
}

function snapshotOf(node: MemoryNode): SheetNodeSnapshot {
  const props: { [prop: string]: SheetPropValue } = {};
  for (const key of Object.keys(node.props)) props[key] = node.props[key];
  const bindings: { [field: string]: SheetBinding } = {};
  for (const key of Object.keys(node.bindings)) bindings[key] = node.bindings[key];
  const explicitModes: { [collection: string]: string } = {};
  for (const key of Object.keys(node.explicitModes)) explicitModes[key] = node.explicitModes[key];
  const out: SheetNodeSnapshot = {
    id: node.id,
    name: node.name,
    kind: node.kind,
    props,
    bindings,
    explicitModes,
    children: node.children.map(snapshotOf),
  };
  if (node.text !== undefined) out.text = node.text;
  return out;
}
