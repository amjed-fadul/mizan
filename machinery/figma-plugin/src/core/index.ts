/**
 * index.ts — the core, as one entry point.
 *
 * Everything exported here is pure: plain data in, plain data out, no Figma and
 * no Node. The plugin sandbox imports it; so does the command-line dry run.
 * That is what makes the mapping testable in CI, where there is no Figma.
 */

export * from './types';
export * from './token-model';
export * from './map';
export * from './plan';
export * from './apply';
export { MemoryVariables } from './memory-adapter';
