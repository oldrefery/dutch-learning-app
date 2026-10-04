# D13 dormant production preparation — completed October 4, 2026

**PASS under AUTH-24.** The owner explicitly approved the exact
[operation](D13-dormant-production-operation-20261004.md). Target: personal Dutch
Learning App production, project josxavjbcjbcjgulwcyy. Candidate application source
13b97b0, starting documentation HEAD1e5218d. Recommended GPT-6 Astra / High.

Nine additive migrations committed between **19:21:26 and 19:21:48 UTC**. All new
paths remain disabled. This completes only dormant backend preparation, not the
functional release, P1/P2 cutover, dictionary publication or CEFR qualification.

## Preflight and recovery baseline

- Explicit existing credential, project-specific session pooler on port5432;
  database/current_user/owner postgres, required CREATE rights verified without
  changing privileges. Initial ledger43 versions matched the reviewed baseline.
- The first connection stopped at certificate verification, before authentication/
  SQL. Downloaded the public Supabase CA from the authenticated project's settings
  link. Retained TLS verify-full, with hostname and CA verification. No global
  trust, server SSL enforcement, account, network rule or credential change.
- All nine migration and nine control-file hashes matched the release manifest.
- Fresh full logical snapshot plus password-free roles saved privately to
  `builds/d13-preparation-backup.2ebz4aqm`, directory0700/files0600.
- database.sql:26,961,696 bytes, SHA-256
  `0ee03456a6c6b232b1174d9ca0811c2d267c68ae13dcd1bb8ef990d074165414`.
- All810 schema sections matched the previously rehearsed snapshot; no added,
  removed or changed definitions. Data sections and sequence values excluded
  from this schema comparison, not treated as schema drift.
- Isolated PG17.6 restore:56 COPY blocks/24,242 rows exactly match sorted SHA-256
  with original column lists. No network/ports, original backup read-only, tmpfs.
  As previously documented,19 GRANTED BY clauses removed only in a local role
  derivative; temporary DB ownership set to postgres to match verified production.
- The exact migration+ledger artifacts passed locally. An intentional exception
  after the first ledger insertion rolled back both schema and ledger:43 original
  versions remained and the new dictionary table did not exist. The subsequent
  successful local run recorded all nine original source hashes correctly.

## Production execution and preservation

Each original file was wrapped in one REPEATABLE READ transaction with an atomic
migration-ledger insertion. Existing outer BEGIN/COMMIT delimiters were replaced
by that wrapper; all source statements and the complete original file stored in
statements[1] remain unchanged. The wrapper adds only preconditions, checks and
ledger bookkeeping. Five-second lock wait and60-second statement/idle-transaction
bounds; transaction advisory lock and exact expected-ledger check precede each file.

Inside every transaction,55 original tables are compared before/after using original
column lists, row counts and ordered row hashes. The existing migration ledger is
excluded from that check because its one new record is the intended change; it is
validated independently. Any mismatch aborts the migration before COMMIT. The
consistent transaction snapshot does not misclassify concurrently accepted learning
writes as migration changes. No full backup was restored onto production.

All nine commit acknowledgements were received. A separate read-only verification
confirmed all52 ledger versions and SHA-256 of each stored original migration:

1. 20260921103000 — shared dictionary schema
2. 20260921140000 — dormant content protocol
3. 20261002090000 — official dictionary mappings
4. 20261002100000 — dictionary import protocol
5. 20261002110000 — import intents
6. 20261002120000 — import recovery
7. 20261002130000 — optional analysis CEFR estimate
8. 20261003090000 — dormant CEFR queue
9. 20261003100000 — dormant CEFR budget/control

No migration was retried or partially replayed. Definitions, owners and ACLs of
all14 existing public learning/review/progress functions remain unchanged.
The final global counts are5,987 words,1,763 review events and70 collections;
these are all-project counts, not the P1-only phone counts.

## Final controls

| Check                                              | Verified result       |
| -------------------------------------------------- | --------------------- |
| Dictionary operations / reads / legacy guard       | false / false / false |
| CEFR worker / policy                               | false / null          |
| Linked personal words / linked cache rows          | 0 / 0                 |
| Dictionary entries                                 | 0                     |
| CEFR methods / jobs / runs / budget policies       | 0 / 0 / 0 / 0         |
| Cron schema                                        | absent                |
| authenticated learning sync / correction protocols | 2 / 1                 |
| authenticated dictionary_content_protocol          | 0                     |

The capability checks ran in a read-only transaction as authenticated, with no
personal learning request. No new client binary, OTA, web/Edge deployment, personal
mapping, provider request, paid action, source push/PR or publication occurred.

## Cleanup and resume

Private receipt:
`reports/shared-dictionary-cefr/d13-production-preparation-20261004/operation.json`.
Phase: complete-dormant-production-preparation; nine commit-confirmed records,
local verification container removed, temporary credential directory removed.
Original backups and all verification/artifact hashes retained. Primary iPhone
snapshot is unchanged and separate. Existing four Android QA services/proxy remain
for owner testing; this operation did not modify them. Temporary certificate
browser tab closed, no uncertain external operation remains.

**Do not replay these nine migrations or request their approval again.** AUTH-24
is completed. Next D13 work: prepare the exact production client/artifact/release
plan; any EAS remote inspection must first verify oldrefery identity and project
ownership. Native binaries/runtime/build numbers, client flags, web/Edge artifacts,
source provenance/publication, current preservation deltas and final DEC-09 cutover
approval remain later gates. No final release approval follows from this operation.
P2's unavailable phone is an accepted evidence gap, not an empty-queue claim or
permission to discard its late offline writes. CEFR remains unqualified and OFF.

Connection and transaction behavior checked against
[PostgreSQL17 password-file documentation](https://www.postgresql.org/docs/17/libpq-pgpass.html),
[psql transaction/error behavior](https://www.postgresql.org/docs/17/app-psql.html)
and [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
