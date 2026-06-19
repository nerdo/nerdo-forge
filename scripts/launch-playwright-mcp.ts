#!/usr/bin/env bun
// Launches the Playwright MCP server for the nerdo-forge plugin.
//
// Browser selection, in order:
//   1. PLAYWRIGHT_CHROME_PATH (explicit override).
//   2. A PATH lookup for chromium -> chromium-browser -> google-chrome-stable -> google-chrome.
//   3. The server's own bundled browser (no --executable-path) as the last resort.
//
// Each CONCRETE candidate (1 and 2) is validated with a cheap, offline-safe
// headless "smoke" launch. A browser that can't run (e.g. missing system
// libraries in a container — the case PLAYWRIGHT_CHROME_PATH exists to solve)
// crashes immediately with a non-zero exit; a healthy one either exits cleanly or
// keeps running. So the smoke spawns it headless and, within a short grace
// window, treats a non-zero exit as FAIL and "exited 0 or still alive" as PASS
// (then kills it). This is hang-tolerant: some builds never exit on --dump-dom,
// and that must not be read as a failure. A candidate that fails is skipped with
// a warning.
//
// The bundled browser is NOT probed: probing it faithfully would require
// installing chromium (a ~150MB download), and @playwright/mcp already surfaces
// an actionable "install browsers / install-deps" error (and a browser_install
// tool) if its bundled browser cannot launch. So bundled is a pure hand-off.
//
// Net effect: works out-of-the-box where a browser is available; on a machine
// where the bundled browser is broken, set PLAYWRIGHT_CHROME_PATH to a working
// Chrome/Chromium and it takes precedence.
//
// Headed vs headless: @playwright/mcp fixes the browser mode when the server
// launches (there is no per-tool-call toggle), so the plugin registers this
// launcher twice — once headless (default) and once with `--headed`. Pass
// `--headed` as a script argument to drop the server's `--headless` flag and
// show a visible browser window for collaborative, watch-along sessions. The
// browser-selection smoke probe (below) always runs headless regardless: it is
// a throwaway validation launch, and a visible window flashing during selection
// would be noise.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCAN_CANDIDATES = [
  "chromium",
  "chromium-browser",
  "google-chrome-stable",
  "google-chrome",
] as const;

// How long to wait for a crash before concluding the browser launched cleanly.
// A missing-library crash is immediate; a healthy browser survives this window.
const SMOKE_GRACE_MS = 5_000;

export type Candidate =
  | { kind: "env"; value: string }
  | { kind: "scan"; name: string }
  | { kind: "bundled" };

export type Selection =
  | { kind: "executable"; executablePath: string }
  | { kind: "bundled" };

export interface SelectBrowserDeps {
  /** Resolve a candidate name to an existing executable path, or null. */
  resolvePath: (name: string) => string | null;
  /** Headless smoke-launch a concrete executable; true if it launched cleanly. */
  smoke: (executablePath: string) => Promise<boolean>;
  /** Surface a non-fatal fall-through reason. */
  warn: (message: string) => void;
}

/**
 * Build the ordered candidate list: explicit override first, then PATH names,
 * then the bundled browser as the terminal fallback.
 */
export function planCandidates(chromePath: string | undefined): Candidate[] {
  const candidates: Candidate[] = [];
  if (chromePath && chromePath.length > 0) {
    candidates.push({ kind: "env", value: chromePath });
  }
  for (const name of SCAN_CANDIDATES) {
    candidates.push({ kind: "scan", name });
  }
  candidates.push({ kind: "bundled" });
  return candidates;
}

/**
 * Walk the candidates in order, returning the first concrete browser that passes
 * the smoke test, or the bundled hand-off. Pure except for the injected deps, so
 * the ordering / fall-through / warning behavior is unit-testable.
 */
export async function selectBrowser(
  candidates: Candidate[],
  deps: SelectBrowserDeps,
): Promise<Selection> {
  for (const candidate of candidates) {
    if (candidate.kind === "bundled") {
      return { kind: "bundled" };
    }

    const raw = candidate.kind === "env" ? candidate.value : candidate.name;
    const label =
      candidate.kind === "env" ? `PLAYWRIGHT_CHROME_PATH='${raw}'` : `'${raw}'`;

    const resolved = deps.resolvePath(raw);
    if (!resolved) {
      // Only the explicit override is worth warning about when missing; an absent
      // PATH scan candidate is expected and noisy to report.
      if (candidate.kind === "env") {
        deps.warn(`${label} did not resolve to an executable; falling back.`);
      }
      continue;
    }

    if (await deps.smoke(resolved)) {
      return { kind: "executable", executablePath: resolved };
    }
    deps.warn(`${label} failed to launch headless; falling back.`);
  }

  // planCandidates always appends a bundled candidate, so the loop returns before
  // here; this is a defensive terminal fallback.
  return { kind: "bundled" };
}

function realResolvePath(name: string): string | null {
  // A value containing "/" is a path used as-is; a bare name is looked up on PATH.
  if (name.includes("/")) {
    return existsSync(name) ? name : null;
  }
  return Bun.which(name);
}

async function realSmoke(executablePath: string): Promise<boolean> {
  // Throwaway profile so the smoke launch never pollutes the working directory.
  const userDataDir = mkdtempSync(join(tmpdir(), "pw-smoke-"));
  const proc = Bun.spawn(
    [
      executablePath,
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      `--user-data-dir=${userDataDir}`,
      "--dump-dom",
      "about:blank",
    ],
    { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
  );

  try {
    // PASS if it exits 0, or if it is still alive after the grace window (it
    // launched without crashing). FAIL only on a fast non-zero exit.
    return await Promise.race([
      proc.exited.then((code) => code === 0),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), SMOKE_GRACE_MS)),
    ]);
  } finally {
    proc.kill();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

/**
 * Build the argv for spawning @playwright/mcp via `bun x`. `--headless` is
 * included unless `headed` is set; the resolved executable path is appended only
 * for a concrete selection (the bundled hand-off omits it). Pure, so the flag
 * composition is unit-testable.
 */
export function buildMcpArgs(
  bunPath: string,
  selection: Selection,
  options: { headed: boolean },
): string[] {
  const args = [bunPath, "x", "-y", "@playwright/mcp@latest", "--browser", "chromium"];
  if (!options.headed) {
    args.push("--headless");
  }
  if (selection.kind === "executable") {
    args.push("--executable-path", selection.executablePath);
  }
  return args;
}

if (import.meta.main) {
  const headed = process.argv.includes("--headed");

  const selection = await selectBrowser(planCandidates(process.env.PLAYWRIGHT_CHROME_PATH), {
    resolvePath: realResolvePath,
    smoke: realSmoke,
    warn: (message) => console.error(`playwright-mcp: ${message}`),
  });

  const args = buildMcpArgs(process.execPath, selection, { headed });
  const mode = headed ? "headed" : "headless";

  if (selection.kind === "executable") {
    console.error(`playwright-mcp: using browser at ${selection.executablePath} (${mode})`);
  } else {
    console.error(
      `playwright-mcp: no usable system browser found; using the bundled browser (${mode}).`,
    );
  }

  // Reuse the bun that's running this script as `bunx` — never hardcode its path.
  const proc = Bun.spawn(args, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });

  // Forward termination signals so the MCP server shuts down cleanly.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => proc.kill());
  }

  process.exit(await proc.exited);
}
