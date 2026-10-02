# D10.3 — explicit import recovery UI checkpoint

Status: accepted-contract checkpoint 5 implemented locally in `b7f207c`, following
sync `abc0b86` / resume coverage `a7315bb`, SQLite `1748066` and server `1828f57`.
User-confirmed GPT-6.1 Sol / High; AUTH-17/AUTH-18. Existing branch, local commits
only. Checkpoint 6 implementation review and assigned-device/both-client acceptance
remain open. D10.3–D10.5 are not closed by this checkpoint.

## Implemented behavior

- `dictionaryImportRecoveryViewRepository` projects owner-bound original/recovery
  pending errors, semantic/state/placement conflicts, missing target placement and
  marker-only pre-upgrade gates. It keeps an acknowledged personal card reachable
  after its target becomes NULL or disappears. Deleted cards are excluded from
  active recovery; their cancellation debt stays in the existing coordinator.
- `fetchWords` publishes these issues after checking the current account. The home
  collection screen links to **Saved imports**, including cards whose original
  collection is gone. The screen shows retained effective content and controls,
  filters the current owner, and does not require a surviving collection route.
- Read current server state is explicit and read-only. It binds the response to
  the exact original intent/personal ID and validates it strictly. Local snapshot
  checks before/after the RPC reject a replaced proposal, cancellation or changed
  placement. Reading does not queue recovery, rotate the origin, create a target,
  acknowledge placement or discard content/learning debt.
- The user sees current server placement (including NULL), selects an existing
  owned target and confirms. A new recovery nonce uses that displayed version and
  placement, the unchanged original intent/root and the same personal ID. The
  exclusive preparation transaction compares the old proposal and captured local
  placement revision, and rechecks active owner/card/target. A later local move or
  replacement cannot be overwritten by an open dialog.
- Uncreated/proven active identities can recover. Unavailable/cancelled identities
  have no recreate action. Semantic conflicts explain that both cards retain
  separate progress and that the other card must be resolved on its own device.
  State/placement failures require another explicit state read and confirmation;
  there is no automatic rebase. A lost reply retries the existing immutable outbox
  through the shared coordinator unless the user explicitly prepares a new attempt.
- Preparation reports only local persistence and waiting for sync. Offline/error
  results retain recovery and original/content/learning debt; the UI reloads the
  actual SQLite state after sync and does not report an unacknowledged delivery as
  success. Hook unmount/account checks suppress late publication. An auth watcher
  permanently invalidates that open view after sign-out, even if the same account
  immediately signs back in; the user reopens it for a new snapshot.
- Ordinary move selection for an unsettled import opens Saved imports rather than
  bypassing recovery. The repository still blocks unverified/unsettled ordinary
  movement. A null/blocked store move no longer produces a success toast.
- Marker-only v15 records without an exact retained intent remain visibly gated.
  No spelling-based provenance, fabricated receipt, implicit placement ACK or
  fresh-ID content copy is introduced. Retained v14/new exact intents use the
  accepted recovery protocol. Actual native upgrade acceptance remains checkpoint 6.
- Runtime gates remain default-off. Existing themed primitives and shared glass
  spacing tokens are reused; both themes are covered by component tests.

## Applicable web behavior

Web imports are immediate server actions through `import_official_dictionary_pack_v1`
and `import_dictionary_copies_v1`, not retained mobile personal-ID/outbox requests.
Web has no durable local import copy/root to recover with this UI protocol. Existing
server-authorized content-only copy and duplicate behavior are retained. No new
web recovery UI, root reconstruction or second general sync framework is added.

Expanded web tests reject recovery/origin fields in self-contained exports and
verify missing-target/cancelled/uncertain failures are returned without automatic
retargeting, downgrade, adoption of a mobile ID or replay. Actual both-client
import/export/reimport compatibility and the legacy direct-write coexistence gate
remain part of checkpoint 6 and later release gates. This is not a claim that the
registry fences arbitrary legacy direct word INSERTs.

## Verification

On 2026-10-02, source `b7f207c`:

- Focused mobile: **6 suites / 82 tests** passed, covering file-backed read/prepare
  binding, unchanged root/SRS/content queues, fresh repeated proposals, stale local
  moves/outboxes, cancellation, unavailable identity, unverified provenance, target
  absence, offline reads, owner rollback/sign-out, both themes, orphan reachability,
  explicit decisions and blocked move feedback, plus preceding sync/metadata tests.
- Focused web: **2 suites / 22 tests** passed.
- Mobile test-inclusive TypeScript and strict scoped ESLint (`--max-warnings 0`)
  passed; Prettier and diff checks passed. Context7 official React effect-cleanup
  documentation was checked; no dependency/API version upgrade was made.
- Normal source commit hooks passed: **155 mobile suites / 1785 tests / 22
  snapshots**; **75 web suites / 648 tests**, one pre-existing skipped suite/test.
  No hook bypass, lint suppression, production credentials or paid provider call.
- Server/domain/SQLite migration source is unchanged from prior **213/213 SQL**
  and deterministic target-contract verification. No SQL/server rerun is claimed
  for this UI-only source checkpoint.
- One intermediate component run failed because the route mock omitted Expo's
  existing `Color.android.dynamic`; the mock was corrected and focused/full hooks
  then passed. Do not change application colors to address that test fixture.
- File-backed synthetic SQLite fixtures cleaned up. Temporary diagnostic logs under
  `/tmp/woordenaar-d10-ui-*` are not portable resume evidence.

## Resources and next action

Exact task resources were reverified read-only at **10:57 UTC**: iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown; Android
`woordenaar_d08_qa_20260921` process absent; all four
`woordenaar-d08-qa.ZFsE50` containers exited. No device/backend was started, no
retained data reset/reseeded, and no other-session resource operated. Initial
sandbox inventory access was unavailable; the scoped authorized read succeeded.

Next: **GPT-6 Astra / High**, accepted-contract checkpoint 6 implementation review,
then assigned-device/both-client acceptance. The current-thread model picker is
unavailable to the agent; manual model confirmation is required before claiming
that review model. Review the complete server/SQLite/sync/UI protocol and its
legacy coexistence limit, not only this UI diff. Use Sol 6.1 / High for any further
implementation repairs. Preserve exact QA data, apply only additive task-local
migrations when needed and permitted, and never run production/cutover/deployment.

Keep D10.3–D10.5 unchecked until actual exit evidence passes. Do not restart D08/D09
or start D11. No pending build/test/QA operation remains after the successful hooks.
