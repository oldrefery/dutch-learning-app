# Memorila-Inspired Learning Roadmap

Date: 2026-08-28
Status: `READY FOR EXECUTION`
Planning branch: `feature/memorila-learning-roadmap`
Repository: `/Users/devrush/code/pet/DutchLearningApp`

This document is the product and technical execution plan for the learning
improvements selected after reviewing Memorila. It is also the recovery point
for future sessions. Before implementation, read this document and continue
from the first work package marked `TODO`.

## Status Legend

- `TODO`: not started.
- `IN PROGRESS`: current work package; do not start a later package.
- `VALIDATION REQUIRED`: implementation is complete, but the next package is
  intentionally blocked until the user validates the result.
- `PROCEED`: the user accepted a validation gate and dependent work may start.
- `READY FOR USER COMMIT`: implementation and verification are complete.
- `COMMITTED`: the user confirmed the work package was committed.
- `BLOCKED`: requires a documented decision or an external dependency.
- `DEFERRED`: explicitly outside the current execution scope.

## Product Goal

Turn the existing rich Dutch flashcards into a progressive retrieval-practice
system that helps users move from recognizing a Dutch word to actively
producing it, while making review load and difficult vocabulary visible.

The roadmap must preserve the application's current strengths:

- Dutch-specific linguistic data and AI enrichment.
- Offline-first local writes and later Supabase synchronization.
- Adaptive SM-2 scheduling.
- Collections, semantic duplicate detection, sharing, and selective import.
- Light and dark themes, accessible controls, and cross-platform behavior.

## Research Inputs

Public competitor inputs:

- Memorila product page: https://memorila.app/
- Memorila spaced repetition description:
  https://memorila.app/articles/spaced-repetition.html
- Memorila App Store page:
  https://apps.apple.com/us/app/memorila-language-flashcards/id6670500654
- Difficult-card feature discussion:
  https://www.reddit.com/r/flip_flashcards/comments/1kn5esr
- Community Journey announcement:
  https://www.reddit.com/r/memorila/comments/1v7ug1h/learning_together_feels_different_community/

Repository inputs:

- `src/app/(tabs)/review.tsx`
- `src/hooks/useReviewScreen.ts`
- `src/stores/actions/reviewActions.ts`
- `src/stores/actions/wordActions.ts`
- `src/types/database.ts`
- `src/types/ApplicationStoreTypes.ts`
- `src/utils/srs.ts`
- `src/db/wordRepository.ts`
- `src/db/progressRepository.ts`
- `src/components/StatsCard.tsx`
- `src/components/AddWordScreen/`
- `src/services/collectionSharingService.ts`

## Decisions Already Made

1. Keep the existing SM-2 algorithm. Do not copy Memorila's fixed interval
   ladder.
2. Separate review mode from SRS assessment:
   - review mode defines what the user must recall;
   - `Again`, `Hard`, `Good`, and `Easy` continue to define scheduling.
3. Start with a session-level mode selector. Do not implement per-word
   automatic promotion before the manual modes have been validated.
4. Keep collections. Add global insights and filters instead of replacing
   collections with a single dictionary.
5. Do not let optional practice outside the due queue mutate SRS state.
6. Do not add a chart dependency for the first analytics version. Use simple
   themed React Native views unless later requirements justify a library.
7. Reuse `expo-audio` for the first audio-focused review version. Do not add a
   second audio stack without a separate decision.
8. Gestures are enhancements, not the only controls. Every action must have a
   visible and accessible button alternative.
9. New behavioral telemetry is not sent remotely without a separate privacy
   decision. Local review history may be synchronized only as user-owned
   learning data with RLS protection.
10. Official starter content must be independently authored or sourced from
    compatible material. Do not copy Memorila dictionaries or screenshots.

## Non-Goals

- Replacing SM-2.
- Supporting languages other than Dutch.
- Creating a separate children's application.
- Adding a mascot or redesigning the complete visual identity.
- Implementing Memorila's pay-per-mastered-card model.
- Building social profiles, leaderboards, or Community Journey in this roadmap.
- Removing authentication or implementing full guest-data migration.
- Supporting background or lock-screen audio in the first Audio Review MVP.

