#!/bin/bash

set -euo pipefail

source "$(dirname "$0")/verify-eas-identity.sh"

PLATFORM="both"
CONTEXT_FILE="builds/build-context.json"
DRY_RUN="false"

print_help() {
  cat <<'EOF'
Usage: scripts/submit-release.sh [OPTIONS]

Submit exact artifacts from a verified release build context.

Options:
  --platform ios|android|both  Platform to submit (default: both).
  --context FILE              Build context (default: builds/build-context.json).
  --dry-run                   Validate and print commands without submitting.
  --help                      Show this help.

This command uploads to internal store tracks only. It does not promote a
release publicly and does not create or push a Git tag.
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
    --context)
      [ "$#" -ge 2 ] || fail "--context requires a value"
      CONTEXT_FILE="$2"
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
    *)
      fail "unknown option: $1"
      ;;
  esac
done

case "$PLATFORM" in
  ios|android|both) ;;
  *) fail "platform must be ios, android, or both" ;;
esac

[ -f "$CONTEXT_FILE" ] || fail "build context not found: $CONTEXT_FILE"
node scripts/prepare-release.js --check --require-clean

CONTEXT_VALUES=$(node -e '
  const fs = require("fs");
  const context = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const values = [
    context.version,
    context.iosBuildNumber,
    context.androidBuildNumber,
    context.commitSha,
    Boolean(context.built?.ios),
    Boolean(context.built?.android),
    context.artifacts?.ios || "",
    context.artifacts?.android || "",
  ];
  console.log(values.map(value => String(value ?? "")).join("\n"));
' "$CONTEXT_FILE")

CONTEXT_PARTS=()
while IFS= read -r line; do
  CONTEXT_PARTS+=("$line")
done <<EOF
$CONTEXT_VALUES
EOF

CONTEXT_VERSION="${CONTEXT_PARTS[0]}"
CONTEXT_IOS_BUILD="${CONTEXT_PARTS[1]}"
CONTEXT_ANDROID_BUILD="${CONTEXT_PARTS[2]}"
CONTEXT_COMMIT="${CONTEXT_PARTS[3]}"
CONTEXT_BUILT_IOS="${CONTEXT_PARTS[4]}"
CONTEXT_BUILT_ANDROID="${CONTEXT_PARTS[5]}"
IOS_ARTIFACT="${CONTEXT_PARTS[6]}"
ANDROID_ARTIFACT="${CONTEXT_PARTS[7]}"

APP_VERSION=$(node -p "require('./app.base.json').expo.version")
APP_IOS_BUILD=$(node -p "require('./app.base.json').expo.ios.buildNumber")
APP_ANDROID_BUILD=$(node -p "require('./app.base.json').expo.android.versionCode")
CURRENT_COMMIT=$(git rev-parse HEAD)

[ "$CONTEXT_VERSION" = "$APP_VERSION" ] || fail "build context version does not match app config"
[ "$CONTEXT_IOS_BUILD" = "$APP_IOS_BUILD" ] || fail "build context iOS build does not match app config"
[ "$CONTEXT_ANDROID_BUILD" = "$APP_ANDROID_BUILD" ] || fail "build context Android build does not match app config"
[ "$CONTEXT_COMMIT" = "$CURRENT_COMMIT" ] || fail "build context commit does not match HEAD"

if [ "$DRY_RUN" != "true" ]; then
  verify_eas_identity
fi

submit_platform() {
  local platform=$1
  local built=$2
  local artifact=$3

  [ "$built" = "true" ] || fail "$platform artifact was not produced by this build context"
  [ -f "$artifact" ] || fail "$platform artifact not found: $artifact"

  echo "npx -y eas-cli@latest submit --platform ${platform} --profile production --path ${artifact} --non-interactive"
  if [ "$DRY_RUN" != "true" ]; then
    npx -y eas-cli@latest submit \
      --platform "$platform" \
      --profile production \
      --path "$artifact" \
      --non-interactive
  fi
}

[ "$PLATFORM" = "android" ] || submit_platform "ios" "$CONTEXT_BUILT_IOS" "$IOS_ARTIFACT"
[ "$PLATFORM" = "ios" ] || submit_platform "android" "$CONTEXT_BUILT_ANDROID" "$ANDROID_ARTIFACT"

if [ "$DRY_RUN" = "true" ]; then
  echo "Dry run only; no artifact was submitted."
else
  echo "Submission completed to the configured internal store tracks."
fi
