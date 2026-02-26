#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- CONFIGURATION ---
SENTRY_ORG="${SENTRY_ORG:-oldrefery}"
SENTRY_PROJECT="${SENTRY_PROJECT:-dutch-learning-app}"
SENTRY_CLI="npx -y sentry-cli"
SENTRY_ENABLE_RELEASE_FLOW="${SENTRY_ENABLE_RELEASE_FLOW:-true}"
SENTRY_ENFORCE_BUILD_CONTEXT="${SENTRY_ENFORCE_BUILD_CONTEXT:-false}"
SENTRY_ALLOW_COMMIT_MISMATCH="${SENTRY_ALLOW_COMMIT_MISMATCH:-false}"
SENTRY_FORCE_RESET_CACHE="${SENTRY_FORCE_RESET_CACHE:-true}"
SENTRY_AUTH_TOKEN_CLI=""
BUILD_CONTEXT_FILE="builds/build-context.json"

echo "🔍 Sourcemap upload script for Sentry"
echo ""

# Resolve Expo config file (app.json or app.base.json)
if [ -f "./app.json" ]; then
    APP_CONFIG_FILE="./app.json"
elif [ -f "./app.base.json" ]; then
    APP_CONFIG_FILE="./app.base.json"
else
    echo -e "${RED}Error: app.json or app.base.json not found in project root${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Using Expo config: ${APP_CONFIG_FILE}${NC}"

# Check if .sentryclirc exists
if [ ! -f ".sentryclirc" ]; then
    echo -e "${RED}Error: .sentryclirc file not found in project root${NC}"
    echo -e "${YELLOW}Please create a .sentryclirc file with your Sentry auth token${NC}"
    exit 1
fi

SENTRY_AUTH_TOKEN_CLI=$(awk -F= '/^token=/{print $2}' .sentryclirc)
if [ -z "$SENTRY_AUTH_TOKEN_CLI" ]; then
    echo -e "${RED}Error: token not found in .sentryclirc${NC}"
    exit 1
fi

print_sentry_auth_help() {
  if is_release_flow_enabled; then
    echo -e "${YELLOW}Required token scopes for release flow:${NC} project:releases, org:read"
  else
    echo -e "${YELLOW}Required token scopes for artifact bundle upload:${NC} org:ci (or broader project upload scopes)"
  fi
  echo -e "${YELLOW}Also verify token belongs to org '${SENTRY_ORG}' and has access to project '${SENTRY_PROJECT}'.${NC}"
}