## Target Learning Modes

### Recognition

The user sees a Dutch word and chooses the correct translation from up to four
options. The mode is intended for new or difficult vocabulary.

Rules:

- Prefer distractors from the user's own words with the same part of speech.
- Exclude the current word, identical translations, and semantic duplicates.
- Keep option generation deterministic for tests and stable rendering.
- Never invent a distractor with AI during a review session.
- If fewer than two safe options are available, fall back to Meaning Recall.
- A wrong choice records `Again` after showing the correct answer.
- A correct choice reveals the answer and offers `Hard`, `Good`, and `Easy`.

### Meaning Recall

The user sees the Dutch word, recalls its meaning, reveals the back, and chooses
one of the four existing SRS assessments. This is the current review behavior,
formalized as an explicit mode.

### Dutch Production

The user sees a preferred English or Russian translation and must produce the
Dutch answer before revealing it.

Rules:

- Noun answers include the article when it is known.
- The answer may show plural, register, fixed preposition, or separable parts
  after reveal, but the prompt stays focused.
- The MVP uses self-evaluation after reveal. Typed-answer validation is not
  part of the first implementation.
- If no usable translation exists, fall back to Meaning Recall.

## Execution Order

### WP0.1 Review Session Configuration Foundation

Status: `COMMITTED`
Priority: P0
Estimated size: S
Suggested branch: `feature/review-session-modes`

Purpose:

Create a typed session configuration without changing the visible review
experience. The legacy path must remain the default until WP0.2 is complete.

Primary files:

- `src/types/ReviewTypes.ts` (new)
- `src/types/database.ts`
- `src/types/ApplicationStoreTypes.ts`
- `src/constants/ReviewConstants.ts`
- `src/stores/actions/reviewActions.ts`
- `src/hooks/useReviewScreen.ts`
- `src/stores/actions/__tests__/reviewActions.test.ts`

Plan:

1. Add discriminated types for:
   - `ReviewMode`: `recognition`, `meaning-recall`, `dutch-production`;
   - `ReviewScope`: all due words, collection due words, difficult due words;
   - `ReviewSessionConfig` containing mode, scope, and optional collection id.
2. Add the resolved config to `ReviewSession`.
3. Change `startReviewSession` to accept an optional typed config.
4. Preserve current behavior when no config is supplied:
   - mode: `meaning-recall`;
   - scope: all due words.
5. Extract due-word and scope filtering into pure, independently tested
   functions.
6. Normalize all due-date comparisons through one local-date utility so the
   queue does not change unexpectedly around timezone boundaries.
7. Keep collection review callers and existing route behavior compatible.

Required tests:

- Omitted config produces the current queue and Meaning Recall mode.
- Collection scope includes only due words from that collection.
- Difficult scope includes only due words meeting the difficulty rule.
- Invalid or deleted collection ids produce an explicit empty/error state.
- Local-date boundary cases do not move tomorrow's words into today's queue.
- Existing previous/next navigation and deletion behavior still work.

Done criteria:

- Existing review UI is unchanged.
- Session source and mode are explicit and typed.
- No `any`, lint suppression, or duplicated date-filter logic is introduced.
- Targeted tests, typecheck, lint, formatting, and full Jest suite pass.

### WP0.2 Progressive Review Modes MVP

Status: `COMMITTED`
Priority: P0
Estimated size: L
Depends on: WP0.1
Suggested branch: `feature/progressive-review-modes`

Purpose:

Let the user choose how knowledge is retrieved while keeping SM-2 assessment
semantics intact.

Primary files:

- `src/app/(tabs)/review.tsx`
- `src/hooks/useReviewScreen.ts`
- `src/components/ReviewModeSelector.tsx` (new)
- `src/components/ReviewModes/RecognitionCard.tsx` (new)
- `src/components/ReviewModes/MeaningRecallCard.tsx` (new or extracted)
- `src/components/ReviewModes/DutchProductionCard.tsx` (new)
- `src/utils/reviewDistractors.ts` (new)
- `src/stores/useSettingsStore.ts`
- `src/constants/ReviewConstants.ts`
- adjacent Jest tests
- `.maestro/13-review-flashcard-flow.yaml`

