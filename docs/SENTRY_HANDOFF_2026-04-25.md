# Sentry Handoff (2026-04-25)

## Scope

Continue the production Sentry remediation plan for `dutch-learning-app` without losing the current triage, research, and orchestration context.

## Repository And Branch State

- Repository: `/Users/devrush/code/pet/DutchLearningApp`
- Current branch: `feature/sentry-error-handling`
- Branch base: created from up-to-date `main` at commit `5309292`
- Current branch policy from the user: complete all plan items in the current branch if it is new and has not already been merged into `main`.
- Code changes made before this handoff: none.
- Documentation changes made by this handoff: this file.

## User Workflow Requirements

- Explain operational steps in Russian.
- Keep code, file content, commands, and logs in English.
- Do not fix code without explicit permission.
- Work through the plan one plan item at a time.
- Inside each plan item, run the full role pipeline from opening orchestration to closing orchestration.
- Stop after each completed plan item.
- At each stop:
  - explain what was done,
  - propose a one-line Conventional Commit message in English,
  - wait for explicit user permission before moving to the next plan item.
- Use internet/documentation checks where needed, and prefer official docs.
- Use Sentry read-only queries only.

## Orchestration Model

Use these logical roles inside each plan item:

1. Opening Orchestrator
2. Architect
3. Documentation Researcher
4. Code Explorer
5. Designer, only if UI/UX behavior is touched
6. Implementer, only after explicit permission for that plan item
7. Strict Reviewer
8. Quality Gate
9. Closing Orchestrator

Subagents are optional, not mandatory. Recommended usage:

- Keep Opening Orchestrator, Architect, Quality Gate, and Closing Orchestrator local.
- Use subagents only for bounded parallel work that does not block the next local step.
- Use explorer subagents for independent codebase questions.
- Use worker subagents only for disjoint implementation ownership if the user explicitly wants parallel implementation.

## Sentry Access Notes

Use the project-local Sentry workflow from `AGENTS.md`.

Important constraints:

- Environment must be `production`.
- Time range must be `14d`.
- Base URL is `https://us.sentry.io`.
- Set `SSL_CERT_FILE` from `certifi` before calling the Sentry API script.
- Release names may appear as both `dutch-learning-app` and `dutchlearningapp`; if release filtering misses data, cross-check with `dist:<build_number>`.

Reference command:

```bash
bash -lc 'set -a; source ./.env; source ./.env.local; set +a; export SSL_CERT_FILE="$(python3 -c "import certifi; print(certifi.where())")"; python3 "$HOME/.codex/skills/sentry/scripts/sentry_api.py" --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --base-url https://us.sentry.io list-issues --environment production --time-range 14d --limit 50 --query "is:unresolved"'
```

For deep dives:

```bash
python3 "$HOME/.codex/skills/sentry/scripts/sentry_api.py" --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --base-url https://us.sentry.io issue-detail <issue_id>
python3 "$HOME/.codex/skills/sentry/scripts/sentry_api.py" --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --base-url https://us.sentry.io issue-events <issue_id> --limit 3
```

## Current Sentry Snapshot

Query used:

- `is:unresolved`
- `environment=production`
- `time-range=14d`
- `limit=50`

Unresolved issues found:

1. `DUTCH-LEARNING-APP-1G`
   - Issue ID: `6919030033`
   - Title: `Error: JWT expired`
   - Level: `error`
   - 14d count: `13`
   - All-time count observed: `360`
   - User count: `1`
   - Latest event: `2026-04-25T07:47:13Z`
   - Release: `com.oldrefery.dutch-learning-app@1.12.1+76`
   - Dist: `76`
   - Platform details observed: iOS `26.3.1`, iPhone17,1, Hermes
   - Working hypothesis: likely auto-captured by Supabase Sentry integration with `errors: true`, without enough operation context.

2. `DUTCH-LEARNING-APP-3Z`
   - Issue ID: `7440788034`
   - Title: `ServerError: Invalid word input. Please provide a valid Dutch word.`
   - Level: `error`
   - 14d count: `1`
   - Latest event: `2026-04-25T07:47:34Z`
   - Operation: `analyzeWord`
   - Cause observed: Dutch multi-word idiom containing `/` is rejected by Edge Function validation.
   - Relevant server files:
     - `supabase/functions/gemini-handler/index.ts`
     - `supabase/functions/gemini-handler/geminiUtils.ts`
   - Relevant client file:
     - `src/lib/supabase.ts`
   - Working hypothesis: a client-side 400 validation case is wrapped as `ServerError`, making expected invalid input look like a high-priority server failure.

