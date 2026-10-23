# D13A.5 — Preserved private/mode preview and resolution guards

Date: 2026-10-11. Status: checkpoint complete locally; D13A.5 remains in progress.
Model recommendation for the next checkpoint: GPT-6.1 Sol / High.
See [exact manifest](D13A-private-mode-preview-20261011.json).

The former conflict UI offered private resolution for remote following content and
its normal pull could fail on the preserved pending command before comparison.
The new mode preview reads protected inputs without acknowledging any command or
committing the remote response. Following and explicit remote legacy returns require
a reviewed mode decision; the UI supports holding the saved work while that apply
path is unfinished. Existing same-mode legacy conflict resolution is preserved.

The SQLite reader captures active owner/word/collection, full original private state,
full cache state and exact command rows in one transaction. After complete strict
protocol2 hydration parsing, the same captured local state must still exist.
A concurrent learning update is retained and does not make that comparison stale.
Remote/publication snapshots remain previews and do not move a cursor or clear debt.

The v1 resolver rejects mode-preview inputs even after feature withdrawal. With v2
active, it rechecks the latest remote/local modes before any legacy resolution.
The legacy response must still match version, reference and content. Inside the
exclusive SQLite write, active ownership and cached following mode are checked before
command removal; the mounted guard is checked again before commit. Guard failure
rolls back original state, queue, debt and refresh work. A-B-A or replaced/unmounted
UI contexts cannot apply an old comparison; no listener is installed for an ordinary
card without a conflict. Shared and returning-legacy previews offer hold only.

Fresh native196 suites/2614 tests/22 snapshots with configured coverage; focused6
suites/146 tests. Production/test TypeScript, scoped ESLint with zero warnings,
Prettier and diff checks pass. The final positive legacy case was added after an
initial full196/2613/22 pass, and the final full suite was rerun on the current bytes.
Initial type/lint diagnostics and two fixture failures (missing move mutation and
missing cache revision dependency) are preserved and repaired without suppressions.

Tests use real file-backed Node SQLite with reopen, and synthetic Auth, RPC and UI
controls in both themes. No actual device/browser/provider acceptance is claimed.
Web118/1222, Edge108 and PostgreSQL547/worker35 are prior unchanged evidence, not fresh
runs or a combined count. Current native boundary195 includes this checkpoint's
sources; web135 and Edge76 manifests and the carried PostgreSQL closures are exact.

Prior500 references matched at entry. The evidence source union is355; seven current
paths include three new implementation files, four extensions, and five additions
to the evidence union (the old conflict UI/test were not in its previous350-path
union). Historical37 mirrors and47 artifacts remain unchanged. Source bytes checked
by the final full suite are frozen separately from updated task notes.

Progress: original D13A.5 **5/8 complete**, item7 **3/4 areas complete**. In area4,
**1/2 fixed checkpoints complete**. Next: explicit reviewed disposition that protects
exact pending/original state and hydrates the chosen mode atomically, with current
owner/placement/version/head and stale-state checks. Do not silently delete a command,
restore private authority, convert an old card, or overwrite learning. D13A.6 corpus
mapping/apply/rollback remains separate. Item6 publication refresh and item8 web
recovery/review-start performance remain open.

All work is local and uncommitted on feature/shared-dictionary-schema HEADf97a733.
Flags OFF, shared_analysis FALSE, CEFR OFF. No provider, paid, hosted, Git publication,
EAS, device, release or automation operation. AUTH27-29 remain consumed. All runners
are closed and no external operation is pending.
