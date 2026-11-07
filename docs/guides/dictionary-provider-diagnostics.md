# Dictionary provider transport diagnostics

The configured `dictionary-analysis` and `dictionary-creation` endpoints emit one
`dictionary-provider-transport-v1` JSON console event when a provider transport
invocation finishes. It records the workflow, SHA256 of the internal invocation
key, outcome, technical reason, observed HTTP status, allowlisted Google status,
and elapsed milliseconds. It does not contain account IDs, credentials, raw
invocation keys, prompts, provider output, URLs, headers, or exception text.

Look in Supabase `function_logs`, using a narrow time window. Match
`attempt_sha256` to the SHA256 of the selected paid attempt's `invocation_key`,
computed locally from the operator's private evidence. Do not copy unrelated log
messages or full metadata into shared reports. Export only the matched technical
projection before the project's log retention expires.

| Reason                       | Observed fact                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `response-received`          | The bounded response was processed; content still needs normal journalling and validation. |
| `http-error`                 | An unsuccessful HTTP response was read. The existing 4xx/5xx classification is unchanged.  |
| `timeout`                    | The local abort timer fired. This does not establish provider cancellation.                |
| `fetch-failed`               | Fetch failed before a response was available. The underlying cause is not inferred.        |
| `missing-response-body`      | The response had no readable body.                                                         |
| `response-too-large`         | The existing 32 KiB response limit was exceeded.                                           |
| `response-read-failed`       | Reading the response stream failed.                                                        |
| `response-decode-failed`     | The response was not valid UTF-8.                                                          |
| `response-processing-failed` | Processing failed after the body was read.                                                 |

An absent HTTP status means no response status was observed. A successful HTTP
status combined with a read failure still leaves the paid outcome uncertain.
Logging errors are contained and never replace the business outcome or cause a
retry. These records are operator diagnostics, not client receipts or monetary
reconciliation evidence. They cannot authorize a retry, release a reservation,
accept content, or publish a revision.

This is retention-limited platform logging, not an additional database journal.
A terminated worker, platform ingestion failure, or failure before entering the
provider transport can leave no event. Absence of an event does not prove that
no provider request occurred. Events cannot reconstruct earlier failed calls
that ran before this instrumentation was deployed.

References, checked 2026-11-07:

- [Supabase log sources and fields](https://supabase.com/docs/guides/observability/log-field-reference)
- [Query logs with SQL](https://supabase.com/docs/guides/observability/advanced-log-filtering)
- [Management API logs endpoint](https://supabase.com/docs/reference/api/v1-get-project-logs)
