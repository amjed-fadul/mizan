/**
 * ws-server.mjs — an RFC 6455 WebSocket server for localhost, with no dependencies.
 *
 * A Figma plugin can only reach the outside world from its UI iframe, and only
 * as a WebSocket *client*. Something on this side has to be listening. Node
 * ships a WebSocket client and no server, so the listener is either a
 * dependency or this file.
 *
 * It is this file because of what a dependency costs *here*, not what it costs
 * generally. This repository has no runtime dependencies, and the Stage 7
 * extraction publishes `machinery/` to be forked — so anything added travels
 * into every fork, permanently, whether or not the fork ever opens Figma. `ws`
 * is a good library and this is not a judgment about it; taking it on to carry
 * one localhost read would contradict the argument that produced the bridge in
 * the first place, which is about exactly what a fork inherits. See
 * ../../decisions/016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md.
 *
 * What this deliberately is not: a general WebSocket server. There is no
 * permessage-deflate, no subprotocol or extension negotiation, no binary
 * frames, no client half, no TLS. Each of those is absent because the one
 * conversation this carries — a plugin sending a variable snapshot to a script
 * on the same machine — does not need it, and an unused branch in a hand-written
 * protocol decoder is a defect waiting for the day somebody exercises it. The
 * cost of the omissions is that pointing a different client at this will fail
 * on features a real server would have; the refusals are explicit close codes
 * rather than silence, so that failure is readable.
 *
 * Brand-agnostic, like everything else in `machinery/`: nothing here knows a
 * token, a product or a mode.
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/**
 * The GUID from RFC 6455 §1.3. Fixed by the protocol, not a choice, and easy to
 * mistype into something that looks right and fails every handshake. The check
 * is the RFC's own worked example: the key `dGhlIHNhbXBsZSBub25jZQ==` must
 * produce the accept value `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`.
 */
const HANDSHAKE_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = Object.freeze({
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
});

const CLOSE_CODE = Object.freeze({
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  MESSAGE_TOO_BIG: 1009,
});

/**
 * Ceiling on a single reassembled message.
 *
 * A localhost read of a variable table is well under a megabyte, so this is not
 * a capacity decision — it is the guard that stops a bug on either side of the
 * socket, or a client that is not our plugin, from asking this process to hold
 * an arbitrary amount of memory. A declared length above the ceiling is refused
 * before any of the payload is buffered.
 */
const DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

/**
 * How many sockets may be open at once.
 *
 * Eight, because this server exists so that one plugin can answer one question
 * and then go away. The number is not a capacity estimate — it is the same
 * argument as the size ceiling one level up: every accepted socket owns a
 * decoder and may buffer up to `maxMessageBytes` before the ceiling stops it,
 * so "accept as many as arrive" makes the memory this process can be asked to
 * hold a function of how many times somebody knocks. Eight leaves room for a
 * retrying plugin, a stale socket that has not finished closing and a test
 * harness at the same time, and refuses the two-hundredth.
 */
const DEFAULT_MAX_CONNECTIONS = 8;

/**
 * The `Origin` values this server will complete a handshake for.
 *
 * WebSocket connections are not subject to the same-origin policy. A browser
 * opens them cross-origin with no preflight and no CORS to consult, and
 * 127.0.0.1 is a potentially-trustworthy origin, so nothing on the browser side
 * stops a page from reaching this port. Which means: any page the person
 * running a read happens to have open in another tab can connect while the
 * bridge is listening, greet before the plugin does, and hand the drift
 * detector a variable table it invented. This is a governance tool whose entire
 * product is a finding, so a fabricated finding is not a side effect of that —
 * it *is* the attack, and with `--save-snapshot` those bytes land in a file
 * somebody commits.
 *
 * Two values are accepted, and they are the two the legitimate clients send:
 *
 * - `null` — no `Origin` header at all, which is what Node's built-in
 *   WebSocket client sends. Verified directly rather than assumed, because
 *   every harness on this side depends on it.
 * - `'null'` (the string) — the opaque origin a sandboxed iframe reports, which
 *   is what a Figma plugin's UI is.
 *
 * Every ordinary web page sends its real origin and is refused by absence from
 * this list. Exported so a check can assert on the set, and so that the day
 * Figma sends something else there is one line to change rather than a search.
 *
 * **An `Origin` check is not authentication.** It is the standard mitigation
 * for a localhost bridge, and what it stops is a *web page*. A local process
 * can send whatever headers it likes, including none, and this does nothing
 * about that — anything already running code on this machine is outside what a
 * header can decide. The only thing narrowing that case is how briefly the port
 * is open: the socket exists for the seconds a read takes and there is no
 * daemon. Said plainly here so that nobody reads this constant as more than it
 * is.
 */
