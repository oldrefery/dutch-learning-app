# @woordenaar/supabase-contracts

Generated TypeScript contracts for the linked Supabase project.

`src/database.generated.ts` is generated from the deployed schema and must not
be edited by hand. Regenerate it after applying database migrations.

`src/database.ts` adds a temporary typed RPC overlay for the local
`20260905200000_server_authoritative_review_events.sql` migration. The migration
is not deployed by this overlay. Regenerate the deployed contracts and remove
the overlay after an explicitly approved schema rollout.
