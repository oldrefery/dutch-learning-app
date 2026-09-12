# N02 experiment: overlap access and Review data

## Decision

Do not ship the page-only concurrency candidate. Client navigation improved in the delayed-backend profile, but direct entry regressed on both 5,000-word datasets. The candidate and its temporary route tests were removed; application source remains unchanged from `f70384a`.

The user reports production Review tab navigation still exceeds two seconds while Start is fast. This is not resolved by the N01 lab results, and no live before/after timing is available. Keep Start and the full snapshot contract intact.

## Candidate and method

The only application change was in `apps/web/src/app/app/review/page.tsx`: await `requireAuthenticatedIdentity()`, then await `Promise.all([requireAuthContext(), searchParams, getReviewWorkspaceData(identity.userId)])`. The existing request-scoped identity cache, verified `getUser()` boundary, caller-authenticated RPC, RLS, complete workspace and access-gated controls were preserved. No layout, shared auth, repository, session or database code changed.

Run the existing harness with:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH WEB_PERF_LATENCY_MS=200 npm run web:performance:navigation -- --core
```

- Apple M1 Pro / macOS arm64, Node 24.9.0, Chromium 149.0.7827.55, Next 16.3.3 webpack production builds.
- Synthetic loopback backend delay: 200 ms per request; no bandwidth limit or production credentials. This is a sensitivity profile, not a measured production RTT.
- Two independent staged builds: baseline first, candidate second. Five matched samples per scenario/path in each build, with legacy/snapshot order alternated inside each build. Baseline/candidate builds were not interleaved; ordering and thermal effects are a limitation. This is not a production A/B test or p95 estimate.
- 60 measured runs plus two excluded warmups per build: 120 measured runs total. All completed, with complete selected queues and no browser/backend fixture errors. No assessments were submitted.
- Cold means direct document entry with a warm application server, not a hosting-function cold start. Client means first same-document navigation from hydrated Settings, without Review prefetch.
- CPU-heavy checks did not run alongside browser measurements. The candidate was copied to its private build before the working-tree experiment was removed.

Artifacts (ignored):

- Baseline: `apps/web/output/performance/navigation/1789225048241-1x-core/`
- Candidate: `apps/web/output/performance/navigation/1789225347155-1x-core/`

Both metadata files identify HEAD `f70384a`; the candidate was an uncommitted working-tree change. Exact Review page SHA-256 values distinguish the staged sources:

- Baseline: `535b592dc2517a2f9f8a55f1eb64dbbc18db29b0e3c01bf69200bf205fa384a4`
- Candidate: `d4e01a3f214c161335cac6d8ff7036c1aa78adc782d23965aca4c15adfab2253`

## Snapshot-path results

Setup values are median [min, max], in milliseconds; Start and combined values are medians. Readiness requires hydrated control interactions, not just visible server-rendered text. Verification frames are included consistently.

| Words / events / selected | Entry  | Setup baseline       | Setup candidate      | Start baseline → candidate | Navigation-to-card baseline → candidate |
| ------------------------- | ------ | -------------------- | -------------------- | -------------------------- | --------------------------------------- |
| 2,500 / 501 / 2,500       | Cold   | 1,016 [1,003, 1,020] | 823 [809, 1,072]     | 63 → 61                    | 1,079 → 884                             |
| 2,500 / 501 / 2,500       | Client | 930 [909, 930]       | 722 [721, 730]       | 61 → 63                    | 989 → 786                               |
| 5,000 / 5,000 / 5,000     | Cold   | 1,054 [1,036, 1,063] | 1,143 [1,123, 1,162] | 108 → 112                  | 1,166 → 1,253                           |
| 5,000 / 5,000 / 5,000     | Client | 996 [979, 1,013]     | 792 [763, 804]       | 113 → 110                  | 1,107 → 907                             |
| 5,000 / 5,000 / 20        | Cold   | 1,066 [1,056, 1,071] | 1,131 [1,109, 1,146] | 22 → 21                    | 1,088 → 1,151                           |
| 5,000 / 5,000 / 20        | Client | 997 [972, 1,005]     | 796 [772, 796]       | 19 → 20                    | 1,016 → 815                             |

Client setup improved by approximately 201–208 ms, consistent with overlapping one delayed request. Cold setup for both 5,000-word datasets worsened beyond the baseline range; combined navigation-to-card also regressed. Passing an absolute target alone is insufficient to accept that tradeoff.

## Request and rendering evidence

- All 30 baseline snapshot samples had access and snapshot requests sequential; all 30 candidate samples overlapped those requests.
- Both builds retained exactly two fixture `/auth/v1/user` requests per navigation (proxy plus verified server identity in this HS256 fixture), one access read and one snapshot RPC. Cold entry also reads collection overviews. No extra identity request appeared in the candidate. This is not a claim about production auth request counts.
- Representative 5,000-word cold sample: baseline snapshot ran at backend-clock 624–861 ms; candidate at 425–670 ms. The collection-overview request ran at 626–861 ms versus 671–872 ms. These overlapping intervals must not be added together.
- In that sample, browser document response completion improved from 960 to 874 ms, yet usable setup moved from 1,057 to 1,123 ms. Neither sample recorded a browser long task. Faster backend completion alone did not imply earlier interactive readiness.
- The interaction of layout streaming, chunk arrival and client readiness needs further attribution. These traces do not prove a particular React scheduling mechanism is responsible. Do not disable loading boundaries or framework timers based on this experiment.

## Validation and next step

The temporary candidate passed web lint, web typecheck and 26 focused tests across the temporary Review route tests and existing auth/repository suites. The route tests checked the verified-identity boundary, rejection before data reads, overlap while access is pending, waiting for access before rendering, read-only/full-access props, failure propagation and identity-specific workspace selection. Existing suites cover actual auth response handling and repository contracts. These checks validate the experiment, not retained new application code.

The first focused test invocation used repository-relative paths through an npm workspace and found no tests. Repeating with absolute paths passed all three suites. Both isolated production builds and both complete browser profiles passed.

Next priority is a read-only trace on the deployed build, including whether repeated navigation is slow. The root Sentry token works for web-project issue reads when not overwritten by an empty value in the web env file. The explicit project query returned one unresolved issue (`DUTCH-LEARNING-APP-WEB-8`, seven missing-Server-Action events, last seen 2026-09-12 01:16:17 UTC, before the current deployment); it does not explain current navigation latency. The connected span-search service is scoped to another project, so its empty results cannot establish the absence of web traces. No live timing baseline was obtained.

`WEB_E2E_EMAIL` / `WEB_E2E_PASSWORD` are not both populated in the known local env files. Configure those locally for a dedicated test account before an isolated live browser measurement; never use the main account, print credentials, or run stateful E2E suites merely to time navigation.

No release, organization permission change, hosted data mutation or production performance improvement is claimed. N02 is evaluated and rejected in this form, not implemented. N03 retains its earlier no-new-index decision; N04–N07 remain conditional on attribution.
