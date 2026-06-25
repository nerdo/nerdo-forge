import { describe, expect, test } from "bun:test";
import {
  buildMcpArgs,
  planCandidates,
  selectBrowser,
  type Candidate,
  type SelectBrowserDeps,
  type Selection,
} from "./launch-playwright-mcp.ts";

// Build deps with injected PATH/filesystem/smoke doubles.
//   resolveTable: candidate name/path -> resolved executable path (absent = unresolvable)
//   smokeOk:      set of resolved paths whose headless smoke "passes"
function makeDeps(
  resolveTable: Record<string, string>,
  smokeOk: string[],
): SelectBrowserDeps & { warnings: string[] } {
  const ok = new Set(smokeOk);
  const warnings: string[] = [];
  return {
    warnings,
    resolvePath: (name) => resolveTable[name] ?? null,
    smoke: (path) => Promise.resolve(ok.has(path)),
    warn: (message) => warnings.push(message),
  };
}

describe("planCandidates", () => {
  test("orders explicit override first, then PATH names, then bundled", () => {
    expect(planCandidates("/opt/chrome")).toEqual([
      { kind: "env", value: "/opt/chrome" },
      { kind: "scan", name: "chromium" },
      { kind: "scan", name: "chromium-browser" },
      { kind: "scan", name: "google-chrome-stable" },
      { kind: "scan", name: "google-chrome" },
      { kind: "bundled" },
    ]);
  });

  test("omits the env candidate when PLAYWRIGHT_CHROME_PATH is unset or empty", () => {
    const first = planCandidates(undefined)[0];
    expect(first).toEqual({ kind: "scan", name: "chromium" });
    expect(planCandidates("")[0]).toEqual({ kind: "scan", name: "chromium" });
  });
});

describe("selectBrowser", () => {
  test("uses PLAYWRIGHT_CHROME_PATH when it resolves and passes the smoke test", async () => {
    const deps = makeDeps({ "/opt/chrome": "/opt/chrome" }, ["/opt/chrome"]);
    const result = await selectBrowser(planCandidates("/opt/chrome"), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/opt/chrome" });
    expect(deps.warnings).toEqual([]);
  });

  test("resolves a bare env-var name via PATH before smoke-testing", async () => {
    const deps = makeDeps({ "my-chrome": "/usr/local/bin/my-chrome" }, ["/usr/local/bin/my-chrome"]);
    const result = await selectBrowser(planCandidates("my-chrome"), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/usr/local/bin/my-chrome" });
  });

  test("falls through to a PATH scan candidate when PLAYWRIGHT_CHROME_PATH is unset", async () => {
    const deps = makeDeps({ chromium: "/usr/bin/chromium" }, ["/usr/bin/chromium"]);
    const result = await selectBrowser(planCandidates(undefined), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/usr/bin/chromium" });
  });

  test("env var that resolves but fails the smoke test warns and falls through", async () => {
    const deps = makeDeps(
      { "/opt/broken": "/opt/broken", "google-chrome": "/usr/bin/google-chrome" },
      ["/usr/bin/google-chrome"], // only the scan candidate launches
    );
    const result = await selectBrowser(planCandidates("/opt/broken"), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/usr/bin/google-chrome" });
    expect(deps.warnings.some((w) => w.includes("/opt/broken") && w.includes("failed to launch"))).toBe(true);
  });

  test("env var that does not resolve warns and falls through", async () => {
    const deps = makeDeps({ chromium: "/usr/bin/chromium" }, ["/usr/bin/chromium"]);
    const result = await selectBrowser(planCandidates("/nope/chrome"), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/usr/bin/chromium" });
    expect(deps.warnings.some((w) => w.includes("/nope/chrome") && w.includes("did not resolve"))).toBe(true);
  });

  test("honors scan order (chromium before google-chrome)", async () => {
    const deps = makeDeps(
      { chromium: "/usr/bin/chromium", "google-chrome": "/usr/bin/google-chrome" },
      ["/usr/bin/chromium", "/usr/bin/google-chrome"],
    );
    const result = await selectBrowser(planCandidates(undefined), deps);
    expect(result).toEqual({ kind: "executable", executablePath: "/usr/bin/chromium" });
  });

  test("hands off to the bundled browser when no concrete candidate works", async () => {
    const deps = makeDeps({}, []);
    const result = await selectBrowser(planCandidates(undefined), deps);
    expect(result).toEqual({ kind: "bundled" });
  });

  test("hands off to bundled when a present system browser fails the smoke test (no env var)", async () => {
    const deps = makeDeps({ chromium: "/usr/bin/chromium" }, []); // resolves but smoke fails
    const result = await selectBrowser(planCandidates(undefined), deps);
    expect(result).toEqual({ kind: "bundled" });
    expect(deps.warnings.some((w) => w.includes("chromium") && w.includes("failed to launch"))).toBe(true);
  });

  test("does not warn for absent PATH scan candidates", async () => {
    const deps = makeDeps({}, []);
    await selectBrowser([{ kind: "scan", name: "chromium" }, { kind: "bundled" }] as Candidate[], deps);
    expect(deps.warnings).toEqual([]);
  });
});

describe("buildMcpArgs", () => {
  const executable: Selection = { kind: "executable", executablePath: "/usr/bin/chromium" };
  const bundled: Selection = { kind: "bundled" };

  test("includes --headless by default (headed: false)", () => {
    expect(buildMcpArgs("/bun", bundled, { headed: false })).toContain("--headless");
  });

  test("omits --headless when headed", () => {
    expect(buildMcpArgs("/bun", bundled, { headed: true })).not.toContain("--headless");
  });

  test("appends --executable-path for a concrete selection", () => {
    const args = buildMcpArgs("/bun", executable, { headed: false });
    expect(args).toEqual([
      "/bun",
      "x",
      "-y",
      "@playwright/mcp@latest",
      "--browser",
      "chromium",
      "--headless",
      "--executable-path",
      "/usr/bin/chromium",
    ]);
  });

  test("omits --executable-path for the bundled hand-off", () => {
    expect(buildMcpArgs("/bun", bundled, { headed: false })).not.toContain("--executable-path");
  });

  test("headed concrete selection: no --headless, keeps --executable-path", () => {
    const args = buildMcpArgs("/bun", executable, { headed: true });
    expect(args).not.toContain("--headless");
    expect(args).toEqual([
      "/bun",
      "x",
      "-y",
      "@playwright/mcp@latest",
      "--browser",
      "chromium",
      "--executable-path",
      "/usr/bin/chromium",
    ]);
  });
});
