# Priority-cohort census preparation — 2026-09-21

Source `e962870`, branch `feature/web-review-navigation`, no application changes.
Status: locally validated and executed read-only against production at
2026-09-21 09:57:34 UTC. [Aggregate result](D01-cohort-production.json).

Artifacts: [SELECT-only template](D01-cohort-census.sql),
[isolated regression test](D01-cohort-census.test.mjs).
The earlier all-owner SQL remains historical evidence; use this scoped template
for the current P1/P2 priority audit instead.

## Scope and safeguards

- Resolve P1/P2 from the existing ignored private identity mapping. It was verified
  in Supabase Auth on September 12 and remains present; do not re-ask spelling or
  expose its emails/UUIDs in portable task files. Never commit rendered SQL.
- Replace exactly the two UUID placeholders, after validating UUID syntax and
  distinctness. An unrendered template fails with invalid UUID syntax; it cannot
  silently become an all-owner query.
- Personal words, tombstones, collections, review events and auxiliary progress
  are filtered to those two owners. Shared cache/schema metadata are explicitly
  separate global resources; personal data from other owners is not reported.
- Repeatable-read, read-only transaction, 20-second statement/2-second lock limits,
  explicit rollback. No DDL, data mutation, credential changes or migrations.
- Accept results only if `transaction_read_only=on`, `distinct_target_owners=2`
  and `matched_auth_owners=2`. Review unexpected schema/errors before retrying.
- Output is aggregate JSON with P1/P2 aliases, not word text or identifiers.
  Provenance and individual CEFR coverage stay NULL/unknown unless separately
  verified. Semantic/translation agreement is not proof of equal meanings.
- Server counts cannot establish installed client builds or device-local queues.

## Local validation

Command: `/opt/homebrew/opt/node@24/bin/node docs/tasks/shared-dictionary-cefr/evidence/D01-cohort-census.test.mjs`.
Result: **23 assertions passed**, disposable Unix-socket PostgreSQL/current local
migrations, no `.env`/remote connection. Covers two included owners, excluded third
owner, tombstones, cache coverage/conflicts, per-owner counts, missing/duplicate
identities, unresolved placeholders, absence of personal output, unchanged full
word snapshots and a blocked write in a read-only transaction.

First sandboxed attempt could not create PostgreSQL shared memory; approved local
retry passed. Both invocations cleaned their own temporary test data; the passing
cluster shut down normally. No existing database or user data was removed.

Transaction syntax checked with Context7's PostgreSQL 15 documentation:
[BEGIN](https://www.postgresql.org/docs/15/sql-begin.html),
[transaction modes](https://www.postgresql.org/docs/15/sql-set-transaction.html).

## Production result

After the user restored sign-in, Chrome showed Dutch Learning App, production
main, project `josxavjbcjbcjgulwcyy`, account oldrefery. The new empty SQL editor
received the validated transaction; Run returned one aggregate row. All three
acceptance guards passed. No Save, setting change, mutation or migration was run.
The editor showed unsaved edits; SQL execution may remain in normal service logs.
The rendered SQL was not saved in repository files.

| Measure                 |    P1 |  P2 |
| ----------------------- | ----: | --: |
| Active personal cards   | 2,311 | 570 |
| Tombstones              |     2 |   0 |
| Collections             |    12 |   2 |
| Review events           | 1,491 |  94 |
| Auxiliary progress rows |     0 |   0 |

The 2,881 active cards form 2,364 SQL-key candidates; 517 have multiple copies
and 11 have differing translations. These are candidates, not proven identical
meanings. There are 231 cards without a cache-key match, 2,344 with exact cache
translations, and only 57 matching an eligible cache key (version 2, used within
180 days). Shared cache totals 2,870 rows, 65 eligible under that predicate.
Do not drop the other cache rows/cards or infer that eligibility proves quality.

Neither inspected table (`words`, `word_analysis_cache`) has a column whose name
matches CEFR/source/provenance/dictionary. This agrees with the source audit's
missing per-word CEFR contract; it is not an exhaustive search of JSON payloads
or external historical files. Individual assessed CEFR and verified public/private
content counts therefore remain unknown, not zero. No personal content is approved
for publication based on this report. D02/D06 must preserve private fallback and
resolve provenance/meaning ambiguity before linking or publishing.
Zero auxiliary progress rows does not mean no progress: SRS lives on cards and
review history is present. Tombstones must survive migration too.

D01.3's scoped measurement is complete with these explicit limits; no textual
vocabulary export or manual semantic classification was needed for this audit.
D01.2 remains blocked on installed builds/device-local sync evidence.

## Previous access checkpoint (superseded)

The new Chrome task tab initially rendered the SQL Editor shell but subsequently
redirected to Supabase sign-in. **The authenticated session has expired**; initial
cached editor UI is not evidence of access. No query was typed or executed.
The sign-in tab was marked for user handoff. Ask the user to complete sign-in;
do not extract credentials or grant wider access. On resume, verify project
`josxavjbcjbcjgulwcyy`, production main, and review the actual editor state before
running only the validated report. Account for any query autosave behavior; do not
change user settings or overwrite an existing saved query without authority.

Await P1 iOS and P2 Android version/build and pending-sync evidence separately.
An asynchronous question was sent; there was no answer by this checkpoint.
D01.2/D01.3 were incomplete at that checkpoint. D01.1 and D01.4 were preserved without reruns.

Quota: 3% used at 09:50:27 -> 5% at 09:53:27 UTC, weekly reset 1790440763.
Rounded account-wide observations, not exact task attribution. This reset differs
from September 12; do not subtract across the two allowance windows.
