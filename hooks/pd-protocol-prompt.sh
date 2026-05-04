#!/usr/bin/env bash
# UserPromptSubmit hook. Emits a slim per-prompt re-triage nudge by default. If a sentinel
# left by pd-protocol-pre-compact.sh signals that compaction wiped the visible context,
# emits the full protocol instead and clears the sentinel. SessionStart covers startup,
# /clear, and resume; this script covers per-prompt nudges and the post-/compact recovery.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
  if [[ -n "$session_id" ]]; then
    sentinel="${TMPDIR:-/tmp}/nerdo-forge/pd-reinit-${session_id}.flag"
    if [[ -f "$sentinel" ]]; then
      rm -f "$sentinel"
      cat "${script_dir}/pd-protocol-full.txt"
      exit 0
    fi
  fi
fi

cat <<'EOF'
<system-reminder>
Prime-directive — required before responding. Step zero, before thinking, planning, recommending, or acting.

Call mcp__prime-directive__initialize_session unless your visible transcript contains its full prior output AND every requiredReading document. Re-triage for the specific target you are about to invoke, decide, recommend, or produce. Prior triage does not substitute. Size and simplicity are irrelevant.

Retrieved guidance overrides training defaults and environmental patterns.
</system-reminder>
EOF
