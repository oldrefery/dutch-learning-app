# D10 web document transfer implementation

Date: 2026-10-02. Starting HEAD `b302d71`, branch
`feature/shared-dictionary-schema`. Implementation commit **`ab8d603`**.
AUTH-17/AUTH-18; implementation routing
GPT-6.1 Sol / High following the model-switch event. No picker operation claimed.

## Production integration

The default-off `DICTIONARY_CONTENT_ENABLED` gate now exposes export controls in
owned collection settings and an Import JSON link on the collections overview.
`/app/dictionary-import` authenticates and loads existing owned destinations plus
batched hydrated semantic duplicate context. Readonly accounts retain import access.
No collection creation, share publication, source references, mobile roots or SRS
fields are added to the schema-v1 transfer contract.

The user pastes JSON, previews validated content, chooses entries and an existing
destination, then explicitly imports. Fifty-row pagination retains selection across
all pages. Owned and within-document duplicates cannot be selected. The server
rechecks target ownership and global hydrated duplicates immediately before calling
the existing content-copy RPC. A concurrent existing card is reported as saved,
never as newly created; existing progress and placement remain the RPC's authority.

Export calls the existing strict helper without publishing. Prepare and Copy JSON
are separate user gestures. Clipboard rejection leaves selectable readonly JSON.
Account-keyed components and browser auth epochs suppress delayed responses after
sign-out, account changes, owner ABA and unmount. Same-owner token refresh remains
valid. An invalidated mounted view requires an explicit page reload.

## Request and result boundaries

`POST /api/dictionary-transfer` is the production path. It does not raise the shared
Server Actions body limit. The route requires an exact same-origin JSON POST, fresh
server `auth.getUser()`, strict owner/UUID/selection envelope and schema-v1 content.
The expected owner from the browser is compared with authenticated identity and is
never used as authority. Destination reads and the RPC enforce owner scope.

Input JSON is limited to 10,000,000 UTF-16 units, matching the native paste boundary.
The streamed request has a 30,100,000-byte cap covering UTF-8 and selection metadata;
an absent or false Content-Length cannot bypass it. Hosting ingress limits can be
smaller; no deployed hosting-size claim or configuration change is made here.
Responses are no-store. Neither errors nor receipts expose upstream private diagnostics.

An RPC failure/lost reply produces an explicit uncertain result, a collection check
link and a manual Preview-again gate. No automatic retry or destination fallback.
A successful mutation with unverified receipt counts stays successful with an unknown
count. Cache invalidation or a synchronous router refresh failure retains saved
success and offers a collection link instead of another import button. No complete
asynchronous browser/navigation-failure claim is made by these local tests.

## Local verification

- Focused web tests: 8 suites / 80 tests PASS, including the pre-existing helper
  suite. Seven new suites exercise command selection/ownership/duplicate checks,
  real helper-to-mocked-RPC payloads, streamed request bounds, default-off/auth/CSRF
  gates, production page callers, readonly access, clipboard fallback, pagination,
  double-click guards, stale result suppression, owner ABA and saved/uncertain feedback.
- Web type generation and TypeScript PASS, including all new tests.
- Strict scoped web ESLint, Prettier and diff checks PASS.
- Normal source commit hooks PASS: mobile 156 suites / 1796 tests / 22 snapshots;
  web 82 suites / 715 tests, one existing skipped suite/test.
- All prior 113 fingerprints unchanged, 20 web files added; current 133/133 hashes
  match after hooks. Private hook log: `reports/shared-dictionary-cefr/d10-web-transfer-20261002/commit.log`.
- No new dependencies, Next config, SQL/RPC, mobile application changes or flag flip.

Next: GPT-6 Astra / High implementation review of `ab8d603`,
then actual task-only browser and cross-owner/mobile-web acceptance. D10.3–D10.5
remain open. Helpers/UI tests do not substitute for native or browser acceptance.

No backend, simulator, emulator or browser operation in this checkpoint. The latest
user instruction requires an explicit device availability handback after pausing
the other session. Existing private QA data, `.playwright-cli/`, root AGENTS exclusion
and paused automation remain intact. No push/PR/merge, production, cutover, deployment,
publication or paid provider call.
