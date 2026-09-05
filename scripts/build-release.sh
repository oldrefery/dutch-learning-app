#!/bin/bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOBILE_DIR="$REPO_ROOT/apps/mobile"
cd "$REPO_ROOT"

source "$(dirname "$0")/verify-eas-identity.sh"

PLATFORM="both"
CONFIRMED_BUILD_NUMBER=""
DRY_RUN="false"
APP_CONFIG_FILE=""

print_help() {
  cat <<'EOF'
Usage: scripts/build-release.sh --confirmed-build-number N [OPTIONS]

Build signed local release artifacts without submitting them.

Options:
  --platform ios|android|both      Platform to build (default: both).
  --confirmed-build-number N      Build number verified as unused in both stores.
  --dry-run                       Validate and print commands without building.
  --help                          Show this help.

Version preparation and store submission are separate commands:
  node scripts/prepare-release.js --version X.Y.Z --build N --apply
  scripts/submit-release.sh --platform both
EOF
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --platform)
      [ "$#" -ge 2 ] || fail "--platform requires a value"
      PLATFORM="$2"
      shift 2
      ;;
    --confirmed-build-number)
      [ "$#" -ge 2 ] || fail "--confirmed-build-number requires a value"
      CONFIRMED_BUILD_NUMBER="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help)
      print_help
      exit 0
      ;;
    --submit|--build-only)
      fail "$1 is no longer supported; build and submission are separate commands"
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

case "$PLATFORM" in
  ios|android|both) ;;
  *) fail "platform must be ios, android, or both" ;;
esac

[[ "$CONFIRMED_BUILD_NUMBER" =~ ^[0-9]+$ ]] || \
  fail "--confirmed-build-number must be a positive integer"
[ "$CONFIRMED_BUILD_NUMBER" -gt 0 ] || \
  fail "--confirmed-build-number must be a positive integer"

if [ -f "$MOBILE_DIR/app.json" ]; then
  APP_CONFIG_FILE="./apps/mobile/app.json"
elif [ -f "$MOBILE_DIR/app.base.json" ]; then
  APP_CONFIG_FILE="./apps/mobile/app.base.json"
else
  fail "app.json or app.base.json not found in apps/mobile"
fi

node scripts/prepare-release.js --check --require-clean

VERSION=$(node -p "require('${APP_CONFIG_FILE}').expo.version")
IOS_BUILD_NUMBER=$(node -p "require('${APP_CONFIG_FILE}').expo.ios.buildNumber")
ANDROID_BUILD_NUMBER=$(node -p "require('${APP_CONFIG_FILE}').expo.android.versionCode")
IOS_BUNDLE_ID=$(node -p "require('${APP_CONFIG_FILE}').expo.ios.bundleIdentifier")
ANDROID_BUNDLE_ID=$(node -p "require('${APP_CONFIG_FILE}').expo.android.package")
RUNTIME_POLICY=$(node -p "require('${APP_CONFIG_FILE}').expo.runtimeVersion?.policy || ''")

[ "$IOS_BUILD_NUMBER" = "$CONFIRMED_BUILD_NUMBER" ] || \
  fail "confirmed build $CONFIRMED_BUILD_NUMBER does not match iOS build $IOS_BUILD_NUMBER"
[ "$ANDROID_BUILD_NUMBER" = "$CONFIRMED_BUILD_NUMBER" ] || \
  fail "confirmed build $CONFIRMED_BUILD_NUMBER does not match Android build $ANDROID_BUILD_NUMBER"
[ "$RUNTIME_POLICY" = "fingerprint" ] || \
  fail "runtimeVersion.policy must be fingerprint for production builds"

IOS_ARTIFACT="builds/app-${VERSION}-${CONFIRMED_BUILD_NUMBER}.ipa"
ANDROID_ARTIFACT="builds/app-${VERSION}-${CONFIRMED_BUILD_NUMBER}.aab"

