# Archived build 85 and repair clients: physical isolated compatibility

Six physical iPhone tests pass: online hydration and offline restart for original build85
bytecode, AUTH28 repair bytecode, and AUTH29 repair bytecode. Actual XCTest exit0 and
1 passed/0 failed/0 skipped for every test. Screenshots from all three offline cases
were inspected and show the current shared translation and original learning state.

## Artifact identity and isolation

The native runtime comes from the archived build85 IPA. All instruction/data sections
of its ten Mach-O binaries are unchanged after QA signing. Each archived Hermes98
bundle retains its instruction bytes and length. The only bytecode ranges changed
are the40-byte backend URL literal and20-byte footer checksum;55 bytes differ per
bundle. Original and derived SHA1 footer checks pass. All45 repair asset identifiers
exist in the archived native package. The signed112-file manifests were rechecked
against the tested packages after execution.

Separate com.oldrefery.dutch-learning-app.d13aqa identity, personal-team QA profile,
QA-only entitlements and runtime configuration isolate these tests from the main app.
The fixed LAN relay forwards only to the local synthetic QA stack and accepts only
the two fixture subjects. Native OTA and Sentry are disabled for these derivatives.
No main application/account was opened, signed out, modified, deleted or reinstalled.

These are configuration-isolated derivatives, not byte-identical signed store/OTA
artifacts. They establish archived parser/repository/native SQLite compatibility;
they do not establish native OTA activation or delivery to the production cohort.
The contract section5 requirement concerns exact archived parsers plus SQLite
dependencies. Their executable instructions are preserved, with the isolation
changes explicitly recorded. Production delivery/activation remains outside this QA
qualification and within later release gates; D13A.8 has not started.

## Assertions and preservation

Before each variant, the saved functional QA database was restored with26 words,
24 active words,7 collections,7 review events and no v1 dictionary-card rows. Online
sync hydrates12 v1 cache rows. The following word points at revision
d8877de8-21a5-49ce-ab37-f3c5840ae185 with empty overrides, and displays
“QA shared bicycle pump two”. With the relay stopped, a new process displays the
same content from SQLite. All word/event identifiers and data match the saved
fixture; only expected local synced_at timestamps change. The seven server events
remain seven with the same identifiers. No answer or content command was submitted.

The QA Documents/Library backup is private. The first attempt to copy the container
root using '.' was rejected by CoreDevice; separate directory copies succeeded.
A first preservation assertion included synced_at and therefore failed; the retained
diff proves those timestamps are the only differences. Semantic data assertions
exclude exactly that field, not arbitrary metadata or learning fields.

Existing exact-source probes remain complementary evidence:12 SQLite head-delivery,
18 pending-command preservation and9 learning-order cases. They are not relabelled
as physical-device tests. No production cohort is converted by this qualification.

Evidence:reports/shared-dictionary-cefr/d13a7-native-resume-20261023/legacy-isolation-review/
runtime-review.json,prepared-packet.json,bytecode-config-delta-review.json,
_-native-sections.json,_-signed-manifest.json and legacy-*-data-review.json.
D13A.7.6 still awaits the final performance matrix and updated Android list check.
