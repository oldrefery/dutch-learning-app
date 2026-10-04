# D08.4 isolated platform QA

Date: 2026-09-21\
Implementation / QA model: GPT-5.6 Sol / High\
Branch: `feature/shared-dictionary-schema`\
Committed HEAD: `c5dfb14d49b9a53521b53e13bdd19991999ede5d`\
Persistence: all D03–D08 changes remain local, uncommitted and unpushed

September 26 review note: the recorded passing scenarios below remain historical
evidence. The [closure review](D08-closure-review.md) found missing native content-
edit/conflict scenarios and made UI fixes requiring new builds. The earlier
assessment that D08.4 execution was complete is superseded; D08.4 remains open.

## Scope and isolation

AUTH-15 covered only disposable native builds/devices, a loopback Supabase stack,
synthetic `example.invalid` owners and local web verification. Production, hosted
preview data, real accounts, EAS, paid calls, deployment, activation and cutover
were not used. `EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED` was enabled only in the
isolated QA artifacts; repository/release defaults remain off.

- Loopback API: `127.0.0.1:55321`; task root
  `/private/tmp/woordenaar-d08-qa.y1lZRm`.
- Native build root: `/private/tmp/woordenaar-d08-native.a0Yyff`.
- iOS task device: `Woordenaar D08 QA 20260921`, iOS 26.5.
- Android task AVD: `woordenaar_d08_qa_20260921`.
- Two synthetic owners were used. Credentials and identifiers remain only in the
  private mode-0600 fixture and are not reproduced here.
- Existing user simulators, retained D01 devices, production accounts and user data
  were not touched.

## Artifacts and rollout checks

The build helper isolates Metro caches by flag value. This was required after an
early dormant build reused an enabled transform cache. The invalid artifact was
discarded; the corrected dormant and enabled bundles have distinct hashes.

| Artifact                               | SHA-256 / result                                                   |
| -------------------------------------- | ------------------------------------------------------------------ |
| Correct dormant Android APK            | `1b9a0ca2e7f0198774738c0c792227af31478c8a8e203bb65f7832a365d04c77` |
| Dormant Android JS bundle              | `8ee2c95db1b06462b5fb9e41603bf42a640ed9105b8555b40f13f3d754dd45f2` |
| Final exact-tree enabled Android APK   | `f2529798630c7aefc1bb9d378323a1c4947a7250b3a0ff2d9640c2fd4765f1aa` |
| Final exact-tree enabled iOS JS bundle | `313ef52f89ea3599f9834c0d0411ac9656a29c7818e023cfcaf86d8e549e41f1` |
| Final iOS build log                    | `build-ios-true-1790022221509.log`, exit 0                         |
| Final Android build log                | `build-android-true-1790022266269.log`, exit 0                     |

The corrected dormant APK retained the synthetic account and legacy cards, synced
learning data, and emitted no dictionary Stage 2.5 work. Installing the enabled APK
with `-r` preserved the same Android account/data. Final exact-tree smoke passed on
iOS (`ios-1790022351637`) and Android (`android-1790022388812`).

## Platform matrix

### iOS — primary mobile platform

- Full fresh-state CEFR/materialization/sync flow passed:
  `ios-1790020779843`. The linked estimated card showed `CEFR A2 · estimated`,
  the reviewed card `CEFR B1`, and the private fallback card an unknown level.
- Owner switch primary → isolated → primary preserved account isolation and the
  original three-card/two-collection view; no foreign collection/card appeared.
- Offline correction preparation passed (`ios-1790020881157`). An online correction
  first confirmed protocol capability (`ios-1790021048825`), after which the API
  was physically stopped.
- Durable offline correction passed (`ios-1790021090198`): the UI proved that the
  change was already saved locally, SQLite held one pending correction, one recovery
  lock and one FIFO correction command.
- Cold-start restoration while still offline passed (`ios-1790021138541`). This
  reproduced and fixed a discovered deadlock where a corrected, no-longer-due word
  previously left the user at “No words for review”. A recovery session now reopens
  exactly that word without changing ordinary due-word selection.
- After reconnect, retry passed (`ios-1790021183678`). Local correction status was
  fully synced, the recovery lock was zero and the FIFO was empty. Server verification
  found exactly one event row and exactly one correction row for the synthetic IDs;
  the effective assessment was `good`, revision 2.
