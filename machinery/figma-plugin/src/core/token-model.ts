/**
 * token-model.ts — DTCG 2025.10 loading, without a filesystem.
 *
 * This is a deliberate port of the half of `machinery/scripts/lib/tokens.mjs`
 * that does not touch `node:fs`: document flattening, `$type` inheritance, mode
 * discovery and mode composition. A Figma plugin runs in a sandbox with no file
 * access, so it is handed a bundle instead of a directory — but the rules about
 * what a token *is* must be the same rules, or the Figma projection stops being
 * a projection.
 *
 * The port is not trusted on assertion. `dry-run.mjs` loads the real token root
 * through `lib/tokens.mjs` and through this file and asserts the two agree,
 * token for token, in every mode. If this file drifts, that test fails.
 *
 * Nothing here knows a colour, a product or a mode name. Everything specific is
 * discovered from the bundle it is given.
 */

import type { TokenBundle } from './types';

/** Directory inside the token root that holds per-mode override files. */
export const MODES_DIR = 'modes';

/** Optional mode manifest, sitting beside the modes directory. */
export const MODES_MANIFEST = 'modes.json';

/** The layer that holds literal values. Nothing here is expected to alias. */
export const PRIMITIVE_LAYER = 'primitive';

/** Token path grammar: dot-separated, lowercase kebab-case segments. */
export const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ALIAS_PATTERN = /^\{([^{}]+)\}$/;

export interface Diagnostic {
  code: string;
  message: string;
  token?: string;
  file?: string;
}

export class Diagnostics {
  errors: Diagnostic[] = [];
  warnings: Diagnostic[] = [];
  private seen = new Set<string>();