3. `DUTCH-LEARNING-APP-3Y`
   - Issue ID: `7405560278`
   - Title: `NetworkError: Internet not reachable`
   - Level: `warning`
   - 14d count: `1`
   - Latest event: `2026-04-12T07:17:06Z`
   - Operation: `analyzeWord`
   - Relevant files:
     - `src/utils/network.ts`
     - `src/lib/supabase.ts`
   - Working hypothesis: expected offline/no-internet state is captured as an exception; it should likely be converted to controlled UX plus breadcrumb/message-level telemetry.

## Observability Gap

Sentry events showed:

- `Source code was not found`
- `app:///main.jsbundle`

Relevant local scripts:

- `scripts/build-and-submit.sh`
- `scripts/upload-sourcemaps.sh`

Working hypothesis:

- Source maps are not consistently uploaded or not matching release/dist for the affected build.
- This should be handled as a separate plan item after the runtime error/noise fixes.

## Documentation Research Already Checked

Official or primary documentation already reviewed:

- Supabase auth sessions: `https://supabase.com/docs/guides/auth/sessions`
- Supabase JS auth session API: `https://supabase.com/docs/reference/javascript/auth-getsession`
- Supabase Edge Function error handling: `https://supabase.com/docs/guides/functions/error-handling`
- Supabase JS Edge Function invocation errors: `https://supabase.com/docs/reference/javascript/functions-invoke`
- Supabase Sentry monitoring: `https://supabase.com/docs/guides/functions/sentry-monitoring`
- Sentry React Native filtering: `https://docs.sentry.io/platforms/react-native/configuration/filtering/`
- Sentry React Native source maps: `https://docs.sentry.io/platforms/react-native/sourcemaps/`
- Expo Sentry guide: `https://docs.expo.dev/guides/using-sentry/`
- React Native NetInfo package docs: `https://github.com/react-native-netinfo/react-native-netinfo`

Research conclusions:

- Supabase access tokens are intentionally short-lived; refresh tokens/session refresh should be the resilience mechanism.
- On non-browser/mobile clients, `startAutoRefresh()` should be tied to app foreground/background lifecycle.
- Edge Functions should return `400` for bad user input and reserve server errors for real failures.
- Supabase JS distinguishes `FunctionsHttpError`, `FunctionsRelayError`, and `FunctionsFetchError`.
- Sentry `beforeSend` and `ignoreErrors` can filter noise, but broad filtering should be used carefully.
- NetInfo distinguishes connection state from actual internet reachability; `refresh()` can re-check reachability.
- React Native source maps must match the release/dist that produced the event.

## Current Plan

### 1. Baseline Sentry Issues, Release/Dist, And Source Map Status

Status: completed.

Outcome:

- Current unresolved production Sentry issues were fetched and triaged.
- Three current issues were identified.
- Source map mismatch/missing source context was observed and reserved for a later plan item.

### 2. `JWT expired`

Status: in progress, stopped before code edits.

Goal:

- Reduce noisy, low-context auto-captured Supabase JWT errors while preserving meaningful auth/session failure reporting.

Current architect recommendation:

- Do not blindly change auth behavior first.
- Keep Supabase tracing and breadcrumbs.
- Disable automatic Supabase error capture in the Sentry Supabase integration by changing `errors: true` to `errors: false` in `src/lib/sentry.ts`.
- Continue relying on existing explicit capture points around session refresh/retry failures, because those have operation context.

Relevant files already inspected:

- `src/lib/sentry.ts`
  - Current integration:
    - `tracing: true`
    - `breadcrumbs: true`
    - `errors: true`
- `src/lib/supabaseClient.ts`
  - `autoRefreshToken: true`
  - `persistSession: true`
  - `detectSessionInUrl: false`
  - custom retry fetch
- `src/lib/supabase.ts`
  - `SESSION_RETRY_PATTERNS`
  - `withSessionRetry`
  - explicit Sentry captures around refresh/retry failures
- `src/contexts/SimpleAuthProvider.tsx`
  - `getSession()`
  - foreground/background `startAutoRefresh()` / `stopAutoRefresh()` lifecycle
