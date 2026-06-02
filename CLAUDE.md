# nerdo-forge — Plugin Authoring Guide

This file governs how Claude Code should behave when editing this plugin. For user-facing documentation see `README.md`.

## Plugin purpose

nerdo-forge is a Claude Code plugin that ships opinionated agents (`agents/`), a status line (`src/statusline.ts`), output styles (`output-styles/`), slash commands (`commands/`), and a setup skill. Agents here are spawned as subagents by the user's main Claude Code session.

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

**If `mcp__prime-directive__*` tools are available** (preferred path):

- Call `mcp__prime-directive__initialize_session`.
- Read every URI in `requiredReading` via `mcp__prime-directive__get_document_contents`.
- Load indexes — they are second-order lookup mechanisms. At minimum: `prime-directive-mcp://skills/index.md` and `prime-directive-mcp://output-styles/index.md`. If `initialize_session` surfaces other indexes, read them too.
- **Per-concern triage**: for each distinct concern your task touches, call `mcp__prime-directive__triage_documents` with a focused, single-topic query. Read full contents for every result above threshold. Your default concerns are listed at the end of this section — add task-specific ones on top.

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

On user correction, persistent test failure, or repeated wrong output, do not retry at the same cognitive level. Use thinking tools (preferred: `mcp__clear-thought__clear_thought` with `metacognitivemonitoring`; manual written decomposition if unavailable) to examine what went wrong before reattempting.

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
- [ ] If superseding an existing weaker bootstrap (e.g., a one-liner), the old version is fully removed.

## When to add a skill vs. an agent

- **Skill** = a procedure. Invoked by the user (`/skill-name`) or injected into context. Use for repeatable how-tos (commit, migrate, set up tooling).
- **Agent** = a cognitive role. Spawned by the host model for delegated work that needs its own context window. Use for token-heavy or specialized reasoning (research, root-cause analysis, UI testing).

If in doubt: if the user would ever invoke it directly, it is a skill. If the model decides when to spawn it, it is an agent.

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

If a release introduces state that lives **outside** these surfaces — a sentinel file the runtime depends on, a settings field outside what setup writes, a global directory created at runtime — the release is NOT covered by the standard procedure. Document the explicit migration steps as part of the assessment AND in the commit body.

For releases that fall entirely within the table above:
- If only `plugin.json`-declared surfaces changed (output styles, slash commands, agents) → `Upgrade impact: none`
- If statusline path or permission bundles changed → `Upgrade impact: re-run setup`
- If anything outside the table changed → `Upgrade impact: <explicit migration steps>`

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
