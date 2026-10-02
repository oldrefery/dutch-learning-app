# D10 R3 repair re-review

User confirmed the requested GPT-6 Astra / High switch. Starting HEAD `833835d`,
reviewed repair `976d1e7`, AUTH-17/18/19, existing feature branch.

## Review result

PASS: no new actionable finding in the bounded R3 change. Auth-entry redirects
require `getUser()` without a returned error; missing/revoked users and thrown
validation failures keep the entry route reachable. Protected routes remain
optimistic in Proxy, while protected page data still requires the existing server
user guard. This breaks the observed redirect cycle without adding server user
validation to every protected Proxy pass. Auth pages do not add a second redirect.
The existing request/response cookie bridge and redirect cookie copying remain
intact; the new live-user check uses that same SDK client. No native sign-out or
protected-data authorization change.

Four focused suites / 45 tests pass on the reviewed source, including the converted
revocation counterexample, valid control, missing/error/throw cases and cookie
rotation/deletion. Prior normal-hook results remain recorded with `976d1e7`.

## Runtime continuation intent

Start only the four retained `woordenaar-d08-qa.ZFsE50` containers and isolated
web runner (55331/55400). Save a pre-write snapshot. Confirm the repaired redirect
with a fresh synthetic session revoked locally, without changing another client's
session. Then use only assigned devices for the still-open cached official
read_only/offline and mobile Safari acceptance. Preserve existing data; do not
reset, reseed, replay completed imports, or begin D11. Record exact new operations
and restore access/session/transport state before task-only shutdown.

## Actual runtime result

PASS on the retained loopback stack: protected 200 for a valid fresh synthetic
session; after local-scope revocation, protected 307 to login and all three auth
entry pages 200 with no cycle. The token remains signed/unexpired, reproducing
the original boundary. See [runtime evidence](D10-final-runtime-20261002.md).
