/**
 * bridge.mjs — reading the live variable table from a plugin, over localhost.
 *
 * Figma's variables REST API is Enterprise-only in both directions
 * ([015](../../../decisions/015-rung-2-has-a-plan-floor.md)), so below
 * Enterprise no script can fetch the variable table. A *plugin* can read it on
 * any plan. This is the short piece of wire between the two, and
 * [016](../../../decisions/016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md)
 * is why it is ours rather than a dependency.
 *
 * ---------------------------------------------------------------------------
 * Which end listens, and why it is this one
 * ---------------------------------------------------------------------------
 *
 * A browser cannot listen, and a Figma plugin's UI is a browser. So the plugin
 * is the client and this is the server — which is the better way round anyway:
 * the socket exists only while a read is in progress. There is no daemon, no
 * port held open between runs, and nothing to remember to stop. The plugin sits
 * there retrying; this opens the door, asks its one question, and shuts it.
 *
 * ---------------------------------------------------------------------------
 * Read-only, and where that is enforced
 * ---------------------------------------------------------------------------
 *
 * Not here. This file could be made to send anything; what stops it is that the
 * other end has no word for anything else. The vocabulary lives in
 * `machinery/figma-plugin/src/core/bridge.ts` and is four types long, three of
 * them answers. That is the guarantee, and it is a property of the plugin
 * rather than a promise in this comment — which is the whole reason 016 chose
 * to build the plugin side instead of adopting a tool with 113 more verbs.
 *
 * What comes back is a payload in the shape of `GET /v1/files/<key>/variables/
 * local`, which is what `check-drift.mjs` already reads. So the bridge adds a
 * *source*, not a format: a snapshot from here and a snapshot from a file are
 * the same thing to the gate, and the offline path stays the primary one.
 *
 * ---------------------------------------------------------------------------
 * Which document was read
 * ---------------------------------------------------------------------------
 *
 * `--snapshot` names a path and `--file-key` names a key, so both say what they
 * read. A socket says only which port it was, and a port is not an identity —
 * with the wrong file open in Figma the read succeeds, every token comes back
 * `missing-in-figma`, and the remedy printed beside it is "re-sync outward",
 * which would write the whole token set into a document nobody meant to touch.
 * The wrong file and a file that is merely behind produce the same report.
 *
 * So the plugin sends a `document` alongside the payload and it is carried
 * through to the report. It is optional, because a plugin built before the field
 * existed is a real thing to meet and must not fail the read — but its absence
 * is itself reported rather than passed over. A report that cannot say which
 * document it read is a report whose remedy cannot be checked.
 *
 * ---------------------------------------------------------------------------
 * What it does not do
 * ---------------------------------------------------------------------------
 *
 * It does not move the floor. Figma Desktop has to be open, with the file open,
 * with the plugin running and its bridge switched on. This removes a copy and a
 * paste; it does not remove the person. There is still no unattended drift
 * detection below Enterprise, and anything that reads this as CI has misread it.
 */

import { createWebSocketServer } from './ws-server.mjs';

/** Must match `BRIDGE_PROTOCOL` in the plugin's `src/core/bridge.ts`. */
export const BRIDGE_PROTOCOL = 'mizan-bridge@1';

/**
 * Must match `BRIDGE_PORT` in the plugin's `src/core/bridge.ts`, the port in
 * its `ui.html`, and the two entries in its manifest's `devAllowedDomains`. A
 * manifest cannot take a variable, so this number is a constant in four places
 * and changing it means changing all four. `selftest.mjs` parses it out of each
 * and asserts they agree — duplication a script watches, rather than
 * duplication anybody has to remember.
 */
export const BRIDGE_PORT = 8791;

/** Loopback only. The plugin connects from this machine or not at all. */
export const BRIDGE_HOST = '127.0.0.1';

/** Long enough to open Figma and press the button; short enough to fail a run. */
export const BRIDGE_TIMEOUT_MS = 60_000;

/**
 * Everything this end may say, which is one thing.
 *
 * Listed as a constant so it can be asserted against rather than read. If a
 * verb ever appears in this array, the read-only claim has stopped being true
 * and `machinery/scripts/selftest.mjs` says so.
 */
export const BRIDGE_SENDS = Object.freeze(['snapshot-request']);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Is this the payload the detector reads?
 *
 * Checked here rather than left to the gate so that a plugin answering with
 * something unexpected produces "the plugin sent something that is not a
 * variable table" instead of "no tokens are in Figma" — the second reads as
 * catastrophic drift and would be believed.
 */