  private add(list: Diagnostic[], code: string, message: string, context: Partial<Diagnostic>): void {
    const key = JSON.stringify([code, context.file || '', context.token || '', message]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    list.push({ code, message, ...context });
  }

  error(code: string, message: string, context: Partial<Diagnostic> = {}): void {
    this.add(this.errors, code, message, context);
  }

  warn(code: string, message: string, context: Partial<Diagnostic> = {}): void {
    this.add(this.warnings, code, message, context);
  }

  get ok(): boolean {
    return this.errors.length === 0;
  }
}

export interface TokenNode {
  path: string;
  segments: string[];
  file: string;
  layer: string;
  rawValue: unknown;
  ownType?: string;
  inheritedType?: string;
  type?: string;
  description?: string;
  deprecated?: unknown;
}

export interface ModeRecord {
  id: string;
  file: string;
  dimension?: string;
  overrides: Map<string, TokenNode>;
}

export interface Dimension {
  name: string;
  modes: string[];
}

export interface TokenSet {
  base: Map<string, TokenNode>;
  modes: Map<string, ModeRecord>;
  dimensions: Dimension[];
  modeSource: string;
  files: string[];
  diagnostics: Diagnostics;
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The target of a pure reference value, `"{color.neutral.900}"`, or null. */
export function aliasTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = ALIAS_PATTERN.exec(value.trim());
  return match ? match[1].trim() : null;
}

/* ------------------------------------------------------------------ *
 * Flattening
 * ------------------------------------------------------------------ */

/**
 * Walk one DTCG document into flat token nodes.
 *
 * A token is any object carrying `$value`. Anything else with non-`$` children
 * is a group. `$type` inherits from the nearest ancestor group *within the same
 * file* — files are separate documents, so inheritance does not cross them.
 */
function flattenDocument(
  data: unknown,
  options: { file: string; layer: string; diagnostics: Diagnostics; into: Map<string, TokenNode> },
): void {
  const { file, layer, diagnostics, into } = options;

  if (!isPlainObject(data)) {
    diagnostics.error('invalid-document', 'Token file must contain a JSON object at the top level.', { file });
    return;
  }

  const walk = (node: Record<string, unknown>, segments: string[], inheritedType: string | undefined): void => {
    const ownType = typeof node.$type === 'string' ? node.$type : undefined;
    const path = segments.join('.');
    const childKeys = Object.keys(node).filter((key) => key.charAt(0) !== '$');
    const hasValue = Object.prototype.hasOwnProperty.call(node, '$value');

    if (hasValue) {
      if (childKeys.length > 0) {
        diagnostics.error(
          'token-has-children',
          `Token "${path}" carries $value and also has child keys (${childKeys.join(', ')}). A token cannot also be a group.`,
          { file, token: path },
        );
      }
      const existing = into.get(path);
      if (existing) {
        diagnostics.error(
          'duplicate-token',
          `Token "${path}" is declared in two files: ${existing.file} and ${file}.`,
          { file, token: path },
        );
        return;
      }
      into.set(path, {
        path,
        segments: segments.slice(),
        file,
        layer,
        rawValue: node.$value,
        ownType,
        inheritedType,
        type: ownType || inheritedType,
        description: typeof node.$description === 'string' ? node.$description : undefined,
        deprecated: node.$deprecated,
      });
      return;
    }

    if (childKeys.length === 0) {
      diagnostics.error(
        'missing-value',
        `"${path || '(root)'}" has no $value and no children. A token needs a $value; a group needs members.`,
        { file, token: path },
      );
      return;
    }

    for (const key of childKeys) {
      const child = node[key];
      if (!isPlainObject(child)) {
        diagnostics.error(
          'invalid-node',
          `"${segments.concat(key).join('.')}" is ${Array.isArray(child) ? 'an array' : typeof child}. Every token and group must be an object.`,
          { file, token: segments.concat(key).join('.') },
        );
        continue;
      }
      walk(child, segments.concat(key), ownType || inheritedType);
    }
  };

  walk(data, [], undefined);
}

/* ------------------------------------------------------------------ *
 * Mode discovery
 * ------------------------------------------------------------------ */

/**
 * Modes are content, so they are discovered rather than declared here.
 *
 *  1. A manifest at `<root>/modes.json`, which is authoritative. Dimension
 *     order in the manifest is the order overrides are applied.
 *  2. Failing that, the filenames under `<root>/modes/`: `theme.light.json` is
 *     mode `theme.light` in dimension `theme`; an unprefixed `light.json`
 *     belongs to the single implicit dimension `mode`.
 */
export function discoverModes(
  bundleFiles: Record<string, unknown>,
  diagnostics: Diagnostics,
): { modes: Map<string, ModeRecord>; dimensions: Dimension[]; source: string } {
  const byId = new Map<string, ModeRecord>();
  const modeFiles = Object.keys(bundleFiles)
    .filter((name) => name.indexOf(`${MODES_DIR}/`) === 0 && name.slice(-5) === '.json')
    .sort();

  for (const file of modeFiles) {
    const id = file.slice(MODES_DIR.length + 1, -'.json'.length);
    if (id.indexOf('/') !== -1) continue; // modes/ is flat, exactly as on disk
    byId.set(id, { id, file, overrides: new Map() });
  }

  if (Object.prototype.hasOwnProperty.call(bundleFiles, MODES_MANIFEST)) {
    const manifest = bundleFiles[MODES_MANIFEST];
    const dimensions: Dimension[] = [];
    if (isPlainObject(manifest) && Array.isArray(manifest.dimensions)) {
      for (const entry of manifest.dimensions as unknown[]) {
        if (!isPlainObject(entry) || typeof entry.name !== 'string' || !Array.isArray(entry.modes)) {
          diagnostics.error(
            'invalid-modes-manifest',
            'Each entry of "dimensions" needs a string "name" and an array "modes".',
            { file: MODES_MANIFEST },
          );
          continue;
        }
        const members: string[] = [];
        for (const id of entry.modes as unknown[]) {
          if (typeof id !== 'string' || !byId.has(id)) {
            diagnostics.error(
              'mode-file-missing',
              `Manifest dimension "${entry.name}" lists mode "${String(id)}" but ${MODES_DIR}/${String(id)}.json is not in the bundle.`,
              { file: MODES_MANIFEST },
            );
            continue;
          }
          (byId.get(id) as ModeRecord).dimension = entry.name;
          members.push(id);
        }
        if (members.length > 0) dimensions.push({ name: entry.name, modes: members });
      }
    } else {
      diagnostics.error('invalid-modes-manifest', 'Mode manifest must contain a "dimensions" array.', {
        file: MODES_MANIFEST,
      });
    }

    for (const mode of byId.values()) {
      if (!mode.dimension) {
        diagnostics.error(
          'mode-not-in-manifest',
          `Mode file ${mode.file} is not listed in any dimension of ${MODES_MANIFEST}. Every mode file must belong to a dimension.`,
          { file: mode.file },
        );
      }
    }
    return { modes: byId, dimensions, source: MODES_MANIFEST };
  }

  const grouped = new Map<string, string[]>();
  for (const mode of byId.values()) {
    const dot = mode.id.indexOf('.');
    mode.dimension = dot > 0 ? mode.id.slice(0, dot) : 'mode';
    const list = grouped.get(mode.dimension) || [];
    list.push(mode.id);
    grouped.set(mode.dimension, list);
  }
  const dimensions = Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, modes]) => ({ name, modes: modes.sort() }));

  return { modes: byId, dimensions, source: 'filenames' };
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

