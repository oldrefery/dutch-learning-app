# Web review performance launch prompt

## Recommended model

Select **GPT-5.6 Terra** and **High** reasoning in the task's model settings. The task is already designed, but async lifecycle, cache freshness and database isolation still require careful reasoning. Terra is the recommended executor for the whole local plan; Luna is suitable only for a separately bounded, mechanical subtask with explicit acceptance checks. This is a task-specific recommendation, not a guarantee of lower total cost.

Official model guidance: [Codex models](https://learn.chatgpt.com/docs/models), [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Checked on 2026-09-12. Model setting names/availability can vary by account; Terra and High are present in this host's current model catalog. API prices are not Codex subscription usage rates.

Use the same repository. The prompt does not create a task or change model settings by itself. Paste the following into a task after selecting the model.

## Full local implementation prompt

```text
Implement the web review performance plan in this repository:
/Users/devrush/code/pet/DutchLearningApp

Read these files first:
1. AGENTS.md and apps/web/AGENTS.md; treat .claude/CLAUDE.md as read-only.
2. docs/plans/web-review-performance-research-2026-09-12.md
3. docs/plans/web-review-performance-plan-2026-09-12.md
4. docs/plans/web-review-performance-execution-2026-09-12.md, if it exists.

Explain progress in Russian. Keep code, commands, logs and file content in English.

Execute required stages W00 through W11 sequentially. W10's assessment is required,
but implement its conditional refinements only when measurements justify them.
Use the plan's decisions and acceptance criteria rather than redesigning the app.
Keep each stage small and reviewable. Do not ask for confirmation between ordinary
local stages; continue after the current stage's required checks pass. Preserve an
execution log with completed stages, changed files, exact checks, measurements,
failures and the next action. Resume from that log after any context change.

First inspect branch, HEAD, worktree and runtime. Follow the plan's safe branch
startup and use Node 24/npm 11. Preserve these plan documents and any unrelated
changes. Do not commit directly to main. Use Context7 and installed framework docs
when touching third-party APIs; do not assume current internet documentation
exactly matches this installed Next.js version.

Key constraints:
- Web saved still means server acknowledgement. Preserve atomic SRS, exact retry
  IDs/payloads, correction revisions, immutable history and account isolation.
- Keep all eligible words and the existing adaptive evidence semantics.
- Preserve Recognition rules, Russian translations and the 600 ms feedback rule.
- Fix Audio Review's userId/mode argument wiring before the async-start changes.
- Removing just one revalidatePath call is insufficient. Implement and test the
  complete boundary-freshness strategy before considering that stage complete.
- Keep getUser revocation behavior; avoid unused access-level reads only where safe.
- No durable outbox, blanket framework upgrade, mobile rewrite, global user cache,
  reduced session limit or speculative infrastructure change.
- Database changes are additive read-only RPCs, tested on a private local cluster.
- Use isolated synthetic browser/backend fixtures. Never benchmark by submitting
  real production learning results or by trusting dev-server timings.
- Measure first usable card as well as loader feedback, and acknowledgement as
  well as next-card paint. Do not present a microbenchmark as full app performance.

You may implement local code, migrations, tests and documentation and run local
checks. Do not push, merge, publish, deploy, apply hosted migrations, change cloud
settings, switch accounts or run Expo/EAS. Prepare a concrete release handoff after
the local work is complete. No automatic subagent delegation is requested.

If a gate fails, investigate and fix the cause without weakening the test or the
learning/persistence contract. If a material design contradiction remains, record
the exact evidence and bounded decision needed. Continue independent authorized
work where possible. Missing production access is a reported limitation, not a
reason to abandon the local plan or invent production results.

Finish with a concise Russian report: completed stages, before/after measurements,
checks passed/failed, remaining limitations, files to review and release readiness.
Do not claim the website has been accelerated in production before deployment.
```

## Resume prompt

```text
Continue the local web performance implementation using
docs/plans/web-review-performance-execution-2026-09-12.md and
docs/plans/web-review-performance-plan-2026-09-12.md.
Verify the current branch and diff, then resume the first incomplete stage.
Preserve completed work and all prior constraints. Do not repeat finished stages
or start a new architecture. Explain progress in Russian; keep files in English.
Complete the remaining authorized local stages and validation, without deployment.
```

## Narrow-stage prompt

Use this when minimizing each run's scope, or when a stronger model needs to resolve a difficult stage. Replace the stage identifier before sending.

```text
Implement only stage W02 of
docs/plans/web-review-performance-plan-2026-09-12.md.
Read its dependencies, the research and the existing execution log first.
Verify that prerequisites are complete; do not overwrite prior work.
Make the bounded change, run its specified checks, and update the execution log.
Preserve every invariant in the plan. No deployment, push, merge or account changes.
Explain the result in Russian and keep all file content in English.
```
