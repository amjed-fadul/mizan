/**
 * map.ts — DTCG values to Figma variable values.
 *
 * Figma has four variable types: COLOR, FLOAT, STRING, BOOLEAN. DTCG has more
 * than four, and several of them are composites. This file is the whole of the
 * translation, and the whole of the honesty about what does not translate: a
 * type that has no Figma representation is *reported*, never approximated.
 *
 * The rule for every branch below: if representing the value requires inventing
 * information the token did not carry — a root font size, a unit conversion, a
 * flattened composite — the answer is a refusal with a reason, not a guess.
 */

import type { FigmaType, PlanValue, Rgba } from './types';
import { aliasTarget, isPlainObject } from './token-model';
// The one projection rule this plugin does not own alone. See the file's header
// for why it is shared code rather than a comment in two places; the build
// bundles it, so the plugin still ships as one file with no dependencies.
import { narrowFontStack } from '../../../scripts/lib/projection.mjs';

export type MapResult =
  | { ok: true; type: FigmaType; value: PlanValue; note?: string }
  /** The token is an alias. Type comes from the chain; the target is by path. */
  | { ok: true; alias: string; type: FigmaType | undefined }
  | { ok: false; reason: string };

/** DTCG `$type`s that are composites. Figma has no composite variable. */
const COMPOSITE_TYPES = new Set([
  'shadow',
  'typography',
  'border',
  'transition',
  'gradient',
  'strokeStyle',
  'cubicBezier',
]);

/** The Figma type a DTCG `$type` lands on, where the answer is unconditional. */
const TYPE_TABLE: Record<string, FigmaType> = {
  color: 'COLOR',
  dimension: 'FLOAT',
  number: 'FLOAT',
  duration: 'FLOAT',
  fontFamily: 'STRING',
  string: 'STRING',
  boolean: 'BOOLEAN',
};

/**
 * The Figma type for a DTCG type, without looking at a value.
 *
 * `fontWeight` is absent on purpose: DTCG allows both `700` and `"bold"`, and
 * which Figma type that is depends on the value, not the type name.
 */
export function figmaTypeFor(dtcgType: string | undefined, value: unknown): FigmaType | undefined {
  if (dtcgType && COMPOSITE_TYPES.has(dtcgType)) return undefined;
  if (dtcgType && TYPE_TABLE[dtcgType]) return TYPE_TABLE[dtcgType];
  if (dtcgType === 'fontWeight') return typeof value === 'number' ? 'FLOAT' : 'STRING';
  if (dtcgType) return undefined;
  // No declared type: fall back to shape, as the adapter in machinery/scripts does.
  if (typeof value === 'number') return 'FLOAT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'string') return 'STRING';
  if (isColorObject(value)) return 'COLOR';
  if (isDimensionObject(value)) return 'FLOAT';
  return undefined;
}

function isColorObject(value: unknown): value is { colorSpace: string; components: number[]; alpha?: number } {
  return isPlainObject(value) && typeof value.colorSpace === 'string' && Array.isArray(value.components);
}

function isDimensionObject(value: unknown): value is { value: number; unit: string } {
  return isPlainObject(value) && typeof value.value === 'number' && typeof value.unit === 'string';
}

/**
 * Parse a DTCG 2025.10 colour into Figma RGBA.
 *
 * Components are already 0–1 floats in DTCG and Figma wants 0–1 floats, so
 * there is no conversion here — only validation, and a refusal for colour
 * spaces this plugin will not silently reinterpret as sRGB.
 */
export function colorToRgba(value: unknown): { ok: true; value: Rgba } | { ok: false; reason: string } {
  if (typeof value === 'string') {
    return { ok: false, reason: `colour must be a DTCG object, not the string ${JSON.stringify(value)}` };
  }
  if (!isColorObject(value)) {
    return { ok: false, reason: 'colour must be an object with colorSpace and components' };
  }
  if (value.colorSpace !== 'srgb') {
    return {
      ok: false,
      reason: `colour space ${JSON.stringify(value.colorSpace)} has no Figma variable equivalent; only "srgb" is projected`,
    };
  }
  const c = value.components;
  if (c.length !== 3 || !c.every((n) => typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1)) {
    return { ok: false, reason: `components must be three 0–1 floats; got ${JSON.stringify(c)}` };
  }
  const alpha = value.alpha === undefined ? 1 : value.alpha;
  if (typeof alpha !== 'number' || !isFinite(alpha) || alpha < 0 || alpha > 1) {
    return { ok: false, reason: `alpha must be a 0–1 float; got ${JSON.stringify(value.alpha)}` };
  }
  return { ok: true, value: { r: c[0], g: c[1], b: c[2], a: alpha } };
}

/**
 * Translate one token value.
 *
 * `declaredType` is the token's effective `$type` — already walked through any
 * alias chain by the caller, because Figma fixes a variable's type at creation
 * and an alias has to know its target's type before either exists.
 */