/**
 * Load a bundle into the same shape `loadTokenSet` produces from a directory.
 *
 * Directory rules, mirrored: every first-level directory other than `modes/` is
 * a layer and everything under it is a base document; `modes/*.json` are mode
 * overrides; files sitting loose at the root — `modes.json`, `pairs.json` — are
 * not token documents and are not walked as one.
 */
export function loadBundle(bundle: TokenBundle, diagnostics = new Diagnostics()): TokenSet {
  const files = bundle && isPlainObject(bundle.files) ? (bundle.files as Record<string, unknown>) : {};
  const base = new Map<string, TokenNode>();
  const read: string[] = [];

  const modeInfo = discoverModes(files, diagnostics);

  const baseFiles = Object.keys(files)
    .filter((name) => {
      if (name.slice(-5) !== '.json') return false;
      const slash = name.indexOf('/');
      if (slash === -1) return false; // loose at the root: not a token document
      return name.slice(0, slash) !== MODES_DIR;
    })
    .sort();

  for (const file of baseFiles) {
    const layer = file.slice(0, file.indexOf('/'));
    read.push(file);
    flattenDocument(files[file], { file, layer, diagnostics, into: base });
  }

  for (const mode of modeInfo.modes.values()) {
    flattenDocument(files[mode.file], {
      file: mode.file,
      layer: MODES_DIR,
      diagnostics,
      into: mode.overrides,
    });
    read.push(mode.file);
  }

  return {
    base,
    modes: modeInfo.modes,
    dimensions: modeInfo.dimensions,
    modeSource: modeInfo.source,
    files: read,
    diagnostics,
  };
}

/* ------------------------------------------------------------------ *
 * Types across an alias chain
 * ------------------------------------------------------------------ */

/**
 * The `$type` a token effectively has.
 *
 * DTCG lets an aliasing token omit `$type` and take its target's. Figma cannot:
 * a variable's resolved type is fixed at creation, so the chain has to be
 * walked before anything is created.
 */
export function effectiveType(path: string, nodes: Map<string, TokenNode>, seen: string[] = []): string | undefined {
  if (seen.indexOf(path) !== -1) return undefined;
  const node = nodes.get(path);
  if (!node) return undefined;
  if (node.type) return node.type;
  const target = aliasTarget(node.rawValue);
  if (target === null) return undefined;
  return effectiveType(target, nodes, seen.concat(path));
}

/**
 * Which dimensions override a given token path.
 *
 * This is the whole architecture question in one function. A token overridden
 * by exactly one dimension belongs to that dimension's Figma collection. A
 * token overridden by none is invariant and belongs to its layer's collection.
 * A token overridden by two has no Figma representation at all, and the caller
 * turns that into an error rather than guessing.
 */
export function varyingDimensions(path: string, set: TokenSet): string[] {
  const found: string[] = [];
  for (const dimension of set.dimensions) {
    for (const modeId of dimension.modes) {
      const mode = set.modes.get(modeId);
      if (mode && mode.overrides.has(path)) {
        found.push(dimension.name);
        break;
      }
    }
  }
  return found;
}

/**
 * A token's node as it stands in one specific mode: the base node, with the
 * mode's override applied if it has one. Type falls back exactly as
 * `composeModes` in the shared library does.
 */
export function nodeInMode(path: string, set: TokenSet, modeId: string | null): TokenNode | undefined {
  const baseNode = set.base.get(path);
  if (!baseNode) return undefined;
  if (modeId === null) return baseNode;
  const mode = set.modes.get(modeId);
  const override = mode && mode.overrides.get(path);
  if (!override) return baseNode;
  return {
    ...baseNode,
    rawValue: override.rawValue,
    type: override.ownType || override.inheritedType || baseNode.type,
    file: override.file,
  };
}
