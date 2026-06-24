import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jjSnapshot, {
  type OmpHookApi,
  type ToolResultHandler,
} from "./jj-snapshot.ts";

// Count operations WITHOUT snapshotting the working copy (--ignore-working-copy),
// so the count reflects only operations the code under test created — never an
// operation incidentally produced by this measurement.
function opCount(cwd: string): number {
  const out = execFileSync(
    "jj",
    ["op", "log", "--ignore-working-copy", "--no-graph", "-T", '"x\n"'],
    { cwd, encoding: "utf8" },
  );
  return out.split("\n").filter((line) => line.length > 0).length;
}

// Drive the factory with a fake API and return the handler it registers for
// `tool_result`. The fake is a plain in-memory stub — no mocking framework.
function loadHandler(): ToolResultHandler {
  let captured: ToolResultHandler | undefined;
  const api: OmpHookApi = {
    on(event, handler) {
      if (event === "tool_result") captured = handler;
    },
  };
  jjSnapshot(api);
  if (!captured) throw new Error("factory did not register a tool_result handler");
  return captured;
}

describe("jj-snapshot hook", () => {
  test("registers a tool_result handler", () => {
    expect(typeof loadHandler()).toBe("function");
  });

  test("invoking the handler snapshots the working copy (creates a jj operation)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jj-snapshot-repo-"));
    try {
      execFileSync("jj", ["git", "init"], { cwd: dir });
      const before = opCount(dir);
      // Create a change that is NOT yet snapshotted (no jj command has run since).
      writeFileSync(join(dir, "a.txt"), "hello");

      await Promise.resolve(loadHandler()({}, { cwd: dir }));

      // The only command that snapshots the working copy is the handler's
      // `jj status`; opCount uses --ignore-working-copy. A new operation proves
      // the handler ran jj and snapshotted the change.
      expect(opCount(dir)).toBeGreaterThan(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("does not throw outside a jj repository (best-effort)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jj-snapshot-nonrepo-"));
    try {
      await expect(
        Promise.resolve(loadHandler()({}, { cwd: dir })),
      ).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
