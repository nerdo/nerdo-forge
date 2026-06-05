# nerdo-forge — Plugin Authoring Guide

This file governs how Claude Code should behave when editing this plugin. For user-facing documentation see `README.md`.

## Plugin purpose

nerdo-forge is a Claude Code plugin that ships opinionated agents (`agents/`), a status line (`src/statusline.ts`), output styles (`output-styles/`), slash commands (`commands/`), a setup skill, and a default set of MCP servers (declared inline in `.claude-plugin/plugin.json` under `mcpServers`). Agents here are spawned as subagents by the user's main Claude Code session.

### Bundled MCP servers

The plugin declares six MCP servers inline in `.claude-plugin/plugin.json` so they are offered (with the standard per-server approval prompt) when the plugin is installed: `context7`, `clear-thought`, `json-emitter`, `precision-math`, and `excel` run directly via `bunx`/`uvx`; `playwright` runs through the bundled `scripts/launch-playwright-mcp.ts` launcher (referenced via `${CLAUDE_PLUGIN_ROOT}`), which selects a browser in order — `PLAYWRIGHT_CHROME_PATH`, then a PATH scan, each validated by a quick headless smoke launch — and otherwise hands off to Playwright's bundled browser. See the launcher's header comment for the full resolution logic. `prime-directive` is intentionally NOT bundled here — it ships from its own plugin.

Runtime prerequisites on the host `PATH`: `bun`/`bunx` for five of the servers and the Playwright launcher, plus Python's `uv`/`uvx` for `excel`. Edits to `plugin.json`'s `mcpServers` (or the launcher script) require `/reload-plugins` or a restart to take effect.

## Agent authoring conventions

### Every agent must include the Prime Directive Bootstrap

Subagents spawn with a fresh context. They do NOT inherit the host's `CLAUDE.md`, `initialize_session` state, or auto-memory. Without an explicit bootstrap in the agent's own system prompt, the subagent defaults to training-data habits.

Concrete regression this prevents: the researcher agent repeatedly used `gh api` for GitHub work despite the user having a `gh` skill documenting subcommand preferences (`gh issue list`, `gh search issues`, etc.). The bootstrap's per-tool orientation step surfaces that skill before the first `gh` invocation.

### Canonical Prime Directive Bootstrap

Every agent in `agents/` MUST include this block verbatim (with the `Default concerns` slot customized). Place it BEFORE any "CRITICAL constraints" or tool-usage sections — orient before acting.

````markdown
## Prime Directive Bootstrap (MANDATORY)

Orient to authoritative guidance before acting. Subagents spawn with a fresh context and do not inherit the host's prime-directive state — you must bootstrap yourself.

The concepts below are the principle. The substrates differ based on what is available to you.

### 1. Load authoritative guidance

**If the prime-directive MCP server is available** (preferred path):

- Initialize the session via the server's session-initialization tool (`initialize_session`).
- Read every URI in `requiredReading` via the server's document-retrieval tool (`get_document_contents`).
- Load indexes — they are second-order lookup mechanisms. At minimum: `prime-directive-mcp://skills/index.md` and `prime-directive-mcp://output-styles/index.md`. If session initialization surfaces other indexes, read them too.
- **Per-concern triage**: for each distinct concern your task touches, call the server's triage tool (`triage_documents`) with a focused, single-topic query. Read full contents for every result above threshold. Your default concerns are listed at the end of this section — add task-specific ones on top.

**If prime-directive MCP is unavailable**, apply the same principle via fallback substrates:

- Read `CLAUDE.md` in cwd and ancestor directories.
- Resolve the Claude config directory first: use `$CLAUDE_CONFIG_DIR` if that env var is set, otherwise default to `~/.claude`. Do not assume `~/.claude`.
- List skills under `<config_dir>/skills/` and plugin caches (`<config_dir>/plugins/**`); read any whose name or description matches your task.
- Check project-level guidance: `README.md`, `docs/`, `.claude/`.
- Check auto-memory: `<config_dir>/projects/**/memory/MEMORY.md`.

