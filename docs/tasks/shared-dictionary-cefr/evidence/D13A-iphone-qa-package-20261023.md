# D13A.7.6 isolated iPhone QA package — October 23, 2026

Status: signed, verified and installed beside the original app; device execution remains open.

Latest checkpoint: personal-team signing succeeded after the owner accepted the updated
agreement and reauthenticated in Xcode. All20 signed-artifact checks pass. Installation
and post-install inventory confirm separate Woordenaar QA2.4.0/85 and original
De Woordenaar2.4.0/85. No app launch or account action was performed.
Signed profile is a wildcard development profile for team7FQ395U52U; signed app
entitlements use the exact QA identifier and no shared keychain group. The sections
below retain the preparation history; the earlier signing-approval blocker is resolved.
Latest receipt:reports/shared-dictionary-cefr/d13a7-native-resume-20261023/iphone-signing-install-checkpoint.json.
The owner permits main-iPhone QA and app reinstall,provided the main account is not
used or changed. Read-only inventory after unlock confirms original2.4.0/build85.
The installed original has not been launched,removed,updated or signed into.

## Artifact and isolation

Separate APFS-cloned source: reports/shared-dictionary-cefr/woordenaar-d08-native.20261023iphone.
Release iphoneos build succeeds. Bundle identifier com.oldrefery.dutch-learning-app.d13aqa;
display name Woordenaar QA;only URL scheme dutchlearning-d13aqa. Runtime config agrees.
QA guard is true;OTA is disabled. JavaScript includes only the required QA server endpoint
192.168.178.106:55341 rather than the old127.0.0.1:55331 endpoint. No optional Apple Sign In
or shared keychain entitlement is requested. Device arm64 platform and separate framework
identifiers are verified. All678 mobile/domain/content source files match retained QA
and the current workspace;changes are confined to clone build/configuration inputs.

Twelve artifact checks pass.102 file digests seal the unsigned package;manifest SHA256:
fe7e61c5ef3be77810718f1e99971a8d9c79b2324bb5c83a41ab8a8322cec6fa.
JavaScript SHA256:2b53c6b0b5cb2cb349982d83ab11eb5d98273f02ebf84447aa3e24042dc6976a.
This is a new QA artifact,not the original85 binary or either published repair OTA.

The dedicated LAN relay has a fixed loopback-only upstream and allows password login
only for the two local synthetic fixture owners. Four checks pass:management endpoint,
signup and non-fixture login denied403;synthetic image200. No test login or real-account
request occurred. The relay was stopped after validation;the prior loopback stack/proxy
remains available. No LAN service is left waiting for approval.

## Retained setup defects

The initial isolated build passed compilation,but a global bundle-ID override also
changed Reachability.framework. Rejected before install;scoped identity to the app target,
then verified framework IDs. The next review rejected a stale Metro transform containing
the previous loopback endpoint. A dedicated empty QA cache and separate build temp directory
produced the final verified endpoint. Logs and rejected-build receipts remain retained.
No production source,repository cache or device installation was changed to repair these.

## Signing boundary and continuation

Personal team7FQ395U52U development certificate137FD9A9… expired2026-09-12. Its local
profile includes the iPhone but cannot use either available valid private-key identity:
both identities belong to work organizations. They must not sign this personal project.
The App Store85 profile is not a development install profile. No Apple portal,EAS,
certificate creation/revocation or provisioning update has been performed.

The concrete next approval is a new personal-team Apple Development certificate,
separate QA App ID and development profile for the already registered iPhone,then
signing and installing this separate QA app. Preserve all distribution profiles and
existing certificates. This can preserve the original app and main account entirely.
If account authentication is needed,it must be handled by the owner. After signing,
verify the team/profile/device/bundle/entitlements before installing;then execute
synthetic physical QA. Do not infer performance or exact-old-runtime acceptance.

Native representative performance remains unmeasured;the measurement contract is saved
separately. D13A.7 remains5/6 complete,1 checkpoint open;8 broad milestones remain.
Retain Astra/High and stop beforeD13A.8. No paid request,hosted migration,publication,
commit or push. All changes/evidence are local-only.

Machine evidence:reports/shared-dictionary-cefr/d13a7-native-resume-20261023/iphone-unsigned-artifact-review.json.