is_true_flag() {
  case "$1" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

is_release_flow_enabled() {
  is_true_flag "$SENTRY_ENABLE_RELEASE_FLOW"
}

run_sentry_or_fail() {
  local action="$1"
  shift

  local output
  if ! output=$($SENTRY_CLI --auth-token "$SENTRY_AUTH_TOKEN_CLI" "$@" 2>&1); then
    echo "$output"

    if echo "$output" | grep -Eiq "http status: 403|do not have permission"; then
      echo -e "${RED}❌ Sentry permission error (403) while ${action}${NC}"
      print_sentry_auth_help
    else
      echo -e "${RED}❌ Sentry command failed while ${action}${NC}"
    fi

    return 1
  fi

  [ -n "$output" ] && echo "$output"
}

load_build_context() {
  local context_file=$1
  if [ ! -f "$context_file" ]; then
    return 1
  fi

  local context_values
  if ! context_values=$(node -e "
      const fs = require('fs');
      const context = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const values = [
        String(context.version ?? ''),
        String(context.iosBuildNumber ?? context.buildNumber ?? ''),
        String(context.androidBuildNumber ?? context.buildNumber ?? ''),
        String(context.iosBundleId ?? ''),
        String(context.androidBundleId ?? ''),
        String(context.commitSha ?? ''),
        String(context.createdAt ?? ''),
        String(context.sentryDisableAutoUpload ?? ''),
        String(Boolean(context.built?.ios)),
        String(Boolean(context.built?.android))
      ];
      console.log(values.join('\\n'));
    " "$context_file" 2>/dev/null); then
    echo -e "${RED}Error: failed to parse build context at ${context_file}${NC}"
    return 1
  fi

  mapfile -t context_parts <<< "$context_values"
  CONTEXT_VERSION="${context_parts[0]}"
  CONTEXT_IOS_BUILD_NUMBER="${context_parts[1]}"
  CONTEXT_ANDROID_BUILD_NUMBER="${context_parts[2]}"
  CONTEXT_IOS_BUNDLE_ID="${context_parts[3]}"
  CONTEXT_ANDROID_BUNDLE_ID="${context_parts[4]}"
  CONTEXT_COMMIT_SHA="${context_parts[5]}"
  CONTEXT_CREATED_AT="${context_parts[6]}"
  CONTEXT_SENTRY_DISABLE_AUTO_UPLOAD="${context_parts[7]}"
  CONTEXT_BUILT_IOS="${context_parts[8]}"
  CONTEXT_BUILT_ANDROID="${context_parts[9]}"
  return 0
}

ensure_context_has_platform() {
  local platform=$1
  if [ "$platform" == "ios" ] && [ "$CONTEXT_BUILT_IOS" != "true" ]; then
    return 1
  fi
  if [ "$platform" == "android" ] && [ "$CONTEXT_BUILT_ANDROID" != "true" ]; then
    return 1
  fi
  return 0
}

# Get values from app.json
APP_VERSION=$(node -p "require('${APP_CONFIG_FILE}').expo.version")
APP_IOS_BUILD_NUMBER=$(node -p "require('${APP_CONFIG_FILE}').expo.ios.buildNumber")
APP_ANDROID_BUILD_NUMBER=$(node -p "require('${APP_CONFIG_FILE}').expo.android.versionCode")
APP_IOS_BUNDLE_ID=$(node -p "require('${APP_CONFIG_FILE}').expo.ios.bundleIdentifier")
APP_ANDROID_BUNDLE_ID=$(node -p "require('${APP_CONFIG_FILE}').expo.android.package")

VERSION="$APP_VERSION"
IOS_BUILD_NUMBER="$APP_IOS_BUILD_NUMBER"
ANDROID_BUILD_NUMBER="$APP_ANDROID_BUILD_NUMBER"
IOS_BUNDLE_ID="$APP_IOS_BUNDLE_ID"
ANDROID_BUNDLE_ID="$APP_ANDROID_BUNDLE_ID"
CONFIG_SOURCE="app config"

# Function to generate sourcemaps and upload to Sentry
create_and_upload() {
  local platform=$1
  local bundle_id=$2
  local build_number=$3

  echo -e "${GREEN}Processing $platform release...${NC}"

  local release_name
  release_name="${bundle_id}@${VERSION}+${build_number}"

  local platform_lower
  platform_lower=$(echo "$platform" | tr '[:upper:]' '[:lower:]')
  local output_dir="builds/sourcemaps-$platform_lower"
  local runtime_bundle_name="index.$platform_lower.bundle"
  if [ "$platform_lower" == "ios" ]; then
    runtime_bundle_name="main.jsbundle"
  fi
  local bundle_file="$output_dir/$runtime_bundle_name"
  local sourcemap_file="$output_dir/$runtime_bundle_name.map"

  if is_release_flow_enabled; then
    echo -e "${YELLOW}Creating release: ${release_name}${NC}"

    # Create release in Sentry (tolerate "already exists", fail on real errors).
    local create_output=""
    if ! create_output=$($SENTRY_CLI releases new "$release_name" \
      --auth-token "$SENTRY_AUTH_TOKEN_CLI" \
      --org "$SENTRY_ORG" \
      --project "$SENTRY_PROJECT" 2>&1); then
      if echo "$create_output" | grep -Eiq "already exists"; then
        echo -e "${YELLOW}Release already exists, continuing...${NC}"
      else
        echo "$create_output"
        if echo "$create_output" | grep -Eiq "http status: 403|do not have permission"; then
          echo -e "${RED}❌ Sentry permission error (403) while creating release${NC}"
          print_sentry_auth_help
        else
          echo -e "${RED}❌ Failed to create release ${release_name}${NC}"
        fi
        return 1
      fi
    else
      [ -n "$create_output" ] && echo "$create_output"
    fi
  fi

  # Create output directory
  rm -rf "$output_dir"
  mkdir -p "$output_dir"

  # Generate bundle with sourcemaps
  echo -e "${BLUE}Generating $platform bundle and sourcemaps...${NC}"
  local embed_args=(--platform "$platform_lower" --dev false --bundle-output "$bundle_file" --sourcemap-output "$sourcemap_file")
  if is_true_flag "$SENTRY_FORCE_RESET_CACHE"; then
    embed_args+=(--reset-cache)
  fi
  SENTRY_DISABLE_AUTO_UPLOAD=true npx expo export:embed "${embed_args[@]}"

  # Check if sourcemap was generated
  if [ ! -f "$sourcemap_file" ]; then
    echo -e "${RED}❌ Failed to generate sourcemap for $platform${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Generated sourcemap: $sourcemap_file${NC}"

  echo -e "${BLUE}Uploading $platform sourcemaps to Sentry...${NC}"
  if is_release_flow_enabled; then
    run_sentry_or_fail "uploading sourcemaps" sourcemaps upload "$output_dir" \
      --org "$SENTRY_ORG" \
      --project "$SENTRY_PROJECT" \
      --release "$release_name" \
      --dist "$build_number" \
      --url-prefix "app:///" \
      --rewrite \
      --validate \
      --wait

    # Set release version
    $SENTRY_CLI releases set-commits "$release_name" --auto \
      --auth-token "$SENTRY_AUTH_TOKEN_CLI" \
      --org "$SENTRY_ORG" \
      --project "$SENTRY_PROJECT" || echo -e "${YELLOW}Warning: Could not set commits for release${NC}"

    # Finalize the release
    run_sentry_or_fail "finalizing release" releases finalize "$release_name" \
      --org "$SENTRY_ORG" \
      --project "$SENTRY_PROJECT"
  else
    run_sentry_or_fail "uploading sourcemaps" sourcemaps upload "$output_dir" \
      --org "$SENTRY_ORG" \
      --project "$SENTRY_PROJECT" \
      --strip-common-prefix \
      --validate \
      --wait
  fi

  echo -e "${GREEN}✅ $platform sourcemaps uploaded successfully!${NC}"
  if is_release_flow_enabled; then
    echo -e "${BLUE}Release: ${release_name}${NC}"
  else
    echo -e "${BLUE}Upload mode: artifact bundle (Debug IDs)${NC}"
  fi

  # Cleanup
  echo -e "${YELLOW}Cleaning up temporary files...${NC}"
  rm -rf "$output_dir"
}

# Parse command line arguments
PLATFORM="both"
while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --platform [ios|android|both]  Generate sourcemaps for specific platform (default: both)"
            echo "  --help                         Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  SENTRY_ENABLE_RELEASE_FLOW=true|false  Enable/disable release+dist upload (default: true)"
            echo "  SENTRY_ENFORCE_BUILD_CONTEXT=true|false  Fail if builds/build-context.json is missing (default: false)"
            echo "  SENTRY_ALLOW_COMMIT_MISMATCH=true|false  Allow uploading with different git HEAD than build context (default: false)"
            echo "  SENTRY_FORCE_RESET_CACHE=true|false  Pass --reset-cache to expo export:embed (default: true)"
            echo ""
            echo "Examples:"
            echo "  $0                             Generate and upload sourcemaps for both platforms"
            echo "  $0 --platform ios             Generate and upload only for iOS"
            echo "  $0 --platform android         Generate and upload only for Android"
            echo "  SENTRY_ENABLE_RELEASE_FLOW=false $0 --platform ios"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate platform argument
if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" && "$PLATFORM" != "both" ]]; then
    echo -e "${RED}Error: Platform must be 'ios', 'android', or 'both'${NC}"
    exit 1
fi

if load_build_context "$BUILD_CONTEXT_FILE"; then
  CONFIG_SOURCE="build context (${BUILD_CONTEXT_FILE})"
  VERSION="$CONTEXT_VERSION"
  IOS_BUILD_NUMBER="$CONTEXT_IOS_BUILD_NUMBER"
  ANDROID_BUILD_NUMBER="$CONTEXT_ANDROID_BUILD_NUMBER"
  IOS_BUNDLE_ID="$CONTEXT_IOS_BUNDLE_ID"
  ANDROID_BUNDLE_ID="$CONTEXT_ANDROID_BUNDLE_ID"

  echo -e "${GREEN}✓ Using build context from ${BUILD_CONTEXT_FILE}${NC}"
  if [ -n "$CONTEXT_COMMIT_SHA" ]; then
    CURRENT_GIT_HEAD=$(git rev-parse HEAD 2>/dev/null || true)
    if [ -n "$CURRENT_GIT_HEAD" ] && [ "$CURRENT_GIT_HEAD" != "$CONTEXT_COMMIT_SHA" ]; then
      if is_true_flag "$SENTRY_ALLOW_COMMIT_MISMATCH"; then
        echo -e "${YELLOW}Warning: git HEAD (${CURRENT_GIT_HEAD}) differs from build commit (${CONTEXT_COMMIT_SHA}), but mismatch is allowed.${NC}"
      else
        echo -e "${RED}Error: git HEAD (${CURRENT_GIT_HEAD}) differs from build commit (${CONTEXT_COMMIT_SHA}).${NC}"
        echo -e "${YELLOW}Checkout the build commit or rerun build before uploading sourcemaps.${NC}"
        echo -e "${YELLOW}Override only if intentional: SENTRY_ALLOW_COMMIT_MISMATCH=true $0 --platform ${PLATFORM}${NC}"
        exit 1
      fi
    fi
  fi

  if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
    if ! ensure_context_has_platform "ios"; then
      echo -e "${RED}Error: build context does not contain an iOS build.${NC}"
      exit 1
    fi
  fi
  if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
    if ! ensure_context_has_platform "android"; then
      echo -e "${RED}Error: build context does not contain an Android build.${NC}"
      exit 1
    fi
  fi

  if ! is_true_flag "$CONTEXT_SENTRY_DISABLE_AUTO_UPLOAD"; then
    echo -e "${YELLOW}Warning: build was created without SENTRY_DISABLE_AUTO_UPLOAD=true. Manual upload can duplicate artifacts.${NC}"
  fi
else
  if is_true_flag "$SENTRY_ENFORCE_BUILD_CONTEXT"; then
    echo -e "${RED}Error: ${BUILD_CONTEXT_FILE} not found, and SENTRY_ENFORCE_BUILD_CONTEXT=true.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}Warning: ${BUILD_CONTEXT_FILE} not found, falling back to values from ${APP_CONFIG_FILE}.${NC}"
fi

echo -e "${BLUE}Sourcemap source configuration (${CONFIG_SOURCE}):${NC}"
echo -e "Version: ${VERSION}"
echo -e "iOS Build: ${IOS_BUILD_NUMBER}"
echo -e "Android Build: ${ANDROID_BUILD_NUMBER}"
echo ""

echo -e "${BLUE}Generating sourcemaps for platform(s): ${PLATFORM}${NC}"
if is_release_flow_enabled; then
  echo -e "${BLUE}Upload mode: release + artifact bundle${NC}"
else
  echo -e "${BLUE}Upload mode: artifact bundle (Debug IDs only)${NC}"
  echo -e "${YELLOW}Warning: use this mode only if events contain debug_meta/debug IDs.${NC}"
fi
echo ""

echo -e "${BLUE}Validating Sentry token...${NC}"
run_sentry_or_fail "verifying token access" info >/dev/null
echo -e "${GREEN}✓ Sentry access check passed${NC}"
echo ""

# --- EXECUTION ---
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
    create_and_upload "iOS" "$IOS_BUNDLE_ID" "$IOS_BUILD_NUMBER"
    echo ""
fi

if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
    create_and_upload "Android" "$ANDROID_BUNDLE_ID" "$ANDROID_BUILD_NUMBER"
    echo ""
fi

echo -e "${GREEN}🎉 All sourcemaps have been generated and uploaded to Sentry!${NC}"
