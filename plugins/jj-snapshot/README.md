# jj-snapshot

An [oh-my-pi](https://github.com/) (omp) plugin that runs `jj status` after **every** tool the agent executes, so [Jujutsu (jj)](https://github.com/jj-vcs/jj) snapshots the working copy granularly as the agent works.

## Why

jj only snapshots the working copy when a jj command runs. Between jj invocations, the agent's edits sit on disk untracked by any operation. This plugin runs `jj status` after each agent action, so the working copy is snapshotted continuously — and because **every jj snapshot is its own operation**, you get a granular, restorable history in `jj op log` (`jj op restore <id>` / `jj undo`) instead of one lump at the end of a turn.

It does **not** create a commit per edit — jj's working copy stays a single mutable commit (`@`). The granularity lives in the operation log, not in `@`.

## How it works

The plugin registers a handler on omp's `tool_result` event, which fires once after **every** tool execution — the most granular "the agent took an action" signal omp exposes:

| Event | Fires |
|---|---|
| `turn_end` | once per user→agent turn (a 3-file edit → 1) |
| `agent_end` | once per agent streaming segment |
| **`tool_result`** | **once per tool call (a 3-file edit → 3)** ← used here |

On each `tool_result` the handler runs `jj status` in the session's working directory. Any jj command triggers jj's working-copy snapshot, so the command's output is irrelevant — the snapshot is the point. There is no tool filter: any action can change the tree, so jj decides what (if anything) to snapshot.

It is **best-effort**: outside a jj repo, when `jj` is not on `PATH`, or on any jj error, the handler swallows the failure and never blocks or fails the tool. Each invocation is bounded at 5s. Concurrent invocations from parallel tool calls serialize on jj's working-copy lock.

## Requirements

- [`jj`](https://github.com/jj-vcs/jj) on `PATH` (developed against jj 0.41).

## Install

```
/marketplace install jj-snapshot@nerdo-plugins
```

Or from a local clone:

```
/marketplace add ~/path/to/nerdo-forge/plugins/nerdo-essentials
/marketplace install jj-snapshot@nerdo-plugins
```

Marketplace-cache installs load the handler from `hooks/pre/jj-snapshot.ts`; `omp plugin link` / npm installs resolve the same file via `package.json#omp.extensions`. It loads once either way.

## Develop / test

```bash
bun test plugins/jj-snapshot
```

The test spins up a throwaway jj repo, invokes the handler, and asserts a new operation appears in `jj op log` — proving the snapshot happened (measurements use `--ignore-working-copy` so only the handler snapshots).

## License

MIT
