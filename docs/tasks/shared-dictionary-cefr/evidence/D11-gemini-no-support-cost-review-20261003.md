# D11 Gemini diagnostic: no-support cost review

Reviewed 2026-10-03 on `feature/shared-dictionary-schema`. This is a local
engineering review of the frozen, unapproved 24-meaning pilot. It does not
authorize credential access, source transmission or a provider call.

## Current bound and documentation

The frozen [authorization packet](D11-gemini-live-authorization-packet-20261003.md)
reserves $1.913472 for 48 generation attempts at the published Gemini 3.5 Flash
Standard token rates. The proposed $2 API-use ceiling leaves $0.086528 for 24
`models.countTokens` calls and one `models.get` call. The private execution
validator requires finite per-control maxima and a verification reference; no
such verified values have been supplied.

Google's [token guide](https://ai.google.dev/gemini-api/docs/tokens) documents
the direct REST `models.countTokens` method as a pre-generation input-token
count. Its [billing FAQ](https://ai.google.dev/gemini-api/docs/billing) says
`GetTokens` requests are unbilled and outside inference quota, but does not
explicitly equate `GetTokens` with this REST method. The
[Models API reference](https://ai.google.dev/api/models) does not state a
charge or a finite maximum for `models.get`. The
[pricing table](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash)
does not separately price either control method. Context7 documentation lookup
on 2026-10-03 returned these same sources without resolving the naming or
metadata-price gaps. No support inquiry will be sent, per the user's direction.

## Local alternatives checked

All 24 frozen generation bodies were prepared locally with a fixed dummy run ID;
only byte lengths were printed. Their UTF-8 sizes range from 2,266 to 2,480
bytes, totaling 57,104 bytes for one attempt per meaning. The current code allows
up to 32 KiB per body. Byte length cannot establish the model's billed token
count, including any protocol overhead. The 2,000-input-token reservation is
therefore enforced by the pre-generation `countTokens` result, not by the local
body-size check. Dropping `countTokens` without a verified replacement would
weaken the generation cost bound; dropping `models.get` would also remove the
preflight model/capability check. Neither change is justified solely by the
available documentation.

A single synthetic, control-only probe could limit the number of unknown-charge
calls and avoid transmitting any of the 24 meaning inputs. It could provide an
observed charge after billing data settles, but one observation is not a
published per-request maximum, and delayed reporting cannot enforce a hard
ceiling. This is a possible separately reviewed experiment, not the frozen
pilot or proof that its combined cost is at most $2.

## Decision for the current checkpoint

Keep the existing control-first runner, frozen bundle, unapproved registry and
`qualified: false` state. Do not enter guessed control prices or a speculative
verification reference. Before the 24-item pilot can run under a hard $2
ceiling, obtain authoritative direct-REST control billing bounds that satisfy
`24 * count_request_max_microusd + metadata_request_max_microusd <= 86528`,
or explicitly review a different cost policy and implementation. Exact personal
key/project binding and permission to transmit the 24 inputs remain separate
gates. No credentials, provider calls or external writes occurred in this review.
