# nerdo-forge

A Claude Code plugin with a custom statusline and the **Disciplined Engineering** output style.

## What's Included

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

## Installation

### From GitHub

```
/plugin marketplace add nerdo/nerdo-forge
/plugin install nerdo-forge@nerdo-plugins
```

### From a local clone

```bash
git clone <repo-url> ~/path/to/nerdo-forge
```

Then in Claude Code:

```
/plugin marketplace add ~/path/to/nerdo-forge
/plugin install nerdo-forge@nerdo-plugins
```

### Setup

After installing, run:

```
/nerdo-forge:setup
```

This will:
1. Configure `~/.claude/settings.json` to use the statusline
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
