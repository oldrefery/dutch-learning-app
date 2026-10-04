# @woordenaar/supabase-contracts

Generated TypeScript contracts for the linked Supabase project.

`src/database.generated.ts` is generated from the deployed schema and must not
be edited by hand. Regenerate it after applying database migrations.

`src/database.target.generated.ts` is a separate pre-deployment contract generated
through the pinned repository migration head in a disposable local PostgreSQL
cluster. Its exact schema head, PostgreSQL image, Supabase Postgres Meta image, and formatter
versions are pinned in `target-schema.json`. Generate or verify it without
contacting a linked project:

```bash
npm run supabase-contracts:target:generate
npm run supabase-contracts:target:check
```

Docker must be running. The official Postgres Meta generator and synthetic
PostgreSQL database use a task-owned internal network without published ports.
No linked-project login or application environment file is loaded. PostgreSQL
data is temporary; exact-name cleanup removes both containers, their anonymous
volumes, and the network on success or failure. The manifest must track the latest
repository migration. The check command fails on schema drift without overwriting
the generated file.

Do not replace `database.generated.ts` or import the target contract into shipped
clients before the corresponding hosted migration and release gate are approved.

Protocol 2 contracts were regenerated from the approved hosted schema on
2026-09-06; the temporary forward RPC overlay has been removed.

`src/database.ts` corrects only the review RPC's accepted nullable correctness and
response-time arguments. PostgreSQL function metadata does not encode that
nullability. Keep this correction separate rather than editing generated types
or replacing a missing answer with `false`. No undeployed functions are added.
See `docs/protocol2-release-2026-09-06.md` in the repository root for rollout evidence.
