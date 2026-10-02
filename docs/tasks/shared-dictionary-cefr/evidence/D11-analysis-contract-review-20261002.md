# D11.1 — contract review

## Verdict and scope

2026-10-02, user-confirmed GPT-6 Astra / High, starting `9caea2f`, reviewed
implementation `a756680`, existing `feature/shared-dictionary-schema`, AUTH-20 /
AUTH-18. Same-thread review after the requested model change; no subagent.

**PASS for the dormant D11.1 contract. No blocking implementation finding.**
This does not certify CEFR quality, calibrated confidence, worker correctness or
permission to activate the feature. D11.2–D11.7 and the live quality/cost gate
remain open. No application or migration code changed during this review.

## Reviewed boundaries

| Boundary                      | Evidence and conclusion                                                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider provenance           | `createGeminiCefrEstimate` accepts only candidate level/confidence; stamps model source, estimated/unknown status, method/version and input digest server-side. Provider editorial/review/hash claims cannot acquire those authorities.                                                   |
| Invalid optional metadata     | Pure domain parser rejects incompatible status/level/confidence, non-finite/out-of-range values, bad input version/digest and missing method data. Invalid CEFR does not invalidate an otherwise usable analysis.                                                                         |
| Content binding               | Canonical input includes translations, examples and material grammar, in an explicit analysis namespace. Cache reads recompute the digest. New matrix verifies rejection after 16 material field mutations; prior tests cover lemma/examples/translation changes.                         |
| Actual persistence round-trip | New actual-handler tests feed captured SDK POST bodies back through cache reads. Both a known estimate and explicit unknown retain their exact envelope. Default-off reads omit it.                                                                                                       |
| Disabled refresh              | New actual-handler test verifies PATCH omits CEFR when disabled. A retained estimate for different content is rejected after re-enable, without calling the provider.                                                                                                                     |
| Legacy behavior               | No cache version bump, eager refresh or new provider call on cache hits. Default-off prompt/response/cache fields retain the old shape. Article-free duplicate refresh uses SQL NULL semantics; the non-null key path remains unchanged.                                                  |
| SQL boundary                  | Nullable additive column, constraints and existing client write denial. Existing 24-test PostgreSQL evidence covers row preservation, invalid metadata, no dictionary publication and reviewed/locked assessment protection. SQL was unchanged, so this review does not repeat that gate. |
| Web/mobile consumers          | Web metadata is optional and structurally parsed; personal persistence ignores it. Mobile changes are type-only. No analysis metadata is used by `resolveEffectiveCefr` or promoted into dictionary assessment/head rows.                                                                 |
| Platform/dependencies         | Pure domain module contains no runtime Web Crypto dependency. Server hashing remains in Edge. Both Deno import maps resolve the shared helper against the existing frozen lock. No dependency or runtime flag changed.                                                                    |

## Explicit limits retained for D11.2

- The hash detects content mismatch; it is neither meaning identity nor proof of
  authenticity. A serialized client form can forge a syntactically valid model
  envelope. This is safe only because that envelope currently has no publishing
  or persistence authority. Future worker inputs must come from trusted published
  revision rows, never from the client envelope or aggregate analysis cache.
- The request model name and explicit method revision identify the current
  uncalibrated analysis method. They do not independently prove a resolved
  provider model build, exact generation settings or measured error rate.
  Calibration profiles must bind the complete versioned method configuration.
- Any finite confidence in [0,1] is currently structurally valid. It is not a
  calibrated probability or an automatic promotion threshold. Keep the analysis
  flag OFF until the D11.2 decision policy is qualified.
- Corrected lemma/legacy cache-key mismatch conservatively discards the estimate
  on later cache reads; no automatic meaning relink is introduced.
- SQL constraints validate shape, not content hashes. Recompute trusted worker
  inputs and enforce exact version/lease/head comparisons at the privileged
  completion boundary. Do not weaken reviewed/locked protection.
- Known quality labels need a reviewed meaning fixture and source permission.
  Existing NT2Lex/SUBTLEX evidence and synthetic SQL labels are not that fixture.

The [calibration/worker contract](D11-calibration-worker-contract-20261002.md)
defines the local implementation route without granting source, cost or runtime
activation approvals.

## Validation and persistence

Added three meaningful review tests to the existing Edge suites; no product fix
was needed. The complete focused command passes **48 tests**:

```sh
/Users/devrush/.deno/bin/deno test --config supabase/functions/deno.json --allow-env supabase/functions/gemini-handler/cefr_test.ts supabase/functions/gemini-handler/cefrHandler_test.ts supabase/functions/gemini-handler/geminiUtils_test.ts
```

No `--allow-net`, real HTTP listener, credentials, provider or retained database.
All transports are in-memory fakes. Deno checks test types during this command.
Scoped Deno lint, Prettier and `git diff --check` pass. The preexisting unsupported
`compilerOptions.allowJs` warning remains; no rule suppression was added.

At startup all 158 D11.1 hashes matched. The
[review inventory](D11-review-source-sha256.json) retains 156 exact hashes and
updates only the two extended test files. The implementation inventory remains
historical. Private logs:
`reports/shared-dictionary-cefr/d11-contract-review-20261002/`.

Assigned devices and retained containers are not needed and were not started.
No runtime QA, import replay, database write, provider call, hosted migration,
scheduler activation, production/cutover, publication/deployment or push/PR/merge.
Necessary local test/evidence commit uses ordinary hooks. Preserve preexisting
`.playwright-cli/` and all private reports/data.

Next: **GPT-6.1 Sol / High** for D11.2 offline fixture validation, calibration
reporting and fail-closed decision policy. A real reviewed fixture/provider sample
is still missing; do not mark quality calibration complete using synthetic results.
Local fake-provider worker preparation can continue with that gate explicitly open.

Assigned resources OFF verified 20:08:28 UTC /22:08:28 Amsterdam: exact iOS
Shutdown, Android absent, four retained task containers exited, ports 55331/55400
closed. No device/backend start or retained data mutation during this review.
