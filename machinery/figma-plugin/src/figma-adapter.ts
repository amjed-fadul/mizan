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
import type { BridgeDocument } from './core/bridge';
import type { RestSource } from './core/rest';
import type { NodesAdapter } from './core/sheet-apply';
import type {
  FigmaType,
  PlanValue,
  SheetBinding,
  SheetNodeKind,
  SheetNodeSnapshot,
  SheetPropValue,
  SheetSnapshot,
  Snapshot,
  SnapshotVariable,
} from './core/types';

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

/**
 * The same read, ids intact, for the bridge.
 *
 * `captureSnapshot` above is what the *planner* needs, and it carries an alias
 * by collection-and-name because the planner runs before the target
 * necessarily exists. The drift detector reads Figma's REST shape, where an
 * alias is an id — so this is a second read rather than a conversion of the
 * first, and nothing has to be re-derived from a name.
 *
 * It refuses rather than guesses. A value shape this plugin does not recognise
 * throws, naming the variable and the mode, because the alternative is a
 * payload with a mode value quietly missing — which the detector would report
 * as drift that nobody caused, against a variable nobody touched.
 */
export async function captureRestSource(): Promise<RestSource> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  return {
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
    })),
    variables: variables.map((variable) => {
      const valuesByMode: Record<string, ResolvedValue> = {};
      for (const modeId of Object.keys(variable.valuesByMode)) {
        valuesByMode[modeId] = toResolvedValue(variable.valuesByMode[modeId], variable.name, modeId);
      }
      return {
        id: variable.id,
        name: variable.name,
        collectionId: variable.variableCollectionId,
        resolvedType: variable.resolvedType as FigmaType,
        description: variable.description || '',
        valuesByMode,
      };
    }),
  };
}

/**
 * Which document the read above came out of.
 *
 * The bridge sends this beside the variable table so the drift report can name
 * what it read, because a report that cannot name its document is a report whose
 * remedy cannot be checked. Open a different file and every token comes back
 * missing, with "re-sync outward" printed underneath — a remedy that would write
 * the whole token set into the wrong document. Reading the wrong file and being
 * behind have to look different in the report, and the name is what makes them
 * look different.
 *
 * Two things this refuses to do.
 *
 * It does not guess at `figma.fileKey`. That property is not always there — it
 * depends on the permissions the plugin is running under and is `undefined` in
 * contexts that do not grant it — so it is read inside a try/catch and falls
 * back to `null`. A key we do not hold is reported as one we do not hold; a
 * fabricated one would name a document the read did not come from, which is the
 * exact failure this function exists to prevent.
 *
 * It does not throw. Identity is a label on a successful read, not a
 * precondition for one: failing a read of 74 variables because the document's
 * name could not be fetched trades a complete answer for a tidy one. An
 * unavailable name is reported as unknown and the snapshot goes out regardless.
 */
export function captureDocument(): BridgeDocument {
  let name = '';
  let fileKey: string | null = null;
  try {
    name = figma.root.name;
  } catch {
    name = '';
  }
  try {
    const key = figma.fileKey;
    fileKey = typeof key === 'string' && key.length > 0 ? key : null;
  } catch {
    fileKey = null;
  }
  // Named rather than blank: an empty string in a report reads as a bug in the
  // report, and "(unknown)" reads as the fact it is.
  return { name: typeof name === 'string' && name.length > 0 ? name : '(unknown)', fileKey };
}

