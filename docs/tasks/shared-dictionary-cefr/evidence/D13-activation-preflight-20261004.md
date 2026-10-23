# D13 activation preflight — AUTH-27

Owner approved the exact server activation and TestFlight/internal distribution
packet after artifact inspection. Permission remains valid; this checkpoint needs
Supabase CLI authentication, not another approval.

## Completed

- Production read-only target and role verified. All 52 ledger versions present;
  all nine deployed candidate migration hashes and 14 learning function contracts
  match prior verified evidence. Dictionary runtime and CEFR worker remain OFF,
  with no entries, sources, official mappings or linked personal words.
- Fresh protected snapshot `builds/d13-activation-backup.87qvcan2/database.sql`,
  27,476,336 bytes, SHA-256
  `9880ab9f5caf5fe07b2344b3a671eb0ad92d06f490e594e9f4fbe19075ed4443`.
  Isolated network-none restore matched all 79 tables / 24,259 rows exactly.
- Compared all 14 original personal/learning tables with the prior snapshot:
  one new word and cache record; zero existing word modifications/deletions;
  one P1 collection updated_at changed and ephemeral rate counters changed.
  Review/history tables unchanged. New data retained, no restoration over production.
- Exact licensed-source publication SQL generated from approved proposal SHA-256
  `4d54ba82661604b7b5f0e70d2126b988daadaeb8ccb370e4c19192b6c713166d`.
  All 83 bounded transactions passed against the fresh isolated copy: 2053 sources,
  published entries and official mappings; zero personal links or CEFR assessments.
  Each transaction verifies original personal-table digests before and after writes.
  No production rehearsal tooling was installed. Stable source/resolution IDs and
  hash-bound batch files/commit markers support inspection before any retry.
- Vercel identity oldrefery, linked woordenaar-web project and production target
  dpl_6BoPjhGd2GFiykayzsUv3uaiDUkk match source 44141e0, READY. Dictionary/CEFR
  environment variables are absent. Read-only inspection only.

## Blocker and next action

Supabase CLI 2.75.0 returns `Access token not provided`. No existing CLI access
credential was found in configured locations. Owner asked to run `supabase login`
for the personal account and reply ready; no token should be sent through chat.

After login, verify personal project josxavjbcjbcjgulwcyy and the existing
`gemini-handler` metadata/JWT setting before writing. Then continue AUTH-27:
review current delta freshness, recreate only the necessary temporary existing-DB
credential, apply the already rehearsed source batches, verify source parity and
preservation, deploy the exact reviewed Edge function, coordinate runtime/web
activation, and submit only the two recorded build IDs. No new consent is needed
for that approved scope. If substantial time has passed, refresh time-sensitive
preconditions; do not rerun successful builds or completed migrations.

Private operation receipt and prepared apply script:
`reports/shared-dictionary-cefr/d13-activation-20261004/operation.json` and
`apply-publication.py`. The apply script deliberately requires verified Edge
access before the first production publication. No production write, activation,
Edge/web deployment, source publication or store submission has occurred.

Both operation-created containers and the temporary DB credential were removed.
Original and new backups, native artifacts, managed source checkout and existing
QA services remain intact. P1 phone untouched; P2 local queues still unknown.

The initial local source precheck referenced the older pre-version-bump manifest;
resolved by binding current release inputs to approved 0a3bae1, with migration
hashes unchanged. The restore runner's final print referenced a migration-only
field after checks and cleanup had passed; the print was corrected, and successful
restore evidence was inspected instead of repeating the operation.

D13 is blocked on CLI access only at this checkpoint; release is not complete.
Detailed sanitized [evidence](D13-activation-preflight-20261004.json).