function looksLikeVariablePayload(payload) {
  if (!isPlainObject(payload)) return false;
  const meta = isPlainObject(payload.meta) ? payload.meta : payload;
  return isPlainObject(meta.variables) && isPlainObject(meta.variableCollections);
}

/**
 * The document the answer came from, if the plugin named it.
 *
 * Validated loosely and on purpose. A name is the part a person reads, so a
 * frame without one carries no identity worth printing and is treated as no
 * identity at all; the file key is Figma's own and may legitimately be absent —
 * an unsaved document has none. Nothing here is required, because requiring it
 * would turn "your plugin is one build old" into "the read failed", and the read
 * did not fail. Absence is reported, not enforced.
 */
function readDocumentIdentity(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.name !== 'string' || value.name.trim() === '') return null;
  return {
    name: value.name,
    fileKey: typeof value.fileKey === 'string' && value.fileKey !== '' ? value.fileKey : null,
  };
}

/**
 * Seconds, printed as they were asked for.
 *
 * `--bridge-timeout 2.5` waits two and a half seconds, so the message that
 * reports the wait has to say 2.5 — rounding it to 3 makes the one number in the
 * sentence disagree with the one number the person typed, which is exactly the
 * kind of small lie that costs somebody a quarter of an hour.
 */
function formatSeconds(ms) {
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? String(seconds) : String(Number(seconds.toFixed(3)));
}

/**
 * Ask a running plugin for the file's current variables.
 *
 * Resolves to `{ ok: true, payload, document }` or `{ ok: false, code, message }`.
 * It does not throw for the ordinary failures — a port already in use, nobody
 * connecting, a plugin that could not read — because each of those is a
 * finding the gate should print with its own remedy rather than a stack trace.
 *
 * `document` is `{ name, fileKey }` when the plugin named the file it read, and
 * `null` when it did not. `null` is a fact the caller has to print, not one it
 * may drop — see the header.
 *
 * `onStatus` is called with human-readable progress. A command that appears to
 * hang while somebody is being asked to go and click something is a command
 * that gets killed.
 */
