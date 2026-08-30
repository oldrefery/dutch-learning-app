# De Woordenaar Web Version Implementation Plan

**Status:** Phase 5 complete — Phase 6 next
**Date:** 2026-08-30  
**Production domain:** `https://woordenaar.app`  
**Mobile application:** Expo / React Native  
**Web application:** Recommended: Next.js App Router / React / TypeScript  
**Backend:** Existing Supabase project

## Implementation progress — 2026-08-30

Work started on `feature/web-backend-stabilization`.

Completed locally:

- fixed atomic AI cache usage increments through a UUID-based RPC;
- aligned shared imports with the `usage_notes` word contract;
- fixed collection-scoped review startup;
- added explicit `full_access` authorization to AI and image Edge Functions;
- added durable Postgres-backed quotas: 10 Gemini cache-miss/force-refresh requests per minute and 30 image-search requests per minute per user;
- aligned mobile collection and review UI with the server authorization policy;
- added Jest and Deno regression coverage;
- verified the linked Supabase project as `Dutch Learning App` (`josxavjbcjbcjgulwcyy`);
- generated the deployed database contract into `packages/supabase-contracts/src/database.generated.ts`, while keeping the existing mobile domain models in `src/types/database.ts` separate;
- configured npm workspaces without moving the Expo application;
- created the Next.js 16 App Router application in `apps/web`;
- established `@woordenaar/domain` and `@woordenaar/supabase-contracts` package boundaries;
- verified the web workspace with ESLint, TypeScript, and a production Webpack build;
- added typed Supabase browser/server clients and SSR cookie refresh through Next.js 16 `proxy.ts`;
- added protected `/app` routing with server-side user verification and fail-closed access-level handling;
- added email/password signup and login, Google and Apple web OAuth initiation, confirmation and OAuth callbacks, password recovery, password update, and logout;
- added a neutral responsive authentication UI and protected application shell that can be replaced after design handoff;
- added regression coverage for safe post-auth redirects.
- added the collection dashboard with aggregate word, mastered, due, and new-word statistics;
- added collection creation, detail, search, rename, and soft-delete-compatible collection removal flows;
- added an owned-word detail route with translations, grammar, conjugation, examples, usage guidance, related words, analysis notes, learning progress, image, and pronunciation playback;
- added ownership-scoped word move, mobile-compatible SRS reset, and tombstone delete actions against the shared Supabase records;
- added a full-access Add Word workflow backed by the existing authenticated `gemini-handler`, including strict response validation, cache/fresh metadata, complete preview, semantic duplicate detection, collection selection, and server-authorized persistence;
- added paginated image search and selection through the existing quota-protected `get-multiple-images` Edge Function for both new and saved words;
- added force-refresh reanalysis that preserves identifiers and SRS progress and mirrors the mobile semantic-key collision fallback;
- added unit coverage for collection logic, word JSON normalization, media URL validation, and reset/delete mutation helpers;
- verified the Phase 3 slice with the full Jest suite, web lint and type checking, a production Next.js build, and a read-only Chrome smoke test.
- completed Phase 4 learning workflows with default, adaptive, and audio review sessions, atomic SRS and review-event persistence, scoped review entry points, and session completion UX;
- added the shared `@woordenaar/content` package as the single source for the reviewed 60-card Dutch A1 starter pack;
- added the Phase 5 web starter-pack flow with approved-manifest validation, semantic duplicate detection, selectable cards, owned target collection selection, full-access collection creation, read-only import into existing collections, RPC-backed persistence, and review continuation;
- verified the starter-pack slice with focused mobile and web tests, mobile and web type checking, web lint, a production Next.js build, and responsive Chrome smoke testing without mutating user data.
- moved the portable batch-capture parser and contracts into `@woordenaar/domain` while preserving the existing mobile imports through compatibility re-exports;
- added the full-access Phase 5 web batch-capture flow with a 30-item limit, optional hints, normalized input deduplication, user-scoped persistent queue recovery, sequential AI analysis, pre-analysis and semantic duplicate checks, pause/resume/retry/skip/cancel controls, and mandatory manual approval before persistence;
- verified the batch-capture slice with shared mobile and web regression tests, mobile/domain/web type checking, web lint, a production Next.js build, and responsive Chrome smoke testing without creating a queue, consuming AI quota, or writing user data.
- completed Phase 5 collection sharing with owner-scoped publish and stop-sharing actions, stable `woordenaar.app/share/{token}` links, copy-link UI, and the same authenticated user header on shared routes;
- added authenticated shared-link continuation, RLS-backed collection preview, semantic duplicate marking, selectable words, owned target collection selection, and read-only-compatible imports through the existing `import_words_to_collection` RPC;
- aligned mobile-generated browser share links with `woordenaar.app` and centralized semantic word keys in `@woordenaar/domain` for mobile, starter-pack, and shared-import parity;
- verified the sharing/import slice with focused mobile and web tests, mobile/domain/web type checking, web lint, a production Next.js build, and read-only responsive Chrome smoke testing without publishing or importing user data.