export const LOCAL_ORIGINS = Object.freeze([null, 'null']);

/** A control frame's payload is capped at 125 bytes by RFC 6455 §5.5. */
const MAX_CONTROL_PAYLOAD = 125;

/** How long `close()` waits for a socket to go quietly before destroying it. */
const CLOSE_LINGER_MS = 1000;

/** Decoder states, in the order a frame presents them. */
const READ_HEAD = 0;
const READ_LENGTH_16 = 1;
const READ_LENGTH_64 = 2;
const READ_MASK = 3;
const READ_PAYLOAD = 4;

const EMPTY = Buffer.alloc(0);

/* ------------------------------------------------------------------ *
 * Frame encoding
 * ------------------------------------------------------------------ */

/**
 * One unmasked frame, server to client.
 *
 * A server MUST NOT mask (§5.1), which is why there is no mask branch here at
 * all rather than a flag defaulting to off. All three length forms are written
 * because the snapshot this carries routinely exceeds 64 KiB.
 */
function encodeFrame(opcode, payload) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 0x10000) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode; // FIN set: nothing this server sends is fragmented.
  return Buffer.concat([header, payload], header.length + length);
}

/** A close frame's payload: two bytes of code, then the reason as UTF-8. */
function encodeClosePayload(code, reason) {
  // Truncated rather than rejected — a reason too long to fit is still worth
  // sending most of, and the code is the part a client acts on.
  const text = Buffer.from(String(reason ?? ''), 'utf8').subarray(0, MAX_CONTROL_PAYLOAD - 2);
  const payload = Buffer.alloc(2 + text.length);
  payload.writeUInt16BE(code, 0);
  text.copy(payload, 2);
  return payload;
}

/* ------------------------------------------------------------------ *
 * Handshake
 * ------------------------------------------------------------------ */

function acceptValue(key) {
  return createHash('sha1').update(key + HANDSHAKE_GUID).digest('base64');
}

/** Minimal HTTP response written straight to the socket, then hung up. */
function refuse(socket, status, text, extraHeaders = '') {
  const body = `${text}\n`;
  socket.write(
    `HTTP/1.1 ${status}\r\n`
    + 'Connection: close\r\n'
    + 'Content-Type: text/plain; charset=utf-8\r\n'
    + `Content-Length: ${Buffer.byteLength(body)}\r\n`
    + extraHeaders
    + `\r\n${body}`,
  );
  socket.destroy();
}

/* ------------------------------------------------------------------ *
 * Connections
 * ------------------------------------------------------------------ */

/**
 * Wire one accepted socket to a connection object.
 *
 * The decoder is a state machine over a queue of chunks rather than one growing
 * buffer. TCP gives no frame boundaries — several frames arrive in one chunk,
 * one frame arrives across many — and concatenating everything on every chunk
 * would copy a multi-megabyte message once per chunk it arrived in. Here each
 * byte is copied once, when the piece it belongs to is taken.
 */
