/**
 * types.ts — the plain-data vocabulary shared by every part of this plugin.
 *
 * Nothing here imports Figma and nothing here imports Node. Both ends of the
 * plugin — the sandbox and the command-line dry run — speak these shapes, which
 * is what makes the transformation provable outside Figma.
 */

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

/**
 * A token root, flattened into one JSON object because a Figma plugin cannot
 * read a filesystem. Keys are paths relative to the token root, exactly as they
 * appear on disk: `modes.json`, `primitive/color.json`, `modes/theme.dark.json`.
 *
 * `bundle.mjs` produces this from a directory. `ui.html` produces the identical
 * shape from a folder picker. Both paths converge here so there is one loader.
 */
export interface TokenBundle {
  format?: string;
  root?: string;
  generated?: string;
  files: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Figma's variable model, as plain data
 * ------------------------------------------------------------------ */

export type FigmaType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * A value destined for one variable in one mode.
 *
 * An alias is carried **by name**, not by id: the planner runs before anything
 * exists, so the target may be a variable this same run is about to create.
 * `apply` resolves names to ids once, after every variable exists.
 */
export type PlanValue =
  | { kind: 'COLOR'; value: Rgba }
  | { kind: 'FLOAT'; value: number }
  | { kind: 'STRING'; value: string }
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'ALIAS'; collection: string; name: string }
  /** Read back from Figma and not understood — an alias to a deleted variable. */
  | { kind: 'UNKNOWN'; note: string };

export interface SnapshotMode {
  id: string;
  name: string;
}

export interface SnapshotCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: SnapshotMode[];
}

export interface SnapshotVariable {
  id: string;
  /** Figma's own name, slash-separated: `text/secondary-market`. */
  name: string;
  collectionId: string;
  resolvedType: FigmaType;
  description: string;
  /** modeId -> value, already normalised into PlanValue. */
  valuesByMode: Record<string, PlanValue>;
}

/** Everything the planner needs to know about the file it is about to change. */
export interface Snapshot {
  collections: SnapshotCollection[];
  variables: SnapshotVariable[];
}

/* ------------------------------------------------------------------ *
 * The plan
 * ------------------------------------------------------------------ */

export type Action =
  | { op: 'create-collection'; collection: string; firstMode: string }
  | { op: 'rename-mode'; collection: string; from: string; to: string }
  | { op: 'create-mode'; collection: string; mode: string }
  | {
      op: 'create-variable';
      collection: string;
      name: string;
      token: string;
      type: FigmaType;
      description: string;
    }
  | {
      op: 'set-description';
      collection: string;
      name: string;
      token: string;
      from: string;
      to: string;
    }
  | {
      op: 'set-value';
      collection: string;
      name: string;
      token: string;
      mode: string;
      from: PlanValue | null;
      to: PlanValue;
    };

export interface Problem {
  code: string;
  message: string;
  token?: string;
  file?: string;
  collection?: string;
}

/** A token deliberately not projected, and why. Never silent. */
export interface Skip {
  token: string;
  type: string | undefined;
  reason: string;
}

/** Something in the file this plugin did not put there. Reported, never removed. */
export interface Orphan {
  kind: 'variable' | 'mode';
  collection: string;
  name: string;
  note: string;
}

export interface CollectionPlanSummary {
  name: string;
  /** `dimension` — modes come from a mode dimension. `layer` — a single mode. */
  origin: 'dimension' | 'layer';
  modes: string[];
  variableCount: number;
  exists: boolean;
}

/**
 * One variable the projection intends the file to hold.
 *
 * The sync itself does not need this — its actions carry everything it writes —
 * but anything that has to *reason about the same projection* does. The proof
 * sheet is the first such reader: it documents exactly the variables the sync
 * projects, and it gets that list from here rather than repeating the
 * classification. Two projections would drift; one cannot.
 */
export interface ProjectedVariable {
  token: string;
  /** Figma's own name, slash-separated. */
  name: string;
  collection: string;
  type: FigmaType;
  /** The token's effective DTCG `$type`, already walked through any alias chain. */
  dtcgType: string | undefined;
  description: string;
}

export interface Plan {
  /** Collections and modes this run intends the file to contain. */
  collections: CollectionPlanSummary[];
  /** Every variable this projection intends to exist, whether or not it changed. */
  projected: ProjectedVariable[];
  actions: Action[];
  /** Anything that makes the projection wrong. A plan with errors cannot be applied. */
  errors: Problem[];
  warnings: Problem[];
  skipped: Skip[];
  orphans: Orphan[];
  /** Collections in the file this plugin does not manage. Left completely alone. */
  untouched: string[];
  /** Stable digest of `actions`, so apply can refuse a plan the user never saw. */
  signature: string;
  stats: {
    tokensRead: number;
    variablesPlanned: number;
    creates: number;
    updates: number;
  };
}

