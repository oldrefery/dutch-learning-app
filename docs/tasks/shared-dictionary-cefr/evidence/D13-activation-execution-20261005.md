# D13 dictionary activation and beta distribution — 2026-10-05

AUTH-27 authorized scope completed. Both exact version **2.4.0 (85)** beta
artifacts are available in their approved testing destinations. No public store
production release, primary-device mutation, paid provider call or CEFR job ran.

## Production activation

- Published the exact approved proposal: **2053 licensed sources, entries, revisions
  and official mappings / 21 packs**, in 83 bounded transactions. Independent
  comparison against original official content passed 2053/2053.
- Fresh protected backup `builds/d13-activation-backup.87qvcan2/database.sql`:
  79 tables / 24,259 rows restored and verified. SHA256
  `9880ab9f5caf5fe07b2344b3a671eb0ad92d06f490e594e9f4fbe19075ed4443`.
  Original snapshots and the primary iPhone export remain retained.
- `gemini-handler` **132 ACTIVE**, JWT verification retained; other Edge functions
  unchanged. The initial CLI2.75 API packaging failed before activation because it
  omitted a transitive file. CLI2.117 local Docker packaging deployed the unchanged
  approved source successfully. OPTIONS200 and unauthenticated POST401 passed
  without a provider request. No CEFR environment flag is installed.
- Runtime `operations_enabled`, `reads_enabled`, `legacy_guard_enabled` switched
  ON atomically. All14 original personal-table digests remained equal within the
  transaction. No personal/cache references were automatically written.
- Authenticated P1(2343 active cards) and P2(570) returned identical legacy learning
  snapshots through the old and new APIs. Learning/review protocols remain2/1;
  dictionary protocol is1. All21 official mappings passed authenticated reads;
  cross-owner effective-content requests returned zero foreign cards.
- Rechecked all14 learning contracts and all9 installed migration file hashes.
  CEFR methods, jobs, runs, assessments remain zero; worker OFF/policy null.
- Web deployment `dpl_74ZRdMpdPQpbjQADbdRpFxniUKdr`, exact merged source
  `44141e00bddfe00267314374bc33a7a0cf8fb4a2`, is READY and the production alias
  returns HTTP200. `DICTIONARY_CONTENT_ENABLED=true` verified through the single-env
  endpoint. No CEFR flag. The first env verification used an encrypted list value;
  corrected the read method without changing the deployment.

## Native distribution

Both binaries retain approved source `0a3bae137d3e58c406215114cbccadd773f71098`.
Original artifact inspection/signing/hash evidence is in
[D13-native-inspection-20261004.md](D13-native-inspection-20261004.md).
Effective Expo identity and linked owner were verified as oldrefery before every
remote EAS operation. Existing store credentials were reused.

| Platform | Build ID                             | Submission ID                        | Final verification                                                      |
| -------- | ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| iOS      | 5d37d6fa-fc60-4137-b694-3b0909071ee9 | de0cf035-a573-45ba-a7e8-99351f05f0e0 | EAS FINISHED; TestFlight Team (Expo), 2.4.0(85), Testing                |
| Android  | 84beddfc-9c76-4128-9b8f-d7975c3dd082 | 73192494-0213-4df9-8ceb-9214a115995c | EAS FINISHED; Play internal Active, 2.4.0 available to internal testers |

iOS submission finished2026-10-04T22:37:26.071Z; Android finished22:36:40.832Z.
TestFlight's general build view says Ready to Submit for external review, while
its existing internal group's Builds view explicitly says **Testing**. No external
review or public release was requested. Actual installation on primary phones is
not asserted; the accepted P2 device evidence gap remains.

## Persistence and next checkpoint

Operation-only DB credential files/directory were removed. Protected backups,
existing QA services and both checkouts retained. No running/uncertain release job.
Private operation receipts live under
`reports/shared-dictionary-cefr/d13-activation-20261004/`; native submission logs
remain under `reports/shared-dictionary-cefr/d13-native-candidate-20261004/`.
Do not replay publication, migrations, runtime cutover, deployment, builds or submissions.

D13 stays **in_progress** because the full exit includes observation and the separate
CEFR qualification/cost gate. Observe at least seven days from this release,
including native offline return, before considering D14 removal. Earliest elapsed-time
boundary is October12 local time; elapsed time alone is not acceptance evidence.
No background automation was created. Keep CEFR OFF and existing cards unlinked.
Checkpoint documents remain local-only/uncommitted; PR122 is already merged and
candidate0a3bae1 remains local-only. Unrelated `.playwright-cli/` is untouched.
