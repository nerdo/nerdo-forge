---
allowed-tools: Read, Edit, Write, Bash, AskUserQuestion
description: Configure the nerdo-forge statusline and output style
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

## 6. Report to the user

Tell the user:
- Statusline has been configured (show the path used)
- "Disciplined Engineering" output style status (set as default, or available via `/output-style`)
- They may need to restart Claude Code for changes to take effect
