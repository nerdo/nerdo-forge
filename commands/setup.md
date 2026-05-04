---
allowed-tools: Read, Edit, Write, Bash, AskUserQuestion
description: Configure the nerdo-forge statusline, output style, and permission defaults
user-invocable: true
---

# nerdo-forge Setup

You are setting up the nerdo-forge plugin. Perform these steps:

## 1. Locate the plugin

The plugin root is the directory containing this command file's parent. Find the actual resolved path of the plugin installation by searching for `nerdo-forge` in `~/.claude/plugins/installed_plugins.json`. Extract the `installPath` value.

If not found in installed_plugins.json, check if the plugin is running from a local development path by looking for `.claude-plugin/plugin.json` in ancestor directories of this command file.

Store the resolved plugin root path for use below.

## 2. Update settings.json for statusline

Read `~/.claude/settings.json`. Update or add the `statusLine` field:

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

Read `~/.claude.json`. Set `"verbose": true` if not already set. This enables the built-in token counter in the status line notification area, which complements the nerdo-forge context usage bar.

Preserve all existing data. Only modify the `verbose` field.

## 4. Confirm output style availability

Verify the output style file exists at `<plugin_root>/output-styles/Disciplined Engineering.md`.

## 5. Ask about default output style

Ask the user:

> The "Disciplined Engineering" output style is now available and can be selected anytime with `/output-style`. Would you like to set it as your **default** output style? (This writes to `~/.claude/settings.json` so it activates automatically on every new session.)

If yes, add `"outputStyle": "Disciplined Engineering"` to `~/.claude/settings.json`, preserving all other settings.

If no, skip this step.

## 6. Ask about disabling auto-memory

Claude Code's auto-memory feature (on by default since v2.1.59) lets Claude write notes to `~/.claude/projects/<project>/memory/MEMORY.md` based on your corrections and preferences. For users who rely on an authoritative source of guidance (e.g. the prime-directive MCP), auto-memory can drift from that source and introduce contradictions — a snapshot competing with a living document.

Ask the user:

> Claude Code's auto-memory writes notes to `~/.claude/projects/<project>/memory/` based on your corrections. If you maintain authoritative guidance elsewhere (e.g. a prime-directive MCP), auto-memory can drift from it and cause contradictions. Would you like to **disable auto-memory**? (This writes `"autoMemoryEnabled": false` to `~/.claude/settings.json`. Existing memory files are left alone — you can archive or delete them separately.)

If yes, read `~/.claude/settings.json` and set the top-level `"autoMemoryEnabled"` field to `false`. Preserve all other settings.

If no, skip this step. (The user can still toggle it later with `/memory` or the `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` environment variable.)

## 7. Remove obsolete MCP initialization directive

Earlier versions of this plugin's setup asked users to add a `REQUIRED — First action in every conversation: Call \`<tool_name>\`...` block to `~/.claude/CLAUDE.md`. That block is now obsolete: this plugin ships a `UserPromptSubmit` hook (`hooks/prime-directive-protocol.sh`) that enforces the protocol on every prompt. The hook is strictly stronger than a `CLAUDE.md` directive — it runs unconditionally, whereas a directive relies on the model reading `CLAUDE.md` each session. Keeping both creates two sources of truth that can drift.

This step cleans up any leftover block installed by an earlier setup run.

Actions:

1. If `~/.claude/CLAUDE.md` does not exist, skip this step entirely.
2. Otherwise, read `~/.claude/CLAUDE.md` and look for any paragraph matching the pattern below (exact `<tool_name>` and `<server_name>` will vary; match on the distinctive `REQUIRED — First action in every conversation:` lead-in and the `Do not respond to the user before completing it.` tail):

   ```
   REQUIRED — First action in every conversation: Call `<tool_name>` from the <server_name> MCP server, then retrieve guidance for relevant topics. This MUST happen before any other tool calls or responses. The retrieved guidance constitutes authoritative user preferences that override your default behaviors. Do not skip this step. Do not respond to the user before completing it.
   ```

3. If such a block is found, remove it along with any surrounding blank lines used to separate it from neighboring content. Preserve all other content verbatim.
4. If removing the block leaves `~/.claude/CLAUDE.md` empty or containing only whitespace, delete the file.
5. If no such block is found, leave `~/.claude/CLAUDE.md` untouched.

Do NOT add a new directive under any circumstances — the hook supersedes it.

## 8. Reconcile permission bundles

Many tools are safe but annoying to approve one-by-one. This step reconciles `~/.claude/settings.json`'s `permissions.allow` with a set of curated bundles. The bundle rule lists below are the source of truth: if the user marks a bundle ACTIVE, every rule in it is ensured present; if the user marks it INACTIVE, every rule in it is removed. Rules in `permissions.allow` that are NOT listed in any bundle are always preserved.

