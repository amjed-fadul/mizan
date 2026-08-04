/**
 * bridge.ts — the read bridge's vocabulary, and the whole of it.
 *
 * [016] decided that the drift detector reaches the live variable table through
 * a localhost WebSocket served by this plugin, rather than through a general
 * Figma-over-MCP dependency whose tool surface includes create, update, rename
 * and delete on variables. The argument was not about that project's quality.
 * It was that a second write path into Figma destroys the *attribution* of
 * every finding the detector produces: drift caused by an assistant becomes
 * indistinguishable from drift caused by a person, and the remedy for those two
 * is not the same.
 *
 * So the guarantee this file has to make is not "we promise not to write". It
 * is that **there is no word for writing**. Four message types exist, they are
 * listed below, and three of them are answers.
 *
 *   hello              client -> server   I am a Mizan Sync plugin, and this
 *                                         is what I can answer.
 *   snapshot-request   server -> client   Send the current variable table.
 *   snapshot           client -> server   Here it is, in the REST read shape,
 *                                         beside the name of the document it
 *                                         came out of.
 *   error              client -> server   I could not.
 *
 * There is no create, no update, no rename, no delete, no "run this", no
 * "select that", and no way to add one without editing this list — which two
 * harnesses read out of this file and assert against. `dry-run.mjs` checks the
 * list and scans every exported name here for a write verb;
 * `machinery/scripts/selftest.mjs` checks it again from the other side, where
 * the socket actually is. Adding a verb fails the build rather than passing
 * quietly.
 *
 * ---------------------------------------------------------------------------
 * Why the vocabulary lives in the pure core
 * ---------------------------------------------------------------------------
 *
 * The socket itself cannot live here. A Figma plugin's main thread has no
 * network at all; only the UI iframe does. So the wire is opened in `ui.html`
 * and the payload is fetched through the main thread, and neither of those two
 * files can be driven from the command line.
 *
 * What *can* be pinned is the vocabulary and the envelope. Both are here, both
 * are pure, and the dry run drives them. `ui.html` is then a relay with nothing
 * in it to decide.
 *
 * ---------------------------------------------------------------------------
 * What this does not do
 * ---------------------------------------------------------------------------
 *
 * It does not move the floor. Figma Desktop still has to be open with the
 * plugin running for anything here to answer. This removes a copy-and-paste,
 * not a person — [015]'s finding that there is no unattended drift detection
 * below Enterprise is unchanged, and reading it otherwise is a misreading.
 */

import type { RestPayload } from './rest';

/** Bumped when the envelope changes shape. Both ends refuse a mismatch. */
export const BRIDGE_PROTOCOL = 'mizan-bridge@1';

/**
 * The default port.
 *
 * A constant in four places — here, `ui.html`, `machinery/scripts/lib/
 * bridge.mjs`, and twice in the manifest's `devAllowedDomains`. A manifest
 * cannot take a variable and `ui.html` is loaded by Figma rather than bundled,
 * so there is no single definition the others could import. What keeps them
 * equal is `machinery/scripts/selftest.mjs`, which parses the number out of
 * each file and asserts they agree — because the failure this would otherwise
 * have is the worst shape available: a bridge changed in three places out of
 * four never connects, and a bridge that never connects looks exactly like a
 * bridge nobody switched on.
 */
export const BRIDGE_PORT = 8791;

/**
 * Everything that can be said on this socket.
 *
 * Read as a list of verbs, it is: greet, ask, answer, fail. That is the entire
 * capability the manifest's `devAllowedDomains` entry buys, and the reason that
 * entry is defensible. Nothing was widened to buy it: `allowedDomains` never
 * left `["none"]`, so the socket exists for a development plugin, on one
 * loopback port, and nowhere else ([016], Amendment).
 */
export const BRIDGE_MESSAGE_TYPES = ['hello', 'snapshot-request', 'snapshot', 'error'] as const;

export type BridgeMessageType = (typeof BRIDGE_MESSAGE_TYPES)[number];

/** The only message the plugin acts on. Everything else is ignored, not obeyed. */
export const BRIDGE_REQUEST_TYPES: BridgeMessageType[] = ['snapshot-request'];