Plan:

1. Add a mode selector before a session starts. Persist only the user's last
   selected session mode; do not persist an automatic mode per word yet.
2. Extract the current card into Meaning Recall without changing its behavior.
3. Implement deterministic Recognition option generation.
4. Implement Dutch Production using the preferred available translation.
5. Keep SRS controls hidden until the answer is revealed.
6. Recognition behavior:
   - wrong option: show the correct answer, then submit `Again`;
   - correct option: show the answer and allow `Hard`, `Good`, or `Easy`.
7. Meaning Recall and Dutch Production retain all four assessments.
8. Reset transient card state whenever the current word or mode changes.
9. Preserve pronunciation, detail modal, image editing, deletion, and
   re-analysis access after the answer is revealed.
10. Add explicit accessibility labels, hints, selected state, and logical focus
    order for every option and assessment button.
11. Keep visible controls for flip and assessment. Do not make gestures the
    only discovery path.
12. Record response time in the in-memory `ReviewAssessment` contract, but do
    not use it for scheduling or promotion in this work package.

Required tests:

- Recognition never includes duplicate or identical answers.
- Recognition falls back safely when the vocabulary cannot supply distractors.
- A wrong choice cannot be rated as successful.
- A correct choice does not advance before an explicit SRS assessment.
- Dutch Production includes `de` or `het` in the revealed answer when known.
- Missing translations fall back without crashing.
- Switching words and modes clears selected options and flip state.
- Existing audio, image, delete, detail, and re-analysis actions remain usable.
- Light and dark theme snapshots cover all three modes.
- Maestro covers starting and completing one session in every mode.

Done criteria:

- The user can explicitly start and complete all three modes.
- SM-2 behavior remains unchanged for equivalent assessments.
- Legacy Meaning Recall remains available and stable.
- No database migration is required.
- All quality gates pass with no new warnings.

### WP0.3 Review Insights And Difficult Words V1

Status: `COMMITTED`
Priority: P0
Estimated size: M
Depends on: WP0.1
Suggested branch: `feature/review-insights`

Purpose:

Make the existing scheduling data understandable without introducing event
history or a chart dependency.

Primary files:

- `src/app/insights.tsx` (new)
- `src/constants/Routes.ts`
- `src/components/StatsCard.tsx`
- `src/components/ReviewInsights/` (new)
- `src/utils/reviewInsights.ts` (new)
- `src/constants/ReviewConstants.ts`
- adjacent Jest and snapshot tests

V1 metrics:

- Due today.
- Due on each of the next seven local calendar days.
- Overdue.
- Current interval distribution.
- Current easiness-factor distribution.
- Difficult words.
- Mastered words using one documented definition.

Difficulty rule for V1:

- A word is difficult when `easiness_factor <= 2.1`.
- Keep the threshold in `ReviewConstants`.
- The threshold is a transparent heuristic, not an AI classification.
- The Difficult Review action includes only difficult words currently due.
- Viewing or manually browsing a non-due difficult word must not change SRS.

Plan:

1. Add pure aggregation functions for forecast and difficulty.
2. Add an Insights screen reachable from the existing Stats card.
3. Render the seven-day forecast with themed `View` bars and accessible text
   equivalents.
4. Add a difficult-word list with links to the existing word detail modal.
5. Add a `Review Due Difficult Words` action using WP0.1 scope filtering.
6. Make empty, loading, and stale-sync states explicit.
7. Use local calendar dates consistently and test DST transitions.
8. Do not infer retention rate or answer history from aggregate word fields.

Required tests:

- Forecast buckets every word into exactly one correct day.
- Overdue and today are not double-counted.
- DST and timezone boundary fixtures remain stable.
- New words at easiness factor `2.5` are not marked difficult.
- Difficult scope never includes a non-due word.
- Empty states and accessible chart summaries render correctly.
- Stats card navigation works in light and dark themes.

Done criteria:

