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

export interface Plan {
  /** Collections and modes this run intends the file to contain. */
  collections: CollectionPlanSummary[];
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
