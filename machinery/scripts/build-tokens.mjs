#!/usr/bin/env node
/**
 * build-tokens.mjs — the token build.
 *
 * Runs the deterministic gates, adapts the DTCG 2025.10 source into what Style
 * Dictionary can read today, and emits one set of platform outputs for every
 * mode combination discovered in the token root.
 *
 * Brand-agnostic, on the same terms as everything else in machinery/. It knows
 * the *shape* of a token set, the CSS custom-property mechanism, and the two
 * mobile resource models. It does not know a colour, a product, a theme or a
 * mode name — those are read out of the token root by lib/tokens.mjs, exactly
 * as the check scripts read them. Point it at a different company's tokens and
 * it emits that company's system.
 *
 * Usage:
 *   node machinery/scripts/build-tokens.mjs [--root <dir>] [--out <dir>]
 *                                           [--work <dir>] [--prefix <str>]
 *                                           [--no-check] [--quiet]
 *
 *   --root <dir>    token root. Defaults to $TOKENS_ROOT, then content/tokens.
 *   --out <dir>     where generated packages are written. Defaults to
 *                   <repo>/packages/tokens.
 *   --work <dir>    where the adapter's intermediate JSON goes. Defaults to
 *                   <repo>/.tokens-build. A build artefact; safe to delete.
 *   --prefix <str>  prefix for every generated name (`--<prefix>-color-…`).
 *                   Defaults to none: a prefix is a brand decision, so this
 *                   file has no opinion and no default value for it.
 *   --no-check      skip the gates. For debugging the build itself. Never in CI.
 *   --quiet         suppress the summary.
 *
 * Exits 1 if a gate fails, if the token set does not adapt, or if Style
 * Dictionary refuses the result.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import StyleDictionary from 'style-dictionary';

import { adaptTokenSet, defaultWorkDir, writeAdapted } from './dtcg-adapt.mjs';
import {
  defaultTokensRoot,
  displayPath,
  parseArgs,
  repoRoot,
} from './lib/tokens.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** The gates, in the order `npm run check` runs them. */
const GATES = ['check-schema.mjs', 'check-contrast.mjs', 'check-tap-target.mjs'];

/**
 * Types the mobile targets emit.
 *
 * Deliberately two. The iOS and Android outputs exist to prove the pipeline is
 * multi-platform, not to be a mobile deliverable — see packages/tokens/README.md.
 * Colour and dimension are the two types that map cleanly onto both resource
 * models with no invented conventions. Everything else needs a decision that is
 * content, not machinery: whether a dimension is `dp` or `sp` depends on whether
 * the token is spacing or type, which is knowledge about the token, not about
 * its shape. When mobile becomes real, that knowledge arrives as a `$extensions`
 * hint in the source and this list grows.
 */
const MOBILE_TYPES = new Set(['color', 'dimension']);

/** CSS assumes a 16px root. Not a brand value — the CSS spec's own default. */
const REM_BASE = 16;

/* ------------------------------------------------------------------ *
 * Gates
 * ------------------------------------------------------------------ */

/**
 * Run the deterministic gates before anything is generated.
 *
 * A build that runs on a token set the gates reject produces output nobody
 * should trust: a CSS file whose contrast is unverified looks exactly like one
 * whose contrast is verified. So this refuses to start rather than warning
 * afterwards, and it refuses loudly — the gate's own output is passed straight
 * through, because it already says precisely what is wrong.
 */
