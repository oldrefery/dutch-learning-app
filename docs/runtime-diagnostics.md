# Runtime diagnostics for crash investigation

Mobile event scope includes `runtime_diagnostics`, a small prior-run snapshot.
It contains a fixed screen-category label, lifecycle state, time since monitoring
started, observed memory-warning count, recovered JavaScript-stall count and the
largest observed timer delay. It contains no route parameters, collection names,
word content, account IDs or URLs.

The native Sentry scope receives the context before an error occurs. Updating
only JavaScript `beforeSend` cannot reconstruct the state of a process that was
already killed. For watchdog events, the native SDK reconstructs prior-run state;
the event timestamp may be the last persisted breadcrumb rather than kill time.

A foreground-only timer runs every five seconds. Healthy ticks perform no scope
writes. A delay of at least two seconds beyond that interval records a recovered
stall, with at most one stall publication per minute. Background and inactive
transitions reset timing; the timer stops outside the foreground. Counters are
bounded and the monitor has no event-history buffer. Navigation and lifecycle
changes and memory warnings update the snapshot. No extra error event, profiling,
screenshot, replay or sampling change is introduced.

`observed_at_uptime_ms` dates the snapshot relative to monitor startup, not native
process launch or crash time. A recovered timer delay is not proof of a blocked
native UI thread or the reason for a watchdog kill. Zero observed memory warnings
does not establish low application memory use. Sudden kills can occur before any
warning or recovered-stall callback runs. Screen categories are intentionally
coarse, and the last persisted context can be older than the final activity.

Native SDK details: [watchdog detection](https://docs.sentry.io/platforms/apple/guides/ios/configuration/watchdog-terminations/)
and [custom context](https://docs.sentry.io/platforms/react-native/enriching-events/context/).
Local QA runs retain their existing telemetry isolation. Simulator measurements
cannot establish physical-device memory limits or validate the native watchdog
heuristic, which excludes simulator builds.
