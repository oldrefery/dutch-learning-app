# D13 held native candidates and activation settings

Status: build/inspection completed under AUTH-26; owner approved this exact
activation and beta-distribution packet as AUTH-27 on October 4. Execution is
conditional on fresh backup, preservation and deployment-access checks. Destinations: TestFlight and Google Play
internal testing. No automatic submission is configured in the build command.

## Exact candidate

Source commit `0a3bae137d3e58c406215114cbccadd773f71098`, branch
`feature/dictionary-release-candidate`, based on merged `44141e0`.
Version2.4.0/build85 on both platforms. EAS IDs:

- iOS: `5d37d6fa-fc60-4137-b694-3b0909071ee9`.
- Android: `84beddfc-9c76-4128-9b8f-d7975c3dd082`.

Profile `dictionary-release` inherits the
production store distribution, production environment/channel, Node24.20.0 and
manual versioning. Dictionary opt-in is true; QA and E2E are false; inherited
legacy dev-user environment values are replaced with nonworking fixture values.
Remote production backend resolves to `josxavjbcjbcjgulwcyy.supabase.co`.

The explicit profile is separate from the default production profile, which stays
dormant. App config rejects QA leakage into the new profile. Normal hooks passed
mobile1798/156 suites and web780/86 suites (1 preexisting skip); config tests12/12.
EAS validated both resolved profiles.1639 source files were scanned; no private
backup/report/env/signing artifacts or secret-pattern matches. Standard EAS shallow
Git metadata contains only the exact candidate commit. No primary device is used.

The future submit profile inherits the existing Apple team/app and sets Android
internal/completed. Its configuration is not evidence of submission. Never use
--latest: after agreement submit only the independently verified exact build IDs.

## Required production sequence before distribution

1. Reconcile current hosted schema/runtime/source and learning deltas with the
   preserved server/iPhone snapshots. P2 device queues remain unknown; the owner
   accepted that gap. Preserve late legacy/offline writes and all2914 snapshot
   cards. Do not replay the already completed AUTH-24 migrations.
2. Approve the exact existing official-source proposal SHA256
   `4d54ba82661604b7b5f0e70d2126b988daadaeb8ccb370e4c19192b6c713166d`.
   It contains2053 mechanically projected licensed entries from21 historical packs,
   preserving attribution/provenance and original content. Sources remain pending
   outside local fixtures until actual publication approval. No personal card or
   pack-level CEFR is promoted to a public meaning assessment.
3. Publish approved sources/revisions and exact official mappings in bounded,
   receipt-backed transactions. Local mapping-trigger verification passed2053
   records in25-row batches; a single bulk statement exceeded120 seconds. Preserve
   stable source/resolution identities and inspect receipts before retry.
4. Deploy the reviewed `gemini-handler` artifact and its dependencies only after
   its exact approval. No provider smoke generation or worker scheduling is needed
   for build verification. All CEFR worker/policy/scheduling remains OFF.
5. At the separately approved coordinated cutover, enable operations, legacy guard
   and reads together after capability/old-client compatibility checks. Enable the
   web dictionary environment and deploy its exact source. This is not done during
   candidate preparation. The held enabled native clients require these capabilities.
6. Existing personal-card automatic mapping is deliberately an empty plan:
   zero safe matches across2914 snapshot cards. Retain possible/missing/private/
   deleted cards unchanged and unlinked. New imports/analyses may reuse shared
   content through the approved protocol once the server is ready.
7. Only after artifact checks and explicit distribution agreement submit the exact
   iOS/Android build IDs to TestFlight/internal testing. Automatic tester updates
   can affect the primary phone; do not submit early against the dormant backend.

## Verification and rollback boundary

Verify downloaded IPA/AAB hashes, application/version identifiers, signing,
embedded runtime/update channel, normal updater settings, dictionary opt-in,
production backend and original source-map upload evidence. Source inspection or
build success alone does not establish every artifact property; record limitations.
App Store-signed IPA cannot run in an iOS simulator. Do not install it onto P1 to
fill a test-evidence gap without a separately agreed device operation.

Local real-snapshot evidence preserves personal/learning data during planning and
empty apply. A separate synthetic linked-card review survives read rollback.
Rollback must keep new learning writes, references and legacy guard; disable new
reads rather than restoring an old whole database. Withdrawing a store candidate
is distinct from reverting already installed clients. Keep protocol compatibility.

Build outputs await the approved prerequisite sequence. No store-processing/installation, production activation,
shared publication, personal linking or CEFR qualification is claimed here.