- Forecast totals match the underlying word list.
- Difficult-word filtering is deterministic and documented.
- No new chart library is installed.
- All quality gates pass.

### Validation Gate A: Manual Modes And Insights

Status: `PROCEED`
Priority: P0
Depends on: WP0.2 and WP0.3

Do not begin automatic per-word promotion until the user validates the manual
experience.

Validation checklist:

- Use every mode with new, mature, noun, verb, expression, and separable-verb
  cards.
- Confirm that Recognition distractors are plausible but unambiguous.
- Confirm that Dutch Production prompts are understandable in both English and
  Russian data cases.
- Confirm that users understand the difference between mode and SRS rating.
- Compare seven-day forecast totals with direct `next_review_date` counts.
- Confirm that Difficult Review is useful and does not encourage reviewing
  non-due cards.
- Collect specific UX issues before changing database schema.

Exit decision:

- `PROCEED`: continue to WP1.1.
- `ADJUST`: revise WP0.2 or WP0.3 and repeat validation.
- `STOP AUTOMATION`: keep manual modes and skip WP1.1/WP1.2.

### WP1.1 Review Event History Foundation

Status: `DONE`
Priority: P1
Estimated size: XL
Depends on: Validation Gate A = `PROCEED`
Suggested branch: `feature/review-event-history`

Purpose:

Create an auditable, offline-first history for retention analytics and later
automatic mode progression. Do not overload Sentry with product analytics.

Data model proposal:

- `event_id`: client-generated UUID, primary key.
- `user_id`: owner, protected by RLS.
- `word_id`: reviewed word.
- `assessment`: Again, Hard, Good, or Easy.
- `review_mode`: mode used for the prompt.
- `answered_correctly`: nullable for self-evaluated modes.
- `response_time_ms`: nullable, bounded integer.
- `previous_interval_days` and `next_interval_days`.
- `previous_easiness_factor` and `next_easiness_factor`.
- `reviewed_at`: user-action timestamp.
- `created_at`: server/default creation timestamp.

Privacy and storage rules:

- Do not duplicate word text, translations, examples, or audio URLs in events.
- Events are user-owned learning data and must use RLS.
- The table is append-only from the application perspective.
- Account deletion must remove events.
- Word deletion behavior must be explicit before migration: cascade or retain a
  de-identified event. Preferred default is cascade.

Primary files:

- new Supabase migration for `review_events`
- `src/db/schema.ts`
- `src/db/initDB.ts`
- `src/db/reviewEventRepository.ts` (new)
- `src/types/ReviewTypes.ts`
- `src/services/syncManager.ts`
- `src/stores/actions/wordActions.ts`
- repository, sync, migration, and action tests

Plan:

1. Finalize the additive remote and local schemas.
2. Add local append and paginated query APIs.
3. Make the local SRS update and local event insert atomic.
4. Use idempotent client UUIDs so retries cannot duplicate an event.
5. Add insert-only push and deterministic paginated pull to SyncManager.
6. Do not advance the event cursor until the full local apply succeeds.
7. Add server-issued or acknowledged timestamps without trusting device time
   for sync ordering.
8. Backfill nothing. Historical analytics begins at migration time.
9. Add a bounded query API for recent events per user and per word.

Required tests:

- SRS update and event insert either both succeed or both roll back locally.
- Retried pushes are idempotent.
- Offline events synchronize after reconnect.
- Pagination and equal-timestamp tie-breaking do not skip events.
- A failed local apply does not advance the cursor.
- RLS prevents cross-user reads and inserts.
- Account and word deletion follow the chosen cascade policy.
- Existing word/progress synchronization remains unchanged.

Done criteria:

- Every new assessment creates exactly one matching review event.
- Offline and multi-device synchronization is deterministic.
- No card content is duplicated into event history.
- Existing SM-2 and review session behavior remains stable.
- Migration verification and all project quality gates pass.

### WP1.2 Automatic Per-Word Mode Progression

Status: `COMMITTED`
Priority: P1
Estimated size: M
Depends on: WP1.1
Suggested branch: `feature/adaptive-review-modes`

Purpose:

Automatically choose a learning mode from recent evidence while allowing users
to continue selecting a manual session mode.

