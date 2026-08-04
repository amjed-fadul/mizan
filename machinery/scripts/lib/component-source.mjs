/**
 * component-source.mjs — reads a component's TypeScript source and reports the
 * API it declares.
 *
 * Brand-agnostic: it is pointed at a file and discovers everything else. It
 * knows the shape of a component's props declaration, never the contents of one.
 *
 * **It parses a declared subset and refuses everything else.** There is no
 * TypeScript parser here — a gate that needs an install is not a gate, and the
 * one TypeScript dependency in this repository lives behind the Figma plugin's
 * own build step where a gate cannot reach it. The honest way to read TypeScript
 * without a parser is to state exactly which forms are understood and to report
 * an error on anything outside them, which is what this file does. Every refusal
 * carries the line it happened on.
 *
 * The subset, in full:
 *
 *   interface <Name>Props [extends A, B] { … }
 *   type <Name>Props = A & B & { … }
 *
 * whose members are `name: T`, `name?: T` or `readonly name: T`, where `T` is a
 * single type expression written on one or more lines. Defaults are read from a
 * destructuring pattern annotated with the props type — a parameter
 * `({ a = 1 }: Props)`, the second type argument of a `forwardRef`, or a
 * `const { a = 1 } = props` over a parameter annotated with it.
 *
 * Refused, by name rather than by silence: index signatures, call signatures,
 * computed keys, object type literals nested in a member, a props type declared
 * more than once, two destructuring patterns disagreeing about a default, and
 * any member this grammar cannot read.
 *
 * No CLI.
 */

/* ------------------------------------------------------------------ *
 * Masking
 *
 * Structural scanning — brace matching, splitting members — runs over a copy
 * of the source with comments and string bodies blanked, so a brace inside a
 * string or a semicolon inside a comment cannot be mistaken for structure.
 * Content is always sliced from the original at the same offsets, because a
 * type expression is mostly string literals and the masked copy has none.
 * ------------------------------------------------------------------ */

/**
 * Blank out comments and string bodies, preserving length and line breaks.
 * Returns `null` if the source ends inside a string or a block comment — an
 * unterminated literal means every offset after it is a guess.
 */
export function maskNonCode(src) {
  const out = new Array(src.length);
  let state = 'code';
  let quote = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') { out[i] = ' '; out[i + 1] = ' '; i += 2; state = 'line-comment'; continue; }
      if (ch === '/' && next === '*') { out[i] = ' '; out[i + 1] = ' '; i += 2; state = 'block-comment'; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { out[i] = ch; quote = ch; i += 1; state = 'string'; continue; }
      out[i] = ch; i += 1; continue;
    }

    if (state === 'line-comment') {
      if (ch === '\n') { out[i] = '\n'; state = 'code'; } else out[i] = ' ';
      i += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (ch === '*' && next === '/') { out[i] = ' '; out[i + 1] = ' '; i += 2; state = 'code'; continue; }
      out[i] = ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    // state === 'string'
    if (ch === '\\') { out[i] = ' '; out[i + 1] = out[i + 1] === '\n' ? '\n' : ' '; i += 2; continue; }
    if (ch === quote) { out[i] = ch; i += 1; state = 'code'; continue; }
    out[i] = ch === '\n' ? '\n' : ' ';
    i += 1;
  }

  if (state === 'string' || state === 'block-comment') return null;
  return out.join('');
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i += 1) if (src[i] === '\n') line += 1;
  return line;
}

/** Index of the closing bracket matching the opener at `open`, or -1. */
function matchBracket(masked, open) {
  const pairs = { '{': '}', '(': ')', '<': '>', '[': ']' };
  const closer = pairs[masked[open]];
  if (!closer) return -1;
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === masked[open]) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/* ------------------------------------------------------------------ *
 * Type text
 * ------------------------------------------------------------------ */

