# D13A.4 provider worker checkpoint — October10, local only

Status: provider transport/orchestration subcheckpoint complete; D13A.4 remains
in_progress. GPT-6.1 Sol / High, owner-confirmed. Same feature/shared-dictionary-schema
branch and HEADf97a733407a4d2b37e8f9ca030ad9574de85a794. See
[exact evidence](D13A-provider-worker-20261010.json).

## Prepared implementation

Migration20261010140000 adds only service-role get_dictionary_analysis_work_v1:
actor/operation/fence-scoped protected immutable identity/anchor, persisted metadata,
journaled result and validation ID. No writes, new grants to people, new flags or
policy qualification. Existing service SELECT and all client table restrictions stay
unchanged. Preflight payload equals the later guarded dispatch grant; stale fences,
wrong actor and missing operations fail without returning content.

The new dictionary-analysis modules implement a strict protected request template,
exact body/model hash, one Gemini generateContent POST after committed dispatch,
no redirects/retries,60-second timeout and32KiB streamed response bound. Model/key
are explicit configuration. Network/408/5xx/timeout/oversized/invalid UTF-8 outcomes
are unknown and quarantined; explicit4xx rejection has a hashed failure receipt.
Successful blocked/truncated/malformed output is journaled with null candidate;
no regex substring extraction or confidence acceptance. Thought parts never become
candidate content; provider envelope remains private. Optional provider responseId
is used when valid; worker:<attempt> fallback identifies local journaling, not a
provider-issued idempotency token or proof of provider completion.

The worker accepts under caller JWT, prepares input from service-only protected
context, verifies committed grant equals prepared context and fences every receipt.
Stored results resume evaluation/publication; stored validation skips reevaluation.
Lost dispatch/journal/validation/publication replies never cause another paid request.
Unknown and late results need explicit existing reconciliation; worker cannot infer
permission from expiry. Current SQL permission/head/anchor/lease/quota/publication
checks remain authoritative. No database transaction spans the network call.

Handler/SDK factories verify identity with Auth getUser(token), isolate caller and
service clients, accept only the strict2KiB version2 command and expose only durable
receipts or exact whitelisted acceptance errors. Read_only administrator analysis is
left to trusted SQL membership; no full_access-only shortcut. Credentials, SQL errors,
private prompts and provider bodies never enter public error responses.

## Verification and limits

34 dependency-injected Edge tests PASS with no network/environment permissions;
SDK adapter typecheck and seven-file Deno lint PASS. Six new real PG fixtures PASS.
The first combined run had63/64: all58 unchanged authority/publication/history cases
passed, one new test made a wrong assumption about pre-existing service SELECT.
Only that fixture assertion was corrected; final new suite6/6. This establishes64
unique PG cases across runs, not a single final64-case green run. All test mirrors
match exact repository bodies; PG16.13 adapter/original support unchanged.

Focused mobile contracts6/105, domain/contracts/mobile production+test/web types,
root lint zero warnings, exact target generate/check, source format and diff PASS.
No fresh full mobile/web tests or exact device/build85/26-fixture acceptance claim.
Initial unsupported Deno flag and duplicate-literal lint repair retained with logs.
54 prior source/support/test/sealed file hashes unchanged; only target manifest/types
are approved extension points in that baseline. Four sealed artifacts preserved;
old Gemini/auth helpers and frozen Deno lock unchanged. Zero disposable task
containers/type networks; all runners exited. Existing QA/backups/services preserved.

Actual semantic evaluation/qualified production policy is NOT implemented by these
synthetic wiring fixtures. The runtime factory requires an explicitly injected
trusted evaluator. No Deno.serve entrypoint or enabled endpoint exists. Next checkpoint
is the evaluator, independent protected evidence, positive/negative sense fixtures
and policy qualification, then final dormant endpoint/workflow verification. Do not
introduce a hidden extra paid validation call or accept confidence alone.

Twelve source/type/test/config files plus task notes/evidence remain local-only and
uncommitted. No app env/keys or real provider request, hosted migration/grant/policy,
publication, commit/push/PR/merge, release/device operation or automation. New flags
OFF; real roles/policies unseeded, capability shared_analysis unavailable and CEFR OFF.
D13 observation open, D14pending and AUTH27/28/29 consumed.
