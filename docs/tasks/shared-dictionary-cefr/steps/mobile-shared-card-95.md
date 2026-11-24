# Shared card display and reanalysis on mobile

Status: local fix committed, distribution pending. Recommended continuation model is GPT-6.2 Sol / High.

- [x] Confirm the handled reanalysis error in production Sentry on physical iOS 2.6.2 (95).
- [x] Reproduce the missing shared content using an empty personal projection and a cached published revision in SQLite.
- [x] Enable the shared content reader, following protocol and server-gated shared analysis in the store build profile. Keep the local private-edit protection.
- [x] Recheck restoration of translations, card identity, learning state and shared analysis availability.
- [ ] Qualify the change on the locked SDK 58 dependencies and a build installed from the intended distribution channel. Check the exact saved phrase, translations and shared analysis action on a physical phone.

## Evidence

The original store build log lists no dictionary flags from the profile or production environment. Production Sentry issue 6H records the private reanalysis operation on a shared card in the embedded iOS bundle. The old profile reproduced the empty translations and missing following-mode metadata. The regression passed after the profile change.

Five focused suites using the available SDK 57 test dependencies ran 112 tests. The 110 passes include shared/private action selection, the store-profile regression and protection of learning state. Two existing light/dark background assertions failed at the host-element matcher. Offline installation of the exact SDK 58 lockfile stopped at an uncached dependency. Full CI and device acceptance are outstanding.

For the next check, open the saved phrase through Add Word, inspect both translations, and confirm the shared analysis action is available to an eligible account. Observe the existing card ID, collection and review schedule. Production generation or distribution is a separate operation.

Track Android word-sync RLS failures and recovery-email delivery separately. The build-95 Sentry search also returned a learning-sync health warning.
