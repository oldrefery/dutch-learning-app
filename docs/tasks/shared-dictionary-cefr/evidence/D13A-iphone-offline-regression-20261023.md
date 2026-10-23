# D13A.7.6 iPhone offline review regression (IOR-1)

Date: 2026-10-23. Scope: separate QA bundle, synthetic local owners only.
Status: prevention fixed; corrected physical offline/restart/reconnect and restored-head restart pass. Final owner-return and independent no-duplicate checks also pass.

## Observed failure

The fresh iPhone QA installation hydrated protocol2 following cards without a protocol1
`dictionary_card_content` mirror. An offline recognition answer marked its personal
word pending. On reconnect, `preserveLegacyPendingContent` interpreted the absent v1
mirror as missing content and queued `create-private` from protected original fields.
The server rejected that command with `legacy-content-upgrade-required`. The subsequent
following hydration refused to overwrite pending content commands, leaving one pending
item. Learning-event delivery nevertheless succeeded exactly once.

The initial evidence is retained: six local/server review events after reconnect,
event `e50ffdb8-4d56-4477-8d80-bbc48e670350` synced; conflict operation
`60b6c79f-8f27-421d-be4f-4f6f7ba275dc`; cached head27 vs server head28. Offline restart
passed; overall initial reconnect acceptance failed. A second wait also failed.
An independent replay of actual hydration code against a copied physical SQLite DB
returns `Legacy dictionary commands require reconciliation`. HTTP status was200,
protocol parser passed, and server head/change sequence were consistent.

## Fix and validation

Legacy preservation now excludes an existing protocol2 effective-card cache for the
same word and owner. It does not generate legacy creation from learning-only pending
state. Genuine pre-adoption legacy words without either cache retain existing behavior.
No automatic deletion of existing user commands or conflict recovery is introduced.

Regression exercises real SQLite: hydrate following content, mark a word pending with
updated learning state, run legacy preservation twice, hydrate a new head, and verify
no fabricated command and byte-equivalent personal row. Before fix:1 failed/12 passed.
After fix:135 passed across officialPackImport.sqlite, dictionaryFollowingSync.sqlite,
and syncManager; scoped ESLint passes with zero warnings. The initial Watchman sandbox
failure was infrastructure-only; rerun used `--watchman=false`.

## Physical replay isolation

Old signed artifact and copied QA database preserved before a clean QA reinstall.
Original bundle `com.oldrefery.dutch-learning-app` and main account were not operated.
Only `com.oldrefery.dutch-learning-app.d13aqa` was uninstalled and reinstalled under
existing owner approval. This resets disposable QA client state; it is not an in-place
recovery test. All six server review events remain. A fresh test makes only the synthetic
following card due again. The corrected build uses the same personal profile and local
endpoint, OTA disabled.15 artifact checks pass and678 source files match workspace.
JS SHA256:1157cf5fb03bef1cbb87322b55e9a931bd44fbda3e5e254ecea3e1f3e0a6345c.

Evidence prefix: reports/shared-dictionary-cefr/d13a7-native-resume-20261023/.

- iphone-hydration-replay-result.json
- iphone-state-before-fix-reinstall-private.json (private)
- iphone-regression-before-nowatchman.log, iphone-regression-after.log
- iphone-fix-lint-final.log
- iphone-fixed-artifact-review.json, iphone-fixed-artifact-manifest.json
- iphone-offline-fix-source-delta.json
- iphone-qa-clean-uninstall.json, iphone-qa-fixed-install.json
- iphone-xctest/ (private synthetic fixture and test logs)

D13A.7 remains5/6 complete,1 remaining;8 broad milestones. Exact85/repairOTA and
representative native performance remain open. No paid requests, hosted mutations,
commits or publication. Stop beforeD13A.8.

## Corrected physical sequence

Passed XCTest segments: fixed-review-ready, fixed-offline-answer,
fixed-offline-restart, fixed-reconnect-head-one, fixed-restored-restart (one test each,
zero skips). This is a segmented scenario, not a single uninterrupted suite.
Independent snapshots verify new event a0af398d-6263-4063-9477-ef34405d8e03 pending
offline and after restart, server count6 unchanged; reconnect yields server count7,
exactly one matching ID, local synced, zero content commands, all refresh versions
completed, head one cached, personal lexical originals preserved. Head two restored.
TypeScript noEmit passed. Failed setup attempts remain retained: reinstalled QA Local
Network dialog, two driver attempts expecting an already-dismissed dialog, and fresh
login UI empty while local rows had loaded. A subsequent real restart/manual sync
loaded the library. The latter initial-render behavior is an observation requiring
separate triage, not silently counted as a passing cold-login assertion.

Final corrected evidence: fixed-owner-return-after-password-sheet passes1/1, zero
skips. All7 server events unchanged after owner return/restart; both owners cache restored
head two, all following refresh debt completed. The A→B→A case is segmented because a
late system Save Password sheet interrupted its first attempt; Not Now dismissed it.
Result: iphone-fixed-offline-result.json reports passed_segmented_physical_scenario.
The old conflict remains in its archived database; no product auto-recovery claimed.
