# D10 R4 — semantic action styling repair

User confirmed the requested GPT-6.1 Sol / High switch. Starting HEAD `b745243`,
existing `feature/shared-dictionary-schema`, AUTH-17/18/19. Source styling repair
and synthetic browser verification only; no native device or backend start.

## Change

`StarterPackImport`, `SharedCollectionImport` and `CollectionSharingPanel` now use
the existing `dw-button` primary/secondary variants. This covers import submit,
sharing publish/stop/copy, selection/duplicate controls and success navigation.
Their unlayered semantic rules outrank the existing control/link color reset and
resolve foreground/background through the approved light/dark tokens. The reset
and global CSS are unchanged; no hardcoded colors, action, target selection,
disabled predicate, navigation URL or server behavior changed.

The existing theme supplies hover/focus states, minimum control size and disabled
opacity. This deliberately adopts its accent action appearance; it does not add a
new neutral button palette or globally change utility precedence.

## Regression evidence

The saved browser regression renders the real three TSX component sources and
compiles the actual global CSS with the installed Tailwind PostCSS plugin. It
injects synthetic `useActionState` results for 16 states and renders `next/link`
as an anchor preserving its props. Server actions are blocked; no import or
sharing mutation runs. This verifies component markup and the real CSS cascade,
not Next.js navigation, backend authorization or actual Safari acceptance.

Before repair (`b745243` source), 14 light-theme primary-label checks fail with
contrast 1:1, including enabled/disabled official/bundled/shared import, pending,
success links and publish. The baseline is expected to fail the repair criterion.
After repair, **40 checks across 16 states and two themes PASS**. Enabled rendered
contrast is at least **5.34:1**. Inactive controls retain the existing theme's
opacity; minimum composited contrast is **1.93:1**, with underlying colors above
4.5:1. The disabled criterion checks differentiation (1.25:1) and correct disabled
semantics, not enabled-text WCAG conformance. Transparent backgrounds are resolved
through ancestors before measurement. Resting colors are sampled without hover
or transitions. Enabled/disabled screenshots were visually inspected.

The source-rendered DOM before/after is identical after removing class attributes,
including selection, disabled state, forms and links. All 140 prior application
fingerprints remain intact; the three changed component paths were added to the
current manifest (143 total).

Commands from the repository root (Node 24):

```bash
mkdir -p reports/shared-dictionary-cefr/d10-r4-repair-20261002
node docs/tasks/shared-dictionary-cefr/evidence/D10-import-contrast-fixture.mjs reports/shared-dictionary-cefr/d10-r4-repair-20261002
bash /Users/devrush/.codex/skills/playwright/scripts/playwright_cli.sh --session d10-r4-contrast open http://127.0.0.1:55400 --headed
node docs/tasks/shared-dictionary-cefr/evidence/D10-import-contrast-check.mjs repaired
```

For the counterexample, generate the baseline without another server:

```bash
node docs/tasks/shared-dictionary-cefr/evidence/D10-import-contrast-fixture.mjs reports/shared-dictionary-cefr/d10-r4-repair-20261002 b745243 --generate-only
bash /Users/devrush/.codex/skills/playwright/scripts/playwright_cli.sh --session d10-r4-contrast reload
node docs/tasks/shared-dictionary-cefr/evidence/D10-import-contrast-check.mjs baseline
```

Regenerate `working-tree --generate-only` and reload before checking repaired
source again. Close only the named browser and SIGTERM the exact fixture PID in
private `fixture-runner.json` after verification. Do not leave it running.

Other verification:

- Three focused suites /13 tests PASS: sharing panel, starter-pack action behavior,
  shared collection domain. An initial command used two nonexistent test filenames;
  corrected paths pass. The failed invocation was a command error, not a test failure.
- Test-inclusive `tsc --project apps/web/tsconfig.json --noEmit` PASS.
- Strict scoped ESLint (`--max-warnings=0`), Prettier, JS syntax and diff checks PASS.
  The npm forwarding form swallowed `--max-warnings`; direct ESLint rerun passes.
- Source/evidence commit `da41085` normal hooks PASS: mobile 156 suites /1796 tests /
  22 snapshots; web 86 suites /778 tests, one existing skipped suite/test. All 143
  source hashes still match after hooks; private `commit.log` retained.

Private artifacts: `reports/shared-dictionary-cefr/d10-r4-repair-20261002/` contains
baseline/repaired matrix JSON/logs, CSS/HTML, screenshots, structure equality,
focused tests, typecheck/lint and cleanup receipts. No credentials are needed.
[Sanitized summary](D10-import-contrast-repair-summary-20261002.json).

## Resource state and next checkpoint

All assigned resources OFF verified **19:00:50 UTC /21:00:50 Amsterdam**: visual
fixture PID absent and port55400 closed, named browser closed, assigned iOS
Shutdown, Android absent and four retained task containers exited. Native devices
and backend stayed off throughout this repair. No pending process or uncertain
write; no production, cutover, deployment, publication, paid call, push/PR/merge.

Next **GPT-6 Astra / High** independent R4 review, then only affected real-page /
Safari visual checks. Current-thread model picker is unavailable; user must select
it, and no automatic switch is claimed. D10.3–D10.5 remain open until the exit gate
is reconciled. Do not begin D11 or replay completed imports.