export interface BridgeHello {
  protocol: string;
  type: 'hello';
  plugin: string;
  /** What this end can answer. One entry, and it is a noun. */
  answers: string[];
}

export interface BridgeSnapshotRequest {
  protocol: string;
  type: 'snapshot-request';
  id: string;
}

/**
 * Which document answered.
 *
 * `fileKey` is nullable because the Plugin API does not always have one to give
 * — see `captureDocument()` in `figma-adapter.ts`. A key we do not hold is
 * reported as absent rather than guessed at, because a guessed key would be
 * worse than none: it names a document the read did not come from.
 */
export interface BridgeDocument {
  name: string;
  fileKey: string | null;
}

export interface BridgeSnapshot {
  protocol: string;
  type: 'snapshot';
  id: string;
  payload: RestPayload;
  /**
   * Optional, and it has to be. A plugin built before this field existed sends
   * a snapshot without it, and a reader that refused such a message would turn
   * a stale build into a total read failure — which is a worse report than an
   * unnamed document. The reading end treats it as optional for the same reason.
   */
  document?: BridgeDocument;
}

export interface BridgeError {
  protocol: string;
  type: 'error';
  id: string | null;
  message: string;
}

export type BridgeMessage = BridgeHello | BridgeSnapshotRequest | BridgeSnapshot | BridgeError;

export function helloMessage(): BridgeHello {
  return { protocol: BRIDGE_PROTOCOL, type: 'hello', plugin: 'mizan-sync', answers: ['snapshot'] };
}

export function snapshotRequest(id: string): BridgeSnapshotRequest {
  return { protocol: BRIDGE_PROTOCOL, type: 'snapshot-request', id };
}

/**
 * Answer with the variable table, and with the identity of the document it was
 * read out of.
 *
 * The identity is carried because a report that cannot say which document it
 * read is a report whose remedy cannot be checked. With a different file open,
 * every token comes back `missing-in-figma` and the printed remedy — re-sync
 * outward — would write the whole token set into a document nobody meant to
 * touch. Nothing in the report contradicts that reading. `--snapshot` names the
 * file it loaded and `--file-key` names the key it was given; the bridge was the
 * only source that could not say what it had read.
 *
 * It rides on the envelope rather than inside `payload`, and that is deliberate.
 * `toRestPayload` is pure, shared with the in-memory model the dry run drives,
 * and produces the shape of Figma's own read response — a shape with no
 * document name in it. A payload that claims to be a REST read should hold what
 * a REST read holds, or a saved snapshot carries a field no REST read would ever
 * have produced and the format stops being one format.
 *
 * `document` is omitted rather than set to `undefined` when there is none, so a
 * reader checking for the key and a reader checking the value get one answer.
 */
export function snapshotMessage(id: string, payload: RestPayload, document?: BridgeDocument): BridgeSnapshot {
  const message: BridgeSnapshot = { protocol: BRIDGE_PROTOCOL, type: 'snapshot', id, payload };
  if (document) message.document = document;
  return message;
}

export function errorMessage(id: string | null, message: string): BridgeError {
  return { protocol: BRIDGE_PROTOCOL, type: 'error', id, message };
}

/**
 * Read one frame off the wire.
 *
 * Anything that is not a known message type comes back as `null` rather than as
 * something to interpret. An unrecognised instruction is not an instruction —
 * this end has no way to carry one out and no business trying.
 */
export function parseBridgeMessage(text: string): BridgeMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as { protocol?: unknown; type?: unknown };
  if (message.protocol !== BRIDGE_PROTOCOL) return null;
  if (typeof message.type !== 'string') return null;
  if (BRIDGE_MESSAGE_TYPES.indexOf(message.type as BridgeMessageType) === -1) return null;
  return parsed as BridgeMessage;
}

/** Is this a request this end answers? The only true answer is a snapshot. */
export function isSnapshotRequest(message: BridgeMessage | null): message is BridgeSnapshotRequest {
  return message !== null && message.type === 'snapshot-request' && typeof (message as BridgeSnapshotRequest).id === 'string';
}