Initial policy:

- Start new words in Recognition.
- Promote Recognition to Meaning Recall after three successful due reviews in
  Recognition with no `Again` among those reviews.
- Promote Meaning Recall to Dutch Production after three successful due
  reviews in Meaning Recall with no `Again` among those reviews.
- Demote one mode after two `Again` assessments within the last three reviews
  in the current mode.
- Do not consider response time in V1.
- Never change the SM-2 interval solely because a mode changes.

Plan:

1. Add a pure `reviewModePolicy` with centralized thresholds.
2. Add an `adaptive` session option that resolves the mode per word.
3. Keep explicit manual modes unchanged and available.
4. Store only a manual per-word override if a real user need is confirmed;
   otherwise derive the mode from event history.
5. Explain promotion or demotion in the word progress UI.
6. Add a setting to disable adaptive modes without losing review history.

Required tests:

- Every promotion and demotion boundary.
- Mixed modes never count toward the wrong policy window.
- Manual sessions do not silently overwrite adaptive state.
- Response time has no policy effect.
- Missing or partial event history defaults safely to Recognition.
- Imported words start with no inherited learner progression.

Done criteria:

- Adaptive mode selection is deterministic and explainable.
- Users can select manual modes at any time.
- Mode changes do not alter the SM-2 schedule.
- All quality gates pass.

Implementation completed on 2026-08-29:

- Added a pure, deterministic `reviewModePolicy` that replays up to 100 recent
  events per word and centralizes promotion and demotion thresholds.
- Kept `ReviewMode` limited to concrete prompt modes and introduced a separate
  `ReviewSessionMode` for the `adaptive` session option.
- Added one bounded SQLite window query for all words in a session, chunked to
  stay below the SQLite bind-variable limit.
- Adaptive decisions are derived once when a session starts and remain stable
  for that session. Manual sessions do not query or persist adaptive state.
- Added the Adaptive selector option, per-word explanations, a persisted
  setting that can disable Adaptive without deleting history, and a scrollable
  selector for compact screens and large text.
- Verified every promotion and demotion boundary, mixed-mode isolation,
  response-time independence, safe defaults, manual session behavior, and the
  concrete mode written by Adaptive assessments.
- Validation passed: build and test TypeScript checks, ESLint, Prettier, 62 Jest
  suites with 926 tests, and an iOS 26.5 Simulator smoke-check covering the
  setting, manual fallback, Adaptive selection, Recognition resolution, and
  the on-screen explanation.

### WP1.3 Official Dutch A1 Starter Pack

Status: `READY FOR USER COMMIT`
Priority: P1
Estimated size: M
Depends on: WP0.2
Suggested branch: `feature/dutch-a1-starter-pack`

Purpose:

Give a new user a useful first review session without weakening the rich card
model or depending on competitor content.

Content rules:

- Start with one pack of approximately 50-100 high-value A1 words and
  expressions.
- Include English translations and Russian translations where reviewed.
- Include correct articles, plurals, separable parts, fixed prepositions, and
  register where applicable.
- Every entry must receive documented language review before release; an
  owner-authorized internal review is allowed when its limitations are recorded
  and it is not represented as independent native-speaker certification.
- Record source/provenance and license notes in the pack manifest.
- Do not copy Memorila, Memrise, Anki community decks, or other copyrighted
  decks without explicit compatible licensing.

Primary files:

- `src/assets/starter-packs/dutch-a1.json` (new)
- `src/types/StarterPackTypes.ts` (new)
- `src/services/starterPackService.ts` (new)
- starter-pack preview/import UI
- reuse `useImportSelection` and semantic duplicate checks where practical
- adjacent tests and Maestro flow

Plan:

1. Define and validate a versioned starter-pack manifest.
2. Reuse the existing import preview, selection, target collection, and
   duplicate behavior instead of building a second importer.
3. Reset all imported SRS/progression fields for the current user.
4. Allow partial import and clear duplicate explanations.
5. Make the pack available offline after app installation.
6. Do not auto-import content without an explicit user action.
7. Add a first-review call to action after successful import.

