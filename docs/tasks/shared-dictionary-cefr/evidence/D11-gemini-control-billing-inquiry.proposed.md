# Proposed Gemini Developer API control-billing inquiry (unsent)

Date prepared: 2026-10-03. This is a local draft. It contains no account,
project, credential, source meaning or user data. Sending it to Google support
requires separate explicit authorization.

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
points billing questions to a billing support case. Do not submit this draft,
post it to a public forum or add private account details without explicit user
authorization. A support answer must identify both REST methods and the current
paid Standard plan before it can satisfy the pilot's control-billing gate.
