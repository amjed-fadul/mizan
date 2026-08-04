/**
 * sheet.ts — the proof sheet, decided before anything is drawn.
 *
 * ===========================================================================
 * WHY A SHEET EXISTS AT ALL, AND WHY EVERYTHING ON IT IS BOUND
 * ===========================================================================
 *
 * One artifact, three jobs:
 *
 *   1. DOCUMENTATION AT THE MOMENT OF USE. A designer opening the file sees
 *      every token as a real swatch beside its variable name, in the file they
 *      are working in, rather than in a page they would have to go and find.
 *
 *   2. PROOF THE SYNC LANDED. A swatch is the variable, not a picture of it.
 *      If a swatch renders wrong, the variable is wrong. There is no third
 *      possibility, because nothing on the sheet restates a value.
 *
 *   3. A READABLE SURFACE BELOW ENTERPRISE. Figma's Variables REST API reads
 *      values on Enterprise only, so an educational or Professional plan has
 *      no programmatic way back to the values it just wrote. What *is*
 *      available on every plan is the set of variables bound to a selected
 *      layer. A page that binds every variable therefore makes the whole set
 *      readable by selecting one frame — which is the only route a drift
 *      detector has below Enterprise.
 *
 * Job 3 is the constraint that shapes everything below: EVERY NON-SKIPPED
 * VARIABLE MUST BE BOUND TO A REAL PROPERTY OF A REAL NODE. A hex written into
 * a text label proves nothing, cannot go stale visibly, and is invisible to
 * anything asking Figma what a layer uses. So the sheet never writes a value.
 * It writes bindings, and one unbound plain-text label per swatch carrying the
 * variable's *name* — which is not a value and cannot drift.
 *
 * ===========================================================================
 * WHAT IS BOUND TO WHAT, AND WHY
 * ===========================================================================
 *
 * The choice is made from the token's DTCG `$type` — a fact the token states —
 * and only falls back to reading the variable's group name in the one case a
 * `$type` genuinely cannot decide: a `dimension` is a length, and a corner
 * radius and a gap are both lengths.
 *
 *   color                    RECTANGLE  fill           a colour is a fill
 *   dimension, radius group  RECTANGLE  cornerRadius   the only shape in which
 *                                                      a radius reads as itself
 *   dimension, otherwise     RECTANGLE  width          a px length shown as a
 *   duration                 RECTANGLE  width          length; a duration is a
 *                                                      magnitude too
 *   number                   RECTANGLE  height         a unitless multiplier has
 *                                                      no natural geometry; as a
 *                                                      thickness a small value
 *                                                      still renders, where a
 *                                                      1.5px-wide bar would read
 *                                                      as nothing
 *   fontWeight (numeric)     TEXT       fontWeight     the specimen renders at
 *                                                      the weight it names
 *   fontFamily               TEXT       fontFamily     the specimen renders in
 *                                                      the family it names
 *   string / untyped         TEXT       characters     the content is the value
 *   boolean                  RECTANGLE  visible        Figma's one bindable
 *                                                      boolean property
 *
 * The group vocabulary below is a statement about geometry, not about a brand:
 * it contains no token name, no product and no colour. A group it does not
 * recognise gets the length bar, which is correct for any magnitude.
 *
 * ===========================================================================
 * STRUCTURE
 * ===========================================================================
 *
 * One page. One frame per MODE COMBINATION — the cartesian product of the mode
 * dimensions, four with two dimensions of two modes each. Each frame carries an
 * explicit mode for every collection the sync manages, so it renders exactly
 * one combination and resolves every alias chain without a designer setting
 * anything. Inside a frame: one section per collection, one group per group in
 * the variable names, one swatch per variable.
 *
 * Nothing here names a dimension, a mode, a collection or a token. The page
 * name is the one constant, and it is generic on purpose — see below.
 */