export async function readSnapshotOverBridge({
  port = BRIDGE_PORT,
  host = BRIDGE_HOST,
  timeoutMs = BRIDGE_TIMEOUT_MS,
  onStatus = () => {},
} = {}) {
  /* The server has to exist before a connection can arrive, and the handler
   * needs to resolve a promise that does not exist yet. One mutable hop
   * settles the order; until it is replaced, a connection is simply ignored. */
  let connectionHandler = () => {};

  /* Refusals the server makes on its own — a wrong `Origin`, the connection cap
   * — are reported rather than swallowed, and this is not a nicety.
   *
   * The `Origin` check is the one part of this bridge that cannot be proven
   * outside Figma: it accepts the sandboxed-iframe origin (`null`) and refuses
   * everything else, and if Figma ever sends something other than `null` the
   * plugin stops connecting. Swallowed, that arrives as "nothing connected
   * within 60s" — a message that sends somebody to check whether they pressed
   * the button, which is the wrong place to look and a long way from the
   * answer. Surfaced, it names the origin it refused, and the fix is one line
   * in `LOCAL_ORIGINS`.
   *
   * A refusal is not a failure of the run: the run continues waiting, because
   * the thing that was refused was, by construction, not the plugin. */
  let refusals = 0;
  const onRefusal = (error) => {
    refusals += 1;
    const origin = error && error.origin !== undefined ? error.origin : null;
    onStatus(
      error && error.code === 'origin-refused'
        ? `Refused a connection from Origin ${JSON.stringify(origin)} — only a sandboxed plugin iframe (Origin: null) or a client sending no Origin may connect. Still waiting.`
        : `Refused a connection: ${error && error.message ? error.message : String(error)}. Still waiting.`,
    );
  };

  let server;
  try {
    server = await createWebSocketServer({
      port,
      host,
      onConnection: (conn) => connectionHandler(conn),
      onRefusal,
      onError: () => {},
    });
  } catch (error) {
    return {
      ok: false,
      code: error && error.code === 'EADDRINUSE' ? 'bridge-port-busy' : 'bridge-unavailable',
      message: error && error.code === 'EADDRINUSE'
        ? `Port ${port} on ${host} is already in use. Another bridge run may still be open, or something else has the port. Stop it, or pass --bridge-port with a free one — and change the plugin manifest's devAllowedDomains to match.`
        : `Could not listen on ${host}:${port}: ${error.message}`,
    };
  }

  onStatus(`Listening on ${host}:${server.port}. Open the file in Figma, run Mizan Sync, and press "Start read bridge".`);

  const result = await new Promise((resolve) => {
    let settled = false;

    /* The connection currently being asked. It is a *live* slot: it is claimed
     * on `hello` and released on close. */
    let answering = null;

    /* Whether anything ever identified itself, which `answering` deliberately no
     * longer records. The timeout has to tell "nobody came" apart from "somebody
     * came and went", because those two send a person to look in different
     * places — at Figma, or at what closed the socket. */
    let greeted = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      const waited = formatSeconds(timeoutMs);
      finish({
        ok: false,
        code: 'bridge-timeout',
        message: !greeted
          ? `Nothing connected within ${waited}s. The bridge needs Figma Desktop open on the file, the Mizan Sync plugin running, and its read bridge switched on — it is a person plus a plugin, not a background service.`
            /* A refusal while nothing ever greeted is the one diagnosis worth
             * putting in front of somebody, because the two causes look
             * identical from the outside and the remedies share nothing: a
             * plugin nobody started, or a plugin that started and was turned
             * away at the door. */
            + (refusals > 0
              ? ` ${refusals} connection(s) were refused during the wait — see the refusal notes above. If one of those was the plugin, the bridge is reaching this port but being turned away, and the accepted origins are LOCAL_ORIGINS in machinery/scripts/lib/ws-server.mjs.`
              : '')
          : answering !== null
            ? `The plugin connected but did not answer within ${waited}s.`
            : `The plugin connected, then the socket closed before it answered, and nothing reconnected within ${waited}s. Figma may have been closed, or the plugin stopped mid-read.`,
      });
    }, timeoutMs);
    timer.unref?.();

    const handle = (conn) => {
      /* Releasing the slot is what lets the plugin rescue its own read. The
       * exclusion the slot buys is between two connections that are both *live*
       * — a second file must not silently decide which document the gate reports
       * on. A dead connection excludes nothing: it has answered no question and
       * will not, and holding the slot on its behalf spends the remaining
       * timeout ignoring the greeting of the plugin that is sitting right there
       * reconnecting. Press Stop then Start, or reload the iframe, and the
       * socket drops; `ui.html` comes back and greets again, and it is asked. */
      conn.on('close', () => {
        if (conn === answering) answering = null;
      });

      conn.on('message', (text) => {
        let frame = null;
        try {
          frame = JSON.parse(text);
        } catch (error) {
          return; // not ours; say nothing
        }
        if (!isPlainObject(frame) || frame.protocol !== BRIDGE_PROTOCOL) return;

        if (frame.type === 'hello') {
          // Only one plugin at a time is asked, for the reason above.
          if (answering !== null) return;
          answering = conn;
          greeted = true;
          onStatus(`Connected to ${typeof frame.plugin === 'string' ? frame.plugin : 'a plugin'}. Asking for the variable table…`);
          conn.send(JSON.stringify({ protocol: BRIDGE_PROTOCOL, type: 'snapshot-request', id: '1' }));
          return;
        }

        if (conn !== answering) return;

        if (frame.type === 'snapshot') {
          if (!looksLikeVariablePayload(frame.payload)) {
            finish({
              ok: false,
              code: 'bridge-bad-payload',
              message: 'The plugin answered with something that is not a variable table. Rebuild the plugin (npm run figma:build) — the two ends are on different versions.',
            });
            return;
          }
          /* The identity travels with the answer, or is absent with it. Read
           * from the frame the payload came in rather than remembered from the
           * greeting, so it can only ever describe the document that was
           * actually read. */
          finish({ ok: true, payload: frame.payload, document: readDocumentIdentity(frame.document) });
          return;
        }

        if (frame.type === 'error') {
          finish({
            ok: false,
            code: 'bridge-plugin-error',
            message: `The plugin could not read the variables: ${typeof frame.message === 'string' ? frame.message : 'no reason given'}`,
          });
        }
      });
    };

    // The server is already listening; this is the hop described above being
    // closed. A connection that arrived in the microtask before this line was
    // ignored, which is correct — the plugin retries.
    connectionHandler = handle;
  });

  await server.close();
  return result;
}
