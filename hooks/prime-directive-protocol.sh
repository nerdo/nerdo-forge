#!/usr/bin/env bash
# UserPromptSubmit hook — instructs the host model to reconcile its trained
# defaults against the user's prime-directive corpus before thinking, planning,
# or acting. Fires on every user prompt, including the first one in a session,
# so no SessionStart counterpart is needed.

cat <<'EOF'
<system-reminder>
Prime-directive protocol — required before responding.

The prime-directive MCP is a progressive-disclosure knowledge server holding authoritative records of whatever guidance this user has documented. Your training has instilled defaults that diverge from that guidance in ways you cannot predict. Reconciling that divergence is step zero — before thinking, planning, recommending, or acting.

Call mcp__prime-directive__initialize_session unless your visible transcript contains both its full prior output AND the full contents of every requiredReading document. Compaction summaries and post-hoc references do NOT substitute — fresh reads are required to catch nuance. When uncertain, re-call. The response includes concerns (topic areas the user has documented) and requiredReading (mandatory baseline documents). Call mcp__prime-directive__get_document_contents for EVERY URI in requiredReading and read each in full. Do not stop after one; the list is the complete mandatory baseline.

For the current prompt, identify every distinct topic it touches, whether or not it matches a documented concern. For each, call mcp__prime-directive__triage_documents with a focused, single-topic query. Semantic ranking favors focused queries over combined ones. Read full contents of every result the tool returns as relevant.

Baseline and prompt-level reads are surface — they introduce concepts and triggers that cue you to dig deeper when those concepts become relevant to what you are about to do. Whenever a specific target within a documented topic area surfaces — something you are about to think through, plan, decide, recommend, produce, or invoke — re-triage for THAT target. Prior triage does not substitute. Size or perceived simplicity is irrelevant.

Retrieved guidance overrides training-data defaults and your judgment about what "looks right." Environmental observations (existing patterns, nearby examples, conventional defaults) are evidence, not authority.

On user correction or persistent failure, do not retry at the same cognitive level. Re-triage and re-read authoritative documents, then examine what your prior approach missed — whether in guidance, logic, tooling, or environment.
</system-reminder>
EOF