print_build_command() {
  local platform=$1
  local artifact=$2
  echo "(cd apps/mobile && NODE_ENV=production npx -y eas-cli@latest build --platform ${platform} --profile production --local --output ../../${artifact} --non-interactive --json)"
}

echo "Release build context: ${VERSION} (${CONFIRMED_BUILD_NUMBER}), platform=${PLATFORM}"
if [ "$DRY_RUN" = "true" ]; then
  [ "$PLATFORM" = "android" ] || print_build_command "ios" "$IOS_ARTIFACT"
  [ "$PLATFORM" = "ios" ] || print_build_command "android" "$ANDROID_ARTIFACT"
  echo "Dry run only; no directory, artifact, upload, or submission was created."
  exit 0
fi

verify_eas_identity

[ -f ".sentryclirc" ] || fail ".sentryclirc file not found in project root"
SENTRY_AUTH_TOKEN_CLI=$(awk -F= '/^token=/{print $2}' .sentryclirc)
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  [ -n "$SENTRY_AUTH_TOKEN_CLI" ] || fail "token not found in .sentryclirc"
  export SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN_CLI"
fi
export SENTRY_URL="${SENTRY_URL:-https://sentry.io/}"

mkdir -p builds
IOS_BUILT="false"
ANDROID_BUILT="false"

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  print_build_command "ios" "$IOS_ARTIFACT"
  (cd "$MOBILE_DIR" && NODE_ENV=production npx -y eas-cli@latest build \
      --platform ios \
      --profile production \
      --local \
      --output "$REPO_ROOT/$IOS_ARTIFACT" \
      --non-interactive \
      --json) > builds/ios-build-metadata.json
  IOS_BUILT="true"
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  print_build_command "android" "$ANDROID_ARTIFACT"
  (cd "$MOBILE_DIR" && NODE_ENV=production npx -y eas-cli@latest build \
      --platform android \
      --profile production \
      --local \
      --output "$REPO_ROOT/$ANDROID_ARTIFACT" \
      --non-interactive \
      --json) > builds/android-build-metadata.json
  ANDROID_BUILT="true"
fi

BUILD_COMMIT_SHA=$(git rev-parse HEAD)
BUILD_CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
node -e '
  const fs = require("fs");
  const context = {
    version: process.argv[2],
    iosBuildNumber: process.argv[3],
    androidBuildNumber: process.argv[4],
    platform: process.argv[5],
    appConfigFile: process.argv[6],
    commitSha: process.argv[7],
    createdAt: process.argv[8],
    runtimeVersionPolicy: process.argv[9],
    sentryDisableAutoUpload: process.argv[10] || "",
    iosBundleId: process.argv[11],
    androidBundleId: process.argv[12],
    built: {
      ios: process.argv[13] === "true",
      android: process.argv[14] === "true",
    },
    artifacts: {
      ios: process.argv[15],
      android: process.argv[16],
    },
  };
  fs.writeFileSync(process.argv[1], `${JSON.stringify(context, null, 2)}\n`);
' "builds/build-context.json" \
  "$VERSION" \
  "$IOS_BUILD_NUMBER" \
  "$ANDROID_BUILD_NUMBER" \
  "$PLATFORM" \
  "$APP_CONFIG_FILE" \
  "$BUILD_COMMIT_SHA" \
  "$BUILD_CREATED_AT" \
  "$RUNTIME_POLICY" \
  "${SENTRY_DISABLE_AUTO_UPLOAD:-}" \
  "$IOS_BUNDLE_ID" \
  "$ANDROID_BUNDLE_ID" \
  "$IOS_BUILT" \
  "$ANDROID_BUILT" \
  "$IOS_ARTIFACT" \
  "$ANDROID_ARTIFACT"

if [ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" = "true" ]; then
  SENTRY_ENFORCE_BUILD_CONTEXT=true scripts/upload-sourcemaps.sh --platform "$PLATFORM"
else
  echo "Sentry source maps were handled during native bundling."
fi

echo "Build completed without store submission."
echo "Review artifacts and then run: scripts/submit-release.sh --platform ${PLATFORM}"