import type {
  FigmaType,
  Plan,
  Problem,
  ProjectedVariable,
  SheetAction,
  SheetBindField,
  SheetBinding,
  SheetCombination,
  SheetNode,
  SheetNodeKind,
  SheetNodeSnapshot,
  SheetOrphan,
  SheetPath,
  SheetPlan,
  SheetPropValue,
  SheetSnapshot,
  SheetSpecimen,
  Snapshot,
  TokenBundle,
} from './types';
import { planSync, signatureOf } from './plan';

/**
 * The generated page's name.
 *
 * This is the one string on the sheet that is not discovered from the token
 * root, and it is deliberately generic rather than derived. Find-or-create by
 * name is the whole idempotency argument, and the three ways tokens reach this
 * plugin do not agree on what the token root is called — a folder picked in
 * Figma carries no root path at all. A page name that changed with the source
 * route would orphan the previous page on every other run. So the *name* is a
 * constant and the *content* is entirely discovered, which is the half that
 * matters: nothing below names a brand, a product, a collection or a mode.
 */
export const SHEET_PAGE_NAME = 'Token proof sheet';

/** The bucket for a variable whose name has no group segment. */
export const UNGROUPED = 'ungrouped';

/*
 * Structural node names.
 *
 * Capitalised on purpose. Token path segments are lowercase kebab-case by the
 * schema gate, so a variable name can never collide with one of these, and
 * find-or-create by name stays unambiguous among siblings.
 */
export const HEADING_NODE = 'Heading';
export const LABEL_NODE = 'Label';
export const SPECIMEN_NODE = 'Specimen';

/* Layout constants. Machinery numbers: no brand, no token, no scale. */
const FRAME_WIDTH = 1200;
const FRAME_GAP = 120;
const SWATCH = 64;
const BAR_HEIGHT = 24;
const BAR_WIDTH = 240;
const TITLE_SIZE = 24;
const SECTION_SIZE = 16;
const GROUP_SIZE = 12;
const LABEL_SIZE = 11;

/**
 * Group names whose members are corner radii rather than lengths in general.
 *
 * The one thing a DTCG `$type` cannot tell us: `dimension` covers both. This
 * list names geometric roles and nothing else — adding a brand's own word here
 * would be a leak, and the fallback (a length bar) is correct without it.
 */
const RADIUS_GROUPS = ['radius', 'radii', 'corner', 'corners', 'rounding'];

interface Rendering {
  kind: SheetNodeKind;
  field: SheetBindField;
  reason: string;
  /** Plain props the specimen node carries. Never a prop that is also bound. */
  props: { [prop: string]: SheetPropValue };
  /** Unbound text content, for a TEXT specimen whose content is not the value. */
  text?: string;
}

/**
 * How one variable is drawn. The whole per-type decision, in one function, so
 * there is one place to read it and one place to change it.
 */
export function renderingFor(variable: ProjectedVariable): Rendering {
  const group = groupOf(variable.name);

  if (variable.type === 'COLOR') {
    return {
      kind: 'RECTANGLE',
      field: 'fill',
      reason: 'a colour is a fill',
      props: { width: SWATCH, height: SWATCH, cornerRadius: 4 },
    };
  }

  if (variable.type === 'BOOLEAN') {
    return {
      kind: 'RECTANGLE',
      field: 'visible',
      reason: "visibility is Figma's one bindable boolean property",
      props: { width: SWATCH, height: BAR_HEIGHT },
    };
  }

  if (variable.type === 'STRING') {
    if (variable.dtcgType === 'fontFamily') {
      return {
        kind: 'TEXT',
        field: 'fontFamily',
        reason: 'the specimen renders in the family the token names',
        props: { fontSize: TITLE_SIZE },
        text: variable.name,
      };
    }
    return {
      kind: 'TEXT',
      field: 'characters',
      reason: 'the text content is the value itself',
      props: { fontSize: SECTION_SIZE },
    };
  }

  // FLOAT.
  if (variable.dtcgType === 'fontWeight') {
    return {
      kind: 'TEXT',
      field: 'fontWeight',
      reason: 'the specimen renders at the weight the token names',
      props: { fontSize: TITLE_SIZE },
      text: variable.name,
    };
  }
  if (variable.dtcgType === 'number') {
    return {
      kind: 'RECTANGLE',
      field: 'height',
      reason:
        'a unitless multiplier has no natural geometry; drawn as a thickness, a value near 1 still renders as a line',
      props: { width: BAR_WIDTH },
    };
  }
  if (variable.dtcgType === 'dimension' && RADIUS_GROUPS.indexOf(group) !== -1) {
    return {
      kind: 'RECTANGLE',
      field: 'cornerRadius',
      reason: 'a radius only reads as itself on a corner',
      props: { width: SWATCH, height: SWATCH },
    };
  }
  return {
    kind: 'RECTANGLE',
    field: 'width',
    reason: 'a length drawn as a length',
    props: { height: BAR_HEIGHT },
  };
}

