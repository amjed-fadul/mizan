/**
 * contract.mjs — the component contract: its schema, its assembly, and the
 * comparison that holds it against the component it describes.
 *
 * Brand-agnostic. Nothing here names a component, a token, a product or a
 * value; the schema document beside the contracts is the shape, and the
 * contracts are the content.
 *
 * Three things live here, and they are one file because they are one rule read
 * three ways:
 *
 * - **The schema is interpreted, not restated.** `component-contract.schema.json`
 *   is an ordinary JSON Schema document, so an editor or any off-the-shelf
 *   validator can read it. This file walks it instead of depending on one,
 *   because a gate that needs an install is not a gate. The subset it
 *   understands is enumerated below and **a keyword outside that subset is an
 *   error in the schema**, not a keyword quietly ignored — an unenforced
 *   constraint that looks enforced is the one failure mode a hand-written
 *   validator has that a real one does not.
 *
 * - **Assembly draws the derived/authored line.** Every property in the schema
 *   carries `x-origin`, and that annotation is what decides which half may
 *   write it. The authored half is a separate file precisely so that this one
 *   can be regenerated without asking a person what they meant.
 *
 * - **Comparison is how the line is held.** Regenerating and comparing is the
 *   whole check: a contract is correct exactly when it is what the generator
 *   would produce from today's source and today's authored file.
 *
 * No CLI.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------------ *
 * Layout
 *
 * Where a contract, its schema and its authored half sit relative to each
 * other. Structure, never values — the same kind of contract the token scripts
 * hold about a token root.
 * ------------------------------------------------------------------ */

/** The schema document, beside the contracts it governs. */
export const SCHEMA_FILE = 'component-contract.schema.json';

/** The authored halves, in a subdirectory so that a contract is never one. */
export const AUTHORED_DIR = 'authored';

/** `ProductCard` becomes `product-card`. One component, one file name. */
export function fileNameFor(component) {
  return component
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Contracts are every JSON file in the directory that is not the schema. */
export function contractFiles(metadataDir) {
  if (!existsSync(metadataDir)) return [];
  return readdirSync(metadataDir)
    .filter((entry) => entry.endsWith('.json') && !entry.endsWith('.schema.json'))
    .sort()
    .map((entry) => join(metadataDir, entry));
}

/* ------------------------------------------------------------------ *
 * The stylesheet beside the component
 *
 * A contract states which tokens a component consumes, and the component's own
 * stylesheet already states it — in the only way that cannot be out of date,
 * by referencing them. So the list is read from there rather than typed out
 * beside it.
 *
 * That needs the token path a custom property came from, and the projection
 * from one to the other lives inside Style Dictionary, which the build depends
 * on and a gate may not: a gate that needs an install is not a gate. It is
 * mirrored here on the same terms `check-drift.mjs` mirrors the Figma
 * projection, and the mirror is safe in a way that one is not, because it is
 * only ever run *forwards* — every token the set defines is projected to a
 * name, and the stylesheet's references are looked up among those. Nothing here
 * inverts a name back into a path, which is the direction that would be a
 * guess.
 * ------------------------------------------------------------------ */

/** The custom property a token path is published as. Mirrors the CSS build. */
export function customPropertyName(tokenPath, prefix = '') {
  return `--${prefix ? `${prefix}-` : ''}${tokenPath.split('.').join('-')}`;
}

/**
 * The stylesheet a component's source sits beside — same directory, same
 * basename. A convention, stated here once rather than assumed in two scripts.
 */
export function stylesheetBeside(sourceFile) {
  const css = sourceFile.replace(/\.[^./\\]+$/, '.css');
  return existsSync(css) ? css : null;
}

const VAR_REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/**
 * Which tokens a stylesheet consumes, and which of its references are not
 * tokens at all.
 *
 * A custom property the token set cannot produce is reported rather than
 * dropped. It is usually a typo and occasionally a component naming a token
 * the system has not decided yet — the second is a legitimate thing to do and
 * has to be declared, which is what `tokens_absent` is for.
 */
export function readStylesheet(css, tokenPaths, prefix = '') {
  const referenced = new Set([...css.matchAll(VAR_REFERENCE)].map((match) => match[1]));
  const tokens = [];
  for (const path of tokenPaths) {
    const name = customPropertyName(path, prefix);
    if (!referenced.has(name)) continue;
    tokens.push(path);
    referenced.delete(name);
  }
  return { tokens: tokens.sort(), unknown: [...referenced].sort() };
}

/* ------------------------------------------------------------------ *
 * The JSON Schema subset
 * ------------------------------------------------------------------ */

/**
 * Keywords this validator implements. Anything else in a schema document is
 * reported as `unsupported-schema-keyword` and fails the run.
 *
 * `x-origin` is ours: it marks which half of the pipeline owns a property.
 * `title` and `description` are documentation and are deliberately inert.
 */
const SUPPORTED = new Set([
  '$schema', '$id', 'title', 'description', 'x-origin',
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties',
  'items', 'minItems', 'uniqueItems', 'minLength', 'pattern', '$defs', '$ref',
]);

const TYPE_OF = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : typeof value;
};

