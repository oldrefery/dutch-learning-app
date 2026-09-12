# Web review performance execution log

## Session context

- Base commit: `8536d8e4a5f588e4533ae918c6285a92f34b11cb`
- Current branch: `feature/web-review-performance`
- Runtime: Node `v24.9.0`, npm `11.6.0`
- Repository state at start: `main` was current with the three supplied plan documents untracked. They were preserved before branch creation.
- Remote action: `git pull --ff-only origin main` reported `Already up to date.` No push, deployment, hosted migration, EAS/Expo command, or account change was performed.

## Completed stages

### W01 — Audio Review call contract

- Passed the authenticated `userId` from the Audio Review page.
- Keyed the workspace by that identity and passed the explicit fifth `useReviewSession` argument: `meaning-recall`.
- Added `AudioReviewWorkspace.test.tsx` to assert the hook contract.

### W02 — Recognition candidate index

- Added `createRecognitionOptionBuilder` to normalize, rank, partition and reuse candidate metadata once per synchronous preparation invocation.
- Updated session preparation to create one builder per vocabulary and to calculate adaptive decisions only in Adaptive mode.
- Kept the public `buildRecognitionOptions` compatibility wrapper, JSON snapshot cloning, language fallback, semantic-overlap exclusion and deterministic option ordering.

### W03 — Asynchronous preparation

- Added preparation states: `idle`, progress-bearing `preparing`, and retryable `error`.
- Added a real yield boundary using `scheduler.yield()` where available and a `setTimeout(0)` fallback, then bounded work batches to 50 questions or roughly 8 ms.
- Added generation and `AbortSignal` ownership; detach and document hiding cancel preparation, while stale completions cannot install a flow.
- First question timing is created only after complete preparation. Audio playback starts from the installed review flow rather than before preparation completes.
- Added accessible progress, Cancel, disabled duplicate Start, and error UI in both review modes.

## Checks run

All commands used `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

- `npm run web:typecheck` — passed after W03.
- `npm run web:test -- --runTestsByPath src/features/review/review-domain.test.ts src/features/review/useReviewSession.test.tsx src/features/review/AudioReviewWorkspace.test.tsx` — passed: 25 tests.
- `npm run web:test -- --runTestsByPath src/features/review/ReviewWorkspace.test.tsx` — passed: 19 tests.

An initial focused Jest invocation used repository-root test paths and correctly failed with `No tests found`; rerunning with workspace-relative paths passed. This is a command-path correction, not an application failure.

## Measurements and limitations

- W00 is **not complete**. No isolated production build, fake loopback Supabase upstream, browser long-task artifact, or five-run baseline has been recorded yet.
- Therefore no before/after performance claim is made. The research document's exploratory numbers remain planning evidence only.
- W04 through W11 are **not started**. In particular, routine route invalidation remains in place until the complete account-scoped boundary-freshness coordinator and its browser acceptance fixture are implemented together.
- No database migration has been created or applied. Hosted services and production learning data were not contacted.

## Changed files so far

- `apps/web/src/app/app/review/audio/page.tsx`
- `apps/web/src/features/review/AudioReviewWorkspace.tsx`
- `apps/web/src/features/review/AudioReviewWorkspace.test.tsx`
- `apps/web/src/features/review/Review.module.css`
- `apps/web/src/features/review/ReviewSetup.tsx`
- `apps/web/src/features/review/ReviewWorkspace.tsx`
- `apps/web/src/features/review/ReviewWorkspace.test.tsx`
- `apps/web/src/features/review/review-domain.ts`
- `apps/web/src/features/review/session-controller.ts`
- `apps/web/src/features/review/session-questions.ts`
- `apps/web/src/features/review/useReviewSession.ts`
- `apps/web/src/features/review/useReviewSession.test.tsx`

## In progress

### W04 — Boundary freshness

- Routine `revalidatePath` calls were removed from ordinary review and correction acknowledgements.
- An account-scoped `ReviewFreshnessProvider` now records confirmed or uncertain mutation attempts and invokes a single authenticated layout invalidation only at a session boundary or after leaving Review.
- `flushReviewFreshness` verifies the authenticated identity before invalidating `/app` as a layout.
- Focused action/session tests pass, but W04 remains incomplete until coordinator race tests and the isolated production-build request-count fixture are added.

## Next action

Complete W00 with an isolated build/browser harness and five-run artifacts; add W04 coordinator race/browser coverage, then complete W04 as one atomic freshness stage before progressing to W05.

## Completion update

### W04–W05 — Freshness and identity

- Replaced routine review/correction route invalidation with an account-scoped boundary coordinator and authenticated layout refresh action.
- Split identity verification from access-level reads; normal review mutations use identity only.

### W06 — Collection overview and streamed chrome

- Added `get_web_collection_overviews_v1(p_today date)` as a `SECURITY INVOKER` RPC with caller-derived ownership, active-word counters and least-privilege grants.
- The authenticated shell streams the Review badge under Suspense instead of blocking on collection statistics. The legacy read path remains only for expected missing-RPC rollout errors.

### W07 — Review snapshot

- Added the `SECURITY INVOKER` `get_web_review_snapshot_v1()` JSON RPC. It returns ordered collections, all active words and the bounded effective event stream from one statement snapshot.
- The server validates the versioned envelope and fails closed for malformed/permission failures; only expected missing-RPC errors use the old capability-aware paged path.

### W08–W09 — Detail and long-session responsiveness

- Added a private no-store detail route, shared server reader and account-mounted bounded detail cache. Requests are abortable; failures are evicted and AI reanalysis invalidates the affected entry.
- Reused the generation-guarded pronunciation lifecycle in standard Review and replaced session-word array materialization used only for length with `sessionTotal`.

### W10 assessment

- Production web build, typechecking, focused UI tests and private PostgreSQL migration tests pass. The snapshot preserved full vocabulary and history semantics; no evidence justified a worker, framework upgrade, cache-components migration, global client query framework, durable outbox, or a hosted region/configuration change.
- W00's controlled browser/performance harness and five-run benchmark remain unimplemented. No latency or long-task improvement is claimed without that artifact; these checks are therefore a release-readiness limitation rather than fabricated measurement.