function attachConnection(socket, maxMessageBytes) {
  const conn = new EventEmitter();

  let queue = [];
  let queued = 0;
  let need = 2;
  let state = READ_HEAD;

  let fin = false;
  let opcode = 0;
  let masked = false;
  let maskKey = EMPTY;
  let payloadLength = 0;

  // The message being reassembled across continuation frames, if any.
  let fragmentOpcode = null;
  let fragments = [];
  let fragmentBytes = 0;

  let closeSent = false;
  let finished = false;

  /** Take exactly `n` bytes off the front of the queue. */
  function take(n) {
    if (n === 0) return EMPTY;
    const first = queue[0];
    if (first.length === n) {
      queue.shift();
      queued -= n;
      return first;
    }
    if (first.length > n) {
      const head = first.subarray(0, n);
      queue[0] = first.subarray(n);
      queued -= n;
      return head;
    }
    const parts = [];
    let got = 0;
    while (got < n) {
      const chunk = queue[0];
      const want = n - got;
      if (chunk.length <= want) {
        queue.shift();
        parts.push(chunk);
        got += chunk.length;
      } else {
        parts.push(chunk.subarray(0, want));
        queue[0] = chunk.subarray(want);
        got = n;
      }
    }
    queued -= n;
    return Buffer.concat(parts, n);
  }

  function send(text) {
    if (finished || closeSent || socket.destroyed) return;
    socket.write(encodeFrame(OPCODE.TEXT, Buffer.from(String(text), 'utf8')));
  }

  function close(code = CLOSE_CODE.NORMAL, reason = '') {
    if (closeSent || socket.destroyed) return;
    closeSent = true;
    socket.end(encodeFrame(OPCODE.CLOSE, encodeClosePayload(code, reason)));
  }

  /** A protocol violation: name it on the wire, then stop reading. */
  function fail(code, reason) {
    finished = true;
    close(code, reason);
    queue = [];
    queued = 0;
  }

  /**
   * Hand something to the consumer with its throws kept out of the decoder.
   *
   * A consumer handler that throws is a bug in the consumer, and the peer must
   * not be told it is a framing error: `close 1002 "frame could not be decoded"`
   * about a frame that decoded perfectly is a false statement in the one place
   * this file claims to be worth reading, which is that its refusals name what
   * actually happened. So delivery sits outside the decoder's try/catch — a
   * decode failure is 1002 and ends the connection, a consumer throw goes to
   * 'error' and leaves the socket alone, because nothing about the socket is
   * wrong.
   */
  function emitToConsumer(event, ...args) {
    try {
      conn.emit(event, ...args);
    } catch (error) {
      conn.emit('error', error);
    }
  }

  function deliver(messageOpcode, payload) {
    if (messageOpcode === OPCODE.BINARY) {
      // Not "unimplemented" — nothing this bridge carries is binary, and 1003
      // is the code that says so rather than pretending the frame was malformed.
      fail(CLOSE_CODE.UNSUPPORTED_DATA, 'binary frames are not supported');
      return;
    }
    emitToConsumer('message', payload.toString('utf8'));
  }

  function handleFrame(payload) {
    if (opcode === OPCODE.PING) {
      if (!closeSent && !socket.destroyed) socket.write(encodeFrame(OPCODE.PONG, payload));
      return;
    }
    if (opcode === OPCODE.PONG) return; // Nothing here sends pings, so nothing is waiting.
    if (opcode === OPCODE.CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : CLOSE_CODE.NORMAL;
      finished = true;
      // Echo the peer's code back, which is what §5.5.1 asks for, then hang up.
      close(code === 1005 || code === 1006 ? CLOSE_CODE.NORMAL : code, '');
      return;
    }

    if (opcode === OPCODE.CONTINUATION) {
      if (fragmentOpcode === null) {
        fail(CLOSE_CODE.PROTOCOL_ERROR, 'continuation frame without a message to continue');
        return;
      }
      fragments.push(payload);
      fragmentBytes += payload.length;
      if (!fin) return;
      const complete = Buffer.concat(fragments, fragmentBytes);
      const messageOpcode = fragmentOpcode;
      fragmentOpcode = null;
      fragments = [];
      fragmentBytes = 0;
      deliver(messageOpcode, complete);
      return;
    }

    if (fragmentOpcode !== null) {
      fail(CLOSE_CODE.PROTOCOL_ERROR, 'a new message started before the previous one finished');
      return;
    }
    if (fin) {
      deliver(opcode, payload);
      return;
    }
    fragmentOpcode = opcode;
    fragments = [payload];
    fragmentBytes = payload.length;
  }

  /**
   * Refuse a length before the payload is buffered. `fragmentBytes` is included
   * so a message split into many small frames cannot walk past the ceiling one
   * frame at a time.
   */
  function lengthAccepted(length) {
    if (length + fragmentBytes <= maxMessageBytes) return true;
    fail(CLOSE_CODE.MESSAGE_TOO_BIG, `message exceeds the ${maxMessageBytes} byte limit`);
    return false;
  }

  function drain() {
    while (!finished && queued >= need) {
      if (state === READ_HEAD) {
        const head = take(2);
        fin = (head[0] & 0x80) !== 0;
        opcode = head[0] & 0x0f;
        masked = (head[1] & 0x80) !== 0;
        payloadLength = head[1] & 0x7f;

        if ((head[0] & 0x70) !== 0) {
          // RSV bits mean an extension, and none was negotiated — see the header.
          fail(CLOSE_CODE.PROTOCOL_ERROR, 'reserved bits set but no extension was negotiated');
          return;
        }
        if (!masked) {
          // A client always masks (§5.1). An unmasked client frame is either a
          // broken implementation or not a browser, and both are refusals.
          fail(CLOSE_CODE.PROTOCOL_ERROR, 'client frames must be masked');
          return;
        }
        const isControl = (opcode & 0x8) !== 0;
        if (isControl && (!fin || payloadLength > MAX_CONTROL_PAYLOAD)) {
          fail(CLOSE_CODE.PROTOCOL_ERROR, 'control frames must be final and at most 125 bytes');
          return;
        }
        if (!isControl && opcode !== OPCODE.CONTINUATION && opcode !== OPCODE.TEXT && opcode !== OPCODE.BINARY) {
          fail(CLOSE_CODE.PROTOCOL_ERROR, `unknown opcode 0x${opcode.toString(16)}`);
          return;
        }

        if (payloadLength === 126) { state = READ_LENGTH_16; need = 2; continue; }
        if (payloadLength === 127) { state = READ_LENGTH_64; need = 8; continue; }
        if (!lengthAccepted(payloadLength)) return;
        state = READ_MASK;
        need = 4;
        continue;
      }

      if (state === READ_LENGTH_16) {
        payloadLength = take(2).readUInt16BE(0);
        if (!lengthAccepted(payloadLength)) return;
        state = READ_MASK;
        need = 4;
        continue;
      }

      if (state === READ_LENGTH_64) {
        const big = take(8).readBigUInt64BE(0);
        // Compared as a BigInt: a 64-bit length can exceed what a Number holds
        // exactly, and the ceiling has to reject it rather than round it.
        if (big > BigInt(maxMessageBytes)) {
          fail(CLOSE_CODE.MESSAGE_TOO_BIG, `message exceeds the ${maxMessageBytes} byte limit`);
          return;
        }
        payloadLength = Number(big);
        if (!lengthAccepted(payloadLength)) return;
        state = READ_MASK;
        need = 4;
        continue;
      }

      if (state === READ_MASK) {
        maskKey = take(4);
        state = READ_PAYLOAD;
        need = payloadLength;
        continue;
      }

      // READ_PAYLOAD. `take` already copied, so unmasking is in place.
      const payload = take(payloadLength);
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= maskKey[i & 3];
      state = READ_HEAD;
      need = 2;
      handleFrame(payload);
    }
  }

  socket.on('data', (chunk) => {
    if (finished) return;
    queue.push(chunk);
    queued += chunk.length;
    try {
      drain();
    } catch (error) {
      conn.emit('error', error);
      fail(CLOSE_CODE.PROTOCOL_ERROR, 'frame could not be decoded');
    }
  });

  socket.on('error', (error) => { conn.emit('error', error); });
  socket.on('close', () => {
    finished = true;
    // Same reasoning as delivery: a consumer's teardown throwing is the
    // consumer's problem to hear about, not this process's problem to die of.
    emitToConsumer('close');
  });

  conn.send = send;
  conn.close = close;
  return conn;
}