**If neither is available**, note the absence in your final report, proceed best-effort, and flag that guidance was unavailable.

### 2. Per-tool orientation (CRITICAL)

Before invoking any CLI or non-trivial tool (`gh`, `rg`, `jq`, `jj`, `bun`, etc.):

- If prime-directive MCP is available, triage for that tool by name and read any matching skill doc.
- Otherwise, check for a matching skill in the user's skills directory, then run `<tool> --help` if unfamiliar.

A skill doc's existence means the user has preferences that override training-data defaults. This rule prevents defaulting to training-data habits (e.g., reaching for `gh api` when `gh` subcommands cover the same need).

### 3. Surface divergences

If loaded guidance diverges from what you observe in the environment, surface it to the host. Do not silently pick one.

### 4. Cognitive escalation on failure

On user correction, persistent test failure, or repeated wrong output, do not retry at the same cognitive level. Use a structured metacognition tool (such as the clear-thought server's `metacognitivemonitoring` mode; manual written decomposition if none is available) to examine what went wrong before reattempting.

### Default concerns for this agent

- <CONCERN 1 — short description of why it matters to this agent>
- <CONCERN 2 — ...>
- <CONCERN 3 — ...>
````

### Customizing default concerns per agent

Pick 3–6 concerns that reflect the agent's role. Good defaults surface the guidance most relevant to the agent's typical work without forcing the agent to discover them from scratch every invocation. Current choices:

- **researcher** → research standards, evidence-based reasoning, cli usage, tool verification, tooling preferences.
- **root-cause-analyzer** → software-development workflow, evidence-based reasoning, error handling, testing reference, cli usage.
- **ui-tester** → user-experience-integration guide, browser-testing skill, form UX, testing reference, cli usage.

### Checklist for new or revised agents

- [ ] Bootstrap block present and placed before any "critical constraints" or tool-usage sections.
- [ ] `Default concerns for this agent` customized for the agent's role.
- [ ] All three availability states handled: PD MCP present, fallback substrates, neither.
- [ ] Per-tool orientation rule is inline (not just per-concern triage).
- [ ] Cognitive escalation rule is inline.
- [ ] No capability is pinned to a literal `mcp__<server>__<tool>` identifier — tools are referenced by capability (see "Reference tools by capability, not by exact MCP name").
- [ ] If superseding an existing weaker bootstrap (e.g., a one-liner), the old version is fully removed.

## When to add a skill vs. an agent

- **Skill** = a procedure. Invoked by the user (`/skill-name`) or injected into context. Use for repeatable how-tos (commit, migrate, set up tooling).
- **Agent** = a cognitive role. Spawned by the host model for delegated work that needs its own context window. Use for token-heavy or specialized reasoning (research, root-cause analysis, UI testing).

If in doubt: if the user would ever invoke it directly, it is a skill. If the model decides when to spawn it, it is an agent.

## Reference tools by capability, not by exact MCP name

Guidance in this plugin — agent prompts, the bootstrap block, slash commands, this file — MUST NOT pin a *capability* to a literal `mcp__<server>__<tool>` identifier. Those identifiers break silently when a server is renamed or namespaced, and a STOP-trigger or instruction whose remediation depends on a literal tool-name string just stops firing. The reader is an LLM that resolves the concrete tool at runtime from a capability description; let it.

- **Lead with the capability or role**, not the wire name: "use your precision-math calculation tool", "fetch docs via a library-documentation MCP server (such as context7)", "the prime-directive server's session-initialization tool (`initialize_session`)".
- If a concrete identifier genuinely aids comprehension, include it **once** as an explicitly illustrative example (`such as …`, `e.g. …`) — never phrased as an exact-match requirement, and never as the thing a rule keys on.
- **The one exception is a literal match that the harness itself requires.** Permission rules in `commands/setup.md` (e.g. `mcp__plugin_nerdo-forge_playwright`, `mcp__plugin_nerdo-forge_context7`) MUST stay exact, because Claude Code matches `permissions.allow` entries by string. Note the `plugin_nerdo-forge_` infix: a server bundled by this plugin surfaces as `mcp__plugin_<plugin-name>_<server>__<tool>`, NOT the bare `mcp__<server>` — so the permission strings carry that infix. Those are configuration, not guidance — keep them verbatim.

When you add or edit any agent/command/doc, scan for `mcp__` and apply this rule; the only hits left should be the permission-rule strings in `commands/setup.md`.

## Distribution & local development

> **Config-directory note:** Throughout this section, `~/.claude` denotes the Claude config directory. That is the default, but Claude Code honors `CLAUDE_CONFIG_DIR` — when it is set, the config directory is `$CLAUDE_CONFIG_DIR` (and the global `.claude.json` lives *inside* it rather than as a `~/.claude.json` sibling). Substitute accordingly when reading or writing any path below. Setup and the agent bootstraps resolve this automatically; do not hardcode `~/.claude` in new code or instructions.

### Local development (preferred for testing changes)

Launch a Claude Code session with `--plugin-dir` pointing at the source:

```bash
claude --plugin-dir /Users/nerdo/personal/code/nerdo-forge
```

This loads the plugin directly from the filesystem with no caching. Use `/reload-plugins` to pick up edits mid-session. No version bump or push needed for iteration.

Invoke plugin agents by their prefixed name during testing: `nerdo-forge:researcher`, `nerdo-forge:root-cause-analyzer`, `nerdo-forge:ui-tester`.

### Verifying changes before push

Every change must be exercised locally before the release flow. Use `--plugin-dir` (above), then touch every surface the change affects:

- **Agents** — invoke by prefixed name (`nerdo-forge:researcher`, etc.). Confirm the bootstrap runs (prime-directive calls visible in trace) and default concerns are loaded.
- **Statusline** — run `bun run build`, then `/reload-plugins`, and visually inspect.
- **Slash commands** — invoke by prefixed name and confirm resolution to the source version.
- **Output styles** — switch via `/output-style` and confirm formatting.
- **MCP servers** — after `/reload-plugins` (or restart), run `/mcp` to confirm the bundled servers are listed, approve them, and call one cheap tool (e.g. `precision-math` `calculate`) to confirm a server responds. For `playwright`, confirm a `browser_*` tool works (the launcher prints to stderr which browser it picked — env/PATH executable or the bundled hand-off; set `PLAYWRIGHT_CHROME_PATH` to force a specific one). Run `bun test scripts/launch-playwright-mcp.test.ts` for the launcher's resolution logic.

`/reload-plugins` picks up edits mid-session; no need to restart between iterations.

### Release flow

1. **Test locally first** (see "Verifying changes before push" above). Do not bump the version until every affected surface has been exercised.
2. **Assess upgrade impact** (see "Per-release upgrade impact assessment" below). The commit message body MUST state the impact line: `Upgrade impact: <none | re-run setup | manual migration steps>`.
3. Bump version with the semver scripts: `bun run bump:minor` (or `bump:patch` / `bump:major`). This syncs the version across `package.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.
4. Commit and push to the marketplace repo.
5. On each machine that has the plugin installed, follow the "Installing an updated version" steps below.

### Per-release upgrade impact assessment

Before every release, walk this checklist to confirm the standard "Installing an updated version" procedure leaves existing installations in a working state. State the result in the commit message body as `Upgrade impact: <one line>`.

| Surface | Migration on uninstall + install | User action required |
|---|---|---|
| **Statusline** | Cache dir path becomes stale (the path in `~/.claude/settings.json` embeds the old version dir) | Re-run `/nerdo-forge:setup` to point at the new cache dir. |
| **Permission bundles** | Reconciled idempotently by setup — added rules for ACTIVE bundles get applied; rules removed from a bundle get cleaned up | Re-run `/nerdo-forge:setup`. |
| **Output styles** | Replaced wholesale | None. |
| **Slash commands** | Replaced wholesale | None. |
| **Agents** | Replaced wholesale | None — provided callers use prefixed names (`nerdo-forge:researcher`, not bare `researcher`). See Hazards. |
| **MCP servers** | Replaced wholesale (declared inline in `plugin.json`; `${CLAUDE_PLUGIN_ROOT}` re-resolves to the new version dir automatically) | None on a normal update. On **first** install of a version that bundles a server the user also registered at user scope, that name now exists twice — remove the user-scope copy with `claude mcp remove -s user <name>`. New servers prompt the standard per-server approval. |

If a release introduces state that lives **outside** these surfaces — a sentinel file the runtime depends on, a settings field outside what setup writes, a global directory created at runtime — the release is NOT covered by the standard procedure. Document the explicit migration steps as part of the assessment AND in the commit body.

For releases that fall entirely within the table above:
- If only `plugin.json`-declared surfaces changed (output styles, slash commands, agents, MCP servers) → `Upgrade impact: none`
- If statusline path or permission bundles changed → `Upgrade impact: re-run setup`
- If anything outside the table changed → `Upgrade impact: <explicit migration steps>`

The release that first introduces a bundled MCP server is a special case: it is `plugin.json`-declared (so updates after it are `none`), but the first install collides with any user-scope copy of the same server name. State `Upgrade impact: manual migration steps` and spell out the `claude mcp remove -s user <name>` dedup in the commit body.

### Installing an updated version (CONFIRMED PROCEDURE)

The key insight: `/plugin install` and `/plugin update` both read from a **cached marketplace manifest**. Bumping the version in your source `marketplace.json` is invisible until the marketplace cache is refreshed explicitly. For this plugin's directory-sourced marketplace, the cache has a `lastUpdated` timestamp in `~/.claude/plugins/known_marketplaces.json` and does not refresh automatically.

The sequence that actually works:

```
/plugin marketplace update                # refresh the manifest cache; UI lists new versions
/plugin uninstall nerdo-forge@nerdo-plugins
/plugin install nerdo-forge@nerdo-plugins
/nerdo-forge:setup                        # re-run setup to re-apply AI-driven steps
```

`/plugin marketplace update` is the critical step and is easy to miss — it is a **different command** from `/plugin update`. `/reload-plugins` does not refresh marketplaces; it only reloads already-installed plugins from their cache dirs.

**Why `/nerdo-forge:setup` must follow an update:** Some setup writes point at the *specific installed version path*. The statusline entry in `~/.claude/settings.json` embeds the cache dir (e.g. `.../nerdo-forge/1.3.0/dist/statusline.js`) — after installing 1.4.0, that path is stale and the statusline will try to execute a file from the old cache dir (which may be GC'd within ~7 days). Re-running setup also gives the opportunity to re-apply permission bundles or the MCP init directive if the new version's setup procedure has changed.

### Known issue: `/plugin update` does not work in this environment

`/plugin update nerdo-forge@nerdo-plugins` silently no-ops on this user's machine even after refreshing the marketplace cache. Do not recommend it. Use the uninstall + install pair from the procedure above.

### Local dev bypasses all of this

For the development machine, use `--plugin-dir` (see "Local development" above). It reads the source directory directly, skips the marketplace manifest entirely, and `/reload-plugins` picks up edits in the current session — so none of the cache-refresh steps above are needed during iteration.

### Hazards to avoid

- **Do NOT `cp` agent, command, or skill files into `~/.claude/plugins/cache/`.** That cache is owned by the plugin installer. Manual edits are overwritten on update and obscure what version is actually running. If you need to iterate quickly, use `--plugin-dir` instead.
- **Do NOT place plugin-provided agents at `~/.claude/agents/*.md`.** Files there are user-level agents resolved by bare name, and they take precedence over plugin agents — meaning a `researcher.md` at `~/.claude/agents/` will shadow `nerdo-forge:researcher` whenever someone (or a subagent spawner) invokes `researcher` without the prefix. This is an invisible-staleness trap.
- **Invoke plugin agents by prefixed name** in prompts, agent descriptions, and cross-agent references. Bare names invite shadowing.
