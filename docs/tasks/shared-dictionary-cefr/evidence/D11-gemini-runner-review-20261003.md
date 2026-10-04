# D11 — Gemini runner technical review

Date: 2026-10-03. Starting HEAD `00f6540`, implementation `a661fe1`, branch
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. GPT-6 Astra / High announced;
model-switch event present, exact picker attribution unverified. No subagent.
Baseline source inventory verified: **216/216 exact**. Review result: **PASS after
two P2 repairs**, for the local diagnostic mechanics and trusted operator boundary.
This is not source transmission, account verification, spending or qualification
approval. No provider/account/key call or paid execution was performed.

## Findings and repairs

### R1 — P2: a lost journal silently recreated the spending allowance

Reproduction: finish a 49-request injected run, remove either `diagnostic.sqlite`
or the whole run directory, reload the same private registry and invoke the runner.
Both cases dispatched another full run rather than rejecting the consumed scope.
Further losses could repeat this indefinitely; controls and spend were bounded only
by the currently present journal, not by the lifetime of that authorization.

The registry now binds an absolute `journal_binding_path` outside the physical run
directory. First execution exclusively creates and fsyncs a private consumption
record and its parent directory before any HTTP. The record binds execution digest,
run identity, physical directory/database identity and a random nonce also written
to the journal. It survives losing the run directory and is checked before dispatch.
An existing record cannot initialize an empty journal; an existing journal cannot
adopt a replacement record. Incomplete initialization conservatively stops. Moving
an approval file does not change its bound consumption location. Aliases into the
run directory and writable/foreign-owned parent directories are rejected.

The operator must preserve the journal and external record and review any loss
before requesting new authorization. This is protection against accidental replay
and inconsistent local state; it is not a hostile-operator spending service. A
process with the same filesystem authority could deliberately erase both records
or restore old snapshots. No automatic recovery, refund or replacement approval is
implemented. `--check` creates no consumption record.

### R2 — P2: duplicate response identity did not durably stop the batch

Reproduction: return the same response ID for two meanings. The second capture's
UNIQUE constraint stopped the process, but no rejected state was persisted. Resume
therefore dispatched another generation before encountering the conflict again.
The bad receipt's reservation remained charged, but the required permanent stop
was not durable.

Capture now checks duplicate response identity and mixed model versions inside the
lease-protected transaction, commits a run rejection reason, then raises the error.
The guard rejects subsequent attempts before HTTP. The rejected receipt remains
uncaptured with its full reservation and unknown usage; it is not counted twice.
The aggregate report exposes `rejection_reason`. The existing fake collector keeps
its duplicate/mixed capture protections and now shares the durable rejection.

## Verification

Three pre-fix failures reproduced the two lost-journal variants and the extra
request after duplicate receipt. A fourth pre-fix case already passed because
SQLite rejected a moved open database; the new explicit binding preserves that
protection independently. Six additional cases cover all 48 attempts plus controls,
same-inode truncation, moved approval file, alias into the run directory, incomplete
first initialization and missing consumption record.

Final: **102/102 diagnostic Node tests PASS** (10 review +92 prior cases), scoped
TypeScript, strict ESLint, Prettier and `git diff --check` PASS. Shared synthetic
runner fixtures were extracted to avoid duplicating approval/body construction;
no test imports trigger provider calls. The old duplicate-capture assertion now
expects the explicit rejection code instead of a SQLite implementation message.
Initial authoring lint warnings (unused import, function complexity, repeated test
literal) were repaired without suppressions. Ordinary commit-hook results are
recorded in the handoff/session receipt.

The maximum retry test dispatched 73 injected calls: 48 generations and 25 controls.
Reservations were 340,608 tokens and 1,937,972 synthetic microUSD, including 24,500
synthetic control microUSD. All 24 uncertain first attempts retained their allowance.
These are test prices, not a verified live bill. The proposed real $2 API-use ceiling
still requires verified account/control billing and exact human authorization.

Runtime binding now covers 17 files, including the shared private-file reader and
journal binding module. The loader snapshots the implementation digest once for
validation and the prepared scope. The live draft and disabled registry template
are rebound to that implementation and this review; all five frozen pilot artifact
hashes and the wire request body remain unchanged. Baseline 216 paths: eight
intentionally updated, **208 retained hashes**; final inventory **221 paths** in
`D11-gemini-runner-review-source-sha256.json`.

Logs: `reports/shared-dictionary-cefr/d11-gemini-runner-review-20261003/` (private,
ignored), including `pre-fix.log`, `node-tests.log`, `typecheck.log`, `lint.log`,
`format.log` and ordinary commit logs. `.playwright-cli/` and previous reports are
preserved. No device/backend, Expo/EAS, hosted migration, scheduler, activation,
publication/deployment or Git push/PR/merge. Account/key ownership is still an
operator-attested boundary, not an assertion independently verified by this parser.

## Next checkpoint

**GPT-6.1 Sol / High — prepare the final concrete live-pilot request.** Announce the
model. Verify public control endpoint billing and the complete cost bound, identify
exact personal account/project/key evidence still needed, and prepare one-day
source/account/spending authorization using the reviewed private registry contract.
Perform only already authorized local/public-document work; obtain any necessary
account/key access or live spending approval explicitly before using it. Do not
populate an approved registry or dispatch real HTTP from a generic continuation.
No teacher is required. Keep model-origin references and qualification false;
D11 remains `in_progress`, D12 has not started, live acceptance remains unproven.