Completed remotely:

- applied migrations `20260830100000`, `20260830101000`, and `20260830102000` to the linked production project;
- deployed `gemini-handler` version 129 and `get-multiple-images` version 34;
- regenerated `packages/supabase-contracts/src/database.generated.ts` from the deployed schema with the UUID cache RPC and quota contract included;
- created the Vercel project `woordenaar-web` with Root Directory `apps/web`, Next.js framework detection, and a web-safe install command;
- deployed and verified the Phase 1 foundation preview;
- deployed the Phase 2 auth foundation preview at `https://woordenaar-iwsmqjp7f-rustems-projects.vercel.app`.

Pending before the generated contract types the legacy mobile client directly:

- add explicit database-to-domain mappers before typing the legacy mobile Supabase client, because deployed database rows contain nullable fields while the mobile domain models intentionally expose normalized non-null values.

Pending external Phase 2 configuration:

- add Supabase Auth redirect allow-list entries for localhost, Vercel preview URLs, and the exact production callback URL;
- configure Google and Apple web OAuth credentials; Apple requires a Service ID and verified web domain;
- connect the Vercel project to GitHub after explicit repository-access approval so pushes create previews automatically;
- attach `woordenaar.app` only during Phase 8 release preparation.

## 1. Executive decision

Build the web application in the same Git repository as the mobile application.

Use a gradual monorepo transition instead of moving the existing Expo application immediately. The first web milestone should keep the mobile application at the repository root, add the web application under `apps/web`, and introduce framework-independent shared packages under `packages`.

This approach provides the main monorepo benefits without destabilizing the current Expo, EAS, native build, Maestro, and deployment workflows.

The recommended initial structure is:

```text
DutchLearningApp/
├── apps/
│   └── web/                       # Next.js web application
├── packages/
│   ├── domain/                    # Pure TypeScript domain logic
│   ├── supabase-contracts/        # Generated DB types and shared DTOs
│   ├── content/                   # Starter pack and learning content
│   └── config/                    # Optional shared TS/ESLint config
├── src/                           # Existing Expo application, unchanged initially
├── supabase/                      # Shared migrations and Edge Functions
├── docs/
├── package.json                   # Existing mobile package and workspace root
└── app.base.json                  # Existing Expo configuration
```

After the web application is stable, a separate migration may move the Expo application to `apps/mobile`. That migration is optional and must have its own verification plan because it affects EAS working directories, native folders, scripts, patches, CI, and local developer commands.

## 2. Why the same repository is preferred

The applications are two clients for the same product and the same user data. They share:

- Supabase authentication and authorization rules;
- the Postgres schema, migrations, triggers, and RLS policies;
- Supabase Edge Functions;
- word and collection contracts;
- semantic duplicate rules;
- the SRS algorithm;
- review-mode selection and adaptive-review policy;
- starter-pack content;
- import and sharing contracts;
- validation and normalization rules;
- release and operational documentation.

Keeping these concerns in one repository makes a backend contract change atomic: the migration, Edge Function, mobile adaptation, web adaptation, generated types, and tests can be reviewed together.

Separate repositories would be justified only if the web and mobile products had different teams, independent release ownership, separate backends, or strict access boundaries. None of those conditions currently apply.

## 3. Monorepo boundaries

### 3.1 Code that should be shared

`packages/domain` should contain only portable TypeScript with no React Native, Expo, Next.js, DOM, or storage imports.

Initial candidates:

- SRS calculation;
- review constants and assessment types;
- adaptive review policy;
- review-word selection rules;
- semantic word-key normalization;
- duplicate detection;
- date and due-word rules with an explicit time-zone contract;
- word analysis DTOs;
- import-selection logic;
- starter-pack validation;
- data formatting that is not UI-specific.

`packages/supabase-contracts` should contain:

- generated Supabase database types;
- Edge Function request and response contracts;
- RPC argument and result contracts;
- shared validation schemas when introduced;
- database-to-domain mappers that do not depend on a platform client.