Required tests:

- Manifest validation rejects malformed linguistic data.
- Import resets progress and ownership fields.
- Semantic duplicates are skipped or clearly selectable according to the
  existing import contract.
- Partial selection imports only selected entries.
- Repeated import is idempotent from the user's perspective.
- Offline import works.
- Light/dark snapshots and Maestro cover preview through first review.

Done criteria:

- A new user can import the pack and start reviewing without manual word entry.
- Content has documented language review and provenance.
- Existing collection import remains unchanged.
- All quality gates pass.

Implementation notes (2026-08-29):

- Added a versioned 60-entry Dutch A1 snapshot curated from 1,917 unique
  semantic cards in the existing project library, with provenance, license,
  runtime validation, and an explicit content-review status.
- Added an offline-first preview/import flow with partial selection, semantic
  duplicate filtering shared with regular collection imports, reset ownership
  and SRS fields, a sticky import action, and a first-review call to action.
- Production import was disabled while `content_review.status` was `pending`;
  the reviewed `0.2.0` release now enables the offline import in production.
- Added unit, hook, snapshot, and Maestro coverage. The iOS 26.5 Simulator flow
  verifies preview, one-card partial import, Review launch, persistence after an
  app restart, and cleanup with successful Supabase tombstone synchronization.
- Fixed the sync payload contract discovered during simulator QA by mapping a
  missing local `tts_url` to the remote schema's required empty-string value.

Validation gate:

- The project owner authorized the documented internal-review exception because
  an external Dutch reviewer was unavailable.
- All 60 entries were checked using
  `docs/content/dutch-a1-starter-pack-review.md`; material corrections and the
  non-native-certification limitation are recorded there.
- Manifest `0.2.0` records the stable review identifier and timestamp, and an
  integrity digest prevents later database changes from silently replacing the
  approved content.
- WP1.3 is ready for the user-owned commit. Start WP1.4 only after that commit.

### WP1.4 Batch Quick Capture

Status: `TODO`
Priority: P1
Estimated size: L
Depends on: WP1.3
Suggested branch: `feature/batch-word-capture`

Purpose:

Allow users to capture multiple Dutch words quickly while retaining the
existing AI review-before-save workflow.

Accepted input:

- One Dutch word or expression per line.
- Optional `dutch ; translation` hint.
- Blank lines and duplicate lines are ignored.
- Enforce a documented batch-size limit before any network calls.

Plan:

1. Add a pure parser with line-level validation and error reporting.
2. Add a persistent local capture queue so the list survives app restarts.
3. Process AI analysis sequentially by default to control rate, cost, and UI
   state.
4. Check local and remote semantic duplicates before analysis when possible.
5. Treat a supplied translation as a hint, not trusted final linguistic data.
6. Require review before each analyzed word is saved.
7. Support pause, retry, skip, and cancel without losing completed items.
8. Keep raw queued words local until they are explicitly analyzed.
9. Make offline state explicit and resume when connectivity returns.

Required tests:

- Parser handles supported syntax, whitespace, duplicates, and malformed rows.
- Queue survives restart and resumes deterministically.
- Network loss does not mark pending items as failed permanently.
- Duplicate words are not re-analyzed unnecessarily.
- Cancel does not save unreviewed words.
- Partial completion can resume without duplicating saved words.
- Rate-limit and AI errors remain isolated to the affected item.

Done criteria:

- A multi-line list can be captured and processed safely.
- No item is silently saved or dropped.
- AI cost and request concurrency remain bounded.
- All quality gates pass.

### WP2.1 Audio Review MVP

Status: `TODO`
Priority: P2
Estimated size: L
Depends on: WP0.2 and Validation Gate A
Suggested branch: `feature/audio-review-mode`

Purpose:

Provide an audio-focused, low-visual-attention review flow for walking,
commuting, household tasks, and accessibility.

MVP limits:

- Foreground use only.
- No lock-screen controls.
- No background playback promise.
- No automatic speech recognition.
- Visible buttons remain available alongside gestures.

Documentation checkpoint before implementation:

- Fetch current Expo `expo-audio` documentation through Context7.
- Fetch current React Native Gesture Handler documentation through Context7.
- Verify audio session, silent-mode, interruption, Bluetooth, AppState, and
  platform behavior against the installed versions.

Primary files:

- `src/app/audio-review.tsx` (new, preferred over overloading the current card)
- `src/hooks/useAudioReviewSession.ts` (new)
- `src/contexts/AudioContext.tsx`
- `src/types/ReviewTypes.ts`
- `src/constants/Routes.ts`
- audio and gesture tests
- new Maestro flow

Interaction proposal:

- Play the Dutch prompt automatically.
- Single tap: reveal and play the answer.
- Double tap: replay the current audio.
- Visible buttons: reveal, replay, Again, Good, pause, and exit.
- Optional swipe actions only after conflict testing.
- Haptics confirm reveal and assessment.

Gesture constraints:

- The project uses React Native Gesture Handler 2.x builder APIs.
- Memoize every gesture and composition with `useMemo`.
- Use `Gesture.Exclusive(doubleTap, singleTap)` where both share one surface.
- Never reuse one gesture instance across multiple detectors.
- Schedule all JS-thread actions through `scheduleOnRN`.
- Preserve the current root `GestureHandlerRootView` contract.
- Do not mix competing React Native touch handlers and RNGH handlers in the
  same interaction subtree.

Plan:

1. Implement the mode as a separate route with a simplified layout.
2. Reuse the WP0.1 session configuration and existing SRS actions.
3. Define a cancellable audio sequence for prompt, reveal, and replay.
4. Stop or pause audio on exit, interruption, route loss, and unmount.
5. Prevent overlapping players and repeated rapid assessments.
6. Add an explicit silent-mode explanation only if current platform behavior
   requires it after documentation verification.
7. Keep screen dimming optional and restore the previous state on exit.
8. Add VoiceOver/TalkBack labels, announcements, and focus behavior.
9. Test headphones, Bluetooth route changes, phone interruptions, and rapid
   background/foreground transitions on real devices.

Required tests:

- Audio sequence order and cancellation.
- No playback continues after exit or unmount.
- Single tap and double tap do not both execute.
- Assessment cannot run twice for one card.
- Visible controls complete the flow without gestures.
- AppState and interruption handling leave a recoverable session.
- iOS and Android Maestro smoke flows.

Done criteria:

- A session can be completed with minimal visual attention.
- Audio lifecycle is leak-free and interruption-safe.
- Every gesture action has a visible accessible alternative.
- All quality gates and real-device checks pass.

### WP2.2 Dutch Usage And Nuance Explanations

Status: `TODO`
Priority: P2
Estimated size: L
Depends on: WP0.2
Suggested branch: `feature/dutch-usage-notes`

Purpose:

Explain distinctions between easily confused Dutch words without bloating the
front of the flashcard.

Plan:

1. Define a structured type for usage notes and word contrasts.
2. Decide on an additive JSON column rather than overloading free-form
   `analysis_notes`.
3. Extend the Gemini structured response and shared analysis cache version.
4. Keep old cached analyses backward compatible.
5. Render a compact `Usage & Nuance` section after the answer is revealed and
   in Word Detail.
6. Include contrast pairs, short explanations, and reviewed examples.
7. Label AI-generated language guidance and keep force re-analysis available.
8. Never use nuance text as the source of SRS correctness.

Required tests:

- Structured response validation and malformed-AI fallback.
- Backward compatibility with cached words lacking the new field.
- Local/remote serialization and sync.
- Word detail and review rendering in both themes.
- Long text, missing contrasts, and multilingual translation cases.
- Edge Function tests for prompt and output validation.

Done criteria:

- Existing cards continue to render without migration-time backfill.
- New analyses can show concise, structured usage guidance.
- AI failure never blocks saving or reviewing a word.
- All app, Edge Function, and migration quality gates pass.

## Deferred Ideas

### Social Progress And Community Journey

Status: `DEFERRED`

Reason:

- Requires active-user density to avoid an empty experience.
- Introduces profile discovery, privacy, blocking, reporting, and moderation
  requirements.
