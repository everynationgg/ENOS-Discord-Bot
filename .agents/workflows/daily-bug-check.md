# daily-bug-check

Triggered with `/daily-bug-check` in the Antigravity chat. Use this when Yog reports
a bug or error rather than asking for a new feature.

1. Ask Yog to paste the exact error message, log line, or describe exactly what
   happened and when — if not already provided. Don't proceed on a vague
   description alone.
2. Locate the relevant code by searching the codebase for the error text or the
   feature name. Do not guess which file is responsible without checking.
3. Confirm the current git working tree is clean/committed. If not, commit the
   current state first, before making any change, so it's revertible.
4. Attempt to reproduce the bug (locally, or by tracing the exact code path that
   would trigger it). State clearly whether you reproduced it or not.
5. If not reproducible: say so explicitly, explain what you checked, and propose
   the most likely cause as a hypothesis — don't present a guess as a confirmed fix.
6. Propose the smallest fix that addresses the root cause, following the file
   change budget in AGENTS.md.
7. Apply the fix.
8. Run the actual build/lint/test command for the affected package (bot or
   dashboard) and paste the real terminal output.
9. Summarize in plain language: what broke, why, what changed, and how Yog can
   verify it himself in Discord or the dashboard.
