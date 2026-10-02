# D10 web transfer repair re-review — 2026-10-02

Result: PASS, no new actionable findings. User confirmed requested Astra / High.
Reviewed source `19d98eb`, starting HEAD `0d9e835`, existing feature branch.

- Raw Host plus request scheme accepts the real Next adapter's normalized/internal
  request URL without trusting its hostname. Canonical HTTP(S) Origin is mandatory.
- A proxy/TLS override requires an explicitly configured site/deployment origin;
  the default localhost fallback is not a trust anchor. Missing/malformed/conflicting
  authority or forwarded headers fail closed. The ingress must overwrite forwarded
  headers; this is a documented deployment boundary, not arbitrary client authority.
- Uncertain feedback captures the submitted collection ID in both rejected transport
  and uncertain receipt paths. Subsequent target changes cannot move the check link.
  Another write still requires explicit preview; no automatic retry or retarget.
- Scope remains content-only, freshly authenticated, bounded and feature-gated.

Validation: Node 24.20.0, `npm run web:test -- dictionary-transfer-origin route.review
DictionaryDocumentImport.review`: 3 suites / 54 tests PASS. All 137 source manifest
fingerprints match before runtime acceptance. Prior full normal-hook results remain
recorded in the repair evidence; unchanged mobile checks were not repeated.

Next: actual local browser acceptance using the retained task stack and fresh isolated
web source copy. Preserve database/fixtures; do not reseed, migrate or reset. Only
named task containers and ports 55321/55322/55331/55400. Native devices require explicit
availability handback. D10.3–D10.5 remain open, D11 not started.

Runtime checkpoint: local export and clipboard PASS; source-owner preview correctly
marks all four entries already added. Pre-write pg_dump and full row snapshots saved
privately under `reports/shared-dictionary-cefr/d10-web-acceptance-20261002/`.
Intent: temporarily set only the retained isolated synthetic owner's access to
read_only, import the self-contained primary export into its existing collection,
then restore its original full_access. Inspect baseline.json/readonly.sql for exact
scope before recovery; do not change other owners or replay uncertain imports.

Runtime checkpoint: read_only isolated owner imported exactly one selected `fiets`
into its existing Isolated Owner collection. Browser interception fetched once with
maxRetries=0, recorded HTTP 200/savedCount=1, then aborted the response. UI displayed
uncertainty, disabled submit, and kept the check link on the attempted collection
after selecting My Words. Opening the link confirmed the saved word. Database moved
12→13 words, 9→10 content states; no uncertain mutation remains. Next fresh preview
imports remaining three, preserving the saved word's original placement. Temporary
read_only access remains active until QA completion. No mobile operation.
