# D13 post-OTA observation — October 10, 2026

D13.6 in progress. At22:10UTC (October10 00:10 Amsterdam), new read-only checks
verified personal Expo account/projectoldrefery. iOS OTA reports1 user/download,
0 failed installs; Android0. Aggregate downloads may include diagnostic traffic,
but Sentry provides independent evidence that the exact iOS OTA launched normally.

## Event attribution

- Sentry4C eventb2327b5a795e4cf1b2a8bc33bc0ea0ce at22:06:40UTC still reports the
  missing simple_past_plural field. Its update ID is the original embedded
  f2711421-1e67-4516-acfe-4aafb39db992 and is_embedded_launch=true. It is not a
  recurrence on the fixed OTA. Owner-reported successful online sync remains valid.
- New Sentry4E eventefac98fc0d124a309e382b58cdc3bece at22:06:48UTC is a handled
  SQLite database-is-locked error from finalizeAsync, operationloadSyncStatus.
  It is on exact iOS OTA01a122ad-683e-7763-a736-9a522c38cec8, embedded=false and
  emergency=false. No exception stack is attached, so do not claim symbolicated
  application frames. Operation tag and breadcrumbs identify status loading while
  dictionary hydration is active. A second manual sync was correctly skipped.
- Sentry49 has no new event. No Android OTA error was returned. Historical4D remains
  outside the new release window. Early post-publish zero-error readings in the
  delivery receipt are historical; this observation supersedes them.

[New4E issue](https://oldrefery.sentry.io/issues/7784180404/) and
[old4C issue](https://oldrefery.sentry.io/issues/7737950888/).
Private raw read receipts/events: reports/shared-dictionary-cefr/d13-post-ota-20261010/.
[Sanitized observation](D13-post-ota-observation-20261010.json).

## Validated local repair and prepared delivery

Expo SQLite exclusive transactions use a separate connection and competing queries
can encounter locks. The status screen reads metadata while sync writes. Add bounded
retry around the read-only status snapshot, using the existing backoff helper:
3 retries,100ms initial/400ms cap with existing equal jitter, only explicit SQLite
locked-message matches. No write or transaction replay, fake empty snapshot,
exception suppression, global connection policy or native dependency change.
Persistent locks and unrelated failures continue to the existing UI/Sentry handler.

A real two-connection SQLite test reproduces an exclusive lock, releases it and
verifies owner-scoped status succeeds with all cards and total_changes unchanged.
Additional tests cover the native finalizeAsync error text, bounded persistent
failure, unrelated schema errors, and existing hook/account/UI behavior. Focused
4 suites/32 tests, both mobile typechecks and targeted lint pass. Initial native
SQLite test exposed cross-realm Error identity; matching a structurally validated
message resolves it without widening retry to unrelated errors. Existing settings
React act warnings remain visible in the passing test output.

Full mobile suite passed157 suites/1806 tests/22 snapshots. Both mobile typechecks,
full lint and the new immutable OTA export/runtime/hash checks pass.
[Exact candidate packet](D13-status-ota-candidate-20261010.md) is ready, not published. The original
AUTH-28 source/export/maps remain untouched. New local change is not published;
any further delivery requires a reviewed exact packet and fresh scoped authority.
Owner confirms the requested offline study/restart/reconnect scenario preserved
cards and review results, and separately identifies iOS. This acceptance applies
to delivered AUTH-28, not the unpublished candidate. Android offline return is not
newly verified. Remaining observation is open; D14 pending, CEFR OFF;
no backend/phone/provider/source commit/push/merge/automation operation occurred.
