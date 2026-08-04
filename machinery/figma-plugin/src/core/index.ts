/**
 * index.ts — the core, as one entry point for Node.
 *
 * Everything exported here is pure: plain data in, plain data out, no Figma and
 * no Node. That is what makes the mapping testable in CI, where there is no
 * Figma.
 *
 * This used to say "the plugin sandbox imports it; so does the command-line dry
 * run". Only the second half is true, and the first half being false is the
 * better outcome rather than a gap. `build.mjs` has two entry points: `code.ts`
 * for the sandbox bundle, and this file for `dist/core.mjs`, which the dry run
 * drives. `code.ts` imports the core modules it needs one by one — `./core/plan`,
 * `./core/apply`, `./core/sheet` and so on — and never reaches for this barrel.
 *
 * Which matters, because the last two exports here are `MemoryVariables` and
 * `MemoryNodes`: the in-memory adapters that exist so the dry run can plan and
 * apply against nothing. If the sandbox did import this file, esbuild would
 * bundle both of them into `code.js` and ship a pair of test doubles inside the
 * plugin — harmless in behaviour and wrong in kind, since the one thing the
 * sandbox must not carry is a second implementation of the thing it is talking
 * to. The separation is currently a property of how the imports happen to be
 * written rather than something a check enforces; if this barrel ever grows a
 * sandbox-side consumer, that is the cost to weigh.
 */

export * from './types';
export * from './token-model';
export * from './map';
export * from './plan';
export * from './apply';
export * from './sheet';
export * from './sheet-apply';
export * from './rest';
export * from './bridge';
export { MemoryVariables } from './memory-adapter';
export { MemoryNodes } from './memory-nodes';