/**
 * One line, one spelling. A type read from a source file is compared against a
 * type recorded in a contract, so two spellings of the same type must not be
 * two types: whitespace collapses, union bars get one space either side, and a
 * leading bar is dropped.
 */
export function normaliseType(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^\s*\|\s*/, '')
    .trim()
    .replace(/;+$/, '')
    .trim();
}

const STRING_LITERAL = /^(?:'[^']*'|"[^"]*")$/;

/**
 * Bracket depth, one character at a time.
 *
 * `<` and `>` are counted separately and `>` only closes when something is
 * open, because in TypeScript the same character ends a type argument list and
 * also spells the arrow in `(e: E) => void`. Counting them together sends the
 * depth negative on the first handler prop, and every split after that one
 * happens in the wrong place.
 */
class Depth {
  constructor() { this.brackets = 0; this.angle = 0; }

  step(ch) {
    if (ch === '(' || ch === '[' || ch === '{') this.brackets += 1;
    else if (ch === ')' || ch === ']' || ch === '}') this.brackets -= 1;
    else if (ch === '<') this.angle += 1;
    else if (ch === '>' && this.angle > 0) this.angle -= 1;
  }

  get open() { return this.brackets + this.angle; }
}

/** Split a union at its top level — inside no bracket of any kind. */
function splitUnion(masked, text) {
  const parts = [];
  const depth = new Depth();
  let start = 0;
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '|' && depth.open === 0) { parts.push(text.slice(start, i)); start = i + 1; continue; }
    depth.step(ch);
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * The literal members of a string union, or null when the type is not one.
 * A closed set of strings is the thing a Figma variant property mirrors, so it
 * is worth naming separately from the type text it came out of.
 */
export function unionValues(typeText) {
  const masked = maskNonCode(typeText);
  if (masked === null) return null;
  const parts = splitUnion(masked, typeText);
  if (parts.length < 2) return null;
  if (!parts.every((part) => STRING_LITERAL.test(part))) return null;
  return parts.map((part) => part.slice(1, -1));
}

/**
 * String unions declared in this file under a name — `type Variant = 'a' | 'b'`.
 *
 * A prop typed `variant?: ButtonVariant` states its type as a name, and the
 * closed set of strings behind that name is the thing a Figma variant property
 * mirrors. Following the alias one step, in the same file, keeps the members
 * derivable without following imports across the tree — and it keeps them
 * *checked*: widen the alias and the contract's recorded values disagree with
 * the source, which is the whole point of recording them.
 *
 * One step, and only within the file. An alias that resolves to another alias,
 * or to something imported, simply has no members here, which is a smaller
 * claim rather than a wrong one.
 */
