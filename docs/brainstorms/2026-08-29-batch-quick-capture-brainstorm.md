---
date: 2026-08-29
topic: batch-quick-capture
---

# Batch Quick Capture

## What We're Building

A user can paste up to 30 Dutch words or expressions, one per line, optionally
followed by a semicolon and translation hint. The app stores the raw queue
locally, processes one item at a time through the existing AI analysis screen,
and requires the user to review and explicitly save every analyzed card.

## Why This Approach

The existing Add Word screen already owns analysis, semantic duplicate checks,
collection selection, rich-card review, and saving. The batch feature should
orchestrate that proven flow instead of creating a second analyzer and editor.
A persisted Zustand queue is sufficient for 30 small text items and avoids a
new synchronized database table for device-local draft data.

## Key Decisions

- Queue ownership is scoped to the signed-in user so drafts never cross
  accounts on a shared device.
- `dutch ; translation` stores the translation only as a visible review hint;
  it is never saved as trusted linguistic data.
- Exact-lemma local and remote checks run before AI analysis. A possible
  duplicate pauses the item and offers Analyze anyway or Skip.
- Only one item can be analyzing or awaiting review. Returning after a save
  advances to the next item unless the queue is paused.
- Network loss leaves an item queued with an explicit waiting message; it does
  not become a permanent failure.
- Restarted transient items return to queued state because unsaved analysis is
  intentionally not persisted.
- Cancel marks unfinished items as cancelled while preserving completed work.

## Open Questions

None for the MVP. Background processing, concurrent requests, bulk approval,
and server-synchronized draft queues are deliberately deferred.

## Next Steps

Implement the parser and store first, then connect the queue to the existing
Add Word review flow and verify restart, duplicate, offline, and partial
completion behavior.
