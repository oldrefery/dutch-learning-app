# Dictionary content protocol 1

Status: local D05 implementation with D08 compatibility review fixes. The migration is additive and every
runtime flag defaults to `false`. It has not been applied or activated remotely.

## Authority and activation

`private.dictionary_content_runtime` separates three release controls:

- `operations_enabled`: advertises protocol 1 and accepts content commands;
- `reads_enabled`: enables bulk effective-content, change pages, and review v2;
- `legacy_guard_enabled`: rejects direct legacy content changes on linked cards.

The current `words` path and `get_web_review_snapshot_v1()` remain authoritative
while the flags are off. Clients cannot read or change the flags. Disabling the
read flag returns clients to v1 without deleting references, content state,
receipts, learning data, or the deterministic legacy projection.

## Commands and retries

`apply_dictionary_content_command_v1(jsonb)` accepts only the exact versioned
envelopes defined by the domain contract. Unknown fields, including learning/SRS
fields, are rejected before mutation. The authenticated owner comes from
`auth.uid()` and the function locks the live owned card before checking its
expected content version.

The `(owner, operation_id)` receipt stores a canonical request digest. An exact
retry returns the original result, including after a soft tombstone. Reusing the
ID with changed intent fails. Content/reference state, the legacy projection, and
the receipt commit atomically. Existing review/reset/correction commands remain
the only writers of learning state.

The command is the sole writer of coexistence content for a linked card. Its
projection updates only legacy content columns. After the release-controlled
guard is enabled, an old whole-row payload that changes linked content fails with
`legacy-content-upgrade-required`; metadata-only updates continue, and the
existing learning trigger still ignores stale SRS snapshots. The client must keep
the rejected pending payload for explicit reconciliation.

For an unlinked card with existing content state, the enabled legacy guard also
captures changed legacy content in its private fallback and increments the
content version. A returning old client therefore cannot leave a newer client's
fallback stale. Projection from a content command already has matching state and
does not increment the version a second time. This trigger is dormant when the
guard is disabled; no learning fields are changed by it.

## Mobile rollout and acknowledgement

`EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED` must be exactly `true` to opt a mobile
build into the new path; it defaults off independently of server capabilities.
Enabled clients require the capability and do not downgrade to whole-row content
writes when it is absent. No release configuration enables this flag yet.

The local command and projected private content commit together. Hydration caches
dependencies first, validates card/receipt versions, then stores card state and
acknowledges exact operations in one exclusive SQLite transaction. Any remaining
pending command protects the local projection. A durable refresh queue records
remote-card hydration debt before advancing the legacy word cursor.

Stale commands remain queued for an explicit local/server choice. A local choice
creates a new private command against the observed remote version; a server choice
discards only the captured word's commands. Both choices reject newer local intent
or changed remote versions. Dictionary failures do not suppress protocol-2
learning uploads and are not reported as a successful complete sync.

## Canonical analysis and cache

`persist_canonical_dictionary_analysis_v1(...)` is executable only by the service
role. It requires approved provenance and an explicit trusted `resolution_id`.
The resolution ID, not lemma/POS/article, is the idempotency and meaning decision:
the same resolution applies once, while distinct unresolved meanings remain
distinct even if their spelling keys match.

An eligible canonical publication may map one `word_analysis_cache` row to its
immutable revision. The cache remains an optimization, not content authority.
Refreshing linguistic cache fields clears that mapping; media refresh alone does
not. Ordinary Gemini output is not published merely because it was cached.

## Bulk reads and delivery

`get_dictionary_effective_content_v1(uuid[])` returns at most 1,000 owned live
cards in one request. Resolution order is pinned immutable revision, valid private
override, then private/legacy fallback. Any linguistic override disables inherited
CEFR; media-only overrides do not. `get_web_review_snapshot_v2()` adds the same
bulk model while v1 remains unchanged.

Revision-head and CEFR-head changes append to a private delivery log. A singleton
cursor row is incremented in the same transaction, serializing allocation through
commit. `get_dictionary_content_changes_v1(after, limit)` exposes only visible
changes and bounded pages. This prevents the classic sequence/timestamp gap where
a client advances beyond a transaction that allocated earlier but commits later.

## Errors

Stable protocol errors include `unsupported-protocol`,
`not-found-or-not-owned`, `stale-content-version`, `invalid-revision`,
`semantic-key-conflict`, `legacy-content-upgrade-required`, and
`operation-intent-mismatch`. Failures do not create success receipts. RLS and
explicit ownership checks do not reveal a foreign card's existence.