- Offline reset passed (`ios-1790021247408`), survived cold restart as `huis — New`
  (`ios-1790021318060`), and converged after reconnect/force-sync
  (`ios-1790021370821`). Local and server SRS state matched: interval 1,
  repetition 0, easiness 2.5, no last-review timestamp; FIFO count zero.

### Android

- Initial enabled flow passed before the final exact-tree rebuild
  (`android-1790018342593`), including all three CEFR states.
- Account-switch isolation passed (`android-1790018449455`).
- The corrected dormant client synced the same synthetic collection without the
  dictionary capability path. Upgrade to the enabled artifact preserved its local
  login/data. The final full enabled smoke with force-sync passed
  (`android-1790021655990`); exact-tree post-refactor smoke passed
  (`android-1790022388812`).

### Web and convergence

The loopback web client showed the same two collections, three words, due state and
streak as iOS. Resetting the private word from web was observed by iOS after sync,
without replacing shared-linked content or learning identity. This verifies the
currently supported web path and mobile/web convergence for D08; D09 new-web
effective-content integration and performance gates remain separate and pending.

## Findings fixed during QA

1. `reviewCorrectionSync` now persists a positive capability result per owner and
   backend. A known-supported client may enqueue the correction locally while
   offline; network errors do not erase the capability. A never-confirmed backend
   still requires an online safety probe.
2. Review start checks the durable correction recovery table before due-word
   selection. A pending correction reopens its owner-scoped word even when it is no
   longer due, allowing the correction controller to restore/retry after cold start.
   Account changes cancel stale asynchronous restoration.
3. Native build caches are isolated for enabled/dormant public environment values,
   preventing a false compatibility result from a reused Metro transform cache.
4. Strict CI warnings were removed through behavior-preserving helper extraction;
   no lint suppression or dependency was added.

## Final exact-tree gates

| Gate                             | Result                                             |
| -------------------------------- | -------------------------------------------------- |
| Mobile Jest                      | 141/141 suites, 1,620/1,620 tests, 22/22 snapshots |
| `npm run mobile:typecheck`       | passed                                             |
| `npm run mobile:typecheck:test`  | passed                                             |
| `npm run lint:ci`                | passed with zero warnings                          |
| `npm run format:check`           | passed                                             |
| D08 native YAML Prettier check   | passed                                             |
| `git diff --check`               | passed                                             |
| Final iOS/Android Release builds | passed                                             |
| Final exact-tree native smoke    | passed on both platforms                           |

Intermediate failures were test-infrastructure findings, not retained product
failures: a constrained Android build exhausted Metaspace, the first dormant APK
shared a Metro cache with the enabled build, and early Maestro flows used an iOS
`back` action or off-screen tap incorrectly. The build helper/flows were corrected;
only the passing run IDs above are acceptance evidence.

## Final review boundary

The documented subset passed on September 21. The September 26 closure review
changed runtime UI and identified acceptance gaps, so revised native builds and
the remaining matrix in `D08-closure-review.md` are required before marking the
stage done. Production flags and cutover remain forbidden by DEC-09.

### Exact-tree runtime fingerprints

- `reviewCorrectionSync.ts`: `519b907806f39963f0608bc18708a760b68086cc240286af7612776ec590d2ec`
- `correctionTransport.ts`: `ddc3633b0d1a48262795f59182e4ce9c6df7ddcd48cd2232df1d706973cf8b6e`
- `reviewActions.ts`: `e0b464222380bda9a90ae19dc46d91d65da59d82ee76740ff11bfe157209d7bd`
- `syncManager.ts`: `3aab6a9298c7cf0dc08bca28d6d8f008330dd88f2a59da4aa8cb08f1f76f58db`
- `dictionaryContentSync.ts`: `be2538b478db7001df57ce3e12d99c64ba55d61653ff2aa33fa0445da9ba4afe`
- `dictionaryContentRepository.ts`: `e4b524dd95d13ae54f3d84fa648c85fcd4131804198e98718f36cfdd0558da6b`
- `CefrBadge.tsx`: `4c3123deba07046f5c012cf2a547df01b10b5525d242ef8b45ebbb92ae3a5b68`
