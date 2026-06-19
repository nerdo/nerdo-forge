---
allowed-tools: Read, Edit, Write, Bash, AskUserQuestion
description: Configure the nerdo-forge statusline, output style, and permission defaults
user-invocable: true
---

# nerdo-forge Setup

You are setting up the nerdo-forge plugin. Perform these steps:

## 0. Resolve the Claude config directory

Do NOT assume the Claude config directory is `~/.claude`. Claude Code honors the `CLAUDE_CONFIG_DIR` environment variable, and this user may have it set to a non-default location. Resolve it once, up front, and use the resolved value everywhere below.

Run this Bash command to compute both the config directory and the global config file path:

```bash
if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  printf 'config_dir=%s\n' "$CLAUDE_CONFIG_DIR"
  printf 'config_json=%s/.claude.json\n' "$CLAUDE_CONFIG_DIR"
else
  printf 'config_dir=%s/.claude\n' "$HOME"
  printf 'config_json=%s/.claude.json\n' "$HOME"
fi
```

Note the asymmetry the snippet handles for you:

- When `CLAUDE_CONFIG_DIR` is **set**, the directory is `$CLAUDE_CONFIG_DIR` and the global config file lives *inside* it at `$CLAUDE_CONFIG_DIR/.claude.json`.
- When it is **unset**, the directory is `~/.claude` but the global config file is its *sibling* at `~/.claude.json`.

Store the two resolved, absolute paths:

- `<config_dir>` — the config directory (`settings.json`, `projects/`, `plugins/` all live here)
- `<config_json>` — the global config file (used in step 3)

Everywhere below that references `<config_dir>` or `<config_json>`, substitute the resolved absolute paths from this step. Never read or write a literal `~/.claude` path.

## 1. Locate the plugin

The plugin root is the directory containing this command file's parent. Find the actual resolved path of the plugin installation by searching for `nerdo-forge` in `<config_dir>/plugins/installed_plugins.json`. Extract the `installPath` value.

If not found in installed_plugins.json, check if the plugin is running from a local development path by looking for `.claude-plugin/plugin.json` in ancestor directories of this command file.

Store the resolved plugin root path for use below.

## 2. Update settings.json for statusline