/** Every subschema reachable from the document, for the keyword audit. */
function* subschemas(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  yield node;
  for (const key of ['properties', '$defs']) {
    if (node[key] && typeof node[key] === 'object') {
      for (const child of Object.values(node[key])) yield* subschemas(child);
    }
  }
  if (node.items) yield* subschemas(node.items);
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    yield* subschemas(node.additionalProperties);
  }
}

/**
 * Keywords used by the document that this validator does not implement.
 * Called before any data is validated: a schema this file cannot enforce in
 * full must not be used to claim anything about a contract.
 */
export function unsupportedKeywords(schema) {
  const found = new Set();
  for (const node of subschemas(schema)) {
    for (const key of Object.keys(node)) if (!SUPPORTED.has(key)) found.add(key);
  }
  return [...found].sort();
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) return null;
  let node = root;
  for (const segment of ref.slice(2).split('/')) {
    node = node?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) return null;
  }
  return node;
}

/**
 * Validate `data` against `schema`. Returns a list of
 * `{ path, message }` — every one of them, rather than the first.
 */
export function validate(data, schema, root = schema, path = '') {
  const problems = [];
  const at = path === '' ? '(root)' : path;

  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (!target) return [{ path: at, message: `schema reference ${schema.$ref} does not resolve` }];
    return validate(data, target, root, path);
  }

  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = TYPE_OF(data);
    const ok = allowed.some((type) => (type === 'integer' ? Number.isInteger(data) : type === actual));
    if (!ok) return [{ path: at, message: `expected ${allowed.join(' or ')}, found ${actual}` }];
  }

  if (schema.enum !== undefined && !schema.enum.includes(data)) {
    problems.push({ path: at, message: `expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}, found ${JSON.stringify(data)}` });
  }
  if (schema.const !== undefined && data !== schema.const) {
    problems.push({ path: at, message: `expected ${JSON.stringify(schema.const)}` });
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      problems.push({ path: at, message: `must not be shorter than ${schema.minLength} character(s)` });
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      problems.push({ path: at, message: `does not match ${schema.pattern}` });
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      problems.push({ path: at, message: `must hold at least ${schema.minItems} item(s), found ${data.length}` });
    }
    if (schema.uniqueItems && new Set(data.map((item) => JSON.stringify(item))).size !== data.length) {
      problems.push({ path: at, message: 'items must be unique' });
    }
    if (schema.items) {
      data.forEach((item, index) => problems.push(...validate(item, schema.items, root, `${path}[${index}]`)));
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of schema.required ?? []) {
      if (!(key in data)) problems.push({ path: at, message: `missing required property "${key}"` });
    }
    for (const [key, value] of Object.entries(data)) {
      const child = schema.properties?.[key];
      if (child) {
        problems.push(...validate(value, child, root, path === '' ? key : `${path}.${key}`));
        continue;
      }
      if (schema.additionalProperties === false) {
        problems.push({ path: at, message: `unknown property "${key}"` });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        problems.push(...validate(value, schema.additionalProperties, root, path === '' ? key : `${path}.${key}`));
      }
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * The derived/authored line
 * ------------------------------------------------------------------ */

/**
 * Which half owns which property, read off the schema rather than listed here.
 * `figma` and `props` are the two mixed properties: their shape says which of
 * their members each half owns, so they are named rather than annotated.
 */
export function origins(schema) {
  const authored = [];
  const derived = [];
  for (const [key, value] of Object.entries(schema.properties)) {
    if (value['x-origin'] === 'authored') authored.push(key);
    else if (value['x-origin'] === 'derived') derived.push(key);
  }
  const propAuthored = [];
  for (const [key, value] of Object.entries(schema.$defs.prop.properties)) {
    if (value['x-origin'] === 'authored') propAuthored.push(key);
  }
  return { authored, derived, propAuthored };
}

/** Property order in a generated contract: the schema's own order. */
export function keyOrder(schema) {
  return Object.keys(schema.properties);
}

export function loadSchema(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

function orderObject(object, order) {
  const out = {};
  for (const key of order) if (key in object) out[key] = object[key];
  for (const key of Object.keys(object)) if (!(key in out)) out[key] = object[key];
  return out;
}

/**
 * Validate the authored half against the line the schema draws.
 *
 * The authored file is checked for what it may *not* say as much as for what
 * it must: a description or a default written by a person here would be a
 * second copy of something the source already states, and a second copy is the
 * only way the two halves can ever disagree.
 */
export function checkAuthored(authored, schema) {
  const problems = [];
  const { authored: allowed, derived, propAuthored } = origins(schema);
  const allowedSet = new Set([...allowed, 'figma', 'props']);
  const derivedSet = new Set(derived);

  for (const key of Object.keys(authored)) {
    if (allowedSet.has(key)) continue;
    problems.push({
      path: key,
      message: derivedSet.has(key)
        ? `"${key}" is derived from the component's source and may not be authored. Change the component, then regenerate.`
        : `"${key}" is not part of a contract.`,
    });
  }

  for (const key of allowed) {
    if (schema.required.includes(key) && !(key in authored)) {
      problems.push({ path: key, message: `missing required property "${key}"` });
    }
  }

  if (!authored.figma || typeof authored.figma !== 'object') {
    problems.push({ path: 'figma', message: 'missing required property "figma"' });
  } else {
    for (const key of Object.keys(authored.figma)) {
      if (key === 'component' || key === 'unmapped') continue;
      problems.push({
        path: `figma.${key}`,
        message: key === 'properties'
          ? 'figma.properties is derived from the props and their authored figmaProperty names. Name the property on the prop.'
          : `"${key}" is not part of the Figma mapping.`,
      });
    }
    if (typeof authored.figma.component !== 'string' || authored.figma.component === '') {
      problems.push({ path: 'figma.component', message: 'missing required property "component"' });
    }
  }

  const propNotes = authored.props ?? {};
  if (TYPE_OF(propNotes) !== 'object') {
    problems.push({ path: 'props', message: 'expected an object keyed by prop name' });
  } else {
    const allowedProp = new Set(propAuthored);
    for (const [name, note] of Object.entries(propNotes)) {
      if (TYPE_OF(note) !== 'object') {
        problems.push({ path: `props.${name}`, message: 'expected an object' });
        continue;
      }
      for (const key of Object.keys(note)) {
        if (allowedProp.has(key)) continue;
        problems.push({
          path: `props.${name}.${key}`,
          message: `"${key}" is derived from the component's source and may not be authored.`,
        });
      }
    }
  }

  return problems;
}

/**
 * Build a contract from a component's declared API and its authored half.
 *
 * Returns `{ contract, problems }`. The derived half is written from `api` and
 * nothing else; the authored half is copied through unread. Where the two meet
 * — a prop's Figma property, a prop with no Figma property at all — the
 * *structure* is derived and only the naming is authored, so a prop cannot
 * quietly stop having a Figma side by nobody mentioning it.
 */
export function buildContract({ api, authored, schema, source, schemaRef, generator, authoredRef, stylesheet, stylesheetRef }) {
  const problems = checkAuthored(authored, schema);
  const notes = authored.props ?? {};

  for (const name of Object.keys(notes)) {
    if (api.props.some((prop) => prop.name === name)) continue;
    problems.push({
      path: `props.${name}`,
      message: `"${name}" is not a prop of ${api.propsType}. The authored half may annotate a prop; it may not introduce one.`,
    });
  }

  const props = api.props.map((prop) => {
    const note = notes[prop.name] ?? {};
    const built = {
      name: prop.name,
      type: prop.type,
      values: prop.values,
      required: prop.required,
      default: prop.default,
      description: prop.description,
      figmaProperty: note.figmaProperty ?? null,
    };
    if (prop.notes.length > 0) built.notes = prop.notes;
    if (prop.deprecated !== null) built.deprecated = prop.deprecated;
    if (note.guidance !== undefined) built.guidance = note.guidance;
    if (built.description === '') {
      problems.push({
        path: `props.${prop.name}.description`,
        message: `Prop "${prop.name}" has no JSDoc in ${source}. A prop an agent cannot read is a prop it will guess at — document it in the component, not here.`,
      });
    }
    return orderObject(built, Object.keys(schema.$defs.prop.properties));
  });

  const mapped = props.filter((prop) => prop.figmaProperty !== null);
  const unmapped = authored.figma?.unmapped ?? [];
  const explained = new Set(unmapped.map((entry) => entry.prop));

  for (const prop of props) {
    if (prop.figmaProperty !== null || explained.has(prop.name)) continue;
    problems.push({
      path: `props.${prop.name}.figmaProperty`,
      message: `Prop "${prop.name}" mirrors no Figma property and is not listed under figma.unmapped. Every prop either mirrors a property or says why it does not.`,
    });
  }
  for (const entry of unmapped) {
    if (props.some((prop) => prop.name === entry.prop && prop.figmaProperty === null)) continue;
    problems.push({
      path: `figma.unmapped`,
      message: props.some((prop) => prop.name === entry.prop)
        ? `Prop "${entry.prop}" is listed as unmapped and also names a Figma property.`
        : `figma.unmapped names "${entry.prop}", which is not a prop of ${api.propsType}.`,
    });
  }

  // A custom property the stylesheet names and the token set cannot produce is
  // either a typo or a token the system has not decided yet. The second is a
  // legitimate thing for a component to do — naming the token it wants and
  // taking no fallback keeps the gap visible instead of hiding a literal in a
  // component — but it is a claim about the system, so it is declared and
  // reasoned rather than tolerated. Declared, tracked, reported, ungated.
  const declaredAbsent = new Map((authored.tokens_absent ?? []).map((entry) => [entry.property, entry]));
  for (const property of stylesheet?.unknown ?? []) {
    if (declaredAbsent.has(property)) continue;
    problems.push({
      path: 'tokens_absent',
      message: `${stylesheetRef} references ${property}, which no token defines. If that is deliberate — a token the system has not decided yet — declare it under tokens_absent with the reason. If it is not, it is a typo and the property resolves to nothing.`,
    });
  }
  for (const property of declaredAbsent.keys()) {
    if ((stylesheet?.unknown ?? []).includes(property)) continue;
    problems.push({
      path: 'tokens_absent',
      message: `${property} is declared absent and ${stylesheet ? `${stylesheetRef} does not reference it` : 'there is no stylesheet to reference it'}. A declaration nothing exercises is a note pretending to be a check.`,
    });
  }

  const contract = {
    $schema: schemaRef,
    name: api.component,
    status: authored.status,
    source,
    propsType: api.propsType,
    extends: api.extends,
    purpose: authored.purpose,
    responsibilities: authored.responsibilities,
    do: authored.do,
    dont: authored.dont,
    do_not_use_when: authored.do_not_use_when,
    alternatives: authored.alternatives,
    content: authored.content,
    constraints: authored.constraints,
    rtl: authored.rtl,
    accessibility: authored.accessibility,
    stylesheet: stylesheetRef ?? undefined,
    tokens: stylesheet?.tokens,
    tokens_absent: authored.tokens_absent,
    props,
    figma: {
      component: authored.figma?.component,
      properties: mapped.map((prop) => ({
        property: prop.figmaProperty,
        prop: prop.name,
        values: prop.values,
      })),
      ...(unmapped.length > 0 ? { unmapped } : {}),
    },
    aiHints: authored.aiHints,
    deprecation: authored.deprecation,
    generated: {
      by: generator,
      from: source,
      authored: authoredRef,
      note: 'Build output. Edit the component or the authored half and regenerate; an edit made here is overwritten by the next run and reported by check-contracts.mjs in the meantime.',
    },
  };

  for (const key of Object.keys(contract)) if (contract[key] === undefined) delete contract[key];

  return { contract: orderObject(contract, keyOrder(schema)), problems };
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

const PROP_FACTS = [
  ['type', 'prop-type-mismatch'],
  ['required', 'prop-required-mismatch'],
  ['default', 'prop-default-mismatch'],
  ['values', 'prop-values-mismatch'],
  ['description', 'prop-description-drift'],
  ['notes', 'prop-description-drift'],
];

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare a contract against the API its component declares today.
 *
 * The prop-level findings are named individually because "the file differs" is
 * not something anybody can act on, and because each of them is a different
 * mistake: a prop the source added is an unfinished contract, a prop the
 * contract has and the source does not is a promise nothing keeps.
 */
export function compareToSource(contract, api) {
  const findings = [];
  const byName = new Map(contract.props.map((prop) => [prop.name, prop]));
  const inSource = new Map(api.props.map((prop) => [prop.name, prop]));

  if (contract.name !== api.component) {
    findings.push({
      code: 'component-name-mismatch',
      message: `The contract is for "${contract.name}"; ${contract.source} exports "${api.component}".`,
    });
  }
  if (contract.propsType !== api.propsType) {
    findings.push({
      code: 'props-type-mismatch',
      message: `The contract was generated from "${contract.propsType}"; the source declares "${api.propsType}".`,
    });
  }
  if (!same(contract.extends ?? [], api.extends)) {
    findings.push({
      code: 'extends-mismatch',
      message: `The props type now extends ${JSON.stringify(api.extends)}; the contract records ${JSON.stringify(contract.extends ?? [])}.`,
    });
  }

  for (const [name, prop] of inSource) {
    if (byName.has(name)) continue;
    findings.push({
      code: 'prop-missing-in-contract',
      message: `The source declares "${name}: ${prop.type}" and the contract does not mention it.`,
      prop: name,
    });
  }

  for (const [name, prop] of byName) {
    const source = inSource.get(name);
    if (!source) {
      findings.push({
        code: 'prop-unknown-to-source',
        message: `The contract describes "${name}", which ${api.propsType} does not declare. A prop nothing implements is a promise nothing keeps.`,
        prop: name,
      });
      continue;
    }
    for (const [key, code] of PROP_FACTS) {
      // An empty list is written by leaving the property out, so a contract
      // without `notes` and a prop with none are the same claim.
      const stated = key === 'notes' ? (prop.notes ?? []) : prop[key];
      if (same(stated, source[key])) continue;
      findings.push({
        code,
        message: `Prop "${name}": the contract says ${key} is ${JSON.stringify(stated)}; the source says ${JSON.stringify(source[key])}.`,
        prop: name,
      });
    }
    const deprecated = prop.deprecated ?? null;
    if (!same(deprecated, source.deprecated)) {
      findings.push({
        code: 'prop-deprecation-drift',
        message: `Prop "${name}": the contract says deprecated is ${JSON.stringify(deprecated)}; the source says ${JSON.stringify(source.deprecated)}.`,
        prop: name,
      });
    }
  }

  return findings;
}

/**
 * Whatever the prop comparison did not cover.
 *
 * The findings above name the disagreements worth naming; this catches the rest
 * — the authored half edited in the generated file, a key reordered, the
 * generator itself changed — by regenerating and comparing. Nothing is exempt
 * from it, which is the property that makes the contract build output rather
 * than a file that merely started that way.
 */
export function compareToRegenerated(contract, regenerated) {
  if (same(contract, regenerated)) return [];
  const differing = [];
  for (const key of new Set([...Object.keys(contract), ...Object.keys(regenerated)])) {
    if (!same(contract[key], regenerated[key])) differing.push(key);
  }
  if (differing.length === 0) {
    return [{
      code: 'contract-stale',
      message: 'The contract holds the same properties in a different order than the generator writes them. Regenerate.',
    }];
  }
  return [{
    code: 'contract-stale',
    message: `The contract is not what the generator would write from today's source and authored half. Differs at: ${differing.join(', ')}. Regenerate rather than editing this file.`,
  }];
}
