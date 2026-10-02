# D10 web transfer R1/R2 repairs

Date: 2026-10-02. Starting HEAD `9150845`, application baseline `ab8d603`, review
tests `46eb250`; existing branch `feature/shared-dictionary-schema`.
User confirmed the requested GPT-6.1 Sol / High switch. AUTH-17/AUTH-18.

## R1 — Public origin validation

The production route now uses the server-only `hasSameTransferOrigin` boundary.
It reads mandatory raw Host instead of the adapted URL hostname. The request URL
supplies the scheme, so loopback normalization, wildcard binds and internal URL
hostnames no longer reject a valid browser Host/Origin pair.

Policy:

- Origin must be a canonical HTTP(S) origin without credentials, path, query,
  fragment, null or a list. Host must be a single valid authority. Missing,
  malformed, comma-separated or cross-origin inputs fail before authentication.
- Forwarded Host, when present, must match the browser origin. Forwarded Proto,
  when present, must be a single `http` or `https` value. Conflicting headers fail
  even when the direct Host matches. Consistent headers grant no extra authority.
- Bridging a different internal Host or TLS-termination scheme requires a public
  origin explicitly configured in the existing `NEXT_PUBLIC_SITE_URL`, otherwise
  `VERCEL_URL`, and a matching Forwarded Proto / public authority. The localhost
  fallback in `getSiteOrigin()` cannot grant this override. Invalid configuration
  and a mismatched explicit site URL fail closed.
- Proxy ingress must overwrite forwarded headers; a configured public origin is
  the bounded deployment policy, not a generic permission to trust arbitrary
  forwarding values. No new setting, wildcard, Next config change or environment
  value change was made. Direct Host validation remains available for ordinary
  local/deployment requests without a proxy override.

The actual installed NextRequestAdapter regressions now assert successful command
execution for all three former counterexamples. Additional route tests assert
configured/unconfigured proxy behavior and rejection before auth for conflicts.
Domain tests cover loopback IPv4/IPv6, strict header syntax, deployment-origin
precedence, TLS termination and fail-closed configuration cases.

## R2 — Attempted destination remains immutable in uncertain feedback

UI feedback is a discriminated union: uncertain outcomes require the collection
ID captured by that submission. Both an uncertain server receipt and a transport
failure store it. The check link uses this attempted ID and the label
`Check the attempted collection`; changing the next target cannot move the link.
Manual Preview again clears the uncertain state before another explicit submission.
No automatic replay, collection creation, SRS change or fallback target was added.

The review UI counterexample is converted to two safety regressions: lost
transport and uncertain receipt. They verify one request to A, selection change
to B, a check link still to A, disabled submission, and re-preview without a write.
Historical counterexamples remain recoverable in `46eb250`.

## Local verification and next gate

- Focused web tests: **11 suites / 134 tests PASS**. Command:
  `npm run web:test -- dictionary-transfer DictionaryDocumentImport DictionaryExportPanel useTransferSession dictionary-import/page`.
- Web type generation and test-inclusive TypeScript PASS; strict scoped web
  ESLint, Prettier and diff checks PASS. An intermediate mixed-header test array
  needed an explicit Record type; final typecheck passes without suppression.
- Four of the prior 133 fingerprinted web files intentionally changed; 129
  baseline files remain exact. Four files are added to the current hash inventory:
  two converted review tests and the new origin helper/test. Current manifest: 137.
- Normal local commit hooks are next. No dependency, SQL/RPC, mobile application,
  runtime feature flag or published manifest change.

Next: GPT-6 Astra / High re-review of the repair commit before actual browser and
cross-owner/mobile-web acceptance. D10.3–D10.5 remain open; D11 is not started.
No backend/device/browser inspection or operation in this checkpoint. The user's
explicit device availability handback is still required before simulator/emulator
use. Private QA fixtures, `.playwright-cli/`, root AGENTS exclusion and the paused
automation remain intact. No push/PR/merge, production, schema cutover, publication,
deployment or paid operation.