function toResolvedValue(value: VariableValue, name: string, modeId: string): ResolvedValue {
  if (typeof value === 'number') return { kind: 'FLOAT', value };
  if (typeof value === 'string') return { kind: 'STRING', value };
  if (typeof value === 'boolean') return { kind: 'BOOLEAN', value };
  if (value && typeof value === 'object') {
    const asAlias = value as VariableAlias;
    if (asAlias.type === 'VARIABLE_ALIAS') return { kind: 'ALIAS', id: asAlias.id };
    const rgba = value as RGBA;
    if (typeof rgba.r === 'number') {
      return {
        kind: 'COLOR',
        value: { r: rgba.r, g: rgba.g, b: rgba.b, a: typeof (rgba as RGBA).a === 'number' ? (rgba as RGBA).a : 1 },
      };
    }
  }
  throw new Error(`variable "${name}" holds a value in mode ${modeId} that this plugin cannot read`);
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

/* ================================================================== *
 * The proof sheet
 *
 * The second half of this file, and the only other place Figma exists.
 * Everything it is asked to do arrives as a plan from the pure core; it
 * decides nothing about what a swatch looks like or which variable it binds.
 *
 * One property is enforced here rather than argued for: THE SHEET ADAPTER
 * NEVER LOOKS AT A NODE OUTSIDE ITS OWN PAGE. `captureSheetSnapshot` finds one
 * page by name and walks that; there is no path from here to any other page,
 * so "it does not touch user content" is a fact about the code.
 * ================================================================== */

/** Figma's own default text font. Loaded before any text node is touched. */
const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };

/**
 * Read the generated page, or report that it does not exist yet.
 *
 * `loadAllPagesAsync` is required by `documentAccess: dynamic-page` before the
 * document's pages can be enumerated at all — there is no way to look for one
 * page by name without it.
 */
export async function captureSheetSnapshot(pageName: string, variables: Snapshot): Promise<SheetSnapshot> {
  await figma.loadAllPagesAsync();
  const page = figma.root.children.filter((child) => child.name === pageName)[0];
  if (!page) return { page: null };

  const variableById = new Map<string, SheetBinding>();
  const collectionNameById = new Map<string, string>();
  for (const collection of variables.collections) collectionNameById.set(collection.id, collection.name);
  for (const variable of variables.variables) {
    const collection = collectionNameById.get(variable.collectionId);
    if (collection) variableById.set(variable.id, { collection, name: variable.name });
  }
  const modeNameById = new Map<string, string>();
  for (const collection of variables.collections) {
    for (const mode of collection.modes) modeNameById.set(`${collection.id}\u0000${mode.id}`, mode.name);
  }

  const root: SheetNodeSnapshot = {
    id: page.id,
    name: page.name,
    kind: 'FRAME',
    props: {},
    bindings: {},
    explicitModes: {},
    children: page.children.map((child) => readNode(child, variableById, collectionNameById, modeNameById)),
  };
  return { page: root };
}

function readNode(
  node: SceneNode,
  variableById: Map<string, SheetBinding>,
  collectionNameById: Map<string, string>,
  modeNameById: Map<string, string>,
): SheetNodeSnapshot {
  const kind: SheetNodeKind = node.type === 'TEXT' ? 'TEXT' : node.type === 'RECTANGLE' ? 'RECTANGLE' : 'FRAME';
  const props: { [prop: string]: SheetPropValue } = { x: node.x, y: node.y, width: node.width, height: node.height };

  const asFrame = node as FrameNode;
  if (node.type === 'FRAME') {
    props.layoutMode = asFrame.layoutMode;
    props.itemSpacing = asFrame.itemSpacing;
    props.padding = asFrame.paddingTop;
    props.counterAxisAlignItems = asFrame.counterAxisAlignItems;
  }
  if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
    const radius = (node as RectangleNode).cornerRadius;
    if (typeof radius === 'number') props.cornerRadius = radius;
  }

  const out: SheetNodeSnapshot = {
    id: node.id,
    name: node.name,
    kind,
    props,
    bindings: readBindings(node, variableById),
    explicitModes: readExplicitModes(node, collectionNameById, modeNameById),
    children: [],
  };

  if (node.type === 'TEXT') {
    const size = node.fontSize;
    if (typeof size === 'number') out.props.fontSize = size;
    out.text = node.characters;
  }
  if ('children' in node) {
    out.children = (node as FrameNode).children.map((child) =>
      readNode(child, variableById, collectionNameById, modeNameById),
    );
  }
  return out;
}

/**
 * Bindings, normalised back into the core's vocabulary.
 *
 * Two of Figma's shapes have to be flattened here or the sheet would never be
 * idempotent: a `cornerRadius` binding is *read back* as four per-corner
 * bindings on a shape with independent corners, and the text fields are read
 * back as one entry per character range. The core knows one `cornerRadius` and
 * one `fontFamily`, so this is where the two models are reconciled.
 */
