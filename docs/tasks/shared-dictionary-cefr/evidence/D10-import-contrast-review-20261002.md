# D10 R4 — invisible import action label

User-confirmed Astra / High, reviewed source `976d1e7`, starting HEAD `833835d`.
Found during the remaining actual iOS Safari acceptance. This is not attributed
to the R3 authentication repair.

## Finding: R4 / P2

In light theme the official/bundled import action has identical foreground and
background colors, so it appears as an unlabeled rectangle. Actual iOS Safari
shows this on the disabled official-pack action; desktop Chromium confirms both
disabled and enabled states. The primary user's existing duplicates were only
previewed; no repeated import was submitted.

Observed computed styles from the real running Next.js page:

| Action                    | Disabled | Color                 | Background            |
| ------------------------- | -------- | --------------------- | --------------------- |
| Import 0 words (official) | true     | oklch(0.21 0.006 250) | oklch(0.21 0.006 250) |
| Import 57 words (bundled) | false    | oklch(0.21 0.006 250) | oklch(0.21 0.006 250) |

Dark-theme diagnostic remains legible (foreground oklch(0.95 0.003 250),
background oklch(0.28 0.006 250)); it does not rescue light-theme acceptance.

`apps/web/src/app/globals.css` defines unlayered `button,input,select,textarea {
color: inherit; font: inherit; }` and `a { color: inherit; }`. These outrank
Tailwind's layered `text-white`/dark color utilities. The neutral background
resolves to the same semantic primary text color. The same affected CTA class
pattern occurs in `StarterPackImport`, `SharedCollectionImport`, and
`CollectionSharingPanel`; success/navigation links also need inspection.

## Repair contract — GPT-6.1 Sol / High

Use the existing semantic button styling (`dw-button` variants) or equivalent
scoped theme-token rules for the affected D10 action and success links. Keep the
change bounded; do not globally move the CSS reset between layers or rewrite
unrelated application styling without reviewing its wider impact. Preserve
selection, disabled/pending state, read_only rules, server actions and navigation.

Verify real computed foreground/background and visible labels in light/dark,
enabled/disabled states, including official/bundled/shared import actions and the
sharing toggle/success links. JSDOM text/role assertions alone do not validate the
CSS cascade. Re-review on Astra / High, then repeat only affected visual checks.

Private runtime evidence root:
`reports/shared-dictionary-cefr/d10-final-acceptance-20261002/` includes
`safari-passed.png`, `safari-retry.log`, `button-enabled-style.txt` and
`button-dark-style.txt`. The Safari flow passed duplicate visibility and disabled
action semantics after adding an explicit scroll to the last row; visual
acceptance stays open until R4 is repaired.
