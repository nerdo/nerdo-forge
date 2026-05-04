#!/usr/bin/env bash
# SessionStart hook. Fires on startup, /clear, and resume — every boundary that wipes the
# visible context. Emits the full prime-directive protocol so the host model bootstraps PD
# discipline from a fresh window. The slim UserPromptSubmit hook re-asserts re-triage
# discipline between boundaries; this script re-establishes the full protocol when the
# window is reset.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "${script_dir}/pd-protocol-full.txt"