`packages/content` should contain:

- the Dutch A1 starter pack;
- its manifest and version;
- learning-guide content that is intended to be identical across clients.

### 3.2 Code that should not be shared initially

Do not attempt to share UI components between React Native and Next.js during the first web version.

Keep these platform-specific:

- navigation;
- layouts and visual components;
- gestures and haptics;
- audio playback adapters;
- authentication session storage;
- SQLite and IndexedDB repositories;
- network-state integrations;
- Expo Updates and web/PWA update UX;
- Sentry platform initialization.

Premature UI sharing would constrain the future web design and introduce complex React Native Web compatibility work without meaningful product value.

### 3.3 Package manager and build orchestration

Keep npm as the package manager during the initial transition because the repository already pins npm. Add npm workspaces for `apps/*` and `packages/*`.

Turborepo may be introduced for task orchestration and caching once at least the web app and one shared package exist. It is useful but not required to scaffold the first web app.

Applications must consume shared packages through their public package exports. They must not import files using relative paths that reach into another workspace.

## 4. Product scope

The web version must provide functional parity with the mobile product:

- account registration, login, OAuth, password recovery, logout, and deletion;
- access-level handling;
- collection management;
- full word-card presentation;
- AI word analysis and reanalysis;
- image selection;
- pronunciation;
- batch capture;
- starter-pack import;
- collection sharing and import;
- all review modes;
- adaptive review;
- audio review;
- SRS updates and review-event history;
- insights;
- recent analysis history;
- settings and sync visibility;
- light and dark themes;
- responsive mobile, tablet, and desktop layouts.

Visual parity with the current mobile UI is not required. A new design will be supplied separately.

## 5. Current backend contract

### 5.1 Supabase tables

| Table                 | Responsibility                                     |
| --------------------- | -------------------------------------------------- |
| `auth.users`          | Supabase identity and sessions                     |
| `public.users`        | Application profile                                |
| `collections`         | User collections and sharing state                 |
| `words`               | Word content and current SRS state                 |
| `word_analysis_cache` | Shared AI analysis cache                           |
| `pre_approved_emails` | Access whitelist                                   |
| `user_access_levels`  | `read_only` or `full_access` access                |
| `user_progress`       | Additional progress stream; role must be clarified |
| `review_events`       | Immutable review history                           |

### 5.2 RPC functions

The client-facing RPC required for parity is:

- `import_words_to_collection(p_collection_id, p_words)`.

It performs an owner check, imports shared words using a security-definer implementation, supports read-only users, and skips semantic duplicates.

Other database functions support access assignment, cache maintenance, triggers, and administrative workflows. They should not be treated as public client APIs without an explicit contract review.

### 5.3 Edge Functions

| Edge Function         | Web usage                                           |
| --------------------- | --------------------------------------------------- |
| `gemini-handler`      | Analyze or reanalyze a Dutch word or expression     |
| `get-multiple-images` | Find alternative word images                        |
| `delete-account`      | Verify the JWT and delete the authenticated account |

All privileged keys remain in Supabase Edge Function secrets. The web browser receives only the Supabase URL and publishable/anon key.

### 5.4 External services

- Google Gemini for linguistic analysis;
- Unsplash for image search;
- Picsum as an image fallback;
- Google Translate TTS URL for current pronunciation playback;
- Sentry for error and release monitoring.

The application currently does not use Supabase Realtime or Supabase Storage.

## 6. Web information architecture

Recommended routes:

```text
/
/login
/signup
/forgot-password
/reset-password
/auth/callback
/app/collections
/app/collections/[collectionId]
/app/add
/app/batch-capture
/app/starter-pack
/app/review
/app/review/audio
/app/insights
/app/history
/app/settings
/share/[token]
```

`/share/[token]` should preserve the incoming destination through authentication and continue to import preview after login.

The initial public landing page may be minimal. Marketing pages are outside the functional-parity milestone unless explicitly added later.

## 7. Authentication architecture

Use Supabase Auth with a browser client for interactive client-side actions and a server-compatible client for session-aware rendering.

Required flows:

- email and password sign-up;
- email confirmation;
- email and password sign-in;
- Google OAuth;
- Apple web OAuth;
- forgot-password email;
- password recovery callback;
- logout;
- account deletion through the existing Edge Function.

Production redirect base:

```text
https://woordenaar.app/auth/callback
```