function runGates(root) {
  for (const gate of GATES) {
    const result = spawnSync(
      process.execPath,
      [join(SCRIPT_DIR, gate), '--root', root, '--quiet'],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) {
      process.stderr.write(
        `\n${'='.repeat(72)}\n`
        + `BUILD REFUSED — ${gate} did not pass.\n\n`
        + 'Nothing was generated. The gates run before the build, not after it,\n'
        + 'because generated output that has not been checked is indistinguishable\n'
        + 'from generated output that has.\n\n'
        + `Fix the errors above in ${displayPath(root)}, then re-run.\n`
        + `${'='.repeat(72)}\n`,
      );
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Transforms
 *
 * The adapter has already turned dimensions into CSS-ready strings ("16px").
 * CSS wants exactly that and needs no further transform. The two mobile targets
 * want a number and a `dp` suffix respectively, so they get one transform each.
 * ------------------------------------------------------------------ */

const valueOf = (token) => token.$value ?? token.value;
const typeOf = (token) => token.$type ?? token.type;

/** "16px" | "1.5rem" -> 16 | 24. Throws on a unit this build cannot convert. */
function toPixels(value, tokenPath) {
  if (typeof value === 'number') return value;
  const match = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(String(value).trim());
  if (!match) {
    throw new Error(`Cannot read dimension "${value}" on token "${tokenPath}".`);
  }
  const number = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === '' || unit === 'px') return number;
  if (unit === 'rem' || unit === 'em') return number * REM_BASE;
  throw new Error(
    `Dimension unit "${unit}" on token "${tokenPath}" has no mobile equivalent. `
    + 'Add one here, or keep the token off the mobile platforms.',
  );
}

function registerTransforms() {
  StyleDictionary.registerTransform({
    name: 'dtcg/dimension/cgfloat',
    type: 'value',
    transitive: true,
    filter: (token) => typeOf(token) === 'dimension',
    transform: (token) => `CGFloat(${toPixels(valueOf(token), token.path.join('.'))})`,
  });

  StyleDictionary.registerTransform({
    name: 'dtcg/dimension/dp',
    type: 'value',
    transitive: true,
    filter: (token) => typeOf(token) === 'dimension',
    transform: (token) => `${toPixels(valueOf(token), token.path.join('.'))}dp`,
  });
}

/* ------------------------------------------------------------------ *
 * Headers
 * ------------------------------------------------------------------ */

function styleDictionaryVersion() {
  try {
    const require = createRequire(import.meta.url);
    // `style-dictionary/package.json` is not in the package's exports map, so
    // it has to be reached through the resolved entry point.
    const entry = require.resolve('style-dictionary');
    const marker = `${sep}style-dictionary${sep}`;
    const packageDir = entry.slice(0, entry.lastIndexOf(marker) + marker.length);
    const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    return `Style Dictionary ${version}`;
  } catch {
    return 'Style Dictionary';
  }
}

/**
 * The "generated — do not edit" header, as plain lines. Every output wraps
 * these in its own comment syntax.
 */
function headerLines(root, extra = []) {
  return [
    'GENERATED FILE — DO NOT EDIT.',
    '',
    `Source:       ${displayPath(root)}  (DTCG 2025.10 — the only token editing surface)`,
    'Generated by: machinery/scripts/build-tokens.mjs',
    `              via machinery/scripts/dtcg-adapt.mjs and ${styleDictionaryVersion()}`,
    ...extra,
    '',
    'Change the source tokens and run `npm run build:tokens`.',
    'Anything edited here is overwritten by the next build.',
  ];
}

const blockComment = (lines) => ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');
const slashComment = (lines) => lines.map((l) => (l ? `// ${l}` : '//')).join('\n');
const xmlComment = (lines) => ['<!--', ...lines.map((l) => (l ? `  ${l}` : '')), '-->'].join('\n');

/* ------------------------------------------------------------------ *
 * Selectors and names
 * ------------------------------------------------------------------ */

/**
 * The attribute selector a mode combination answers to.
 *
 * `:root[data-theme="dark"][data-density="compact"]` — one attribute per mode
 * dimension, named after the dimension. Both halves come from the token root, so
 * a system whose dimensions are named something else entirely gets those names
 * here without anything in this file changing.
 *
 * `:root` rather than a bare attribute selector so the block outranks the
 * plain `:root` block above it on specificity rather than on source order.
 */
function cssSelector(attributes) {
  if (attributes.length === 0) return ':root';
  return `:root${attributes.map((a) => `[data-${a.dimension}="${a.mode}"]`).join('')}`;
}

/** `dark-compact` -> `DarkCompact`. Empty for the single-combination case. */
function pascal(slug) {
  if (slug === 'base') return '';
  return slug.split(/[^a-z0-9]+/i).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/* ------------------------------------------------------------------ *
 * Style Dictionary instances
 * ------------------------------------------------------------------ */

/**
 * One instance per combination. `formatPlatform` returns the formatted text
 * without writing anything, which is what lets the CSS blocks be assembled into
 * a single file below.
 *
 * `log.warnings` is disabled on the CSS platform only, and only because of the
 * invariant/varying split: a mode block filtered down to the tokens that vary
 * still references primitives that live in the `:root` block of the same file,
 * and Style Dictionary cannot see that far and warns about every one of them.
 * The references are correct; the warning is not. Broken references are caught
 * by check-schema.mjs before this runs, so nothing real is being silenced.
 */
function createDictionary(combination, model, { prefix }) {
  const isFirst = model.combinations[0] === combination;
  const cssFiles = [];

  if (isFirst) {
    cssFiles.push({
      destination: 'invariant.css',
      format: 'css/variables',
      filter: (token) => model.invariant.has(token.path.join('.')),
      options: { outputReferences: true, showFileHeader: false, selector: ':root' },
    });
  }
  if (model.varying.size > 0) {
    cssFiles.push({
      destination: `delta.${combination.slug}.css`,
      format: 'css/variables',
      filter: (token) => model.varying.has(token.path.join('.')),
      options: {
        outputReferences: true,
        showFileHeader: false,
        selector: cssSelector(combination.attributes),
      },
    });
  }

  const mobileFilter = (token) => MOBILE_TYPES.has(typeOf(token));

  return new StyleDictionary({
    source: [combination.file],
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      css: {
        transformGroup: 'css',
        prefix,
        files: cssFiles,
      },
      ios: {
        // The stock `ios-swift` group ends in `size/swift/remToCGFloat`, which
        // reads "16px" as 16rem. The adapter already produced a CSS-ready
        // string, so the dimension transform is replaced rather than stacked.
        transforms: ['attribute/cti', 'name/camel', 'color/UIColorSwift', 'dtcg/dimension/cgfloat'],
        prefix,
        files: [{
          destination: `DesignTokens${pascal(combination.slug)}.swift`,
          format: 'ios-swift/enum.swift',
          filter: mobileFilter,
          options: { showFileHeader: false, className: `DesignTokens${pascal(combination.slug)}` },
        }],
      },
      android: {
        transforms: ['attribute/cti', 'name/snake', 'color/hex8android', 'dtcg/dimension/dp'],
        prefix,
        files: [{
          destination: 'tokens.xml',
          format: 'android/resources',
          filter: mobileFilter,
          options: { showFileHeader: false },
        }],
      },
    },
  });
}

/**
 * One instance per overlay, CSS only.
 *
 * Simpler than `createDictionary` because an overlay has no matrix behind it:
 * its adapted document already holds exactly the paths it changes, so there is
 * nothing to filter and no invariant/varying split to respect. `outputReferences`
 * stays on so the emitted block aliases the primitive it was written against —
 * `var(--line-height-arabic-normal)` rather than a re-stated `1.75` — which is
 * what keeps the two scales from drifting apart in the output the way the
 * source already keeps them from drifting apart at the top.
 */
function createOverlayDictionary(overlay, { prefix }) {
  return new StyleDictionary({
    source: [overlay.file],
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      css: {
        transformGroup: 'css',
        prefix,
        files: [{
          destination: `overlay.${overlay.name}.css`,
          format: 'css/variables',
          filter: (token) => overlay.changed.has(token.path.join('.')),
          options: { outputReferences: true, showFileHeader: false, selector: overlay.selector },
        }],
      },
    },
  });
}

/**
 * The companion to `createOverlayDictionary`: the same paths at their base
 * values, scoped to descendants of the overlay that are not themselves in it.
 *
 * `outputReferences` is OFF here, and that is the one real difference. This
 * block redefines the same custom properties the overlay does, so emitting a
 * reference would produce `--x: var(--x)` — a property defined in terms of the
 * value being replaced. The literal is correct and is the same value the
 * `:root` block already carries.
 */
function createRestoreDictionary(overlay, model, { prefix }) {
  return new StyleDictionary({
    source: [model.combinations[0].file],
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      css: {
        transformGroup: 'css',
        prefix,
        files: [{
          destination: `overlay.${overlay.name}.restore.css`,
          format: 'css/variables',
          filter: (token) => overlay.changed.has(token.path.join('.')),
          options: {
            outputReferences: false,
            showFileHeader: false,
            selector: `${overlay.selector} :not(${overlay.selector})`,
          },
        }],
      },
    },
  });
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

async function build(model, outDir, { prefix }) {
  registerTransforms();

  // Only the generated directories are cleared. README.md, package.json and
  // docs/ in the same package are hand-written and must survive a rebuild.
  for (const dir of ['css', 'ios', 'android']) {
    rmSync(join(outDir, dir), { recursive: true, force: true });
  }

  const cssBlocks = [];
  const written = [];

  const write = (relative, contents) => {
    const file = join(outDir, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8');
    written.push(file);
  };

  for (const combination of model.combinations) {
    const dictionary = createDictionary(combination, model, { prefix });
    const modeLine = combination.modes.length > 0
      ? [`Mode:         ${combination.label}`]
      : [];

    for (const { destination, output } of await dictionary.formatPlatform('css')) {
      cssBlocks.push({ destination, output: output.trim() });
    }

    const [swift] = await dictionary.formatPlatform('ios');
    // The Swift format opens with its own filename banner. Ours says more and
    // says it first, so the banner is dropped rather than stacked under it.
    const swiftBody = swift.output.replace(/^(?:\s*\/\/.*\n)+/, '').trimStart();
    write(
      join('ios', swift.destination),
      `${slashComment(headerLines(model.root, modeLine))}\n\n${swiftBody}`,
    );

    const [xml] = await dictionary.formatPlatform('android');
    // The header has to sit after the XML declaration, not before it.
    const [declaration, ...rest] = xml.output.trimStart().split('\n');
    write(
      join('android', combination.slug, xml.destination),
      `${declaration}\n${xmlComment(headerLines(model.root, modeLine))}\n${rest.join('\n').trim()}\n`,
    );
  }

  /* Overlay blocks are emitted LAST and the order is load-bearing.
   *
   * An overlay may only carry paths that do not vary across the matrix — the
   * adapter refuses anything else — so every path here also appears in the
   * plain `:root` block above. `:root` and a subtree selector such as
   * `:lang(ar)` are both one pseudo-class, so specificity does not separate
   * them and source order decides. Last wins, and last is where these go.
   *
   * They are emitted for CSS only. An overlay applies to a SUBTREE, and the
   * mobile resource models have no subtree to apply it to: a Swift enum and an
   * Android resource file are flat name/value tables resolved at build time,
   * with no equivalent of an element that changes what a name means for its
   * descendants. Emitting one there would mean picking a winner globally,
   * which is the opposite of what an overlay is for.
   */
  for (const overlay of model.overlays ?? []) {
    if (overlay.changed.size === 0) continue;
    const dictionary = createOverlayDictionary(overlay, { prefix });
    for (const { destination, output } of await dictionary.formatPlatform('css')) {
      cssBlocks.push({ destination, output: output.trim() });
    }

    /* THE RESTORE BLOCK, and it is not optional.
     *
     * Custom properties inherit. An overlay redefines names on the subtree its
     * selector matches, so a nested island that does NOT match the selector
     * inherits the overlaid values rather than falling back to the base ones —
     * there is nothing to fall back to, because no declaration applies to it.
     *
     * For a script overlay that is the mixed-content case exactly: a Latin run
     * inside an Arabic page would be set in the Arabic face at Arabic leading.
     * That is the case subtree scoping exists to serve, so an overlay that
     * cannot express the restore does not actually solve the problem it claims.
     *
     * `<selector> :not(<selector>)` is the general form — descendants of the
     * scope that are not themselves in it — and it composes from the selector
     * content already supplies, so machinery still never parses it. It carries
     * one more compound than the overlay block, so it wins on specificity
     * rather than on order.
     *
     * Sourced from the first combination rather than from a base-only document
     * because every overlaid path is invariant by construction (the collision
     * guard refuses anything else), so any combination carries the base value.
     */
    const restore = createRestoreDictionary(overlay, model, { prefix });
    for (const { destination, output } of await restore.formatPlatform('css')) {
      cssBlocks.push({ destination, output: output.trim() });
    }
  }

  /* `changed`, not `entries`. An overlay's `entries` is the whole composed set
     — it always has members — so filtering on it would announce a block in the
     header that the loop above declined to emit. */
  const overlayLines = (model.overlays ?? []).filter((o) => o.changed.size > 0);
  const cssHeader = blockComment(headerLines(model.root, [
    '',
    'One file, one block per mode combination, switched at runtime by attribute:',
    '',
    ...model.combinations.map((c) => `  ${cssSelector(c.attributes)}`),
    '',
    ...(overlayLines.length > 0
      ? [
        'Then one block per overlay — a mode that is not a dimension, applied on',
        'top of whichever combination is active and scoped to a subtree:',
        '',
        ...overlayLines.map((o) => `  ${o.selector}`),
        '',
        'Overlays come last on purpose: they share a specificity with :root, so',
        'source order is what makes them win.',
        '',
      ]
      : []),
    'The bare :root block holds every value that is identical in all of them.',
  ]));

  write('css/tokens.css', `${cssHeader}\n\n${cssBlocks.map((b) => b.output).join('\n\n')}\n`);

  return written;
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

async function main(argv) {
  const args = parseArgs(argv, {
    flags: ['quiet', 'no-check'],
    values: ['root', 'out', 'work', 'prefix'],
  });

  if (args.unknown.length > 0) {
    process.stderr.write(`Unrecognised argument(s): ${args.unknown.join(', ')}\n`);
    return 1;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const outDir = args.out ? args.out : join(repoRoot(), 'packages', 'tokens');
  const workDir = args.work ? args.work : defaultWorkDir();
  const prefix = args.prefix;

  if (!args['no-check'] && !runGates(root)) return 1;

  let model;
  try {
    model = adaptTokenSet(root);
  } catch (error) {
    process.stderr.write(`\nBUILD REFUSED — the token set did not adapt.\n${error.message}\n`);
    return 1;
  }

  if (model.empty) {
    process.stdout.write(
      `Token build — ${displayPath(root)}\n\n`
      + 'No token files found. Nothing to build.\n'
      + 'This passes because there is nothing to generate, not because anything was generated.\n',
    );
    return 0;
  }

  writeAdapted(model, workDir);

  let written;
  try {
    written = await build(model, outDir, { prefix });
  } catch (error) {
    process.stderr.write(`\nBUILD FAILED — Style Dictionary refused the adapted tokens.\n${error.stack ?? error.message}\n`);
    return 1;
  }

  if (!args.quiet) {
    const lines = [
      `Token build — ${displayPath(root)} -> ${displayPath(outDir)}`,
      `${model.tokenCount} token(s), ${model.combinations.length} combination(s) `
      + `across ${model.dimensions.length} dimension(s) `
      + `(${model.dimensions.map((d) => d.name).join(', ') || 'none'}).`,
      `${model.invariant.size} value(s) identical in every combination, ${model.varying.size} mode-dependent.`,
      '',
      ...model.combinations.map((c) => `  ${c.slug.padEnd(16)} ${cssSelector(c.attributes)}`),
      '',
      `${written.length} file(s) written:`,
      ...written.map((f) => `  ${displayPath(f)}`),
      '',
      `Intermediate JSON: ${displayPath(workDir)} (build artefact, safe to delete).`,
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  return 0;
}

process.exitCode = await main(process.argv.slice(2));