/** The group a variable is filed under: the first segment of its Figma name. */
export function groupOf(figmaVariableName: string): string {
  const slash = figmaVariableName.indexOf('/');
  return slash === -1 ? UNGROUPED : figmaVariableName.slice(0, slash);
}

/**
 * Every mode combination, as the cartesian product of the mode dimensions.
 *
 * Collections that are token layers have exactly one mode and so multiply the
 * product by one; they are still written onto every frame, because a frame that
 * leaves a collection unset falls back to that collection's default and the
 * point of the sheet is that nothing about what it renders is implicit.
 */
export function combinationsOf(plan: Plan): SheetCombination[] {
  const dimensions = plan.collections.filter((c) => c.origin === 'dimension');
  const layers = plan.collections.filter((c) => c.origin !== 'dimension');

  let rows: { label: string[]; modes: { [collection: string]: string } }[] = [{ label: [], modes: {} }];
  for (const dimension of dimensions) {
    const next: typeof rows = [];
    for (const row of rows) {
      for (const mode of dimension.modes) {
        const modes: { [collection: string]: string } = {};
        for (const key of Object.keys(row.modes)) modes[key] = row.modes[key];
        modes[dimension.name] = mode;
        next.push({ label: row.label.concat(`${dimension.name} ${mode}`), modes });
      }
    }
    rows = next;
  }

  return rows.map((row) => {
    const modes: { [collection: string]: string } = {};
    for (const key of Object.keys(row.modes)) modes[key] = row.modes[key];
    for (const layer of layers) modes[layer.name] = layer.modes[0];
    return {
      // A token root with no mode dimensions still gets one frame; naming it
      // after the thing it is not would be worse than naming it after what it
      // is, which is every mode there is.
      label: row.label.length > 0 ? row.label.join(' / ') : 'all modes',
      modes,
    };
  });
}

/* ------------------------------------------------------------------ *
 * The planner
 * ------------------------------------------------------------------ */

/**
 * Plan the sheet.
 *
 * `snapshot` is the file's variable state — the sheet can only bind variables
 * that exist, so this is checked rather than assumed. `sheet` is the generated
 * page as it currently stands, and nothing else in the document.
 */