Supabase configuration must include production, Vercel preview, and localhost redirect URLs. The Apple web flow needs an Apple Service ID and verified web domain; it cannot reuse the native Expo Apple API directly.

## 8. Data-access architecture

### 8.1 Recommended first release: online-first

For the first web milestone, make Supabase the authoritative data source and use optimistic UI updates where appropriate.

Benefits:

- fastest path to feature parity;
- immediate cross-device visibility;
- less sync complexity;
- direct use of existing RLS;
- easier debugging before adding a second offline engine.

The repository layer must hide the data source from UI code so IndexedDB can be added later.

### 8.2 Full offline parity

If exact offline parity is required, add:

- IndexedDB storage;
- a persisted mutation outbox;
- entity sync statuses;
- incremental pull cursors;
- word and progress tombstones;
- review-event append-only synchronization;
- network and focus triggers;
- conflict and duplicate reconciliation;
- a service worker and PWA install support.

The current mobile sync protocol is the reference behavior, but its implementation should not be copied line-for-line because SQLite and IndexedDB have different transaction and query characteristics.

### 8.3 Cross-client behavior

Web writes go to the same Supabase tables. Mobile clients receive them on their next sync. Mobile offline writes become visible on web after mobile synchronization.

Realtime is not required for the first release. It may be considered later for cross-tab refresh or active multi-device sessions.

## 9. Functional implementation requirements

### 9.1 Collections

- display total, mastered, due, and new counts;
- create, rename, and delete where access permits;
- prevent invalid deletion scenarios;
- search words inside a collection;
- move, delete, reset, and reanalyze words;
- open review scoped to the selected collection;
- publish, copy link, and stop sharing.

### 9.2 Word analysis

- validate and normalize Dutch input;
- call `gemini-handler`;
- display cache/fresh-analysis state;
- display the complete linguistic analysis;
- detect semantic duplicates;
- choose a target collection;
- select or replace the image;
- play pronunciation;
- save and reanalyze without losing SRS progress.

### 9.3 Batch capture

- accept up to 30 entries;
- support an optional hint after a semicolon;
- validate limits and duplicates;
- persist queue progress;
- pause, resume, retry, skip, cancel, and recover;
- require manual review before saving each analyzed entry.

### 9.4 Starter pack

- show the bundled versioned A1 pack;
- allow selection and deselection;
- detect existing words;
- choose or create a collection;
- import selected words;
- start a review session from the result.

### 9.5 Shared collection import

- resolve the share token;
- show collection metadata and word count;
- require authentication under the current RLS model;
- allow a target collection to be selected;
- mark duplicates;
- import selected words through the RPC;
- support read-only users according to the existing policy.

### 9.6 Review

Implement:

- Recognition;
- Meaning Recall;
- Dutch Production;
- Adaptive mode;
- all-due, collection-due, and difficult-due scopes;
- Again, Hard, Good, and Easy assessments;
- card flip and keyboard controls;
- previous and next navigation;
- pronunciation, image replacement, details, reanalysis, and deletion;
- session completion, restart, and mode change;
- atomic SRS and review-event persistence.

### 9.7 Audio review

- require an explicit user gesture to start the audio session;
- automatically play later prompts when browser policy permits;
- provide reveal, repeat, pause, resume, and replay controls;
- use Again and Good assessments;
- provide visible equivalents for every audio-only action.

### 9.8 Insights and history

- review forecast;
- interval and easiness distributions;
- difficult and mastered words;
- difficult-due review entry point;
- recent AI-analysis history;
- future-ready review-event history section.

## 10. Backend remediation before web feature development

### P0 — contract and correctness

1. Fix cache usage updates. The Edge Function currently calls `increment_usage`, while the database function is named `increment_cache_usage`, and an RPC result cannot be used directly as an update scalar.
2. Extend `import_words_to_collection` to copy `usage_notes` and verify every current word field.
3. Fix the mobile collection review action so it starts a `collection-due` session with the collection ID.
4. Enforce AI/image access and quotas inside Edge Functions. Hiding the Add Word UI is not an authorization boundary.
5. Generate authoritative TypeScript types from the deployed Supabase schema.

### P1 — policy decisions

1. Define starter-pack behavior for read-only users.
2. Decide whether shared collection previews are public or authenticated-only.
3. Decide whether unsharing rotates or invalidates share tokens permanently.
4. Define CORS rules for production, preview, and local origins.
5. Add user-level or account-level AI rate limiting.
6. Clarify whether `user_progress` remains part of the product contract or becomes legacy.

### P2 — scalability and durability