export function mapValue(rawValue: unknown, declaredType: string | undefined): MapResult {
  const alias = aliasTarget(rawValue);
  if (alias !== null) {
    return { ok: true, alias, type: figmaTypeFor(declaredType, undefined) };
  }

  if (declaredType && COMPOSITE_TYPES.has(declaredType)) {
    return {
      ok: false,
      reason: `"${declaredType}" is a composite DTCG type and Figma variables hold single values. Figma models this as a style, not a variable.`,
    };
  }

  const type = figmaTypeFor(declaredType, rawValue);
  if (!type) {
    if (Array.isArray(rawValue) || isPlainObject(rawValue)) {
      return {
        ok: false,
        reason: `no Figma variable type for a ${Array.isArray(rawValue) ? 'list' : 'structured'} value of $type ${JSON.stringify(declaredType)}`,
      };
    }
    return { ok: false, reason: `no Figma variable type for $type ${JSON.stringify(declaredType)}` };
  }

  switch (type) {
    case 'COLOR': {
      const parsed = colorToRgba(rawValue);
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      return { ok: true, type, value: { kind: 'COLOR', value: parsed.value } };
    }

    case 'FLOAT': {
      if (typeof rawValue === 'number' && isFinite(rawValue)) {
        return { ok: true, type, value: { kind: 'FLOAT', value: rawValue } };
      }
      if (isDimensionObject(rawValue)) {
        // Figma FLOAT is unitless and its canvas unit is the pixel. `rem`
        // would need a root font size, which is a fact about a document rather
        // than about the token, so it is refused instead of assumed.
        if (rawValue.unit === 'px') {
          return { ok: true, type, value: { kind: 'FLOAT', value: rawValue.value } };
        }
        if (declaredType === 'duration' && (rawValue.unit === 'ms' || rawValue.unit === 's')) {
          const ms = rawValue.unit === 's' ? rawValue.value * 1000 : rawValue.value;
          return {
            ok: true,
            type,
            value: { kind: 'FLOAT', value: ms },
            note: 'duration projected in milliseconds',
          };
        }
        return {
          ok: false,
          reason: `dimension unit "${rawValue.unit}" cannot be projected: a Figma FLOAT is unitless, and converting would mean assuming a root size the token does not state`,
        };
      }
      return { ok: false, reason: `expected a number or a DTCG dimension; got ${JSON.stringify(rawValue)}` };
    }

    case 'STRING': {
      if (typeof rawValue === 'string') {
        return { ok: true, type, value: { kind: 'STRING', value: rawValue } };
      }
      // A DTCG fontFamily may be a stack; a Figma STRING variable holds one
      // value. Which one is not decided here: `narrowFontStack` decides it, and
      // `machinery/scripts/check-drift.mjs` imports the same function to decide
      // what the file *should* hold. A stack is the one projection that throws
      // information away, so the two ends cannot re-derive each other's answer —
      // if they picked differently, the detector would report drift, a sync
      // would run, and the same drift would come back forever.
      const narrowed = narrowFontStack(rawValue);
      if (narrowed !== null) {
        return { ok: true, type, value: { kind: 'STRING', value: narrowed.family }, note: narrowed.note };
      }
      return { ok: false, reason: `expected a string or a list of strings; got ${JSON.stringify(rawValue)}` };
    }

    case 'BOOLEAN': {
      if (typeof rawValue === 'boolean') return { ok: true, type, value: { kind: 'BOOLEAN', value: rawValue } };
      return { ok: false, reason: `expected a boolean; got ${JSON.stringify(rawValue)}` };
    }

    default:
      return { ok: false, reason: `unhandled Figma type ${type}` };
  }
}

/* ------------------------------------------------------------------ *
 * Names
 * ------------------------------------------------------------------ */

/**
 * A token path as a Figma variable name.
 *
 * Figma groups variables on `/` and rejects `.` and `:` in a name, so the DTCG
 * path separator becomes the Figma group separator. Path segments are
 * kebab-case by the schema gate, so nothing else needs escaping — and if a
 * segment ever does, this is the one place that has to learn about it.
 */
export function figmaName(tokenPath: string): string {
  return tokenPath.split('.').join('/');
}

/** The inverse, so a variable read back from Figma can be matched to a token. */
export function tokenPathFromName(name: string): string {
  return name.split('/').join('.');
}

/** Two values equal for the purpose of "is this already what Figma holds?". */
export function valuesEqual(a: PlanValue | null | undefined, b: PlanValue | null | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'COLOR': {
      const other = (b as { value: Rgba }).value;
      return (
        near(a.value.r, other.r) && near(a.value.g, other.g) && near(a.value.b, other.b) && near(a.value.a, other.a)
      );
    }
    case 'FLOAT':
      return near(a.value, (b as { value: number }).value);
    case 'STRING':
    case 'BOOLEAN':
      return a.value === (b as { value: string | boolean }).value;
    case 'ALIAS': {
      const other = b as { collection: string; name: string };
      return a.collection === other.collection && a.name === other.name;
    }
    case 'UNKNOWN':
      return false;
    default:
      return false;
  }
}

/**
 * Float comparison with a tolerance, because a value written to Figma and read
 * back has been through a serialisation this plugin does not control. The
 * tolerance is far below one 8-bit colour step (1/255 ≈ 0.0039), so a real
 * change can never hide inside it.
 */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

/** How a value reads in a diff line. */
export function describeValue(value: PlanValue | null | undefined): string {
  if (!value) return '(unset)';
  switch (value.kind) {
    case 'COLOR': {
      const hex = [value.value.r, value.value.g, value.value.b]
        .map((c) => {
          const byte = Math.round(Math.min(1, Math.max(0, c)) * 255);
          return (byte < 16 ? '0' : '') + byte.toString(16);
        })
        .join('');
      return value.value.a === 1 ? `#${hex}` : `#${hex} @ ${value.value.a}`;
    }
    case 'FLOAT':
      return String(value.value);
    case 'STRING':
      return JSON.stringify(value.value);
    case 'BOOLEAN':
      return String(value.value);
    case 'ALIAS':
      return `→ ${value.collection}/${value.name}`;
    case 'UNKNOWN':
      return `(${value.note})`;
    default:
      return '(unknown)';
  }
}
