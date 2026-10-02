# D10.3 — unavailable import target: architectural review input

Status: **draft / not implemented / not an accepted protocol decision**.
Prepared 2026-10-02 after source `42c9bfd`; next model GPT-6 Astra / High under the
stage routing. The current-thread picker is unavailable; a manual switch must be
confirmed before claiming that review model. Existing review repairs remain valid.

## Reproduced state and problem

SQLite v15 preserves the original personal word, SRS, private content and queues
when a remote target collection disappears. The immutable import intent continues
to address that original target. Generic local card movement does not rewrite it.

A request can already have succeeded on the server while its reply was lost.
Rotating operation/target locally is therefore unsafe: the new request can collide
with the proposed personal ID, and a delayed original request can later reach a
restored collection. No absence check proves that all old requests are finished.
Receipt replay must never resurrect a remotely deleted personal card.

The JSON reimport path is a separate content-copy operation with a fresh personal
ID. It must not be offered as automatic recovery of an existing personal identity,
because the retained card may already own learning history and pending commands.

## Non-negotiable contract requirements

1. Retain the exact personal ID, SRS/history, source content/pin provenance and all
   content/learning queues. Never adopt another semantic duplicate's personal ID.
2. Persist the complete recovery request before sending it. Lost replies replay the
   same request/nonce. No deletion of the original local intent during preparation.
3. Bind original and recovery inputs to the authenticated owner and immutable
   hashes. A client assertion of prior delivery or an existing same-owner UUID is
   insufficient authority to move/edit a server card.
4. Original delivery and recovery must serialize on the same stable owner/original
   operation lock. A committed recovery must prevent any unseen delayed original
   operation from inserting at the old target, including after target restoration.
5. Proven original success permits at most an authorized metadata move of that same
   active owned card, with no content or SRS rewrite. Never recreate a missing or
   tombstoned previously acknowledged ID. Recheck the existing move/read-only rules.
6. If the original operation never succeeded, server settlement/cancellation must
   be durable before a successor can insert the same proposed ID at a new owned
   target. It must be atomic with insertion/conflict recording, not a separate
   client preflight. Preserve immutable historical receipts.
7. A typed semantic conflict retains both personal identities and every local queue.
   Explicit conflict retry must obey immutable receipt and vacancy rules. Changing
   targets alone cannot adopt, merge or delete the duplicate.
8. In-flight original client acknowledgements/errors must compare the exact persisted
   intent and recovery state transactionally; they cannot erase a newer recovery
   proposal. Sync skips original delivery while a recovery proposal is active.
9. Recovery acknowledgement atomically records durable import provenance, updates
   only intended collection metadata and retires exactly the acknowledged recovery
   and import records. Concurrent local learning/private edits must survive.
10. Repeated target failure, repeated recovery and multi-device attempts need an
    explicit lineage/serialization rule. A late older recovery must not overwrite a
    newer chosen target. Do not assume one retarget is enough or silently loosen
    recovery to get an initial happy path working.

## Candidate direction to evaluate

Use an additive authenticated settlement/recovery RPC bound to the original
immutable intent, an explicit owned target and a durable recovery operation. Keep
a private owner-scoped settlement/receipt ledger so an unseen original operation
can be cancelled without forging an inserted/conflict receipt. The original apply
RPC checks that settlement under its existing operation lock before a new insert;
cached receipts remain historical acknowledgements, never mutations.

If original delivery is proven inserted, authorize only a metadata move of its
active owned ID. If not inserted, validate the original source/provenance and new
owned target and attempt an insert with the original proposed ID and server SRS
defaults. Both paths require durable recovery receipts and no resurrection.

On the client, add an owner/word-bound recovery outbox beside the untouched import
intent; create it in one SQLite transaction and deliver it before dependent queues.
Any stale original reply must see the outbox and refrain from acknowledgement.
Acceptance must compare the exact queued recovery before changing local metadata.
The draft intentionally leaves repeated-recovery lineage unresolved: choose and
test a safe bounded rule before migrations or client queue changes are implemented.

## Required adversarial cases for the accepted design

| Case                                                                      | Required result                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Original target gone, request never delivered                             | One same-ID import in chosen owned target; queues retained       |
| Original success with lost reply                                          | Same existing ID moved only if authorized; SRS/content unchanged |
| Original request arrives after recovery commit and old target restoration | No second insertion or target rollback                           |
| Recovery succeeds with lost reply                                         | Exact receipt replay; no repeated move/reset                     |
| Original/recovery acknowledged ID remotely deleted                        | Preserve local identity/debt; no resurrection                    |
| Active semantic duplicate on another client                               | Typed conflict; neither identity/history merged                  |
| Original receipt/error arrives after local recovery enqueue               | Recovery remains durable; no stale acknowledgement               |
| Owner changes during prepare/send/receipt                                 | No cross-owner publish, acknowledgement or metadata move         |
| Learning or private edit occurs during recovery                           | Learning/content queues and current local values survive         |
| New target deleted or becomes unavailable while recovery is unknown       | Safe retained state and a defined next recovery action           |
| Two recovery choices race or older recovery arrives late                  | Defined lineage result; no stale target overwrite                |
| Read-only account and existing synced target                              | Preserve accepted import/move rules; no collection INSERT        |

## Exact next checkpoint

Review the source import/receipt SQL and client transaction boundaries against this
matrix on Astra / High; accept or replace the candidate and resolve repeated-recovery
lineage. Save the accepted contract and evidence before switching back to GPT-6.1
Sol / High for implementation. Additive SQL/SQLite migrations, generated target
types, recovery UI and concurrency tests follow only that accepted contract.
Keep all QA resources off during this architectural work. No hosted action or new
Git publication is implied. D10 remains active; do not start D11.