/* ------------------------------------------------------------------ *
 * The proof sheet
 *
 * A second, separate projection: the same variables, rendered as nodes on a
 * page. It shares this file's vocabulary because it shares the discipline —
 * plain data in, plain data out, find-or-create by name, no delete operation
 * anywhere in the action list.
 * ------------------------------------------------------------------ */

/** The three node kinds the sheet builds. Nothing else is created. */
export type SheetNodeKind = 'FRAME' | 'RECTANGLE' | 'TEXT';

/**
 * A property the sheet may bind a variable to.
 *
 * Every one of these is a real Figma bindable field, and every non-skipped
 * variable is bound to exactly one of them. A value written as a text label
 * would prove nothing and would be invisible to a reader asking Figma which
 * variables a layer uses.
 */
export type SheetBindField =
  | 'fill'
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'characters'
  | 'fontFamily'
  | 'fontWeight'
  | 'visible';

/** The plain properties the sheet sets. Deliberately few: layout and size. */
export type SheetPropName =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'fontSize'
  | 'layoutMode'
  | 'itemSpacing'
  | 'padding'
  | 'counterAxisAlignItems';

export type SheetPropValue = number | string;

/** A binding, carried by name because ids do not exist until apply runs. */
export interface SheetBinding {
  collection: string;
  /** Figma's own variable name, slash-separated. */
  name: string;
}

/** One node of the generated page, as this plugin models it. */
export interface SheetNode {
  name: string;
  kind: SheetNodeKind;
  props: { [prop: string]: SheetPropValue };
  /** Unbound text content. Absent when `characters` is bound. */
  text?: string;
  /** field -> variable. */
  bindings: { [field: string]: SheetBinding };
  /** collection name -> mode name. Only combination frames carry these. */
  explicitModes: { [collection: string]: string };
  children: SheetNode[];
}

/** The same shape, read back from a document, with ids attached. */
export interface SheetNodeSnapshot extends SheetNode {
  id: string;
  children: SheetNodeSnapshot[];
}

/**
 * What the sheet planner is allowed to see of the document: the generated page
 * and nothing else. The adapter never reads another page, which is how "never
 * touches user content" is a property of the code rather than a promise.
 */
export interface SheetSnapshot {
  page: SheetNodeSnapshot | null;
}

/**
 * A node path, from the page down, by name. `[]` is the page itself.
 * Names are unique among siblings — the planner refuses a tree where they
 * are not, because find-or-create by name is the whole idempotency argument.
 */
export type SheetPath = string[];

export type SheetAction =
  | { op: 'create-page'; page: string }
  | { op: 'create-node'; path: SheetPath; kind: SheetNodeKind }
  | { op: 'set-prop'; path: SheetPath; prop: string; from: SheetPropValue | null; to: SheetPropValue }
  | { op: 'set-text'; path: SheetPath; from: string | null; to: string }
  | { op: 'bind'; path: SheetPath; field: string; from: SheetBinding | null; to: SheetBinding }
  | { op: 'set-explicit-mode'; path: SheetPath; collection: string; from: string | null; to: string };

/** A node under the generated page that this plan does not describe. */
export interface SheetOrphan {
  path: SheetPath;
  kind: SheetNodeKind;
  note: string;
}

/** One mode combination, and the frame that renders it. */
export interface SheetCombination {
  /** The frame's name, and its title. */
  label: string;
  /** collection name -> mode name, for every collection the sync manages. */
  modes: { [collection: string]: string };
}

/** How one variable is rendered, for the diff and for the dry run to check. */
export interface SheetSpecimen {
  token: string;
  collection: string;
  /** Figma variable name. */
  name: string;
  /** The group the sheet files it under, taken from the variable name. */
  group: string;
  type: FigmaType;
  dtcgType: string | undefined;
  kind: SheetNodeKind;
  field: SheetBindField;
  /** Why this field, in one sentence, for the diff. */
  reason: string;
}

export interface SheetPlan {
  page: string;
  combinations: SheetCombination[];
  specimens: SheetSpecimen[];
  actions: SheetAction[];
  errors: Problem[];
  warnings: Problem[];
  /** Variables the sync skips. The sheet skips them for the same reason. */
  skipped: Skip[];
  orphans: SheetOrphan[];
  /**
   * Font families the sheet binds. Figma refuses a font binding for a family it
   * has not loaded, and loading is async while applying is not — so the
   * families are named here and loaded before apply runs.
   */
  fonts: string[];
  signature: string;
  stats: {
    variablesDocumented: number;
    nodesPlanned: number;
    creates: number;
    updates: number;
  };
}
