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

## 8. Offer permission bundles

Many tools are safe but annoying to approve one-by-one. Offer to pre-approve curated bundles by writing to `~/.claude/settings.json` under `permissions.allow`.

Use `AskUserQuestion` with a single **multi-select** question so the user can pick any combination (or none). Use these exact options:

**Question:** "Which permission bundles would you like to pre-approve? (Written to `~/.claude/settings.json` — you can edit or remove them later.)"
**Header:** "Permissions"
**multiSelect:** true

**Options:**

1. **Label:** "Essentials (Recommended)"
   **Description:** "prime-directive, precision-math, context7 MCP tools; WebSearch; WebFetch for any site."

2. **Label:** "Browser testing"
   **Description:** "All playwright MCP tools. Enables the ui-tester agent and browser automation."

3. **Label:** "jj safe commands"
   **Description:** "Read-only jj (status, diff, log, show) plus reversible writes (describe, commit, new, squash, split). Excludes destructive/external commands."

4. **Label:** "Dev shell bundle"
   **Description:** "Read-only git, common test/build/lint scripts (bun/npm/pnpm), and harmless inspection commands (ls, cat, jq, etc.)."

5. **Label:** "GitHub CLI (read-only)"
   **Description:** "Read-only gh subcommands (pr/issue/release/run/workflow view+list, search, repo view). Excludes mutating operations and raw `gh api` (which can POST/PUT/DELETE)."

### Apply selected bundles

For each selected bundle, the corresponding permission rules are listed below. Read `~/.claude/settings.json`, ensure a `permissions.allow` array exists, and merge (deduplicate) the rules from each selected bundle. Preserve all other settings.

If the user selects nothing, skip this step silently.

**MCP entry form:** Use the server-level string (e.g. `mcp__prime-directive`) exactly as listed — do NOT expand to the tool-wildcard form (`mcp__prime-directive__*`). The server-level entry already covers all tools on that server; adding both is duplicative. If an existing entry in `permissions.allow` uses the wildcard form (`mcp__<server>__*`) for a server you're about to add, replace it with the server-level form rather than keeping both.

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
Bash(jj status:*)
Bash(jj st:*)
Bash(jj diff:*)
Bash(jj log:*)
Bash(jj show:*)
Bash(jj op log:*)
Bash(jj operation log:*)
Bash(jj bookmark list:*)
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
- Which permission bundles were applied (or that none were selected)
- They may need to restart Claude Code for changes to take effect
