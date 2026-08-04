#!/usr/bin/env node
/**
 * bundle.mjs — a token root, flattened into one JSON file.
 *
 * A Figma plugin runs in a sandbox with no filesystem, so it cannot read
 * `content/tokens/` however much it would like to. It has to be *handed* the
 * tokens. This produces the thing to hand it: every document under the root,
 * keyed by its path relative to that root, in one file that can be pasted into
 * the plugin UI or picked with a file dialog.
 *
 *   node bundle.mjs [--root <dir>] [--out <file>] [--quiet]
 *
 *   --root <dir>   token root to bundle. Defaults to $TOKENS_ROOT, then to the
 *                  repository's content/tokens.
 *   --out <file>   where to write. Defaults to stdout, so it pipes.
 *
 * The plugin UI's folder picker produces the identical shape from a directory
 * the user selects, so neither path is privileged and the plugin has one loader.
 *
 * Nothing here knows a token name. It copies documents; it does not read them.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { defaultTokensRoot, displayPath, parseArgs } from '../scripts/lib/tokens.mjs';

function collect(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) collect(abs, files);
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(abs);
  }
  return files;
}

/**
 * Read every JSON document under `root` into the bundle shape the plugin
 * consumes. Throws on unreadable JSON — a half-read token root is not a token
 * root, and a bundle missing one file would sync as if those tokens were
 * deleted.
 */
export function bundleTokenRoot(root) {
  const files = {};
  for (const abs of collect(root).sort()) {
    const key = relative(root, abs).split(sep).join('/');
    try {
      files[key] = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (error) {
      throw new Error(`Cannot read ${displayPath(abs)}: ${error.message}`);
    }
  }
  return {
    format: 'dtcg-token-bundle@1',
    root: displayPath(root),
    generated: new Date().toISOString(),
    files,
  };
}

function main(argv) {
  const args = parseArgs(argv, { flags: ['quiet'], values: ['root', 'out'] });

  if (args.unknown.length > 0) {
    process.stderr.write(`Unrecognised argument: ${args.unknown.join(' ')}\n`);
    return 1;
  }

  const root = args.root ? args.root : defaultTokensRoot();
  const stat = statSync(root, { throwIfNoEntry: false });
  if (!stat || !stat.isDirectory()) {
    process.stderr.write(`Token root does not exist or is not a directory: ${root}\n`);
    return 1;
  }

  let bundle;
  try {
    bundle = bundleTokenRoot(root);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  const count = Object.keys(bundle.files).length;
  if (count === 0) {
    process.stderr.write(`No JSON documents under ${displayPath(root)}.\n`);
    return 1;
  }

  const json = `${JSON.stringify(bundle, null, 2)}\n`;
  if (args.out) {
    writeFileSync(args.out, json);
    if (!args.quiet) {
      process.stderr.write(`${count} document(s) from ${displayPath(root)} -> ${args.out}\n`);
    }
  } else {
    process.stdout.write(json);
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('bundle.mjs')) {
  // The default output is stdout so this pipes; a reader that stops early
  // (`| head`) should end the run, not crash it.
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
  process.exitCode = main(process.argv.slice(2));
}
