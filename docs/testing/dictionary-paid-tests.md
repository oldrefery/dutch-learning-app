# Dictionary paid-workflow test boundaries

The paid-spend migration changes admission and provider-grant requirements. New
installations are empty and closed: a full_access role alone no longer enables
the new paid flows. Synthetic fixtures explicitly install their own budget,
cohort, model ceilings and usage evidence; none reads application credentials.

The current-schema suites are `dictionary-analysis-endpoint`,
`dictionary-analysis-actor`, `dictionary-paid-spend`, `dictionary-paid-cohort`
`dictionary-paid-lifecycle`, `dictionary-paid-usage-shape` and
`dictionary-paid-late-usage` and `dictionary-paid-provider-compatibility`.
They use the latest migration and verify caller/service separation, all four paid
transitions, two complete workflows, replay, uncertainty, monetary concurrency,
revocation, administrator reconciliation and durable redaction-safe accounting.
The Edge tests inject transports and HTTP; no real provider is allowed.

The lifecycle suite covers cohort/phase expiry after lock waits, current business
state and lease fences, terminal-only unissued closure, claim/close races, public
alias ordering against Auth deletion, and publication/envelope-stop ordering.
The paid fixture's `grantPair` drives real business acceptance and dispatch;
`reservePair` creates isolated ledger reservations only for rollback, liability
and invalid-business tests. A ledger reservation alone cannot authorize a call.
The transport regression rejects a delayed monetary reply after its returned
earliest release/cohort/business deadline, before invoking the fake provider.

The usage-shape suite covers all four generation/judgement journal routes. Missing
`usageMetadata` keeps the original conservative hold without disabling the release.
Present arrays, strings, numbers, booleans, explicit JSON null and malformed objects
keep the liability and disable the release. Valid usage settles exactly once.
Each case verifies raw result/evidence retention, exact replay, budget counters
and whether an unrelated already-granted attempt can still be claimed. Malformed
usage also denies new acceptance. The late-usage suite covers quarantined attempts
across all four routes: malformed late usage stops the envelope while the original
monetary evidence and hold stay byte-identical. Valid or absent late usage does not
automatically settle or release that hold. The pure cost classifier is shared with
normal settlement. Concurrent claim/stop, transaction rollback and reviewed
reconciliation verify that stop control and accounting remain distinct.

The provider-compatibility suite checks the 1048576-input-token ceiling, exact
full-provider pair reservation and one-nanoUSD-short atomic denial. Across all four
journal routes, absent cache/thought counters normalize to zero; explicit null or
malformed counters still quarantine and stop. Required usage/version fields stay
explicit. Raw business evidence, replay, rollback, late-result quarantine, private
ACLs and aggregate grant caps remain verified. No live model limit or rate is seeded
by the migration; synthetic test envelopes are invocation-local only.

Ten earlier core SQL-contract suites explicitly stop at migration
`20261025093000_add_dictionary_capability_release_gate.sql`. Their pre-paid
fixtures intentionally exercise older internal grant/result contracts without
the newly required monetary evidence. They remain historical core regression
checks, not proof that those fixtures can issue paid grants under the new schema.
The endpoint and paid suites test current integration with the new triggers.
Other migration-transition tests retain their own explicit earlier boundary.

Report current-schema integration counts and historical core counts separately.
Do not describe a historical fixture pass as current enabled-path qualification.
When changing a prior core function, add its affected cases to the current-schema
coverage as well as running the historical regression; the new migration initially
adds guards and accounting without rewriting the earlier grant/journal bodies.
The additive lifecycle repair moves the old generic acceptance/dispatch and
independent acceptance bodies into inaccessible private functions and wraps the
same public signatures with Auth-first locking. Latest-schema alias/deletion,
revocation/replay and private-function ACL regressions cover those wrappers;
historical core tests still exercise their explicitly pinned original schema.

The local harness creates only an invocation-owned disposable PostgreSQL cluster.
Its Docker fallback requires the already cached pinned image, a local Unix
socket, no network or exposed ports, and removes only its own container. No hosted
database, application environment, real account or provider credential is loaded.
