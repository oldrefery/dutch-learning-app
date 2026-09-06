# @woordenaar/domain

Framework-independent product contracts and pure business logic shared by the
mobile and web applications.

This package must not import React Native, Expo, Next.js, browser APIs, or a
storage implementation.

The `review-flow*` modules define shared review-session transitions: active question,
read-only history, assisted skips, idempotent submission state, paused auto-advance,
and confirmed assessment summaries. Platform adapters own UI and persistence; see
[the integration contract](../../docs/review-flow-state-2026-09-06.md).
