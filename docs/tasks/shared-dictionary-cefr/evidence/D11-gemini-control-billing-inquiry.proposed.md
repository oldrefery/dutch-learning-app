# Proposed Gemini Developer API control-billing inquiry (canceled, unsent)

Date prepared: 2026-10-03. This local draft contains no account, project,
credential, source meaning or user data. The user originally authorized one send
from `oldrefery@gmail.com`. It was not sent. The user then canceled the inquiry.
Do not submit it on resume; retain the unchanged message below only as historical
documentation of unresolved cost questions.

## Subject

Billing of direct REST `models.countTokens` and `models.get` requests

## Message

We are preparing a small, paid Standard-tier Gemini Developer API diagnostic
using `gemini-3.5-flash` through the direct `generativelanguage.googleapis.com`
REST API. Before authorizing any API calls, we need a complete upper bound for
24 requests to `POST /v1beta/models/gemini-3.5-flash:countTokens` and one request
to `GET /v1beta/models/gemini-3.5-flash`.

1. Is the direct REST `models.countTokens` method billed for this paid Standard
   model and tier? If so, what are the billing unit, rate and per-request upper
   bound for a text-only request containing `generateContentRequest`? Does the
   [Gemini billing FAQ](https://ai.google.dev/gemini-api/docs/billing) statement
   that `GetTokens` is unbilled refer to this same REST method?
2. Is the direct REST `models.get` metadata request billed? If so, what are the
   billing unit, rate and per-request upper bound?
3. Are there any other mandatory API-use charges for those two control methods,
   without tools, grounding, explicit cache or file upload? Please link the
   applicable current official pricing or billing documentation.

We are asking about the direct Gemini Developer API REST methods, not Firebase AI
Logic or the Agent Platform Gemini API. We will confirm account-specific
currency, taxes and billing conditions separately through a private billing
channel. No credentials or project identifiers are included in this inquiry.

## Routing

Google's [Gemini troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting)
points billing questions to a billing support case. The user directed that no
question be sent; do not submit this draft or post it publicly. The unresolved
control-method charges require a separate no-support design decision before the
pilot can become executable.