function readBindings(node: SceneNode, variableById: Map<string, SheetBinding>): { [field: string]: SheetBinding } {
  const bound = node.boundVariables;
  const out: { [field: string]: SheetBinding } = {};
  if (!bound) return out;

  const single = (field: string, alias: VariableAlias | undefined): void => {
    if (!alias) return;
    const target = variableById.get(alias.id);
    if (target) out[field] = target;
  };
  const first = (field: string, aliases: readonly VariableAlias[] | undefined): void => {
    if (!aliases || aliases.length === 0) return;
    const target = variableById.get(aliases[0].id);
    if (target) out[field] = target;
  };

  first('fill', bound.fills);
  single('width', bound.width);
  single('height', bound.height);
  single('visible', bound.visible);
  single('characters', bound.characters);
  single('cornerRadius', bound.cornerRadius || bound.topLeftRadius);
  first('fontFamily', bound.fontFamily);
  first('fontWeight', bound.fontWeight);
  return out;
}

function readExplicitModes(
  node: SceneNode,
  collectionNameById: Map<string, string>,
  modeNameById: Map<string, string>,
): { [collection: string]: string } {
  const out: { [collection: string]: string } = {};
  const explicit = (node as FrameNode).explicitVariableModes;
  if (!explicit) return out;
  for (const collectionId of Object.keys(explicit)) {
    const collection = collectionNameById.get(collectionId);
    const mode = modeNameById.get(`${collectionId}\u0000${explicit[collectionId]}`);
    if (collection && mode) out[collection] = mode;
  }
  return out;
}

/** The write side of the sheet. One Plugin API call per method, as above. */
export class FigmaNodes implements NodesAdapter {
  private nodes = new Map<string, BaseNode>();

  constructor(
    private snapshot: SheetSnapshot,
    private collections: VariableCollection[],
    private variables: Variable[],
  ) {}

  /**
   * Load the document, and every font the sheet is going to need.
   *
   * Figma refuses to bind a font family it has not loaded and refuses to set
   * text on a node whose font is not loaded, and both of those are async while
   * applying a plan is not. So the families the plan names are loaded here,
   * up front, in every style the running Figma actually has for them — asking
   * Figma which styles exist beats guessing at style names.
   */
  static async create(pageName: string, variables: Snapshot, families: string[]): Promise<FigmaNodes> {
    await figma.loadFontAsync(DEFAULT_FONT);
    const wanted = [DEFAULT_FONT.family].concat(families.filter((family) => family !== DEFAULT_FONT.family));
    const available = await figma.listAvailableFontsAsync();
    for (const font of available) {
      if (wanted.indexOf(font.fontName.family) === -1) continue;
      try {
        await figma.loadFontAsync(font.fontName);
      } catch {
        // A font the running Figma lists but cannot load is not a reason to
        // refuse the whole sheet; the one binding that needed it will fail and
        // be reported with everything else.
      }
    }
    const sheet = await captureSheetSnapshot(pageName, variables);
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const locals = await figma.variables.getLocalVariablesAsync();
    const adapter = new FigmaNodes(sheet, collections, locals);
    adapter.index(pageName);
    return adapter;
  }

  /**
   * Hold on to the real nodes behind the snapshot's ids.
   *
   * `documentAccess: dynamic-page` has no synchronous lookup by id, and
   * applying a plan is synchronous — so the nodes are collected here, right
   * after `loadAllPagesAsync` has made them reachable, rather than looked up
   * one at a time later.
   */
  private index(pageName: string): void {
    const page = figma.root.children.filter((child) => child.name === pageName)[0];
    if (!page) return;
    this.nodes.set(page.id, page);
    const walk = (node: SceneNode): void => {
      this.nodes.set(node.id, node);
      if ('children' in node) for (const child of (node as FrameNode).children) walk(child);
    };
    for (const child of page.children) walk(child);
  }

  readSheet(): SheetSnapshot {
    return this.snapshot;
  }

  createPage(name: string): string {
    const page = figma.createPage();
    page.name = name;
    this.nodes.set(page.id, page);
    return page.id;
  }