/* ------------------------------------------------------------------ *
 * The server
 * ------------------------------------------------------------------ */

/**
 * Start a WebSocket server and resolve once it is listening.
 *
 * @param {object} options
 * @param {number} options.port           port to bind; 0 asks the OS to pick one.
 * @param {string} [options.host]         interface to bind — see below.
 * @param {(conn: EventEmitter & { send: Function, close: Function }) => void} [options.onConnection]
 * @param {(error: Error) => void} [options.onError]
 * @param {(error: Error & { code: string }) => void} [options.onRefusal]
 *        A handshake turned away before it became a connection — an origin
 *        outside `LOCAL_ORIGINS` (`code: 'origin-refused'`) or the connection
 *        cap (`code: 'too-many-connections'`). Optional and additive: callers
 *        that do not pass it get these through `onError` like any other error,
 *        so nothing silently disappears for a caller written before this
 *        existed. Pass it when the two want printing differently — a refusal is
 *        an answer this server gave, not a fault it suffered.
 * @param {number} [options.maxMessageBytes]
 * @param {number} [options.maxConnections] defaults to eight; see the constant.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export function createWebSocketServer({
  port,
  host = '127.0.0.1',
  onConnection,
  onError,
  onRefusal,
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxConnections = DEFAULT_MAX_CONNECTIONS,
} = {}) {
  // The default is the loopback address and not 0.0.0.0, deliberately. A bridge
  // reachable from every interface is a different security proposition from one
  // reachable only from this machine: it would put the plugin's snapshot, and
  // this decoder, in front of anything on the network. `host` is a parameter
  // because tests may need ::1, not because binding wider is a supported use.
  const server = createServer();
  const open = new Set();
  let closing = null;

  const report = (error) => {
    if (onError) onError(error);
  };

  /**
   * Say, in code, what was just said on the wire.
   *
   * A refusal that only exists as an HTTP status the refused party reads is a
   * refusal this side cannot print, and the thing most likely to be refused one
   * day is the legitimate plugin after Figma changes something. So it is raised
   * here too, carrying the same sentence the body carried and a `code` a caller
   * can switch on.
   */
  const refused = (code, message, detail) => {
    const error = Object.assign(new Error(message), { code }, detail);
    if (onRefusal) onRefusal(error);
    else report(error);
  };

  // A plain HTTP request is not a mistake worth a stack trace — it is somebody
  // pointing a browser at the port. 426 says what the port is actually for.
  server.on('request', (req, res) => {
    res.writeHead(426, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    });
    res.end('This port speaks WebSocket only.\n');
  });

  server.on('upgrade', (req, socket, head) => {
    const upgrade = String(req.headers.upgrade ?? '').toLowerCase();
    if (upgrade !== 'websocket') {
      refuse(socket, '400 Bad Request', 'Upgrade header must be "websocket".');
      return;
    }

    // Checked before anything else about the shape of the request, because an
    // ordinary web page sends a perfectly well-formed handshake — what is wrong
    // with it is who is asking, and that answer should not depend on the rest
    // parsing. Absence is normalised to `null` so the accepted set stays one
    // list rather than a list plus a special case.
    const origin = req.headers.origin ?? null;
    if (!LOCAL_ORIGINS.includes(origin)) {
      // 403 rather than 400: the request is fine, the sender is not. The body
      // names the origin it saw because the failure this check will one day
      // cause is Figma sending something new, and "refused, saw
      // https://www.figma.com" is a two-minute diagnosis where a bridge that
      // simply never connects is an afternoon — and looks exactly like a bridge
      // nobody switched on. Echoed as it arrived: Node's HTTP parser has
      // already rejected control characters in a header value, so there is
      // nothing here to escape.
      const message = `Refused: Origin ${JSON.stringify(origin)} may not open this bridge. `
        + 'It accepts a sandboxed plugin iframe (Origin: null) or a client that sends no Origin header at all, and nothing else.';
      refuse(socket, '403 Forbidden', message);
      refused('origin-refused', message, { origin });
      return;
    }

    const key = req.headers['sec-websocket-key'];
    // The key is 16 random bytes, base64-encoded. Anything shorter is not a
    // handshake this can complete, and guessing at it would produce an accept
    // value the client will reject anyway — better to say so with a status.
    if (typeof key !== 'string' || Buffer.from(key, 'base64').length < 16) {
      refuse(socket, '400 Bad Request', 'Sec-WebSocket-Key is missing or too short.');
      return;
    }

    const version = String(req.headers['sec-websocket-version'] ?? '');
    if (version !== '13') {
      refuse(socket, '400 Bad Request', 'Only WebSocket version 13 is supported.', 'Sec-WebSocket-Version: 13\r\n');
      return;
    }

    // Last of the refusals, so that a malformed request still gets the more
    // specific 400 rather than being told the server is busy.
    //
    // Refused with 503 at the HTTP layer rather than by completing the
    // handshake and sending close 1013 "try again later". Both are legal. 503
    // is the honest one, because 1013 would mean accepting the connection —
    // decoder, buffers and all — purely in order to reject it, which is the
    // cost the cap exists to avoid. `Retry-After` carries what 1013 would have
    // said, and a retrying plugin is exactly the client that will read it.
    if (open.size >= maxConnections) {
      const message = `Refused: ${open.size} connections are already open and the limit is ${maxConnections}.`;
      refuse(socket, '503 Service Unavailable', message, 'Retry-After: 1\r\n');
      refused('too-many-connections', message, { open: open.size, limit: maxConnections });
      return;
    }

    socket.setNoDelay(true);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${acceptValue(key)}\r\n`
      + '\r\n',
    );

    const conn = attachConnection(socket, maxMessageBytes);
    const entry = { conn, socket };
    open.add(entry);
    conn.on('close', () => open.delete(entry));
    conn.on('error', report);

    try {
      if (onConnection) onConnection(conn);
    } catch (error) {
      // A consumer that throws while wiring its handlers up has a bug, and a
      // bug in a consumer must not end the process. `machinery/` is published
      // to be forked (see the header), so this handler belongs to somebody
      // else's code in somebody else's build: their mistake has to arrive as a
      // reported error, not as an uncaught exception with this file's frames in
      // it. The socket is left alone — there is nothing wrong with it.
      report(error);
    }

    // Bytes that arrived in the same packet as the request line belong to the
    // first frame; Node hands them over here rather than re-emitting them.
    //
    // Replayed *after* `onConnection`, which is the whole point of the ordering
    // and not an accident of it. A client may send its first message in the
    // same packet as the handshake — the plugin's `hello` is exactly that — and
    // replaying before the consumer has attached a 'message' listener drops
    // that message with nothing raised anywhere. The run then reports that
    // nothing connected while a client sits there connected and waiting, which
    // is the least diagnosable failure this file is capable of producing.
    if (head && head.length > 0) socket.emit('data', head);
  });

  server.on('error', report);

  function close() {
    if (closing) return closing;
    closing = (async () => {
      await Promise.all([...open].map((entry) => new Promise((resolve) => {
        if (entry.socket.destroyed) { resolve(); return; }
        // A close frame is sent first so the peer learns why, then a timer
        // bounds how long a socket that never answers can hold shutdown open.
        const timer = setTimeout(() => entry.socket.destroy(), CLOSE_LINGER_MS);
        timer.unref?.();
        entry.socket.once('close', () => { clearTimeout(timer); resolve(); });
        entry.conn.close(CLOSE_CODE.GOING_AWAY, 'server closing');
      })));
      await new Promise((resolve) => { server.close(() => resolve()); });
    })();
    return closing;
  }

  return new Promise((resolve, reject) => {
    const onListenError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onListenError);
      resolve({ port: server.address().port, close });
    };
    server.once('error', onListenError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}
