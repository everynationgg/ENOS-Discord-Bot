---
activation: glob
glob: "bot/**"
description: >
  Mandatory technical resiliency rules for the ENOS Discord bot worker. Applies to
  any file under bot/. Exists to eliminate the recurring crash/memory-leak/race-
  condition classes of bug in this project.
---

# Bot Worker Resiliency Directives

These are non-negotiable for any change under `bot/`. Violating any of these is
treated as introducing a new bug, even if the requested feature "works."

## Interaction Safety

- Every slash command, button, select menu, and modal handler MUST be wrapped in
  try/catch. An uncaught interaction error must never crash the process.
- Before calling `.editReply()` or `.followUp()`, always check
  `interaction.deferred` / `interaction.replied` first.

## Process Guardrails

- `bot/src/index.js` must register `unhandledRejection` and `uncaughtException`
  listeners so transient API/network failures don't trigger Fly.io container
  restarts.

## Gemini Chat History Sanitization

- Chat histories passed to Gemini must strictly alternate `user -> model -> user`,
  starting with `user`. Never pass consecutive same-role messages into
  `startChat()`. Sanitize/filter before every call.

## Database Writes

- Never do "read-then-write" balance updates, XP additions, or Boss HP edits in
  JavaScript application logic — this causes race conditions under concurrent
  use. Always use a Postgres RPC function (`supabase.rpc()`) for currency
  transfers, RPG attacks, and trivia scoring.

## Canvas Memory

- After rendering a card with `@napi-rs/canvas`, explicitly nullify/release
  context allocations, image resources, and buffers. Never retain dynamic image
  buffers globally in memory.
