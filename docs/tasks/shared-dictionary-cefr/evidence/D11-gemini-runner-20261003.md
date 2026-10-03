# D11 — dormant authorized Gemini diagnostic runner

Date: 2026-10-03. Starting HEAD `233e9bc`, branch
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. GPT-6.1 Sol / High announced;
actual picker attribution unverified. No subagent. This checkpoint implements local
mechanics and fake HTTP verification. It is not live spending/source authorization.

## Result and boundary

`diagnostic-runner.ts` connects the repaired REST adapter to the same durable
control/generation journal. One metadata read, at most 24 exact-body token counts
and at most 48 generations share the $2 proposed API-use ceiling. Stable meaning
identity is independent of attempt number; each attempt reserves its own full
allowance. Controls reserve their verified maximum cost plus token-count input
allowance. Reports separate actual generation receipt usage from unknown control
cost and combine conservative reservations under `reserved_all`. Qualification
and calibration eligibility remain false. No operational/client/worker activation.

`diagnostic-execution.ts` validates an explicit owner-only private operator registry,
draft and key without environment defaults. It binds all 24 source hashes, frozen
bundle, exact draft, a 15-file runtime dependency digest, key digest, personal paid
account/project attestation, rate/model/tier/control billing evidence, combined
ceiling, exact run directory/UUID, one UTC day and expiry. Approval/key/runtime
changes stop dispatch. The parser does not independently discover remote ownership,
key membership, paid tier or control pricing: these require externally verified
operator evidence and actual human authorization. No such real registry/key was
provided or loaded. Synthetic registries use the fixed dummy key and injected HTTP;
they cannot pass either live CLI mode. Provider runs reject test hooks.

`diagnostic-live.ts --check` performs local private validation with no HTTP or
journal creation. Only `--execute` dispatches after explicit authorization.
The committed draft and registry template remain unapproved and disabled. The
complete live cost is still unknown. A technical review must precede the final
concrete source/account/spending request.

## Restart, stop and response handling

- Reservations precede dispatch; the lease and approval are checked again after
  reservation. Unknown controls cannot replay. Exact verified control receipts
  cache across same-day resume.
- Transient HTTP 408/429/5xx, network errors and timeouts get at most one generation
  retry. Persisted exponential delay plus jitter honors `Retry-After` up to five
  seconds. A longer provider delay durably stops the batch. An unknown generation
  after a crash also retains cost and waits before its second reservation.
- Permanent errors, invalid receipts and a changed pinned response model version
  durably stop subsequent batch requests and resumes. Invalid candidates retain
  verified usage without claiming an assessment. Verified receipts arriving across
  approval expiry are captured before the next guard stops the run.
- Repaired body cancellation, strict JSON/UTF-8/MIME/envelope bounds, fixed endpoints,
  redirect rejection, disjoint usage and output caps are retained. Timeout identity
  now survives into the report instead of being counted only as a generic transport
  failure. Legacy fake journals migrate accounting/timestamp columns, while a
  scoped execution cannot adopt an unrelated fake journal.

## Verification

Node 24.20.0, installed dependencies; explicit scoped TypeScript, strict ESLint,
Prettier and `git diff --check`. Final diagnostic Node tests: **92/92 PASS**
(**31 new runner cases +61 retained cases**). Cases include full run/no-call resume,
exact counted body, combined ceiling, stable retries/Retry-After, permanent/receipt/
model/delay stops, pre-dispatch crash, unknown controls, lease loss/overlap,
revocation/key rotation, expiry during HTTP, timeout accounting, incomplete waits,
forged/private/artifact/source/account/day/cost bindings and both live CLI refusal
modes. Initial authoring failures corrected a lease-error expectation and exposed
missing timeout provenance; the structured timeout repair retains existing body
lifecycle tests. The prior draft assertion was updated for the new dormant CLI;
unapproved/not-ready and disabled-template assertions remain explicit. Final
types/lint/format/diff PASS; ordinary hooks recorded in the
handoff/session receipt after the implementation commit.

The fake full run used 49 HTTP calls (25 controls/24 generations), 194,304 reserved
tokens and 981,236 simulated microUSD: generation 956,736 plus test-only controls
24,500. Verified fake generation usage was 10,080 microUSD; real control cost stayed
null. These values test arithmetic, not pricing/account verification or a paid bill.

Logs: `reports/shared-dictionary-cefr/d11-gemini-runner-20261003/` (ignored/private).
Source inventory: `D11-gemini-runner-source-sha256.json`; baseline 210/210 exact at
startup, nine intentionally updated paths and 201 retained hashes. Frozen five
pilot artifact digests and request identity/body contract are unchanged.

Documentation consulted through Context7: official Gemini REST/token/usage and
[troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting) guidance
for finite transient retries/backoff. No provider/account/credential API, paid call,
Expo/EAS, device/backend, hosted migration, schedule, deployment/publication,
Git push/PR/merge or external write occurred. `.playwright-cli/` and private reports
are preserved.

## Next checkpoint

**GPT-6 Astra / High — technical review.** Announce the model. Review the private
approval trust boundary, runtime dependency binding, combined control/generation
budget, retry/restart/lease/window fences, receipt accounting and CLI default-off
behavior. Reproduce and repair findings locally before any real-provider request.
No teacher is required. D11 stays `in_progress`; D12 has not started. Live acceptance
and independent CEFR quality remain unproven.
