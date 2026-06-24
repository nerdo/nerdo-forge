import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// Minimal structural slice of the omp ExtensionAPI/HookAPI this plugin uses.
// Declared locally so the plugin typechecks without depending on
// @oh-my-pi/pi-coding-agent (not a dependency of this repo). The runtime passes
// the real API object; we only ever call `on`. To adopt the canonical type,
// replace these with `import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"`.
export interface ToolResultContext {
  readonly cwd?: string;
}
export type ToolResultHandler = (
  event: unknown,
  ctx: ToolResultContext,
) => void | Promise<void>;
export interface OmpHookApi {
  on(event: "tool_result", handler: ToolResultHandler): void;
}

// Wall-clock bound on each jj invocation so a hung jj never stalls the agent loop.
const TIMEOUT_MS = 5_000;

// LOCATION: this module lives under `hooks/pre/` (not `extensions/`) on purpose.
// A marketplace-cache install surfaces a plugin's skills/commands/hooks/tools/mcp
// but NOT its `package.json#omp.extensions` entries; only `hooks/pre|post/` is
// scanned, and the loader folds any `.ts`/`.js` found there into the extension
// runtime (binding `pi.on(...)`). Placing the factory here is the only way a
// marketplace-cache install loads it. `package.json#omp.extensions` also points
// here so the `omp plugin link` (node_modules) route resolves it too; it is one
// physical file, so path de-dup collapses both routes to a single load.
export default function jjSnapshot(pi: OmpHookApi): void {
  // `tool_result` fires once after every tool execution — the most granular
  // "the agent took an action" signal omp exposes. A 3-file edit is 3 tool
  // calls, so this fires 3 times; `turn_end` fires once per user turn and
  // `agent_end` once per streaming segment, neither per action. No tool filter:
  // any action can change the tree, so let jj decide what (if anything) to snapshot.
  //
  // Any jj command snapshots the working copy, so running `jj status` after each
  // action keeps jj's operation log current — every snapshot is its own
  // restorable operation (`jj op log` / `jj op restore`). No idempotency guard:
  // unlike a context-injecting harness, a redundant snapshot is a no-op, so a
  // double load (both marketplace-cache and node_modules routes) is harmless.
  pi.on("tool_result", async (_event, ctx) => {
    try {
      await run("jj", ["status"], {
        cwd: ctx?.cwd ?? process.cwd(),
        timeout: TIMEOUT_MS,
      });
    } catch {
      // Best-effort: not a jj repo, jj not on PATH, or jj errored. Snapshotting
      // is a background convenience — never surface or block on its failure.
    }
  });
}