function localUnions(src, masked) {
  const unions = new Map();
  for (const match of masked.matchAll(/(?:^|[^\w$])(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    const name = match[1];
    const from = match.index + match[0].length;
    let end = from;
    while (end < masked.length) {
      const newline = masked.indexOf('\n', end);
      if (newline === -1) { end = masked.length; break; }
      // A union may be written one alternative per line; a line beginning with
      // `|` continues the declaration rather than starting something new.
      const next = /^\s*\|/.test(masked.slice(newline + 1, masked.indexOf('\n', newline + 1) + 1 || undefined));
      end = newline;
      if (!next) break;
      end = newline + 1;
    }
    const text = normaliseType(src.slice(from, end));
    const values = unionValues(text);
    if (values) unions.set(name, values);
  }
  return unions;
}

/* ------------------------------------------------------------------ *
 * JSDoc
 * ------------------------------------------------------------------ */

/** The last block comment in `text`, unwrapped, or null. */
function trailingJsDoc(text) {
  const matches = [...text.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  // Only if nothing but whitespace follows it — a comment with code between it
  // and the member is a comment about the code, not about the member.
  if (text.slice(last.index + last[0].length).trim() !== '') return null;
  return last[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .join('\n')
    .trim();
}

/**
 * Split an unwrapped JSDoc body into its summary, the rest of its prose, and
 * its block tags.
 *
 * The first paragraph is the summary and the rest are notes, which is the
 * convention every documentation tool already reads a JSDoc block by. It also
 * keeps a generated contract legible: a twenty-line explanation collapsed into
 * one string is faithful and unreadable, and metadata here is written for
 * humans first and read by machines second.
 */
function splitJsDoc(body) {
  const prose = [];
  const tags = [];
  let current = null;
  for (const line of body.split('\n')) {
    const tag = /^@([a-zA-Z]+)\s*([\s\S]*)$/.exec(line.trim());
    if (tag) {
      current = { tag: tag[1], text: tag[2].trim() };
      tags.push(current);
    } else if (current) {
      current.text = `${current.text} ${line.trim()}`.trim();
    } else {
      prose.push(line.trim());
    }
  }

  const paragraphs = prose
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph !== '');

  return { description: paragraphs[0] ?? '', notes: paragraphs.slice(1), tags };
}

/* ------------------------------------------------------------------ *
 * The props declaration
 * ------------------------------------------------------------------ */

const MEMBER_START = /^\s*(?:\/\*\*|(?:readonly\s+)?[A-Za-z_$][\w$]*\s*\??\s*:)/;

/**
 * Split an interface body into member chunks.
 *
 * `;` and `,` at depth zero end a member. A newline at depth zero also ends one,
 * but only when what follows looks like the start of another member — otherwise
 * a union written one alternative per line would be read as several members.
 */
function splitMembers(masked, body, offset) {
  const chunks = [];
  const depth = new Depth();
  let start = 0;

  // Emptiness is judged on the masked copy, so a chunk holding nothing but a
  // JSDoc comment is not a member — it belongs to the member that follows, and
  // splitting it off would leave every prop undocumented.
  const push = (end) => {
    if (masked.slice(start, end).trim() !== '') {
      chunks.push({ text: body.slice(start, end), index: offset + start });
    }
    start = end + 1;
  };

  for (let i = 0; i < body.length; i += 1) {
    const ch = masked[i];
    if (depth.open === 0 && (ch === ';' || ch === ',')) { push(i); continue; }
    if (depth.open === 0 && ch === '\n'
      && masked.slice(start, i).trim() !== '' && MEMBER_START.test(masked.slice(i + 1))) {
      push(i);
      continue;
    }
    depth.step(ch);
  }
  push(body.length);
  return chunks;
}

const MEMBER = /^\s*(readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([\s\S]+)$/;

/**
 * Find the one declaration of `name` and return its body and what it extends.
 * Two declarations of the same name is a refusal rather than a choice: merging
 * them is a TypeScript feature this reader does not implement, and picking the
 * first would produce a contract missing half its props.
 */
function findPropsDeclaration(src, masked, name, errors) {
  const declaration = new RegExp(
    `(^|[^\\w$])(?:export\\s+)?(interface|type)\\s+${name}\\b`,
    'g',
  );
  const found = [...masked.matchAll(declaration)];
  if (found.length === 0) {
    errors.push({ code: 'props-type-not-found', message: `No \`interface ${name}\` or \`type ${name}\` in this file.` });
    return null;
  }
  if (found.length > 1) {
    errors.push({
      code: 'props-type-redeclared',
      message: `\`${name}\` is declared ${found.length} times. This reader does not merge declarations; one declaration, or the contract would be missing half its props.`,
      line: lineOf(src, found[1].index),
    });
    return null;
  }

  const match = found[0];
  const kind = match[2];
  const after = match.index + match[0].length;
  const brace = masked.indexOf('{', after);
  if (brace === -1) {
    errors.push({ code: 'props-type-unreadable', message: `\`${name}\` has no object body.`, line: lineOf(src, match.index) });
    return null;
  }

  const head = src.slice(after, brace);
  const extendsFrom = [];

  if (kind === 'interface') {
    const clause = /^\s*(?:<[^>]*>)?\s*(?:extends\s+([\s\S]+?))?\s*$/.exec(head);
    if (!clause) {
      errors.push({ code: 'props-type-unreadable', message: `Cannot read the head of \`interface ${name}\`: ${head.trim()}`, line: lineOf(src, match.index) });
      return null;
    }
    if (clause[1]) extendsFrom.push(...splitTopLevel(clause[1]));
  } else {
    // type X = A & B & { … } — everything before the object literal is inherited.
    const clause = /^\s*(?:<[^>]*>)?\s*=\s*([\s\S]*)$/.exec(head);
    if (!clause) {
      errors.push({ code: 'props-type-unreadable', message: `Cannot read the head of \`type ${name}\`: ${head.trim()}`, line: lineOf(src, match.index) });
      return null;
    }
    for (const part of clause[1].split('&')) {
      const trimmed = part.trim();
      if (trimmed !== '') extendsFrom.push(trimmed);
    }
  }

  const close = matchBracket(masked, brace);
  if (close === -1) {
    errors.push({ code: 'props-type-unreadable', message: `The body of \`${name}\` is not closed.`, line: lineOf(src, brace) });
    return null;
  }

  // A second object literal in a `type X = { … } & { … }` would be silently
  // dropped, so it is refused instead.
  const tail = masked.slice(close + 1);
  if (kind === 'type' && /^\s*&/.test(tail)) {
    errors.push({
      code: 'props-type-unreadable',
      message: `\`type ${name}\` intersects more than one object literal. Declare the members in one body.`,
      line: lineOf(src, close),
    });
    return null;
  }

  return { bodyStart: brace + 1, bodyEnd: close, extends: extendsFrom };
}

/**
 * The same split, over a region of the masked source, reporting offsets rather
 * than text. A destructuring entry has to be sliced from the *original* source
 * to read its default expression, and searching for the masked text to find it
 * again would land on the wrong copy the moment two entries look alike.
 */
function splitTopLevelAt(masked, from, to) {
  const parts = [];
  const depth = new Depth();
  let start = from;
  for (let i = from; i < to; i += 1) {
    const ch = masked[i];
    if (ch === ',' && depth.open === 0) { parts.push({ start, end: i }); start = i + 1; continue; }
    depth.step(ch);
  }
  parts.push({ start, end: to });
  return parts;
}

/** Split `A, B<C, D>` on its top-level commas. */
function splitTopLevel(text) {
  const parts = [];
  const depth = new Depth();
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ',' && depth.open === 0) { parts.push(text.slice(start, i)); start = i + 1; continue; }
    depth.step(ch);
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

/**
 * Every destructuring pattern that speaks for this props type.
 *
 * A default is a fact about the component, and the component states it in one
 * of three places depending on how it was written. All three are read, and a
 * disagreement between two of them is an error rather than a winner: two
 * patterns with different defaults for the same prop means the component's
 * behaviour depends on which code path ran, which no contract can describe.
 */
function findDefaults(src, masked, propsTypeName, errors) {
  const patterns = [];

  // ({ … }: Props)
  const annotated = new RegExp(`\\}\\s*:\\s*${propsTypeName}\\b`, 'g');
  for (const match of masked.matchAll(annotated)) {
    const open = openerFor(masked, match.index);
    if (open !== -1) patterns.push(open);
  }

  // forwardRef<T, Props>(({ … }, ref) => …)
  const forwardRef = new RegExp(`forwardRef\\s*<[^>]*?,\\s*${propsTypeName}\\s*>\\s*\\(`, 'g');
  for (const match of masked.matchAll(forwardRef)) {
    const paren = masked.indexOf('(', match.index + match[0].length - 1);
    const inner = masked.indexOf('(', paren + 1);
    if (inner === -1) continue;
    const brace = firstNonSpace(masked, inner + 1);
    if (masked[brace] === '{') patterns.push(brace);
  }

  // function C(props: Props) { const { … } = props }
  const param = new RegExp(`([A-Za-z_$][\\w$]*)\\s*:\\s*${propsTypeName}\\b`, 'g');
  for (const match of masked.matchAll(param)) {
    const name = match[1];
    const destructure = new RegExp(`(?:const|let|var)\\s*\\{`, 'g');
    for (const decl of masked.matchAll(destructure)) {
      const brace = masked.indexOf('{', decl.index);
      const close = matchBracket(masked, brace);
      if (close === -1) continue;
      if (new RegExp(`^\\s*=\\s*${name}\\b`).test(masked.slice(close + 1))) patterns.push(brace);
    }
  }

  const defaults = new Map();
  const seen = new Set();
  for (const open of patterns) {
    if (seen.has(open)) continue;
    seen.add(open);
    const close = matchBracket(masked, open);
    if (close === -1) continue;
    for (const entry of splitTopLevelAt(masked, open + 1, close)) {
      const real = src.slice(entry.start, entry.end);
      const assignment = /^\s*([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/.exec(real);
      if (!assignment) continue;
      const [, name, value] = assignment;
      const text = value.trim();
      if (defaults.has(name) && defaults.get(name) !== text) {
        errors.push({
          code: 'conflicting-default',
          message: `Prop "${name}" is given two different defaults in this file — ${defaults.get(name)} and ${text}. A contract can describe one.`,
          line: lineOf(src, open),
        });
        continue;
      }
      defaults.set(name, text);
    }
  }

  return { defaults, patterns: seen.size };
}

function firstNonSpace(masked, from) {
  let i = from;
  while (i < masked.length && /\s/.test(masked[i])) i += 1;
  return i;
}

/** The `{` opening the pattern that closes at the `}` just before `index`. */
function openerFor(masked, index) {
  const close = masked.lastIndexOf('}', index);
  if (close === -1) return -1;
  let depth = 0;
  for (let i = close; i >= 0; i -= 1) {
    if (masked[i] === '}') depth += 1;
    else if (masked[i] === '{') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/* ------------------------------------------------------------------ *
 * The reader
 * ------------------------------------------------------------------ */

/** The one exported props type in a file, when there is exactly one. */
export function findPropsTypeName(masked) {
  const names = new Set();
  for (const match of masked.matchAll(/export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*Props)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
}

/** The component the file exports, by convention: `<Name>Props` belongs to `<Name>`. */
function findComponentName(masked, propsTypeName) {
  const base = propsTypeName.replace(/Props$/, '');
  const exported = new RegExp(`export\\s+(?:default\\s+)?(?:function|const|class)\\s+${base}\\b`);
  if (exported.test(masked)) return base;
  if (new RegExp(`export\\s*\\{[^}]*\\b${base}\\b`).test(masked)) return base;
  return base;
}

/**
 * Read a component's declared API.
 *
 * Returns `{ ok, api, errors }`. `api` is null when `ok` is false — a partial
 * read is not offered, because a contract generated from half a props
 * declaration looks exactly like a contract generated from all of it.
 */
export function readComponentApi(source, { file = '<source>', propsType } = {}) {
  const errors = [];
  const masked = maskNonCode(source);
  if (masked === null) {
    errors.push({ code: 'unparsed-source', message: 'The file ends inside a string or a block comment.' });
    return { ok: false, api: null, errors: errors.map((e) => ({ file, ...e })) };
  }

  let propsTypeName = propsType;
  if (!propsTypeName) {
    const candidates = findPropsTypeName(masked);
    if (candidates.length === 0) {
      errors.push({ code: 'props-type-not-found', message: 'No exported type whose name ends in "Props". Name one, or pass --props-type.' });
      return { ok: false, api: null, errors: errors.map((e) => ({ file, ...e })) };
    }
    if (candidates.length > 1) {
      errors.push({
        code: 'props-type-ambiguous',
        message: `This file exports ${candidates.length} props types (${candidates.join(', ')}). Pass --props-type to say which one the contract is about.`,
      });
      return { ok: false, api: null, errors: errors.map((e) => ({ file, ...e })) };
    }
    [propsTypeName] = candidates;
  }

  const declaration = findPropsDeclaration(source, masked, propsTypeName, errors);
  if (!declaration) return { ok: false, api: null, errors: errors.map((e) => ({ file, ...e })) };

  const body = source.slice(declaration.bodyStart, declaration.bodyEnd);
  const maskedBody = masked.slice(declaration.bodyStart, declaration.bodyEnd);
  const chunks = splitMembers(maskedBody, body, declaration.bodyStart);
  const aliases = localUnions(source, masked);

  const props = [];
  const names = new Set();

  for (const chunk of chunks) {
    const code = chunk.text.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    if (code.trim() === '') continue;

    const member = MEMBER.exec(code);
    if (!member) {
      errors.push({
        code: 'unparsed-member',
        message: `Cannot read this member of ${propsTypeName}: ${code.trim().slice(0, 80)}. This reader understands \`name: T\`, \`name?: T\` and \`readonly name: T\` only — index signatures, call signatures and computed keys are outside it.`,
        line: lineOf(source, chunk.index),
      });
      continue;
    }

    const [, , name, optional, rawType] = member;
    const typeText = normaliseType(rawType);

    if (typeText.includes('{')) {
      errors.push({
        code: 'unparsed-member',
        message: `Prop "${name}" is typed with an inline object literal. Give it a named type — a contract that quoted this would be quoting an anonymous shape nothing else can name.`,
        line: lineOf(source, chunk.index),
      });
      continue;
    }
    if (names.has(name)) {
      errors.push({ code: 'duplicate-prop', message: `Prop "${name}" is declared twice in ${propsTypeName}.`, line: lineOf(source, chunk.index) });
      continue;
    }
    names.add(name);

    // The documentation for a member is the block comment that ends just before
    // it. Everything up to and including the last `*/` in the chunk is that
    // comment's neighbourhood; anything after it is the member itself.
    const lastClose = chunk.text.lastIndexOf('*/');
    const doc = lastClose === -1 ? null : trailingJsDoc(chunk.text.slice(0, lastClose + 2));
    const parsed = doc === null ? { description: '', notes: [], tags: [] } : splitJsDoc(doc);
    const deprecated = parsed.tags.find((tag) => tag.tag === 'deprecated');

    props.push({
      name,
      type: typeText,
      values: unionValues(typeText) ?? aliases.get(typeText) ?? null,
      required: optional !== '?',
      description: parsed.description,
      notes: parsed.notes,
      deprecated: deprecated ? (deprecated.text || true) : null,
    });
  }

  const { defaults } = findDefaults(source, masked, propsTypeName, errors);
  for (const prop of props) {
    prop.default = defaults.has(prop.name) ? defaults.get(prop.name) : null;
    if (prop.default !== null && prop.required) {
      errors.push({
        code: 'default-on-required-prop',
        message: `Prop "${prop.name}" is required and also given a default. One of the two is wrong, and a contract cannot say which.`,
      });
    }
  }

  for (const name of defaults.keys()) {
    if (names.has(name)) continue;
    errors.push({
      code: 'default-for-unknown-prop',
      message: `A default is given for "${name}", which ${propsTypeName} does not declare. It is probably inherited — this reader only describes props the file declares, so a default for one it cannot see would be a claim nothing here can check.`,
    });
  }

  if (props.length === 0) {
    errors.push({ code: 'no-props', message: `${propsTypeName} declares no props.` });
  }

  const withFile = errors.map((e) => ({ file, ...e }));
  if (withFile.length > 0) return { ok: false, api: null, errors: withFile };

  return {
    ok: true,
    errors: [],
    api: {
      component: findComponentName(masked, propsTypeName),
      propsType: propsTypeName,
      extends: declaration.extends,
      props: props.sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}
