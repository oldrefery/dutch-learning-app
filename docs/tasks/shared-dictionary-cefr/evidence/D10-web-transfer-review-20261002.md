# D10 web document transfer review — changes required

Date: 2026-10-02. Reviewed application source `ab8d603`; starting HEAD `5d95165`,
branch `feature/shared-dictionary-schema`. User confirmed the requested switch to
GPT-6 Astra / High. AUTH-17/AUTH-18. No application repair in this checkpoint.

## R1 / P1 — Valid browser origins are rejected after Next.js URL adaptation

Location: `apps/web/src/app/api/dictionary-transfer/route.ts:51`.

The handler compares the raw browser Origin with `new URL(request.url).origin`.
The installed Next.js 16.3.3 does not guarantee that this URL keeps the public host:

- `server/web/next-url.js` normalizes loopback IP hostnames, including `127.0.0.1`,
  to `localhost`. A browser at `http://127.0.0.1:55400` sends that IP in Origin and
  Host, while the adapted request URL becomes `http://localhost:55400/...`.
- `NextNodeServer.attachRequestMeta` can construct `initURL` from the configured
  `fetchHostname` and port. A wildcard bind or internal proxy hostname can differ
  from the browser's Host / forwarded public host.
- The actual app-route template calls `NextRequestAdapter.fromNodeNextRequest`.

`route.review.test.ts` uses the installed NodeNextRequest and NextRequestAdapter,
then invokes the actual production POST handler. Three legitimate cases return
403 before authentication or command execution: loopback IP normalization,
wildcard bind versus localhost, and internal proxy host versus public origin.
A same-public/internal-localhost control returns 200. No listener, browser,
backend or remote request is needed to reproduce this framework boundary.

Impact: both Prepare JSON export and Import are unavailable for these otherwise
valid same-origin requests, including loopback-IP local QA. Existing tests use a
plain Web Request with matching URL/Origin, so they do not cover the adaptation.

Repair contract: validate against the legitimate externally visible request host/
origin using an explicit Host / trusted proxy-header policy consistent with the
runtime. Keep strict JSON POST and fail-closed handling of missing, null, malformed,
cross-origin and conflicting/untrusted host inputs. Do not disable the origin guard,
trust Origin itself as authority, add wildcards or change global Server Actions
limits. Convert the adapter counterexamples to acceptance regressions and add
negative host/origin/proxy-header cases.

Documentation checked through Context7 `/vercel/next.js`: the framework's Server
Actions compare Origin host with Host or X-Forwarded-Host. That built-in validation
does not automatically protect this custom Route Handler. References:
[data security](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx),
[action handler](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/action-handler.ts).
Installed source, rather than unpinned documentation alone, establishes the exact
loopback adaptation observed by the reproducer.

## R2 / P2 — An uncertain import loses its attempted destination in the check link

Location: `apps/web/src/features/sharing/DictionaryDocumentImport.tsx:177-198`.

Submit to collection A, lose the reply, then select collection B. The destination
select becomes enabled after the request finishes. The uncertain feedback stores
only message/boolean, and its check link reads mutable `target`, so the link now
opens B even though the only submitted request targeted A. The import could have
committed into A. This sends the user to the wrong place to reconcile the result.

`DictionaryDocumentImport.review.test.tsx` reproduces this with two existing owned
collections and one rejected transport promise. It verifies exactly one request
to A, no request to B, a still-disabled import button, and the check link drifting
to B. This is a recovery-feedback defect, not proof of duplicate creation or an
automatic retry; the server's global duplicate policy remains intact.

Repair contract: retain the attempted destination with the uncertain operation
and use that immutable destination for its check link/label, or prevent changing
it while reconciliation is pending. Keep explicit re-preview before another
submission and do not silently move, recreate or retarget the earlier operation.
Convert the counterexample to an original-destination safety assertion.

## Verification and limits

- Two new review suites / five tests PASS: four counterexamples and one valid
  control. Passing here proves the reported defects, not acceptance of the feature.
- Command: `npm run web:test -- DictionaryDocumentImport.review route.review`.
- Web type generation and test-inclusive TypeScript PASS; strict scoped ESLint,
  Prettier and diff checks PASS. All 133 application fingerprints remain unchanged.
- Initial test assumed 127.0.0.1 survived adaptation; it failed because Next.js
  normalizes it to localhost. The final test uses an IP browser Origin and asserts
  the observed normalized URL. Do not repeat the incorrect assumption.
- Reviewed strict document parsing, fresh owner/target checks, content-only RPC
  payload, global duplicate handling, readonly access, no-replay uncertainty,
  successful-write cache handling, auth epochs and clipboard gesture separation.
  No further blocking finding established in those reviewed paths.
- No simulator/emulator/browser/backend inspection or operation; no actual
  cross-owner or both-client acceptance claim. Devices still require explicit
  availability handback from the user before any use.

Next: GPT-6.1 Sol / High for R1/R2 repairs, then Astra / High re-review and remaining
integrated acceptance. Current-thread picker is unavailable. D10.3–D10.5 stay open;
do not start D11 or repeat completed native upgrades/R1/R2 mobile recovery checks.
Necessary local commits only. No push/PR/merge, production, cutover, publication,
deployment, paid operations or automation change.