- `src/services/syncManager.ts`
  - preflight/retry logic
  - explicit captures after refresh/retry failure
- `src/app/index.tsx`
  - `getSession()` without Sentry capture
- `src/app/(tabs)/_layout.tsx`
  - `getSession()` with Sentry capture
- `src/hooks/useImportSelection.ts`
  - auth check via `getSession()`
- `src/components/ImageSelector/ImageSelector.tsx`
  - uses `withSessionRetry` around `functions.invoke`

Recommended implementation for this plan item:

1. Edit `src/lib/sentry.ts`.
2. Change the Supabase integration option from `errors: true` to `errors: false`.
3. Update the nearby comment so it says tracing/breadcrumbs, not automatic error tracking.
4. Add a focused Jest test for the Sentry integration config, likely at `src/lib/__tests__/sentry.test.ts`.
5. Run a focused test and targeted lint/type checks.

Recommended focused test intent:

- Import the Sentry module under Jest mocks.
- Assert `supabaseIntegration` is called with:

```ts
{
  tracing: true,
  breadcrumbs: true,
  errors: false,
}
```

Potential focused verification commands:

```bash
npx jest src/lib/__tests__/sentry.test.ts --runInBand --watchman=false
npx eslint src/lib/sentry.ts src/lib/__tests__/sentry.test.ts
npm run typecheck
```

### 3. `Invalid word input`

Status: pending.

Goal:

- Separate expected Edge Function 400 validation failures from real server errors.
- Decide product policy for Dutch multi-word expressions and punctuation such as `/`.

Initial options:

- Option A: Treat the current validation as correct, but classify 400 responses as user/input validation, not `ServerError`.
- Option B: Broaden validation to allow accepted Dutch expressions/idioms and normalize separators.
- Option C: Split the input before server invocation if the UX should only support one word at a time.

Likely files:

- `src/lib/supabase.ts`
- `supabase/functions/gemini-handler/index.ts`
- `supabase/functions/gemini-handler/geminiUtils.ts`

### 4. `Internet not reachable`

Status: pending.

Goal:

- Move expected offline/no-internet states out of exception capture and into controlled UX plus lower-noise telemetry.

Initial options:

- Add breadcrumb/message-level telemetry only.
- Use NetInfo `refresh()` before declaring internet unreachable where appropriate.
- Keep exception capture only for unexpected network state or repeated failures after retries.

Likely files:

- `src/utils/network.ts`
- `src/lib/supabase.ts`

### 5. Source Maps And Observability

Status: completed.

Goal:

- Ensure production Sentry events for EAS builds and updates resolve source maps correctly.

Initial checks:

- Confirm release and dist naming for build `76`.
- Verify `scripts/upload-sourcemaps.sh` uses matching release/dist/url-prefix.
- Verify EAS Build/EAS Update paths include sourcemap upload where needed.

Likely files:

- `scripts/build-and-submit.sh`
- `scripts/upload-sourcemaps.sh`
- EAS config files if present

Outcome:

- Verified production event metadata for build `76`:
  - release: `com.oldrefery.dutch-learning-app@1.12.1+76`
  - dist: `76`
  - location: `app:///main.jsbundle`
  - Sentry error: `Source code was not found`
- Confirmed local iOS release/dist/url-prefix alignment:
  - `app.base.json` iOS bundle id: `com.oldrefery.dutch-learning-app`
  - version: `1.12.1`
  - build number: `76`
  - manual upload release: `com.oldrefery.dutch-learning-app@1.12.1+76`
  - manual upload dist: `76`
  - manual upload url prefix: `app:///`
- Confirmed release exists in Sentry, but legacy release file listing returned no source map artifacts.
- Updated native build path so `scripts/build-and-submit.sh` exports `SENTRY_AUTH_TOKEN` from `.sentryclirc` when the environment variable is missing.
- Updated manual native upload path so `scripts/upload-sourcemaps.sh` uses the local Sentry CLI when available, targets `https://us.sentry.io/`, and generates bundles with `NODE_ENV=production`.
- Added EAS Update upload support through `scripts/upload-sourcemaps.sh --update-dist dist`.
- Added `scripts/eas-update-production.sh` and package scripts:
  - `npm run update:production -- --message "message"`
  - `npm run sourcemaps:build`
  - `npm run sourcemaps:update`
