# nerdo-forge — Plugin Marketplace

A Claude Code plugin marketplace with three installable plugins: **nerdo-essentials** (agents, statusline, output styles, commands, setup), **nerdo-mcp-bundle** (MCP servers), and **jj-snapshot** (jj working-copy snapshots).

## What's Included

### nerdo-essentials

The primary plugin. Includes:

**Statusline** — A rich status bar showing:
- Directory name with context-aware folder icon
- Language runtime versions (bun/node, python, go, rust) detected from project files
- [Jujutsu (jj)](https://github.com/jj-vcs/jj) VCS info: working copy and parent change IDs, descriptions, file change counts with color-coded status

**Output Style: Disciplined Engineering** — An engineering-focused output style that emphasizes:
- Evidence-based verification and intellectual honesty
- A mandatory testing discipline cycle (test → fix → typecheck → test → build)
- End-user validation as a feedback loop, not a handoff
- User-documented preferences treated as prime directives (highest authority)
- Claims vs. inferences language precision

**Specialized agents** — researcher, root-cause-analyzer, ui-tester — spawned by the host Claude Code session for delegated work.

**Setup command** — configures statusline, output style, and permission bundles.

### nerdo-mcp-bundle

Seven MCP servers (you approve each on first load):

| Server | Launched via | Notes |
|---|---|---|
| `context7` | `bunx @upstash/context7-mcp` | |
| `clear-thought` | `bunx @waldzellai/clear-thought-onepointfive` | |
| `json-emitter` | `bunx @nerdo/json-emitter-mcp` | |
| `precision-math` | `bunx @nerdo/precision-math-mcp` | |
| `excel` | `uvx excel-mcp-server stdio` | Requires Python's [`uv`](https://docs.astral.sh/uv/) on `PATH` |
| `playwright-headless` | bundled `scripts/launch-playwright-mcp.ts` | Invisible browser for background runs. See below |
| `playwright-headed` | bundled `scripts/launch-playwright-mcp.ts --headed` | Visible browser window to watch along. See below |

**Requirements:** [`bun`](https://bun.sh) on `PATH` (for the `bunx` servers and the Playwright launcher), and `uv`/`uvx` for `excel`.

**Headed vs headless:** Playwright's browser mode is fixed when the MCP server starts (there is no per-call toggle), so the bundle ships the same launcher twice — `playwright-headless` (default, invisible) and `playwright-headed` (a visible window you can watch). Both register in every session; call the headed server's `browser_*` tools when you want to see the browser, the headless server's otherwise.

**Playwright browser:** both launchers try `PLAYWRIGHT_CHROME_PATH`, then a `PATH` lookup for `chromium` → `chromium-browser` → `google-chrome-stable` → `google-chrome`, validating each with a quick headless launch so a present-but-broken browser is skipped. If none works, they hand off to Playwright's own bundled browser (which the server downloads on first use). On a machine where the bundled browser is broken — e.g. a container missing system libraries, the case this exists for — start Claude with `PLAYWRIGHT_CHROME_PATH=/path/to/chromium claude` to point it at a working browser; that takes precedence over everything else.

> **Already added these at user scope?** If you previously ran `claude mcp add -s user <name> …` for any of the seven, that name now exists twice. Remove the user-scope copy so the bundle's is the single source: `claude mcp remove -s user <name>`. (`prime-directive` is *not* bundled, so leave any user-scope registration of it alone.)

### jj-snapshot

An omp plugin that runs `jj status` after every tool execution, giving you a granular, restorable history in `jj op log`. See `plugins/jj-snapshot/README.md` for details.

## Installation

### From GitHub

```
/plugin marketplace add nerdo/nerdo-plugins
/plugin install nerdo-essentials@nerdo-plugins
```

This installs the primary plugin. The marketplace also lists **nerdo-mcp-bundle** and **jj-snapshot** — install those separately if you want MCP servers or jj snapshots.

### From a local clone

```bash
git clone <repo-url> ~/path/to/nerdo-forge
```

Then in Claude Code:
 
```
/plugin marketplace add ~/path/to/nerdo-forge/plugins/nerdo-essentials
/plugin install nerdo-essentials@nerdo-plugins
```

### Setup

After installing nerdo-essentials, run:

```
/nerdo-essentials:setup
```

This will:
1. Configure your Claude config directory's `settings.json` (honoring `CLAUDE_CONFIG_DIR`, defaulting to `~/.claude`) to use the statusline
2. Ask whether to set Disciplined Engineering as your default output style
3. Confirm everything is wired up

Restart Claude Code for changes to take effect.

## Development

Requires [bun](https://bun.sh) for building from source.

```bash
bun install
bun run build      # Rebuild statusline to dist/
bun run typecheck   # Type-check without emitting
```

The pre-built `dist/statusline.js` is committed to the repo, so end users don't need bun.

## License

MIT
