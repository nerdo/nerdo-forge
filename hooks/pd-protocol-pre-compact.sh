#!/usr/bin/env bash
# PreCompact hook. Fires before /compact (manual or auto) wipes the visible window down to
# a summary that does not preserve PD initialization output. SessionStart does NOT fire on
# /compact, so we leave a sentinel keyed on session_id; the next UserPromptSubmit detects
# it and emits the full protocol in place of the slim nudge.

input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
[[ -z "$session_id" ]] && exit 0

state_dir="${TMPDIR:-/tmp}/nerdo-forge"
mkdir -p "$state_dir" 2>/dev/null || exit 0
touch "${state_dir}/pd-reinit-${session_id}.flag" 2>/dev/null || exit 0
