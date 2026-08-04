/**
 * sheet-apply.ts — building a sheet plan, through an adapter.
 *
 * The same shape as `apply.ts`, for the same reason: one implementation of
 * "how a plan is written", driven by Figma in the plugin and by an in-memory
 * scene graph in the dry run. Two build paths would drift, and then what the
 * dry run proves would not be what happens.
 *
 * There is **no delete path** here either. Not for nodes the sheet no longer
 * needs, not for a page it created and later stopped filling. Everything it
 * will not write is reported as an orphan and left where it is. The plugin's
 * action vocabulary still contains nothing that removes anything.
 *
 * The adapter never sees a node outside the generated page, so "it does not
 * touch user content" is enforced by the interface rather than promised in a
 * comment.
 */

import type {
  SheetAction,
  SheetNodeKind,
  SheetNodeSnapshot,
  SheetPath,
  SheetPlan,
  SheetPropValue,
  SheetSnapshot,
} from './types';

/** The narrow surface the sheet needs from a scene graph. */
export interface NodesAdapter {
  /** The generated page as it stands, or null if it does not exist. */
  readSheet(): SheetSnapshot;
  /** Create the generated page. Called at most once, and only when absent. */
  createPage(name: string): string;
  /** Create a child of `parentId`, appended last. */
  createNode(parentId: string, kind: SheetNodeKind, name: string): string;
  setProp(nodeId: string, prop: string, value: SheetPropValue): void;
  setText(nodeId: string, characters: string): void;
  bind(nodeId: string, field: string, collection: string, variable: string): void;
  setExplicitMode(nodeId: string, collection: string, mode: string): void;
}

export interface SheetApplyResult {
  applied: number;
  failures: { action: SheetAction; message: string }[];
}

export function applySheet(plan: SheetPlan, adapter: NodesAdapter): SheetApplyResult {
  const failures: SheetApplyResult['failures'] = [];
  let applied = 0;

  const idByPath = new Map<string, string>();

  const snapshot = adapter.readSheet();
  const record = (node: SheetNodeSnapshot, path: SheetPath): void => {
    idByPath.set(keyOf(path), node.id);
    for (const child of node.children) record(child, path.concat(child.name));
  };
  if (snapshot.page) record(snapshot.page, []);

  const idFor = (path: SheetPath): string => {
    const id = idByPath.get(keyOf(path));
    if (!id) throw new Error(`"${path.length === 0 ? '(page)' : path.join(' / ')}" was expected to exist by now`);
    return id;
  };

  // Structure first, in plan order, so that a parent always exists before the
  // child that names it. The planner emits the tree depth-first, so plan order
  // is already parents-before-children; nothing here reorders it.
  for (const action of plan.actions) {
    try {
      switch (action.op) {
        case 'create-page': {
          idByPath.set(keyOf([]), adapter.createPage(action.page));
          break;
        }
        case 'create-node': {
          const parent = idFor(action.path.slice(0, -1));
          const id = adapter.createNode(parent, action.kind, action.path[action.path.length - 1]);
          idByPath.set(keyOf(action.path), id);
          break;
        }
        case 'set-prop':
          adapter.setProp(idFor(action.path), action.prop, action.to);
          break;
        case 'set-text':
          adapter.setText(idFor(action.path), action.to);
          break;
        case 'bind':
          adapter.bind(idFor(action.path), action.field, action.to.collection, action.to.name);
          break;
        case 'set-explicit-mode':
          adapter.setExplicitMode(idFor(action.path), action.collection, action.to);
          break;
        default:
          break;
      }
      applied += 1;
    } catch (error) {
      failures.push({ action, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { applied, failures };
}

/** A path as a map key. NUL-joined: a node name may itself contain anything. */
function keyOf(path: SheetPath): string {
  return path.join('\u0000');
}