Read `<config_dir>/settings.json`. Update or add the `statusLine` field:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node <plugin_root>/dist/statusline.js"
  }
}
```

Replace `<plugin_root>` with the actual resolved path from step 1.

Preserve all existing settings. Only modify the `statusLine` field.

## 3. Enable verbose mode

Read `<config_json>`. Set `"verbose": true` if not already set. This enables the built-in token counter in the status line notification area, which complements the nerdo-forge context usage bar.

Preserve all existing data. Only modify the `verbose` field.

## 4. Confirm output style availability

Verify the output style file exists at `<plugin_root>/output-styles/Disciplined Engineering.md`.

## 5. Ask about default output style

Ask the user:

> The "Disciplined Engineering" output style is now available and can be selected anytime with `/output-style`. Would you like to set it as your **default** output style? (This writes to `<config_dir>/settings.json` so it activates automatically on every new session.)

If yes, add `"outputStyle": "Disciplined Engineering"` to `<config_dir>/settings.json`, preserving all other settings.

If no, skip this step.

## 6. Ask about disabling auto-memory

Claude Code's auto-memory feature (on by default since v2.1.59) lets Claude write notes to `<config_dir>/projects/<project>/memory/MEMORY.md` based on your corrections and preferences. Disabling it is an optional personal preference.

Ask the user:

> Would you like to **disable auto-memory**? Claude Code writes notes to `<config_dir>/projects/<project>/memory/` based on your corrections; disabling stops that. (This writes `"autoMemoryEnabled": false` to `<config_dir>/settings.json`. Existing memory files are left alone — you can archive or delete them separately.)

If yes, read `<config_dir>/settings.json` and set the top-level `"autoMemoryEnabled"` field to `false`. Preserve all other settings.

If no, skip this step. (The user can still toggle it later with `/memory` or the `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` environment variable.)

## 7. Reconcile permission bundles

Many tools are safe but annoying to approve one-by-one. This step reconciles `<config_dir>/settings.json`'s `permissions.allow` with a set of curated bundles. The bundle rule lists below are the source of truth: if the user marks a bundle ACTIVE, every rule in it is ensured present; if the user marks it INACTIVE, every rule in it is removed. Rules in `permissions.allow` that are NOT listed in any bundle are always preserved.

The goal is an idempotent, symmetric operation: running setup repeatedly with the same selections should produce no change, and unchecking a previously-applied bundle should actually remove it.

### 7a. Inspect current state

Read `<config_dir>/settings.json` and, for each of the six bundles listed in §7d, compute the current state by exact-string comparison against `permissions.allow`:

- **ON** — every rule in the bundle is present
- **PARTIAL** — some rules present, some missing (include the count, e.g. `PARTIAL (11/13)`)
- **OFF** — no rules from the bundle are present

Display the result to the user verbatim before asking anything, for example:

> Current permission bundle state:
> - Essentials: ON
> - Browser testing: ON
> - jj safe commands: PARTIAL (11/13)
> - Dev shell bundle: OFF
> - GitHub CLI (read-only): ON
> - Transcript inspection: OFF

### 7b. Ask whether to change anything

Use `AskUserQuestion`:

**Question:** "The current bundle state is shown above. Do you want to review and change it? Selecting 'No' leaves `permissions.allow` untouched. Selecting 'Yes' asks which bundles should be ACTIVE at the end — any bundle you leave unchecked will have its rules REMOVED from `permissions.allow`."
**Header:** "Permissions"
**multiSelect:** false

**Options:**

1. **Label:** "No, leave as-is"
   **Description:** "Skip this step. `permissions.allow` is not touched."

2. **Label:** "Yes, review and adjust"
   **Description:** "Show the bundle selector. Declare the desired end state explicitly; setup adds missing rules for checked bundles and removes rules for unchecked ones."

If the user chose "No", skip to §8.

### 7c. Collect desired end state

`AskUserQuestion` caps options at four per question, so split the six bundles into two questions. For every option, append the current state from §7a to the label in parentheses (e.g. `Essentials (Recommended) — currently ON`) so the user can see at a glance what leaving it checked or unchecked means.

**Question 1:** "Which of these bundles should be ACTIVE at the end of setup? Unchecked = rules REMOVED."
**Header:** "Bundles 1/2"
**multiSelect:** true

**Options** (append the live state string to each label):

1. **Label:** "Essentials (Recommended) — currently <state>"
   **Description:** "The nerdo-forge-bundled MCP servers (context7, precision-math, clear-thought, json-emitter, excel); WebSearch; WebFetch for any site."

2. **Label:** "Browser testing — currently <state>"
   **Description:** "All tools on both nerdo-forge-bundled playwright MCP servers (headless for background runs, headed for watch-along sessions). Enables the ui-tester agent and browser automation."

3. **Label:** "jj safe commands — currently <state>"
   **Description:** "Read-only jj (root, status, diff, log, show) plus reversible writes (describe, commit, new, squash, split). Excludes destructive/external commands."

4. **Label:** "Dev shell bundle — currently <state>"
   **Description:** "Read-only git, common test/build/lint scripts (bun/npm/pnpm), and harmless inspection commands (ls, cat, jq, etc.)."

**Question 2:** "Which of these bundles should be ACTIVE at the end of setup? Unchecked = rules REMOVED."
**Header:** "Bundles 2/2"
**multiSelect:** true

**Options** (append the live state string to each label):

1. **Label:** "GitHub CLI (read-only) — currently <state>"
   **Description:** "Read-only `gh` subcommands (pr/issue/release/repo/run/workflow/search view + list, auth status). No write operations."

2. **Label:** "Transcript inspection — currently <state>"
   **Description:** "Read access to `<config_dir>/projects/**` so agents can audit prior session logs (turn-by-turn JSONL records). Opt-in; off by default."

### 7d. Apply the desired end state

For each of the six bundles, using the exact rule lists below:

- **Selected (ACTIVE):** ensure every rule string is present in `permissions.allow`. Add missing rules at the end of the array. Do not duplicate.
- **Unselected (INACTIVE):** remove every rule string in the bundle from `permissions.allow` by exact match.

If a rule string appears in more than one bundle and at least one of those bundles is selected, keep the rule (it is required by the selected bundle).

Rules in `permissions.allow` that are not listed in any bundle are preserved exactly as they are.

**MCP entry form:** Use the server-level string exactly as listed — do NOT expand to the tool-wildcard form (`...__*`). The server-level entry already covers all tools on that server; adding both is duplicative.

**Plugin-bundled vs user/project-scope naming (CRITICAL):** a server bundled *by a plugin* is namespaced with a `plugin_<plugin-name>_` infix, so its server-level string is `mcp__plugin_nerdo-forge_<server>` (e.g. `mcp__plugin_nerdo-forge_playwright-headless`) — NOT the bare `mcp__playwright-headless`. A bare `mcp__<server>` matches only a server registered at user or project scope. Since nerdo-forge now ships these servers itself, the rule lists below use the `mcp__plugin_nerdo-forge_*` form for them. Servers provided at user/project scope or by *other* plugins are not nerdo-forge's concern — this command does not add, manage, or remove their permissions.

- **When ADDING:** if an existing entry in `permissions.allow` uses the wildcard form (`mcp__<server>__*`) for a server being added, replace it with the server-level form rather than keeping both.
- **When REMOVING:** remove only the exact bundle rule string (the server-level form). Leave any wildcard or user-specific variant alone so the user can clean it up manually if they choose.

**Bundle: Essentials**
```
mcp__plugin_nerdo-forge_context7
mcp__plugin_nerdo-forge_precision-math
mcp__plugin_nerdo-forge_clear-thought
mcp__plugin_nerdo-forge_json-emitter
mcp__plugin_nerdo-forge_excel
WebSearch
WebFetch
```

**Bundle: Browser testing**
```
mcp__plugin_nerdo-forge_playwright-headless
mcp__plugin_nerdo-forge_playwright-headed
```

**Bundle: jj safe commands**
```
Bash(jj root:*)
Bash(jj status:*)
Bash(jj st:*)
Bash(jj diff:*)
Bash(jj log:*)
Bash(jj show:*)
Bash(jj evolog:*)
Bash(jj files:*)
Bash(jj op log:*)
Bash(jj operation log:*)
Bash(jj op restore:*)
Bash(jj operation restore:*)
Bash(jj op revert:*)
Bash(jj operation revert:*)
Bash(jj bookmark list:*)
Bash(jj workspace list:*)
Bash(jj describe:*)
Bash(jj commit:*)
Bash(jj new:*)
Bash(jj squash:*)
Bash(jj split:*)
```

**Bundle: Dev shell bundle**
```
Bash(git status:*)
Bash(git log:*)
Bash(git diff:*)
Bash(git show:*)
Bash(git blame:*)
Bash(git branch:*)
Bash(bun run test:*)
Bash(bun run typecheck:*)
Bash(bun run build:*)
Bash(bun run lint:*)
Bash(npm run test:*)
Bash(npm run typecheck:*)
Bash(npm run build:*)
Bash(npm run lint:*)
Bash(pnpm run test:*)
Bash(pnpm run typecheck:*)
Bash(pnpm run build:*)
Bash(pnpm run lint:*)
Bash(ls:*)
Bash(pwd)
Bash(tree:*)
Bash(which:*)
Bash(echo:*)
Bash(jq:*)
Bash(cat:*)
Bash(head:*)
Bash(tail:*)
Bash(node --version)
Bash(bun --version)
Bash(jj --version)
Bash(git --version)
```

**Bundle: GitHub CLI (read-only)**
```
Bash(gh pr view:*)
Bash(gh pr list:*)
Bash(gh pr diff:*)
Bash(gh pr status:*)
Bash(gh pr checks:*)
Bash(gh issue view:*)
Bash(gh issue list:*)
Bash(gh issue status:*)
Bash(gh release view:*)
Bash(gh release list:*)
Bash(gh release download:*)
Bash(gh repo view:*)
Bash(gh repo list:*)
Bash(gh run view:*)
Bash(gh run list:*)
Bash(gh run watch:*)
Bash(gh run download:*)
Bash(gh workflow view:*)
Bash(gh workflow list:*)
Bash(gh search:*)
Bash(gh auth status:*)
Bash(gh --version)
```

**Bundle: Transcript inspection**
```
Read(<config_dir>/projects/**)
```

This is the one bundle rule whose string is config-dir-dependent. Substitute `<config_dir>` with the resolved absolute path from step 0 before adding or removing it (e.g. `Read(/Users/me/.config/claude/projects/**)`). For the exact-match add/remove logic in §7d, compare against this substituted form — not the literal `<config_dir>` placeholder.

### 7e. Migrate superseded MCP permission strings

Earlier versions of this bundle (and hand-added grants) used the **bare** `mcp__<server>` form for servers that nerdo-forge now ships as plugin-bundled servers. Those bare strings no longer match the plugin's tools (which carry the `plugin_nerdo-forge_` infix), so they are dead weight. The same applies to the **renamed** playwright server: the old `mcp__plugin_nerdo-forge_playwright` form was superseded by the split `playwright-headless` / `playwright-headed` servers, so it too is now a stray. Because none of these are listed in any bundle, §7d's "preserve unlisted rules" rule would otherwise leave them behind.

Whenever the user chose "Yes, review and adjust" in §7b, **remove every string below from `permissions.allow` by exact match**, regardless of which bundles were selected — they are superseded forms, never the correct identifier for a plugin-bundled server:

```
mcp__context7
mcp__context7__*
mcp__precision-math
mcp__precision-math__*
mcp__clear-thought
mcp__clear-thought__*
mcp__json-emitter
mcp__json-emitter__*
mcp__excel
mcp__excel__*
mcp__playwright
mcp__playwright__*
mcp__plugin_nerdo-forge_playwright
mcp__plugin_nerdo-forge_playwright__*
```

Do NOT remove anything outside the list above. The list is exhaustive for nerdo-forge's own bundled servers; leave every other `permissions.allow` entry — user/project-scope servers and servers provided by *other* plugins — untouched.

Caveat to surface if any of these were present and removed: this also drops permissions for any *user/project-scope* server of the same name. That is intended — nerdo-forge now provides these servers, and the dedup step (`claude mcp remove -s user <name>`) removes those user-scope copies. If you deliberately keep a user-scope copy of one of these and want it allowed, re-add its grant after setup.

## 8. Report to the user

Tell the user:
- Statusline has been configured (show the path used)
- "Disciplined Engineering" output style status (set as default, or available via `/output-style`)
- Auto-memory status (disabled, or left on)
- Permission bundle reconciliation result. If the user chose "No, leave as-is" in §7b, say so. Otherwise, for each of the six bundles, report one of: `unchanged (ON)`, `unchanged (OFF)`, `added N rule(s)`, `removed N rule(s)`. If no net changes occurred, say so explicitly.
- Superseded-string migration (§7e): if any bare/wildcard legacy MCP strings were removed, list them; otherwise say there were none.
- They may need to restart Claude Code for changes to take effect
