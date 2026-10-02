# D10 review — missing web document transfer integration

Date: 2026-10-02. Application source `c3f9baf`, repository HEAD `559321a`.
Review on user-confirmed GPT-6 Astra / High. No application changes in this review.

## Finding

D10.5 cannot close its both-client acceptance gate: web JSON document export and
reimport exist as server-only helpers, but no production page, route handler or
server action calls them. The current UI exposes sharing by link and official
pack import, not self-contained document transfer. This is unfinished integration,
not a demonstrated regression in an existing web transfer UI.

Evidence:

- `apps/web/src/features/sharing/dictionary-transfer.ts` exports
  `exportOwnedDictionaryCollection` and `importDictionaryCollectionExport`.
- Repository-wide references to both functions are limited to that module and
  `dictionary-transfer.test.ts`. Those tests mock the Supabase RPC boundary.
- `export_dictionary_collection_v1` is called only inside that helper.
- `apps/web/src/app/app/collections/[collectionId]/page.tsx` mounts sharing,
  rename and delete settings, without document transfer controls.
- `CollectionSharingPanel.tsx` copies a published share URL, not an export document.
- The other production call to `import_dictionary_copies_v1` is the bundled
  Essentials fallback in `features/starter-pack/dictionary-import.ts`.

Read-only reproduction:

```bash
rg -n 'exportOwnedDictionaryCollection|importDictionaryCollectionExport' apps/web/src
rg -n 'export_dictionary_collection_v1|import_dictionary_copies_v1|parseDictionaryCollectionExport' apps/web/src
```

The existing helper/unit/SQL tests remain valid contract evidence. They do not
establish that a web user can export, paste, preview, select and reimport a document.
Do not substitute direct helper invocation or a QA-only route for that missing UI.

## Next implementation checkpoint

Use GPT-6.1 Sol / High under AUTH-17/AUTH-18. Connect the accepted schema-v1 content
transfer contract to default-off web controls and authenticated actions, reusing
the existing helpers and normal owned-collection UI patterns. Preserve:

- An owned export, without publishing a collection or generating a share token.
- Validated self-contained content only; no source personal IDs, private revision
  dependencies, mobile import roots, SRS or learning history in the document.
- Explicit preview/selection and an existing owned destination; preserve the
  existing read-only import policy and one-collection duplicate behavior.
- No silent retargeting or automatic retry after an uncertain response. Existing
  cards, progress and collection metadata must remain intact.
- Account-change protection, truthful saved/error feedback and normal cache
  refresh; dormant/signed-out entrypoints must remain unavailable.
- Bounded input and invalid/future/dependent document rejection before writes.

Add action/UI regression coverage, then Astra / High review and task-only browser
acceptance including cross-owner and mobile ↔ web transfer. Continue the remaining
official/shared/bundled integrated matrix afterward. D10.3–D10.5 remain unchecked;
do not begin D11. Current-thread model switching is unavailable in the exposed
tools; obtain manual model confirmation before claiming Sol / High.