1. Add pagination for large collections and histories.
2. Decide whether selected images should be copied into managed storage.
3. Replace or provide a fallback for the current Google Translate TTS URL.
4. Add explicit analytics aggregation only if client-side calculations become expensive.

## 11. Vercel and domain configuration

Create one Vercel project whose Root Directory is `apps/web`.

Current preview project:

- project: `rustems-projects/woordenaar-web`;
- Root Directory: `apps/web`;
- framework: Next.js;
- install command: `npm install --ignore-scripts` so the root Expo `patch-package` lifecycle does not run in the web build;
- current auth preview: `https://woordenaar-iwsmqjp7f-rustems-projects.vercel.app`;
- Git integration: intentionally pending explicit approval.

Production configuration:

- domain: `woordenaar.app`;
- redirect: `www.woordenaar.app` to `woordenaar.app`;
- separate Development, Preview, and Production environment variables;
- Sentry web project or clearly separated web releases;
- deployment metadata for version and commit display.

Browser-safe variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SENTRY_DSN
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
UNSPLASH_ACCESS_KEY
```

Update all generated share URLs from the old Vercel host to:

```text
https://woordenaar.app/share/{token}
```

Vercel monorepo deployments should track changes in `apps/web` and any shared packages consumed by the web application.

## 12. Delivery phases

### Phase 0 — backend stabilization

Deliverables:

- all P0 remediation completed;
- deployed schema and generated types aligned;
- backend contract tests passing;
- production and staging/preview environment policy documented.

### Phase 1 — workspace foundation

Deliverables:

- npm workspaces configured;
- `apps/web` created;
- shared package boundaries established;
- existing mobile commands and EAS configuration unchanged;
- Vercel preview deployment working.

### Phase 2 — authentication and application shell

Deliverables:

- all auth flows;
- route protection;
- responsive shell and navigation;
- access-level handling;
- light and dark themes;
- error monitoring.

### Phase 3 — collections and word management

Deliverables:

- collection dashboard and details;
- word details;
- create, rename, delete, move, reset, and search flows;
- AI analysis, image selection, pronunciation, and reanalysis.

### Phase 4 — learning workflows

Deliverables:

- all review modes and scopes;
- adaptive review;
- SRS persistence;
- review events;
- audio review;
- session completion UX.

### Phase 5 — acquisition and import workflows

Deliverables:

- batch capture;
- starter pack;
- collection sharing;
- shared collection import;
- authentication continuation for shared links.

### Phase 6 — insights, settings, and operational parity

Deliverables:

- insights;
- history;
- settings;
- account deletion;
- sync and connectivity state;
- build/update information;
- accessibility review.

### Phase 7 — offline and PWA, if required

Deliverables:

- IndexedDB repository;
- persisted outbox;
- conflict handling;
- offline review;
- service worker;
- installable PWA;
- cross-client synchronization tests.

### Phase 8 — production release

Deliverables:

- `woordenaar.app` DNS and TLS active;
- OAuth providers verified on the production domain;
- security and rate-limit checks;
- mobile-to-web and web-to-mobile compatibility tests;
- performance budgets met;
- production monitoring and rollback plan.

## 13. Quality gates

Every phase should include:

- TypeScript type checking;
- linting and formatting;
- unit tests for shared domain logic;
- component tests for important states;
- integration tests against a safe Supabase environment;
- end-to-end tests for auth, add word, review, sharing, and account deletion;
- light and dark theme validation;
- desktop, tablet, and narrow mobile viewport validation;
- keyboard-only and screen-reader checks;
- confirmation that no service-role or provider secret appears in the browser bundle.

Critical cross-client tests:

1. Create a word on web, sync mobile, and review it on mobile.
2. Review a word offline on mobile, sync it, and verify the new SRS state on web.
3. Publish a collection on mobile and import it on web.
4. Publish a collection on web and import it on mobile.
5. Reanalyze on one client without losing progress on the other.
6. Delete a word offline and verify that tombstones prevent resurrection.

## 14. Decisions intentionally deferred until design handoff

- visual identity and brand expression;
- desktop navigation style;
- density of the collection and word layouts;
- use of illustrations or photography;
- animation language;
- exact landing-page scope;
- whether mobile and web should visually converge later.

These decisions do not block backend remediation, workspace setup, shared-domain extraction, or authentication architecture.

## 15. Related design brief

Use `docs/design/woordenaar-web-claude-design-brief.md` as the self-contained input for Claude Design or another design-generation workflow.