export function planSheet(bundle: TokenBundle, snapshot: Snapshot, sheet: SheetSnapshot): SheetPlan {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];

  const sync = planSync(bundle, snapshot);
  for (const problem of sync.errors) {
    errors.push({
      ...problem,
      message: `${problem.message} (the sheet documents the sync's projection, so it cannot be built while that projection has errors)`,
    });
  }

  const combinations = combinationsOf(sync);
  const specimens: SheetSpecimen[] = [];
  const fonts: string[] = [];

  /* -- Which variables actually exist in the file? -------------------- */

  const liveVariables = new Map<string, { type: FigmaType; values: string[] }>();
  for (const variable of snapshot.variables) {
    const collectionName = snapshot.collections.filter((c) => c.id === variable.collectionId)[0];
    if (!collectionName) continue;
    const values: string[] = [];
    for (const modeId of Object.keys(variable.valuesByMode)) {
      const value = variable.valuesByMode[modeId];
      if (value.kind === 'STRING') values.push(value.value);
    }
    liveVariables.set(`${collectionName.name}\u0000${variable.name}`, { type: variable.resolvedType, values });
  }

  const missing: string[] = [];
  const documented: ProjectedVariable[] = [];

  for (const variable of sync.projected) {
    const live = liveVariables.get(`${variable.collection}\u0000${variable.name}`);
    if (!live) {
      missing.push(`${variable.collection}/${variable.name}`);
      continue;
    }
    if (live.type !== variable.type) {
      errors.push({
        code: 'sheet-variable-type',
        token: variable.token,
        collection: variable.collection,
        message: `"${variable.name}" is ${live.type} in this file but the token projects to ${variable.type}. Fix the sync before documenting it.`,
      });
      continue;
    }
    documented.push(variable);

    const rendering = renderingFor(variable);
    specimens.push({
      token: variable.token,
      collection: variable.collection,
      name: variable.name,
      group: groupOf(variable.name),
      type: variable.type,
      dtcgType: variable.dtcgType,
      kind: rendering.kind,
      field: rendering.field,
      reason: rendering.reason,
    });
    if (rendering.field === 'fontFamily') {
      for (const family of live.values) if (fonts.indexOf(family) === -1) fonts.push(family);
    }
  }

  if (missing.length > 0) {
    errors.push({
      code: 'sheet-variable-missing',
      message:
        `${missing.length} variable(s) the sheet documents are not in this file — for example ${missing.slice(0, 3).join(', ')}. ` +
        'The sheet binds variables; it does not create them. Run the sync first, then generate the sheet.',
    });
  }

  /* -- The tree the page should hold --------------------------------- */

  // The root of the desired tree is the page. Its `kind` is never read: a page
  // is created by `create-page`, and the kind comparison in `diffNode` is
  // skipped at depth zero. It is filled in only so the root is the same shape
  // as every other node and the walk below needs no special case.
  const page: SheetNode = {
    name: SHEET_PAGE_NAME,
    kind: 'FRAME',
    props: {},
    bindings: {},
    explicitModes: {},
    children: [],
  };

  combinations.forEach((combination, index) => {
    const frame: SheetNode = {
      name: combination.label,
      kind: 'FRAME',
      props: {
        x: index * (FRAME_WIDTH + FRAME_GAP),
        y: 0,
        width: FRAME_WIDTH,
        layoutMode: 'VERTICAL',
        itemSpacing: 32,
        padding: 32,
        counterAxisAlignItems: 'MIN',
      },
      bindings: {},
      explicitModes: combination.modes,
      children: [heading(combination.label, TITLE_SIZE)],
    };

    for (const collection of sync.collections) {
      const members = documented.filter((v) => v.collection === collection.name);
      if (members.length === 0) continue;

      const section: SheetNode = {
        name: collection.name,
        kind: 'FRAME',
        props: { layoutMode: 'VERTICAL', itemSpacing: 20, padding: 0, counterAxisAlignItems: 'MIN' },
        bindings: {},
        explicitModes: {},
        children: [heading(`${collection.name} (${collection.modes.join(', ')})`, SECTION_SIZE)],
      };

      const groups: string[] = [];
      for (const member of members) {
        const group = groupOf(member.name);
        if (groups.indexOf(group) === -1) groups.push(group);
      }

      for (const group of groups) {
        const groupFrame: SheetNode = {
          name: group,
          kind: 'FRAME',
          props: { layoutMode: 'VERTICAL', itemSpacing: 8, padding: 0, counterAxisAlignItems: 'MIN' },
          bindings: {},
          explicitModes: {},
          children: [heading(group, GROUP_SIZE)],
        };

        for (const member of members) {
          if (groupOf(member.name) !== group) continue;
          const rendering = renderingFor(member);
          const binding: SheetBinding = { collection: member.collection, name: member.name };

          const specimen: SheetNode = {
            name: SPECIMEN_NODE,
            kind: rendering.kind,
            props: rendering.props,
            bindings: { [rendering.field]: binding },
            explicitModes: {},
            children: [],
          };
          if (rendering.text !== undefined) specimen.text = rendering.text;

          groupFrame.children.push({
            name: member.name,
            kind: 'FRAME',
            props: { layoutMode: 'HORIZONTAL', itemSpacing: 16, padding: 0, counterAxisAlignItems: 'CENTER' },
            bindings: {},
            explicitModes: {},
            children: [
              specimen,
              // The one unbound thing on the sheet, and the only thing that can
              // be: a name is not a value, so it cannot go stale.
              { name: LABEL_NODE, kind: 'TEXT', props: { fontSize: LABEL_SIZE }, text: member.name, bindings: {}, explicitModes: {}, children: [] },
            ],
          });
        }

        section.children.push(groupFrame);
      }

      frame.children.push(section);
    }

    page.children.push(frame);
  });

  checkSiblingNames(page, [], errors);

  /* -- Diff against the page as it stands ---------------------------- */

  const actions: SheetAction[] = [];
  const orphans: SheetOrphan[] = [];

  if (!sheet.page) actions.push({ op: 'create-page', page: SHEET_PAGE_NAME });
  diffNode(page, sheet.page, [], actions, orphans, errors);

  const creates = actions.filter((a) => a.op === 'create-page' || a.op === 'create-node').length;

  return {
    page: SHEET_PAGE_NAME,
    combinations,
    specimens,
    actions,
    errors,
    warnings,
    skipped: sync.skipped,
    orphans,
    fonts,
    signature: signatureOf(actions),
    stats: {
      variablesDocumented: documented.length,
      nodesPlanned: countNodes(page) - 1,
      creates,
      updates: actions.length - creates,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function heading(text: string, fontSize: number): SheetNode {
  return {
    name: HEADING_NODE,
    kind: 'TEXT',
    props: { fontSize },
    text,
    bindings: {},
    explicitModes: {},
    children: [],
  };
}

function countNodes(node: SheetNode): number {
  return node.children.reduce((total, child) => total + countNodes(child), 1);
}

/**
 * Names must be unique among siblings, because that is the only handle
 * find-or-create has. A tree that breaks it would silently create a second node
 * on every run, which is the precise opposite of idempotent — so it is an error
 * rather than something to resolve cleverly.
 */
function checkSiblingNames(node: SheetNode, path: SheetPath, errors: Problem[]): void {
  const seen: string[] = [];
  for (const child of node.children) {
    if (seen.indexOf(child.name) !== -1) {
      errors.push({
        code: 'sheet-duplicate-name',
        message: `Two nodes named "${child.name}" would be siblings under ${path.length === 0 ? 'the page' : path.join(' / ')}. Find-or-create matches on name, so this cannot be built.`,
      });
    }
    seen.push(child.name);
    checkSiblingNames(child, path.concat(child.name), errors);
  }
}

/**
 * The diff, one node at a time.
 *
 * Find-or-create by name, update in place, and report anything under the page
 * that this plan does not describe. There is no branch here that removes a
 * node — the same standard the sync holds itself to, for the same reason: a
 * generator that deletes can destroy work it never owned.
 */
function diffNode(
  desired: SheetNode,
  current: SheetNodeSnapshot | null,
  path: SheetPath,
  actions: SheetAction[],
  orphans: SheetOrphan[],
  errors: Problem[],
): void {
  if (current && path.length > 0 && current.kind !== desired.kind) {
    errors.push({
      code: 'sheet-kind-conflict',
      message: `"${path.join(' / ')}" already exists as a ${current.kind} but the sheet needs a ${desired.kind}. A node's type cannot be changed and this plugin does not delete — remove it in Figma and run again.`,
    });
    return;
  }

  if (path.length > 0 && !current) {
    actions.push({ op: 'create-node', path, kind: desired.kind });
  }

  for (const prop of orderProps(Object.keys(desired.props))) {
    const to = desired.props[prop];
    const from = current && Object.prototype.hasOwnProperty.call(current.props, prop) ? current.props[prop] : null;
    if (!samePropValue(from, to)) actions.push({ op: 'set-prop', path, prop, from, to });
  }

  if (desired.text !== undefined) {
    const from = current && current.text !== undefined ? current.text : null;
    if (from !== desired.text) actions.push({ op: 'set-text', path, from, to: desired.text });
  }

  for (const field of Object.keys(desired.bindings).sort()) {
    const to = desired.bindings[field];
    const from = current && current.bindings[field] ? current.bindings[field] : null;
    if (!from || from.collection !== to.collection || from.name !== to.name) {
      actions.push({ op: 'bind', path, field, from, to });
    }
  }

  for (const collection of Object.keys(desired.explicitModes).sort()) {
    const to = desired.explicitModes[collection];
    const from = current && current.explicitModes[collection] ? current.explicitModes[collection] : null;
    if (from !== to) actions.push({ op: 'set-explicit-mode', path, collection, from, to });
  }

  const currentByName = new Map<string, SheetNodeSnapshot>();
  if (current) for (const child of current.children) currentByName.set(child.name, child);

  const desiredNames: string[] = [];
  for (const child of desired.children) {
    desiredNames.push(child.name);
    diffNode(child, currentByName.get(child.name) || null, path.concat(child.name), actions, orphans, errors);
  }

  if (current) {
    for (const child of current.children) {
      if (desiredNames.indexOf(child.name) !== -1) continue;
      orphans.push({
        path: path.concat(child.name),
        kind: child.kind,
        note: 'nothing in the token source produces this node; reported, not deleted',
      });
    }
  }
}

/**
 * The order properties are written in, which is not alphabetical on purpose.
 *
 * Figma rejects an auto-layout property on a frame that has no auto-layout, so
 * `layoutMode` has to be set before `itemSpacing` and the alignment; and a
 * width means something different before and after a frame starts hugging its
 * contents. Sorting these by name would produce a diff that reads tidily and
 * fails to apply. Anything not named here follows, in the order it was built.
 */
const PROP_ORDER = [
  'layoutMode',
  'itemSpacing',
  'padding',
  'counterAxisAlignItems',
  'width',
  'height',
  'cornerRadius',
  'fontSize',
  'x',
  'y',
];

function orderProps(props: string[]): string[] {
  const known = PROP_ORDER.filter((prop) => props.indexOf(prop) !== -1);
  return known.concat(props.filter((prop) => PROP_ORDER.indexOf(prop) === -1));
}

/** Numbers compared with a tolerance, for the round trip through Figma. */
function samePropValue(a: SheetPropValue | null, b: SheetPropValue | null): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  return a === b;
}

/** One diff line, for the UI and the command-line dry run alike. */
export function describeSheetAction(action: SheetAction): string {
  const where = (path: SheetPath) => (path.length === 0 ? '(page)' : path.join(' / '));
  switch (action.op) {
    case 'create-page':
      return `+ page "${action.page}"`;
    case 'create-node':
      return `+ ${action.kind} ${where(action.path)}`;
    case 'set-prop':
      return `~ ${where(action.path)} ${action.prop} ${action.from === null ? '(unset)' : String(action.from)} -> ${String(action.to)}`;
    case 'set-text':
      return `~ ${where(action.path)} text -> ${JSON.stringify(action.to)}`;
    case 'bind':
      return `~ ${where(action.path)} ${action.field} -> ${action.to.collection}/${action.to.name}`;
    case 'set-explicit-mode':
      return `~ ${where(action.path)} mode [${action.collection}] -> ${action.to}`;
    default:
      return JSON.stringify(action);
  }
}

/** True when the sheet may be built. Errors block; warnings do not. */
export function isSheetApplicable(plan: SheetPlan): boolean {
  return plan.errors.length === 0;
}