- Set `eas.json` production build environment to `production` so EAS Build and update commands use the matching EAS environment.

Focused checks run:

```bash
bash -n scripts/upload-sourcemaps.sh
bash -n scripts/build-and-submit.sh
bash -n scripts/eas-update-production.sh
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); JSON.parse(require('fs').readFileSync('eas.json', 'utf8')); JSON.parse(require('fs').readFileSync('app.base.json', 'utf8'));"
scripts/upload-sourcemaps.sh --help
scripts/build-and-submit.sh --help
scripts/upload-sourcemaps.sh --update-dist /tmp/dutchlearningapp-missing-dist # expected missing-dist guard failure
npx prettier --check docs/SENTRY_HANDOFF_2026-04-25.md package.json eas.json
npm run typecheck
```

Not run:

- Real `eas build`, `eas update`, store submit, or real source map upload commands.

### 6. Focused Tests

Status: completed.

Goal:

- Add or adjust tests for each accepted fix.
- Keep tests scoped to the changed behavior.

Outcome:

- Confirmed existing focused tests cover accepted runtime fixes:
  - `src/lib/__tests__/sentry.test.ts` verifies Supabase Sentry tracing/breadcrumbs remain enabled while automatic error capture is disabled.
  - `src/lib/__tests__/supabase.test.ts` verifies invalid word input is classified as validation and expected offline preflight failures skip Sentry exception capture.
  - `src/utils/__tests__/network.test.ts` and `src/utils/__tests__/networkUtils.test.ts` verify network reachability refresh and offline handling behavior.
- Added `src/__tests__/sourcemapsScripts.test.ts` for source map observability script regressions without running real EAS or Sentry upload commands.
- Covered:
  - EAS Update `--update-dist` help text.
  - missing `dist` fast-fail before Sentry token validation.
  - native upload release/dist/url-prefix alignment.
  - production EAS update command ordering before sourcemap upload.

Focused checks run:

```bash
npx jest src/__tests__/sourcemapsScripts.test.ts --runInBand --watchman=false
npx jest src/lib/__tests__/sentry.test.ts src/lib/__tests__/supabase.test.ts src/utils/__tests__/network.test.ts src/utils/__tests__/networkUtils.test.ts src/__tests__/sourcemapsScripts.test.ts --runInBand --watchman=false
npx eslint src/__tests__/sourcemapsScripts.test.ts
```

Notes:

- Existing network tests still print expected console errors and React `act(...)` warnings, but all focused suites pass.

### 7. Quality Gate

Status: pending.

Goal:

- Run relevant lint/type/test gates after approved changes.
- Report unrelated failures instead of hiding them.

Candidate commands:

```bash
npm run lint
npm run typecheck
npm run test:ci
```

Use narrower commands first during each plan item, then broaden when the change set is ready.

## Suggested One-Line Commit Messages By Plan Item

Do not commit automatically. Propose these at the required stop points:

- Plan item 1: `chore: document current Sentry production triage`
- Plan item 2: `fix: reduce low-context Supabase auth error noise in Sentry`
- Plan item 3: `fix: classify invalid word input as validation failure`
- Plan item 4: `fix: lower Sentry noise for expected offline network states`
- Plan item 5: `chore: align Sentry source map upload with release metadata`
- Final combined commit, only if the user wants a single commit: `fix: improve Sentry error classification and observability`

## Suggested Restart Prompt

Use this prompt in a new Codex session:

```text
[$repo-session-bootstrap](/Users/devrush/.codex/skills/repo-session-bootstrap/SKILL.md)

Continue work in /Users/devrush/code/pet/DutchLearningApp using /Users/devrush/code/pet/DutchLearningApp/docs/SENTRY_HANDOFF_2026-04-25.md as the authoritative handoff.

Follow the repository AGENTS.md rules: explain steps in Russian; keep code, file content, commands, and logs in English. Do not fix anything without explicit permission for the current plan item. Use the current branch feature/sentry-error-handling if it is still new and not merged into main.

I approve read-only Sentry queries and required internet/documentation checks for this investigation. Use production Sentry only with environment=production and time-range=14d.

Continue from plan item 2: JWT expired. For this item, run the full logical role pipeline from Opening Orchestrator through Closing Orchestrator, but stop after the item is complete. Then explain what was done, propose a one-line Conventional Commit message in English, and wait for my explicit permission before moving to plan item 3.
```