  createNode(parentId: string, kind: SheetNodeKind, name: string): string {
    const parent = this.node(parentId) as ChildrenMixin;
    const node: SceneNode =
      kind === 'TEXT' ? figma.createText() : kind === 'RECTANGLE' ? figma.createRectangle() : figma.createFrame();
    node.name = name;
    parent.appendChild(node);
    this.nodes.set(node.id, node);
    return node.id;
  }

  setProp(nodeId: string, prop: string, value: SheetPropValue): void {
    const node = this.node(nodeId) as SceneNode;
    switch (prop) {
      case 'x':
        node.x = value as number;
        return;
      case 'y':
        node.y = value as number;
        return;
      case 'width':
      case 'height': {
        const frame = node as FrameNode;
        // An auto-layout frame hugs by default; a fixed size on the axis being
        // set has to be declared before the resize will hold.
        if (node.type === 'FRAME' && frame.layoutMode !== 'NONE') {
          const primaryIsVertical = frame.layoutMode === 'VERTICAL';
          const axisIsPrimary = prop === 'height' ? primaryIsVertical : !primaryIsVertical;
          if (axisIsPrimary) frame.primaryAxisSizingMode = 'FIXED';
          else frame.counterAxisSizingMode = 'FIXED';
        }
        const width = prop === 'width' ? (value as number) : node.width;
        const height = prop === 'height' ? (value as number) : node.height;
        (node as RectangleNode).resize(Math.max(width, 0.01), Math.max(height, 0.01));
        return;
      }
      case 'cornerRadius':
        (node as RectangleNode).cornerRadius = value as number;
        return;
      case 'fontSize':
        (node as TextNode).fontSize = value as number;
        return;
      case 'layoutMode': {
        const frame = node as FrameNode;
        frame.layoutMode = value as 'HORIZONTAL' | 'VERTICAL';
        frame.primaryAxisSizingMode = 'AUTO';
        frame.counterAxisSizingMode = 'AUTO';
        return;
      }
      case 'itemSpacing':
        (node as FrameNode).itemSpacing = value as number;
        return;
      case 'padding': {
        const frame = node as FrameNode;
        frame.paddingTop = value as number;
        frame.paddingRight = value as number;
        frame.paddingBottom = value as number;
        frame.paddingLeft = value as number;
        return;
      }
      case 'counterAxisAlignItems':
        (node as FrameNode).counterAxisAlignItems = value as 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
        return;
      default:
        throw new Error(`"${prop}" is not a property this plugin sets`);
    }
  }

  setText(nodeId: string, characters: string): void {
    (this.node(nodeId) as TextNode).characters = characters;
  }

  bind(nodeId: string, field: string, collection: string, name: string): void {
    const node = this.node(nodeId) as SceneNode;
    const variable = this.variable(collection, name);
    if (field === 'fill') {
      // A bound paint is a paint whose colour comes from the variable. The
      // literal colour below is never seen: Figma replaces it on every render.
      const paint = figma.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 },
        'color',
        variable,
      );
      (node as RectangleNode).fills = [paint];
      return;
    }
    node.setBoundVariable(field as VariableBindableNodeField, variable);
  }

  setExplicitMode(nodeId: string, collection: string, mode: string): void {
    const node = this.node(nodeId) as FrameNode;
    const found = this.collections.filter((c) => c.name === collection)[0];
    if (!found) throw new Error(`no collection named "${collection}"`);
    const modeId = found.modes.filter((m) => m.name === mode)[0];
    if (!modeId) throw new Error(`collection "${collection}" has no mode named "${mode}"`);
    node.setExplicitVariableModeForCollection(found, modeId.modeId);
  }

  private node(id: string): BaseNode {
    const cached = this.nodes.get(id);
    if (!cached) throw new Error(`node ${id} is not loaded`);
    return cached;
  }

  private variable(collection: string, name: string): Variable {
    const found = this.collections.filter((c) => c.name === collection)[0];
    if (!found) throw new Error(`no collection named "${collection}"`);
    const variable = this.variables.filter((v) => v.variableCollectionId === found.id && v.name === name)[0];
    if (!variable) throw new Error(`no variable "${name}" in collection "${collection}"`);
    return variable;
  }
}
