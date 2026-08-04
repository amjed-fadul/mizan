/**
 * code.ts — the plugin's main thread.
 *
 * Its whole job is message plumbing and the confirmation gate:
 *
 *   preview  ->  read the document, plan, send the diff back. Nothing written.
 *   apply    ->  re-read, re-plan, refuse if the diff moved, write, re-plan
 *                once more and report what remains. Idempotency, proven in the
 *                room rather than asserted.
 *
 * The bundle stays here between the two messages, so what gets written is the
 * source the user previewed rather than whatever the UI still has in a textarea.
 *
 * The proof sheet is a **separate action** with the same shape — its own
 * preview, its own diff, its own confirmation. Somebody may want to sync
 * without regenerating the documentation, or regenerate the documentation
 * without syncing, and folding the two together would take that choice away.
 *
 * The **bridge** is the one message here with no confirmation gate, and that
 * is because it writes nothing: it reads the variable table and hands it back.
 * A gate exists to stand between an intention and a change to the document.
 * There is no change to stand in front of. See `core/bridge.ts` for why the
 * vocabulary has no word for one.
 */

import { applyPlan } from './core/apply';
import { errorMessage, helloMessage, snapshotMessage } from './core/bridge';
import { isApplicable, planSync } from './core/plan';
import { toRestPayload } from './core/rest';
import { SHEET_PAGE_NAME, isSheetApplicable, planSheet } from './core/sheet';
import { applySheet } from './core/sheet-apply';
import type { Plan, SheetPlan, TokenBundle } from './core/types';
import {
  FigmaNodes,
  FigmaVariables,
  captureDocument,
  captureRestSource,
  captureSheetSnapshot,
  captureSnapshot,
} from './figma-adapter';

interface PreviewMessage {
  type: 'preview';
  bundle: TokenBundle;
}

interface ApplyMessage {
  type: 'apply';
  signature: string;
}

interface PreviewSheetMessage {
  type: 'preview-sheet';
  bundle: TokenBundle;
}

interface ApplySheetMessage {
  type: 'apply-sheet';
  signature: string;
}

/**
 * The UI has a socket open and something on the other end asked for the
 * variable table. `id` is the asker's own correlation id and is echoed back
 * untouched; nothing in this file interprets it.
 */
interface BridgeReadMessage {
  type: 'bridge-read';
  id: string;
}

/** The UI's socket just opened and it needs the greeting to send. */
interface BridgeHelloMessage {
  type: 'bridge-hello';
}

type Incoming =
  | PreviewMessage
  | ApplyMessage
  | PreviewSheetMessage
  | ApplySheetMessage
  | BridgeReadMessage
  | BridgeHelloMessage
  | { type: 'close' };

let pending: { bundle: TokenBundle; plan: Plan } | null = null;
let pendingSheet: { bundle: TokenBundle; plan: SheetPlan } | null = null;

figma.showUI(__html__, { width: 720, height: 640, themeColors: true });

