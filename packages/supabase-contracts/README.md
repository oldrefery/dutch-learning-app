# @woordenaar/supabase-contracts

Generated TypeScript contracts for the linked Supabase project.

`src/database.generated.ts` is generated from the deployed schema and must not
be edited by hand. Regenerate it after applying database migrations.

Protocol 2 contracts were regenerated from the approved hosted schema on
2026-09-06; the temporary forward RPC overlay has been removed.

`src/database.ts` corrects only the review RPC's accepted nullable correctness and
response-time arguments. PostgreSQL function metadata does not encode that
nullability. Keep this correction separate rather than editing generated types
or replacing a missing answer with `false`. No undeployed functions are added.
See `docs/protocol2-release-2026-09-06.md` in the repository root for rollout evidence.
