#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- CONFIGURATIOM ---
SENTRY_ORG="oldrefery"
SENTRY_PROJECT="dutch-learning-app"

echo "🔍 Sourcemap upload script for Sentry"
echo ""

# Check if .sentryclirc exists
if [ ! -f ".sentryclirc" ]; then
    echo -e "${RED}Error: .sentryclirc file not found in project root${NC}"
    echo -e "${YELLOW}Please create a .sentryclirc file with your Sentry auth token${NC}"
    exit 1
fi

# Get values from app.json
VERSION=$(node -p "require('./app.json').expo.version")
IOS_BUILD_NUMBER=$(node -p "require('./app.json').expo.ios.buildNumber")
ANDROID_BUILD_NUMBER=$(node -p "require('./app.json').expo.android.versionCode")
IOS_BUNDLE_ID=$(node -p "require('./app.json').expo.ios.bundleIdentifier")
ANDROID_BUNDLE_ID=$(node -p "require('./app.json').expo.android.package")

echo -e "${BLUE}Current app configuration:${NC}"
echo -e "Version: ${VERSION}"
echo -e "iOS Build: ${IOS_BUILD_NUMBER}"
echo -e "Android Build: ${ANDROID_BUILD_NUMBER}"
echo ""

# Function to generate sourcemaps and upload to Sentry
create_and_upload() {
  local platform=$1
  local bundle_id=$2
  local build_number=$3

  echo -e "${GREEN}Processing $platform release...${NC}"

  local release_name="${bundle_id}@${VERSION}+${build_number}"
  local platform_lower=$(echo "$platform" | tr '[:upper:]' '[:lower:]')
  local output_dir="builds/sourcemaps-$platform_lower"
  local bundle_file="$output_dir/index.$platform_lower.bundle"
  local sourcemap_file="$output_dir/index.$platform_lower.bundle.map"

  echo -e "${YELLOW}Creating release: ${release_name}${NC}"

  # Create release in Sentry
  npx sentry-cli releases new "$release_name" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" || echo -e "${YELLOW}Release may already exist${NC}"

  # Create output directory
  rm -rf "$output_dir"
  mkdir -p "$output_dir"

  # Generate bundle with sourcemaps
  echo -e "${BLUE}Generating $platform bundle and sourcemaps...${NC}"

  if [ "$platform_lower" == "ios" ]; then
    npx expo export:embed --platform ios --dev false --bundle-output "$bundle_file" --sourcemap-output "$sourcemap_file"
  else
    npx expo export:embed --platform android --dev false --bundle-output "$bundle_file" --sourcemap-output "$sourcemap_file"
  fi

  # Check if sourcemap was generated
  if [ ! -f "$sourcemap_file" ]; then
    echo -e "${RED}❌ Failed to generate sourcemap for $platform${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Generated sourcemap: $sourcemap_file${NC}"

  # Upload sourcemaps to Sentry
  echo -e "${BLUE}Uploading $platform sourcemaps to Sentry...${NC}"

  npx sentry-cli releases files "$release_name" upload-sourcemaps \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" \
    --dist "$build_number" \
    --strip-prefix "builds/sourcemaps-$platform_lower/" \
    "$output_dir"

  # Set release version
  npx sentry-cli releases set-commits "$release_name" --auto \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" || echo -e "${YELLOW}Warning: Could not set commits for release${NC}"

  # Finalize the release
  npx sentry-cli releases finalize "$release_name" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT"

  echo -e "${GREEN}✅ $platform sourcemaps uploaded successfully!${NC}"
  echo -e "${BLUE}Release: ${release_name}${NC}"

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
            echo "Examples:"
            echo "  $0                             Generate and upload sourcemaps for both platforms"
            echo "  $0 --platform ios             Generate and upload only for iOS"
            echo "  $0 --platform android         Generate and upload only for Android"
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

echo -e "${BLUE}Generating sourcemaps for platform(s): ${PLATFORM}${NC}"
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