figma.ui.onmessage = async (message: Incoming) => {
  try {
    if (message.type === 'close') {
      figma.closePlugin();
      return;
    }

    if (message.type === 'preview') {
      const snapshot = await captureSnapshot();
      const plan = planSync(message.bundle, snapshot);
      pending = { bundle: message.bundle, plan };
      figma.ui.postMessage({ type: 'plan', plan });
      return;
    }

    if (message.type === 'apply') {
      if (!pending) {
        figma.ui.postMessage({ type: 'error', message: 'Nothing to apply. Preview the changes first.' });
        return;
      }
      if (!isApplicable(pending.plan)) {
        figma.ui.postMessage({
          type: 'error',
          message: 'This plan has errors. Fix the token source and preview again — a partial projection is drift.',
        });
        return;
      }

      // Re-plan against the live document. If somebody edited variables between
      // the preview and the confirmation, the diff the user approved is not the
      // diff that would be written, and this refuses rather than proceeding.
      const adapter = await FigmaVariables.create();
      const fresh = planSync(pending.bundle, adapter.readSnapshot());
      if (fresh.signature !== message.signature) {
        pending = { bundle: pending.bundle, plan: fresh };
        figma.ui.postMessage({
          type: 'stale',
          message: 'The document changed since the preview. Here is the current diff — review it and confirm again.',
          plan: fresh,
        });
        return;
      }

      const result = applyPlan(fresh, adapter);
      const after = planSync(pending.bundle, await captureSnapshot());
      pending = { bundle: pending.bundle, plan: after };

      figma.ui.postMessage({
        type: 'applied',
        applied: result.applied,
        failures: result.failures.map((f) => ({ message: f.message, action: f.action })),
        remaining: after.actions.length,
        plan: after,
      });

      figma.notify(
        result.failures.length === 0
          ? `Sync complete — ${result.applied} change${result.applied === 1 ? '' : 's'} written.`
          : `Sync finished with ${result.failures.length} failure${result.failures.length === 1 ? '' : 's'}.`,
      );
      return;
    }

    if (message.type === 'preview-sheet') {
      const snapshot = await captureSnapshot();
      const sheet = await captureSheetSnapshot(SHEET_PAGE_NAME, snapshot);
      const plan = planSheet(message.bundle, snapshot, sheet);
      pendingSheet = { bundle: message.bundle, plan };
      figma.ui.postMessage({ type: 'sheet-plan', plan });
      return;
    }

    if (message.type === 'apply-sheet') {
      if (!pendingSheet) {
        figma.ui.postMessage({ type: 'error', message: 'Nothing to build. Preview the sheet first.' });
        return;
      }
      if (!isSheetApplicable(pendingSheet.plan)) {
        figma.ui.postMessage({
          type: 'error',
          message:
            'This sheet plan has errors. A half-drawn sheet documents nothing — fix the source, or run the sync first, and preview again.',
        });
        return;
      }

      // The same gate the sync uses: re-plan against the live document and
      // refuse if the diff has moved since the preview. A confirmation on a
      // diff nobody is going to write is not a confirmation.
      const snapshot = await captureSnapshot();
      const adapter = await FigmaNodes.create(SHEET_PAGE_NAME, snapshot, pendingSheet.plan.fonts);
      const fresh = planSheet(pendingSheet.bundle, snapshot, adapter.readSheet());
      if (fresh.signature !== message.signature) {
        pendingSheet = { bundle: pendingSheet.bundle, plan: fresh };
        figma.ui.postMessage({
          type: 'sheet-stale',
          message: 'The document changed since the preview. Here is the current diff — review it and confirm again.',
          plan: fresh,
        });
        return;
      }

      const result = applySheet(fresh, adapter);
      const afterSnapshot = await captureSnapshot();
      const after = planSheet(
        pendingSheet.bundle,
        afterSnapshot,
        await captureSheetSnapshot(SHEET_PAGE_NAME, afterSnapshot),
      );
      pendingSheet = { bundle: pendingSheet.bundle, plan: after };

      figma.ui.postMessage({
        type: 'sheet-applied',
        applied: result.applied,
        failures: result.failures.map((f) => ({ message: f.message, action: f.action })),
        remaining: after.actions.length,
        plan: after,
      });

      figma.notify(
        result.failures.length === 0
          ? `Proof sheet built — ${result.applied} change${result.applied === 1 ? '' : 's'} written.`
          : `Proof sheet finished with ${result.failures.length} failure${result.failures.length === 1 ? '' : 's'}.`,
      );
      return;
    }

    /**
     * The bridge's whole implementation on this side: read, project, hand back.
     *
     * `id` is echoed and never read. The reply is a finished protocol message
     * rather than a payload the UI would have to wrap, so `ui.html` forwards
     * bytes it was given and constructs no message of its own — which is what
     * keeps the read-only claim a property of this file rather than of that one.
     *
     * The document's identity goes out beside the payload rather than inside it.
     * `toRestPayload` produces the shape of Figma's read endpoint and is shared
     * with the in-memory model, so it has no business carrying a document name;
     * the envelope does. What it buys is that the drift report can say which
     * file it read — and a report that cannot say that is a report whose remedy
     * cannot be checked.
     */
    if (message.type === 'bridge-hello') {
      figma.ui.postMessage({ type: 'bridge-reply', message: helloMessage() });
      return;
    }

    if (message.type === 'bridge-read') {
      try {
        const payload = toRestPayload(await captureRestSource());
        figma.ui.postMessage({
          type: 'bridge-reply',
          message: snapshotMessage(message.id, payload, captureDocument()),
        });
      } catch (error) {
        figma.ui.postMessage({
          type: 'bridge-reply',
          message: errorMessage(message.id, error instanceof Error ? error.message : String(error)),
        });
      }
      return;
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: error instanceof Error ? `${error.message}` : String(error),
    });
  }
};