- Existing collection sharing provides more immediate value.

Revisit only after manual/adaptive modes show sustained usage and the product
has a clear privacy model for social visibility.

### Guest Mode

Status: `DEFERRED`

Reason:

- Offline local data already exists, but reliable guest-to-account ownership
  migration affects every user-owned table and conflict path.
- Validate authentication drop-off before adding this complexity.

### Monetization, Kids Version, Multi-Language Expansion, Mascot

Status: `DEFERRED`

These are product-strategy decisions and are not dependencies for improving
Dutch retrieval practice.

## Cross-Cutting Requirements

### Architecture

- Preserve command/query separation.
- Keep pure selection, aggregation, distractor, and policy logic outside UI
  components.
- Keep local storage as the first write target for user learning actions.
- Treat Supabase synchronization as retryable and idempotent.
- Use explicit interfaces and discriminated unions; never use `any`.
- Avoid new dependencies unless the work package explicitly proves the need.

### UI And Accessibility

- Use theme constants only; no hardcoded colors.
- Support light and dark themes in every new screen and state.
- Keep touch targets at least 44 points.
- Do not encode meaning by color alone.
- Provide labels, hints, selected state, focus order, and text alternatives for
  charts and gestures.
- Respect reduced motion/transparency settings where applicable.
- Avoid hidden gesture-only actions.

### Review Correctness

- Never mutate SRS from passive browsing or unscheduled practice.
- Never submit an assessment before the answer is revealed, except the defined
  Recognition wrong-answer path.
- Keep one assessment per card attempt.
- Do not count imported progression from another user.
- Do not use response speed for promotion until separately validated.

### Privacy And Security

- Review events contain identifiers and learning metadata only, not card text.
- Protect every remote user-owned table with RLS.
- Do not send behavioral telemetry to Sentry.
- Keep logs free of translations, raw prompts, email, tokens, and user-entered
  batch content unless a separately reviewed diagnostic path requires it.
- Ensure account deletion covers every new remote table.

### Documentation

- Update `README.md` only when a feature is released.
- Update `docs/SRS_ALGORITHM.md` when mode/SRS separation becomes user-visible.
- Add user-facing help for mode selection, difficulty heuristic, and Audio
  Review before release.
- Fetch current third-party documentation through Context7 before touching a
  library, SDK, API, CLI, or cloud-service integration.

## Quality Gates For Every Work Package

Minimum commands:

```bash
npm run typecheck
npm run typecheck:test
npm run lint:ci
npm run format:check
npm run test:ci
git diff --check
```

Additional gates when applicable:

- `npm run test:edge` for Edge Function changes.
- Project-approved Supabase migration validation for schema changes.
- `npx expo-doctor` if dependencies or native configuration change.
- Targeted Maestro flows for user-visible review, import, or audio changes.
- Real iOS and Android checks for audio, gestures, accessibility, and lifecycle
  behavior.

Every bug fixed during a work package requires a regression test near the
affected implementation.

## Work Package Handoff Protocol

1. Work on one package at a time.
2. Start from updated `main` and create the suggested feature branch or another
   compliant `feature/<description>` branch.
3. Do not start the next package while the current package is `IN PROGRESS`.
4. After verification, mark the package `READY FOR USER COMMIT`.
5. Provide the user with:
   - one short Conventional Commit message in English;
   - what changed;
   - why it changed;
   - exact verification results;
   - any remaining manual checks.
6. The user owns commits unless they explicitly request otherwise.
7. Resume only after the user confirms the commit or asks to continue.
8. Stop at every `VALIDATION REQUIRED` gate until the user provides the exit
   decision.

## Recommended Commit Sequence

```text
feat: add typed review session configuration
feat: add progressive review modes
feat: add review insights and difficult words
feat: add offline review event history
feat: add adaptive review mode progression
feat: add Dutch A1 starter pack
feat: add batch word capture
feat: add audio-focused review mode
feat: add Dutch usage explanations
```

## Immediate Next Action

After this planning document is committed and merged, start WP0.1 on a fresh
branch from updated `main`. Do not implement WP0.2 or any database migration in
the same work package.
