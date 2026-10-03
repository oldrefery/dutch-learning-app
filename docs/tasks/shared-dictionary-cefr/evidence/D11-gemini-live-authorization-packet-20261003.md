# D11 diagnostic Gemini pilot — authorization packet (unapproved)

Prepared 2026-10-03 on `feature/shared-dictionary-schema` from reviewed runner
`0893a2e` and documentation receipt `58bb193`. This packet is a request for a
single diagnostic run, not an approval or an execution instruction. No account,
project, credential, billing record or provider endpoint was accessed.

## Exact proposed scope

| Item                     | Bound                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                  | Compare provider predictions with a provisional model-origin reference; no CEFR qualification, publication or worker activation                                                                |
| Frozen inputs            | The 24 `item_id`/`input_sha256` pairs in [the unapproved live draft](D11-gemini-live-request.proposed.json); bundle SHA-256 `154340a433175cdd542e06b2967ac6a66a649f4ee3ce752225e61ae6f092db4a` |
| Data sent                | Canonical meaning inputs and generation instructions only; no reference bands, user account, learning history or media                                                                         |
| Provider                 | Gemini Developer API REST, `gemini-3.5-flash`, paid Standard, one candidate, text only, no tools, search, cache, Batch, Flex or Priority                                                       |
| Requests                 | At most 24 `models.countTokens`, one `models.get`, and 48 `generateContent` attempts (two per meaning); concurrency one, five-second request timeout, no control retries                       |
| Window                   | One explicitly approved UTC day and expiry no later than its end; one bound run ID, run directory, credential digest and external consumption record                                           |
| Generation reservation   | 2,000 input tokens and separately reserved 2,048 answer plus 2,048 thinking tokens per attempt; 48 × $0.039864 = **$1.913472**                                                                 |
| Proposed API-use ceiling | **$2.000000** for all generation and control requests combined; never exceed the bound in the private registry                                                                                 |

The four bundled inputs (`huis`, `boek`, `fiets`, `water`) have an
app/repository-limited source license. The remaining 20 are original diagnostic
drafts. Explicit permission to transmit **all 24 exact hashes**, including the
four bundled inputs, is required. The linked draft is `approved: false` and each
input remains `transmission_approved: false`.

## Public price evidence and unresolved control charges

The [official Gemini 3.5 Flash pricing table](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash)
lists paid Standard input at $1.50 per million tokens and output, including
thinking, at $9.00 per million. Its displayed table does not give a separate
charge or explicit zero-price rule for `models.countTokens` or `models.get`.
The [Gemini billing FAQ](https://ai.google.dev/gemini-api/docs/billing) says
`GetTokens` requests are unbilled, but does not identify that name with the
[`models.countTokens` REST method](https://ai.google.dev/api/tokens) used here.
The [Firebase AI Logic count-tokens guide](https://firebase.google.com/docs/ai-logic/count-tokens)
explicitly says `countTokens` is free in its documented integration. This is
supporting evidence, not proof of direct Developer API REST billing for this key.
The [Models API reference](https://ai.google.dev/api/models) documents
`models.get` as a metadata GET without stating its billing treatment. Therefore
the complete live charge is **not verified** and both private control-cost maxima
and `control_billing_verification_ref` must remain unset.

The proposed $2 ceiling leaves **86,528 micro-USD ($0.086528)** after the
1,913,472 micro-USD generation reservation. A usable verified control bound must
satisfy `24 × count_request_max_microusd + metadata_request_max_microusd <= 86528`.
For illustration only, reserving 3,000 micro-USD for each count call would leave
14,528 micro-USD for metadata. That example is **not** a provider price or an
approved bound. Taxes, currency conversion and account-specific charges are
outside the proposed API-use ceiling and need separate account review. A pricing
change or an unbounded control charge requires a revised packet and approval.

## Evidence required before an executable private registry exists

1. Obtain the user's authorization to inspect the intended **personal** Google
   account/project and the local secret key binding. Record the personal account
   identity, exact project identifier, paid plan/billing status, key-to-project
   membership, key type/restrictions and billing evidence in private references.
   The [official key guide](https://ai.google.dev/gemini-api/docs/api-key) says
   newer authorization keys bind to a service account and standard keys
   associate requests with a Cloud project; unrestricted standard keys are
   rejected. Do not copy the key or account details into the repository. Check
   any linked billing account/currency and whether the project has other
   concurrent use; the local $2 ledger only bounds this pilot's reserved API
   requests.
2. Obtain authoritative billing evidence for the direct REST `models.countTokens`
   and `models.get` methods under the intended plan, with finite per-request maxima
   satisfying the equation above. Recheck the model/tier tariff at approval time.
   If this evidence cannot be established, leave the live runner disabled and
   seek a separately reviewed design or budget change.
3. Ask for a single explicit human approval naming the 24 exact hashes, provider,
   personal account/project/key binding, one UTC day, 24+1 control requests,
   48 generation attempts, and the combined API-use ceiling. Account inspection
   permission does not itself authorize transmission or spending.
4. Only after the preceding evidence and approval, create owner-only private
   draft/registry/key paths, bind their digests, run UUID/directory, UTC day,
   expiry and external journal record. Run the no-HTTP `--check` first. The
   `--execute` mode remains separately dependent on the exact approval; preserve
   the journal and consumption record across resume.

The [disabled registry template](D11-gemini-execution.unapproved.json) and
[review](D11-gemini-runner-review-20261003.md) describe the executable contract.
The separate report must remain unqualified; provider agreement with an
assistant-authored reference cannot establish independent CEFR accuracy.

## Read-only account inspection checkpoint

On 2026-10-03, after explicit user permission, the signed-in personal Google AI
Studio API-keys, Projects and Billing pages were inspected read-only. Two imported
projects displayed paid Tier 1 Postpay and masked keys under the same billing
account. The page did not identify which key is used by this application, and did
not expose key type or restrictions in the inspected table. No key value was
revealed or copied, and no account/project/key identifiers are persisted here.
The Billing page displayed an upcoming plan transition; recheck the active plan
and credit availability before seeking live approval. No settings, purchase,
credential, provider request or execution registry changed. Direct REST control
billing and the complete cost bound remain unverified.

An [account-free billing inquiry](D11-gemini-control-billing-inquiry.proposed.md)
is drafted locally but unsent. It asks Google to identify the direct REST
charges for both methods. Sending it is a separate external communication gate.

## Personal-console and spending checkpoint — 2026-10-03

The user authorized read-only Credentials inspection and one send of the prepared
inquiry only from the personal account. The signed-in identity was verified on
both personal Cloud Console project pages. Available Gemini API-restricted keys
showed no bound service account; one showed no application restriction. No key
value was revealed or copied. These page observations do not identify the
application's exact secret-to-key/project binding.

The user subsequently allowed a small paid diagnostic without another spending
prompt, retaining the personal-account restriction. This does not establish
control-method billing or raise the frozen $2 API-use ceiling. The support
assistant requires a billing-account selection before sending the account-free
inquiry. Automatic approval review rejected navigating to the private Billing
product to determine that link as outside the earlier Credentials/support scope.
The exact read-only billing-page permission is pending. No inquiry was sent; no
source was transmitted, no paid API call occurred, and no registry was enabled.
The complete cost bound and executable account/key binding remain unverified.
