# D10 retained runtime acceptance — 2026-10-02

Started at `833835d`, source `976d1e7`, user-confirmed Astra / High,
AUTH-17/18/19. No application changes. All work used the retained synthetic
loopback stack and the two assigned native devices. No production, schema
cutover, deployment, publication, paid call, push, PR, or merge.

## Completed acceptance

- R3 actual HTTP PASS: a fresh valid synthetic session reaches protected content
  (200) and redirects away from login. After revoking only that session with local
  sign-out scope, its JWT remains signed/unexpired, but server user validation
  rejects it. Protected content redirects to login; login, signup and
  forgot-password each return 200 without a redirect cycle.
- Actual iOS Safari official-pack preview PASS: all three duplicate entries can
  be inspected after scrolling, and `Import 0 words` is disabled. No repeated
  import was submitted. Visual acceptance remains blocked by
  [R4](D10-import-contrast-review-20261002.md): the light-theme action label has
  the same computed color as its background, including an enabled bundled action.
- Android isolated owner: read_only account, settled sync and cached official
  manifest preview PASS. Blocking only the task REST transport then importing
  the remaining kompas creates one durable personal card. Cold restart retains
  it and shows 0/3 selectable, without a repeated import.
- The manifest was cached, but dictionary mappings were not. Offline import
  correctly used the accepted **private-copy fallback**. This does not claim
  cached canonical-mapping coverage; online mapped imports were covered earlier.
- After clearing the transport fault, ordinary sync while still read_only
  delivers exactly that card and content state once. Native pending import,
  content, recovery, personal-refresh and hydration queues are empty. Retained
  delivery receipts have matching local/acknowledged placement revisions.

Personal word ID: `db455c40-fdb6-4eb8-9823-d0e50d4e6fd8`.
Import operation: `217420b8-7a2d-4537-b440-a48ea42133f8`.
Do not replay `D10-native-official-readonly-offline.yaml` against this retained
fixture. It is evidence of a completed one-time mutation.

## Synthetic fixture correction and preservation

The first isolated native login exposed malformed source fixtures from the prior
catalog setup: getij, duin and the hidden control lacked required `translations.ru`;
the hidden control also had no collection. Ordinary native orphan cleanup
created one hidden-control tombstone before the acceptance import began.

The task-only fixture correction added `ru: []` to those three synthetic source
rows and placed the hidden control in the owner's existing unshared collection.
An exact-row admin transaction restored its tombstone with transaction-local
replication mode, reset automatically at commit; no schema or trigger definition
changed. The stopped Android app's one hidden cache row was then aligned to the
corrected server fixture. Neither operation touched learning or pending queues.
The hidden source remains unshared; the previously revoked share stays revoked.

Final server comparison: 28 words, 22 content states and nine collections. All 27
prepared words and 21 preexisting states are exact; only the one accepted kompas
card/state was added. Relative to the original snapshot, all 24 unrelated words
are exact; the three intentional fixture corrections above are explicitly
excluded. All collections, review tables and four original access rows are exact.
The isolated read_only change was restored to its original full-access row.
Android's initial 13 word/SRS projections and all learning rows are exact; its
final cache has 24 words including the corrected hidden control and the new card.

## Evidence and bounded automation failures

Private root: `reports/shared-dictionary-cefr/d10-final-acceptance-20261002/`.
Snapshots, credentials, native debug captures and raw database values remain
ignored. Runtime receipts include `revocation-result.json`, `offline-result.json`,
`preservation-result.json`, `access-restore.json`, `local-hidden-restored.json`,
`safari-retry.log`, `android-readonly-warm-settled.log`, `android-offline.log`,
`android-readonly-deliver.log` and `android-primary-settled.log`.
Native snapshots remain under `woordenaar-d08-native.20261001` with labels
`d10-final-before`, `d10-readonly-warm`, `d10-official-offline`,
`d10-official-delivered` and `d10-final-restored`.

Early automation attempts failed before import because of input truncation,
startup route timing, a below-fold Safari row and the malformed synthetic data.
The final warm/offline/delivery flows pass. Logout scrolling and iOS password
entry also required bounded cleanup retries. Those attempts are retained privately
and do not count as successful acceptance. The Android primary session is restored
and its real settings screen reports Up to date.

## Checkpoint

R3 is closed; R4 requires a bounded styling repair on GPT-6.1 Sol / High, followed
by Astra / High re-review and only affected visual acceptance. D10.3–D10.5 remain
open until the stage exit gate is reconciled. Do not start D11 or repeat closed
import/recovery/transfer checks. The iOS primary session is also restored and the actual settings screen confirms
Up to date. All 19 initial iOS word/SRS projections and learning rows are exact;
pending queues are empty. The successful exact-password replacement used native
Select All before paste, followed by private equality verification; partial
cursor deletion had left a suffix. Clipboard cleared and password masked before
final login. Temporary credential-repair flows remain only in private artifacts.

All assigned resources OFF verified **18:44:48 UTC /20:44:48 Amsterdam**: assigned
iOS Shutdown; Android absent; four exact retained containers exited; named browser
closed; runner/proxy/web PIDs absent and ports 55331/55400 closed. All proxy fault
flags were false before shutdown. No pending QA process or uncertain mutation.
See [sanitized summary](D10-final-runtime-summary-20261002.json).

Verification: four focused R3 suites /45 tests pass; all 140 source hashes match.
Normal commit hooks are required; their result is recorded in the handoff.