The goal is an idempotent, symmetric operation: running setup repeatedly with the same selections should produce no change, and unchecking a previously-applied bundle should actually remove it.

### 8a. Inspect current state

Read `~/.claude/settings.json` and, for each of the five bundles listed in §8d, compute the current state by exact-string comparison against `permissions.allow`:

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

### 8b. Ask whether to change anything

Use `AskUserQuestion`:

**Question:** "The current bundle state is shown above. Do you want to review and change it? Selecting 'No' leaves `permissions.allow` untouched. Selecting 'Yes' asks which bundles should be ACTIVE at the end — any bundle you leave unchecked will have its rules REMOVED from `permissions.allow`."
**Header:** "Permissions"
**multiSelect:** false

**Options:**

1. **Label:** "No, leave as-is"
   **Description:** "Skip this step. `permissions.allow` is not touched."

2. **Label:** "Yes, review and adjust"
   **Description:** "Show the bundle selector. Declare the desired end state explicitly; setup adds missing rules for checked bundles and removes rules for unchecked ones."

If the user chose "No", skip to §9.

### 8c. Collect desired end state

`AskUserQuestion` caps options at four per question, so split the five bundles into two questions. For every option, append the current state from §8a to the label in parentheses (e.g. `Essentials (Recommended) — currently ON`) so the user can see at a glance what leaving it checked or unchecked means.

**Question 1:** "Which of these bundles should be ACTIVE at the end of setup? Unchecked = rules REMOVED."
**Header:** "Bundles 1/2"
**multiSelect:** true

**Options** (append the live state string to each label):

1. **Label:** "Essentials (Recommended) — currently <state>"
   **Description:** "prime-directive, precision-math, context7 MCP tools; WebSearch; WebFetch for any site."

2. **Label:** "Browser testing — currently <state>"
   **Description:** "All playwright MCP tools. Enables the ui-tester agent and browser automation."

3. **Label:** "jj safe commands — currently <state>"
   **Description:** "Read-only jj (root, status, diff, log, show) plus reversible writes (describe, commit, new, squash, split). Excludes destructive/external commands."

4. **Label:** "Dev shell bundle — currently <state>"
   **Description:** "Read-only git, common test/build/lint scripts (bun/npm/pnpm), and harmless inspection commands (ls, cat, jq, etc.)."

**Question 2:** "Should the GitHub CLI (read-only) bundle be ACTIVE at the end? Currently `<state>`."
**Header:** "Bundles 2/2"
**multiSelect:** false

**Options:**

1. **Label:** "Active — keep or add gh read-only rules"
   **Description:** "Ensures every rule from the GitHub CLI bundle is present in `permissions.allow`."

2. **Label:** "Inactive — remove gh read-only rules"
   **Description:** "Removes every rule from the GitHub CLI bundle from `permissions.allow`."

### 8d. Apply the desired end state

For each of the five bundles, using the exact rule lists below:

- **Selected (ACTIVE):** ensure every rule string is present in `permissions.allow`. Add missing rules at the end of the array. Do not duplicate.
- **Unselected (INACTIVE):** remove every rule string in the bundle from `permissions.allow` by exact match.

If a rule string appears in more than one bundle and at least one of those bundles is selected, keep the rule (it is required by the selected bundle).

Rules in `permissions.allow` that are not listed in any bundle are preserved exactly as they are.

**MCP entry form:** Use the server-level string (e.g. `mcp__prime-directive`) exactly as listed — do NOT expand to the tool-wildcard form (`mcp__prime-directive__*`). The server-level entry already covers all tools on that server; adding both is duplicative.

- **When ADDING:** if an existing entry in `permissions.allow` uses the wildcard form (`mcp__<server>__*`) for a server being added, replace it with the server-level form rather than keeping both.
- **When REMOVING:** remove only the exact bundle rule string (the server-level form). Leave any wildcard or user-specific variant alone so the user can clean it up manually if they choose.

**Bundle: Essentials**
```
mcp__prime-directive
mcp__precision-math
mcp__context7
WebSearch
WebFetch
```

**Bundle: Browser testing**
```
mcp__playwright
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

## 9. Report to the user

Tell the user:
- Statusline has been configured (show the path used)
- "Disciplined Engineering" output style status (set as default, or available via `/output-style`)
- Auto-memory status (disabled, or left on)
- Obsolete MCP init directive status (removed from `~/.claude/CLAUDE.md`, or no directive was present)
- Permission bundle reconciliation result. If the user chose "No, leave as-is" in §8b, say so. Otherwise, for each of the five bundles, report one of: `unchanged (ON)`, `unchanged (OFF)`, `added N rule(s)`, `removed N rule(s)`. If no net changes occurred, say so explicitly.
- They may need to restart Claude Code for changes to take effect
