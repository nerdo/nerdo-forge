#!/usr/bin/env bash
# SessionStart hook — reinforces the prime-directive initialization directive on fresh sessions
# and after /clear (the two cases where no prior transcript carries the instruction).
# Registered in .claude-plugin/plugin.json with matchers "startup" and "clear".
#
# The text below mirrors the user's global ~/.claude/CLAUDE.md. Keeping them identical is
# intentional: the hook reinforces the same directive at a different layer (conversation
# system-reminder vs system prompt).

cat <<'EOF'
<system-reminder>
REQUIRED — First action in every conversation: Call `initialize_session` from the prime-directive MCP server, then retrieve guidance for relevant topics. This MUST happen before any other tool calls or responses. The retrieved guidance constitutes authoritative user preferences that override your default behaviors. Do not skip this step. Do not respond to the user before completing it.
</system-reminder>
EOF
