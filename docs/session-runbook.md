# Resumable repository session runbook

## Entry and scope

`/repo` and `/repo continue` mean resume the active task **when delivered as a user
message**. `/repo status` means inspect only; `/repo pause` means checkpoint only.
These aliases live in `AGENTS.md`; they do not register an application menu command.
If the client intercepts an unknown slash command, send:

> Resume the active task using docs/session-starter-prompt.txt.

The existing repository-bootstrap skill can also discover the starter/runbook and
active-task pointer. No global settings, custom prompts, or credentials are needed.
See [official reusable-instruction guidance](https://learn.chatgpt.com/docs/build-skills)
for the distinction between project instructions and registered skills.

Only follow this workflow when the user asks to resume, inspect, or pause it.
Do not infer permission to resume from unrelated work in the same checkout.

## Durable sources of truth

| File                         | Responsibility                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/tasks/_active_task.md` | Which task to resume; paths, not duplicated progress                                                    |
| Task `handoff.md`            | Stage status ledger, current stage/checkpoint, exact next action, branch/worktree and evidence pointers |
| Task `steps/Dxx.md`          | Stage-specific inputs, ordered checkboxes, exit gate and checkpoint notes                               |
| Task `decisions.md`          | Accepted decisions, unresolved questions, scoped approvals and their consumption                        |
| Task `sessions.md`           | Append-only concise historical checkpoints; read the relevant tail only                                 |
| Linked implementation plan   | Requirements, invariants, detailed stage scope and model recommendations                                |

The handoff selects the stage; the stage card selects the checkpoint. Never advance
from a checked box alone when its required evidence or approval is missing.
Contradictions require reconciling actual files/commits/results before proceeding.

## Startup: safe after a day, a week, or a hard interruption

1. Follow the starter read order. Do not repeat a completed architecture audit.
2. Read-only inspect `git status --short --branch`, current HEAD, and the task's
   recorded branch/evidence. Check whether files and dependency commits are present.
   Fetch remote PR/CI/deployment state only when needed and within allowed access;
   never print secrets or rely on an old green result for a different commit.
3. Preserve dirty work, including untracked task documents. A new session in the
   same local checkout can use them; a fresh worktree/clone cannot unless those
   files were committed and included in its base, or explicitly transferred.
   Do not silently start from main when the task's work lives on a feature branch.
   In this checkout, root `AGENTS.md` is locally excluded by `.git/info/exclude`.
   A normal documentation commit will not include its resume alias automatically.
   Do not change that exclusion or force-add the file without approval. The
   explicit starter-file prompt remains portable when the docs bundle is present.
4. Resume the existing stage branch when it exists. Starting a new implementation
   branch requires a safely synchronized main/base and preservation of the task
   bundle first. Do not pull/rebase/reset an in-progress dirty branch automatically.
5. Recheck time-sensitive facts: access, dependency versions, schema/deployments,
   native build adoption, running jobs, and quota/reset boundaries if relevant.
   Never treat elapsed time as proof that CI passed or mobile clients upgraded.
6. Verify the current stage's dependency gates and permissions. Previously proposed
   designs remain proposals until accepted. Record new user approval with exact
   scope and expiry/consumption, without credentials or transcript dumps.
7. If the model/effort is known and differs from the stage recommendation, explain
   the requested switch before substantial work. If unknown, ask the user to check
   the picker; do not claim to have changed it or silently change it.
8. Give a compact Russian summary: bootstrap mode, active stage/checkpoint, branch,
   completed evidence, model/effort, blocker if any, and exact next action.

Default scope: resume one stage, not the entire multi-week project. A stage may
span multiple sessions; do not force it into one context window.

## Checkpoint while working

- Mark a stage `in_progress` before its first substantive work. Write the intended
  next checkpoint before a long test, migration rehearsal, or external operation.
- After each completed checkpoint, significant test result, external state change,
  or newly discovered blocker: save checkboxes/notes and update the handoff.
- Log each test with command, result, date, code revision/worktree state, and a
  durable sanitized evidence path. Tool session IDs and `/tmp` files are temporary,
  not a resume strategy. If an artifact must stay private, record its protected
  location and aggregate outcome, not its secret or private contents.
- Before a long action, record target, intent, expected result, and how to check
  whether it already happened. After an interrupted action, inspect its state
  before retrying; never blindly repeat a deployment, payment, import, or backfill.
- After a quota warning or user pause, finish only a safe small atomic step and
  checkpoint. Do not begin another long operation. Hard termination may prevent a
  final save, which is why checkpoints are incremental.
- If the last session crashed, reconcile the recorded intent against git diff,
  files, logs and external job status. Mark uncertain work `unverified`; do not
  mark it done or delete it simply because its tool session no longer exists.

## Completion, interruption, and permissions

Stage status vocabulary: `pending`, `in_progress`, `paused`, `blocked`, `done`.
`paused` is a recoverable session/quota stop; `blocked` records a specific missing
decision, access, dependency or environment. These are file statuses, not product
automation/goal statuses. A reset changes available quota, not task status.

A stage is `done` only when its exit gate, required review and evidence are complete.
Record code completion, PR/CI status and environment deployment separately; a
merged PR is not proof of a deployed migration. Do not invent PR IDs or commit IDs.

Before ending any work session:

1. Update the stage checkboxes and its Evidence/Checkpoint notes.
2. Update handoff stage statuses, first incomplete checkpoint, exact next action,
   branch/HEAD, dirty files, test evidence, failed attempts, and pending operations.
3. Update decisions/approval records only when something actually changed.
4. Append one compact entry to `sessions.md`, including quota observations only if
   measured. Never compute usage by subtracting across different reset windows.
5. Record the persistence level: local-only, committed, or pushed. Make a scoped
   commit only when authorized; never push, open/merge a PR, deploy, or buy credits
   merely to preserve a handoff. Do not commit private reports or secrets.
6. If complete, select the next stage and announce its model. Stop at the boundary
   unless the user requested continued multi-stage work. If paused, retain the
   same stage and exact next checkpoint rather than resetting its checklist.

Release authority must identify the environment, target revision/artifact,
operation, and allowed scope. Prior one-off performance-release permission was
consumed and does not authorize this dictionary project. Observations requiring
days of waiting are recorded as a future resume condition; do not create a
background reminder/monitor unless the user requests one.

## Resume acceptance scenarios

- Fresh local session: starter → active pointer → handoff → stage; no chat needed.
- One-week pause: keep completed boxes; refresh external/quota facts; resume the
  same checkpoint with the recorded recommended model.
- Hard stop after edit/before test: preserve diff; run missing verification; do not
  repeat an already applied migration or assume the stage passed.
- Fresh worktree without the task files: report missing bundle/base; recover from
  the recorded branch or ask for transfer; do not reconstruct progress from memory.
- Completed stage: verify evidence, advance to the next allowed stage, announce
  model; a blocked approval gate is not bypassed by typing `/repo` again.
